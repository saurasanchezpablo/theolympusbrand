# Performance, one service, incremental builds

What was measured, what changed, and what it bought: the site and the map
in the browser, the house's server, and the build. Every number here was
measured on the development machine (8 threads, no GPU: the browser draws
WebGL in software, SwiftShader), with the tools named beside it. Numbers
from software rendering say where the time goes, not how a real graphics
card will feel.

## The build

Measured with `npm run build:profile` (`node scripts/build.ts all --profile`).

| | Before | After |
|---|---|---|
| Everything, from nothing | 132.8 s, one step after another | 46.1 s (4 at once, empty cache) |
| Everything again, nothing changed | 132.8 s (everything ran) | 0.29 s |
| Screens (master) | 75.5 s | 27 s cold, 14.5 s with the marble cache |
| Integrations | 14.3 s | 4.0 s |
| The map | 1.94 s | 0.64 s |
| The site (map + bundle) | 4.11 s | 0.95 s first, 0.3 s repeated |
| A building moved, published by the server | — (the separate builder rebuilt the map and the whole site) | 3.8 s from the save to the new release |

Where the time went, and what was done:

- **Nothing was ever skipped.** `scripts/build.ts` gives each step a key
  made of everything it is made from: the code it runs (the import closure of
  its script, followed through every relative import), the lockfile, its
  inputs (the catalogue, the server's data, the documents) and the outputs of
  the steps before it. A step whose key is unchanged and whose outputs are
  still exactly what it left (re-hashed on every build) is skipped. Services
  and each service's screens are steps of their own: a service changed
  rebuilds that service, its screens, and what lists every service.
- **One step at a time.** Independent steps run together (4 by default,
  `--jobs`).
- **The marble grounds** (wallpapers, boot screens, integration
  backgrounds) were drawn row by row on one thread, the same pictures again
  for every size and service. They are now drawn by a pool of worker threads
  and kept on disk by size and tone (`.cache/marble/`), byte-identical.
- **The island** was computed from noise on every map build and every
  editor start: now kept in `.cache/island/` (exact heights, not the
  16-bit file), keyed by its code.
- **The bundle** was rebuilt by Vite for every site build: now built once per
  version of the page's code (`.cache/bundle/`). The site is put together
  from it and the published files (`scripts/lib/site.ts`); a new release
  links every unchanged file from the release before, so publishing a moved
  building writes a handful of files.
- **Compression** happens once per content (`.cache/compressed/`), brotli
  and gzip, on zlib's threads.

Correctness checks: a clean build and an incremental one give the same bytes
(`tests/build-graph.test.ts` on the map; CI rebuilds everything and fails
on any difference with the committed files); an output altered or deleted by
hand makes its step run again; the site put together from the cache was
compared file by file with the old Vite build (identical).

## One service

Before: three containers (an nginx web server, a builder, the map's edit
service on its own port) and a proxy rule joining them. The page learned a
change was done by watching a file.

After: `scripts/serve.ts` (`npm start`, or the one Docker image) serves the
site, answers the map's edit API under `/api/` on the same origin, and
rebuilds and publishes the site itself (`scripts/lib/rebuilder.ts`):

- each change saved gets a number; changes within 1.5 s, or during a build,
  are built together; builds never overlap;
- a build writes a new release; it replaces the served one in a single step
  (a symbolic link turned), only if it succeeded and only if it differs —
  a failed build leaves the last good release served and says why;
- `/build.json` gives the last change requested and the last one published;
  the map's page shows *saved on the server, publishing…* and then *saved and
  published* only when the release that includes its change is served;
- the numbers continue across restarts; the data folder (`OLYMPUS_DATA`) and
  the releases are kept in volumes, so a new container serves at once.

Static files are served from the release with the compressed copy the
browser accepts, an ETag (304 on revalidation), the built scripts cached for
a year, everything else revalidated, ranges for the downloads, and the
house's security headers. Checked by `tests/serve.test.ts`,
`tests/rebuild.test.ts`, and both browser checks, which now run against this
server.

| Transferred (bytes on the wire) | Before (nginx gzip or none) | After (brotli) |
|---|---|---|
| The map's land (`terrain.bin`, 781 kB) | 285 kB (gzip) | 275 kB |

## In the browser

Measured with `node scripts/dev/perf-browser.ts <url> <out.json>` (Chrome
headless, SwiftShader, an empty cache each time; desktop 1440×900, tablet
768×1024 at 2× CPU slowdown, phone 390×844 at 4×). One run each, before and after: differences under
about 20 % are within the noise of a single run.

- **Before:** `vite preview` on the built site (no compression), the
  separate edit service not running.
- **After:** `scripts/serve.ts` on a release made by `scripts/build.ts
  release`, with its brotli copies.

| Page, size | Measure | Before | After |
|---|---|---|---|
| Home, desktop | Bytes transferred | 2065 kB | 836 kB |
| Home, desktop | Main-thread task time to ready | 2224 ms | 1171 ms |
| Home, desktop | Work while idle (task ms per 10 s) | 560 | 267 |
| Home, phone | Work while idle (task ms per 10 s) | 1450 | 856 |
| Home, phone | Load | 748 ms | 1196 ms (worse; see below) |
| Map, desktop | Bytes transferred | 1253 kB | 718 kB |
| Map, desktop | Ready (first frame drawn) | 7160 ms | 4409 ms |
| Map, desktop | Largest paint | 7040 ms | 476 ms |
| Map, desktop | Triangles drawn | 1 502 k | 1 016 k |
| Map, tablet | Ready | 8257 ms | 6024 ms |
| Map, tablet | Heap | 67.8 MB | 14.7 MB |
| Map, phone | Ready | 7033 ms | 5597 ms |
| Catalogue, phone | Largest paint | 2832 ms | 1748 ms |
| Atelier, desktop | Bytes transferred | 410 kB | 385 kB |

What made the differences:

- **Compression and caching** (the server): text, scripts, the medallion's
  STL and the map's data now travel as brotli. The home page transfers less
  than half; the map 43 % less.
- **The land under the sea is not drawn.** 62.5 % of the island's height
  grid lies wholly beneath the sea, which is opaque: those cells are now left
  out of the land mesh (486 k triangles), after the normals are computed, so
  the coast looks the same. The browser check measures 1 602 k → 1 116 k
  triangles on its own view.
- **Off-screen motion stops.** The home page's cloud bank and its band of
  names were animated by CSS for as long as the page was open, even when
  scrolled away; an IntersectionObserver now pauses them out of view. This
  is the drop in work while idle.
- **The map's chunk.** The map shared a 114 kB chunk with the Atelier's
  geometry; it now imports the catalogue's categories from their own module
  (`src/catalog/categories.ts`), and the shared chunk is 2 kB.
- **The map's start is measured.** `olympusMapStats().startup` gives each
  phase in ms (setup, land, forest, city, people, items, first frame) — on
  the desktop run: 105 / 91 / 176 / 52 / 5 / 100 / 505.

Where it got worse: the phone home page's load (748 → 1196 ms) and its
largest paint (2972 → 3380 ms). The page and its bytes are smaller, so this is
most likely the noise of a single run, but that has not been confirmed:
repeat runs were not made.

## What was not changed, and why

- **Frame rate.** In software rendering the map draws 1–3 frames a second
  before and after; it says nothing about a graphics card. The triangle and
  draw-call counts are what can be compared: 88 draw calls on the desktop.
- **The forest** is the longest phase of the map's start (176 ms desktop,
  604 ms phone). It is instanced already; drawing fewer trees would change
  the picture, which is the owner's call.
- **Shader compilation** (`compileAsync`) was not tried: the first frame
  takes about half a second here, and the gain could not be measured without
  a GPU.
- **The Docker image** has not been built on this machine (the disk is
  full); CI builds it, runs it, checks `/build.json`, the site, the API, and
  that a new container keeps the data.
- **The first build of a new server** still takes minutes when its cache is
  empty: every service's screens are drawn (99 s of the first release's
  105 s here). The image ships with a warm cache for the house's own
  services.
- **The baseline browser numbers** were taken before this work began and
  kept in the session's scratch files; the commands above reproduce both.
