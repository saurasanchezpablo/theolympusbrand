# Project audit — 20 October 2026

A review of the whole repository before the site's redesign: what exists,
what works (and how that was established), what does not, and the order in
which to improve it. "Verified" means observed by running something;
"suspected" means inferred from the code and not yet observed.

## Architecture

| Layer | What it is |
|---|---|
| **Geometry** (`src/geometry/`) | Pure, deterministic TypeScript: the crest, emblem and seal on a 512-unit artboard, the pantheon of gods, lockups, the border, QR codes, polygon booleans (clipper-lib), text outlined from the brand fonts (opentype.js). |
| **Products** (`src/catalog/`, `src/print/`, `src/manufacturing/`, `src/integrations/`, `src/screens/`, `src/render/`, `src/export/`) | Everything made from the marks: service files, print checks, 3D models (layer stacks, a heightfield, a lathe solid), stickers and PDFs, dashboard configurations and theme kits, wallpapers and boot screens, PNG / ICO / STL / 3MF / PDF writers. |
| **Command line** (`scripts/`) | One script per product family, run natively by Node 24 (TypeScript with erasable syntax). |
| **Website** (`app/`) | React 19 + Vite 8, fully static: home, the Atelier (logo generator), catalogue, guide (the repository's Markdown), downloads. A Vite plugin publishes repository folders under `/files/`. Two Web Workers: models and stickers, marble grounds. Storage: `localStorage` only. No backend, no API, no authentication. |
| **Deployment** (`deploy/`) | nginx in Docker with an explicit MIME list and a strict Content-Security-Policy. |
| **Checks** | `node --test` suite (95 tests), Playwright-driven browser checks (21 workflows), GitHub Actions on every push (tests, browser checks, byte-for-byte reproducibility of every generated file, Docker image smoke test). |

There is no server-side code, so there are no credentials, environment
variables or privileged operations in the site. The only scripts that act on
machines (theme kits, boot screens, terminal) are shell files the owner runs
by hand on their own servers; nothing in the site executes them.

## Inventory

| Feature | Status | Evidence |
|---|---|---|
| Master identity, 16 services, brand book | Implemented | Tests, golden fingerprints, CI rebuild |
| Atelier: edit, save, history, undo/redo, share links, import/export | Implemented | Browser checks (verified) |
| Exports: SVG/PNG, asset pack, design file, wallpaper | Implemented | Browser checks; SVG/pack byte-identical to the CLI |
| 3D models: 10 products, STL/3MF/OpenSCAD | Implemented; OpenSCAD sources **unverified** (no OpenSCAD) | Tests, OrcaSlicer `--info` |
| Stickers: PDF/SVG with spot-colour layers | Implemented | Tests, Ghostscript separations |
| Integrations, screens, install scripts | Implemented; **unverified on live systems** | Tests against stand-in systems |
| Catalogue, guide, downloads pages | Implemented | Browser checks |
| Responsive layout | **Partial** — see below | Screenshots at 360, 768, 1024, 1440 px |
| Accessibility | **Partial** — see below | axe-core on every page and size |

## Findings

### Responsive layout (verified with screenshots)

- **The Atelier has two layouts, and the switch is at 1180 px.** At 1024 × 768
  — a common laptop — it falls to the phone layout: library, canvas and
  settings in one long column, the design below the fold and the settings
  far below that.
- **Phones:** the site navigation is a sideways-scrolling strip that cuts off
  "Downloads"; the Atelier's three toolbar buttons wrap into a ragged block;
  the library list fills the first screen before the design appears.
- **Guide on phones:** the chapter list (12 entries) fills the first screen
  before the chapter itself.
- **Catalogue on phones:** one card per screen, each with a 300 px crest.
- No page scrolls sideways at any of the four sizes (measured), but the
  measurement missed clipped content inside scroll containers (the nav):
  the check needs to look inside containers too.

### Accessibility (axe-core 4.10, every page × four sizes)

- **Serious:** the guide's wide tables scroll sideways but cannot be reached
  with the keyboard (`scrollable-region-focusable`).
- **Moderate:** the Atelier has no level-one heading and part of it lies
  outside landmarks (`page-has-heading-one`, `region`).
- **Minor:** empty table headers in the guide (`| | |` in the Markdown).
- Colour contrast passes everywhere; focus is visible (`:focus-visible`
  outline); reduced motion is not yet relevant — the site has almost no
  motion.

### Performance (measured: local preview server, Chrome)

| Page | Content shown | First paint | Largest paint | Long tasks | Transferred |
|---|---|---|---|---|---|
| Home, desktop | 316 ms | 284 ms | 384 ms | 57 ms | 1.29 MB |
| Home, phone (4× slower CPU) | 1111 ms | 1060 ms | 1348 ms | 353 ms | 1.29 MB |
| Atelier, phone (4× slower CPU) | 1173 ms | 1128 ms | 1344 ms | 353 ms | 1.05 MB |

- **One 781 kB JavaScript bundle (246 kB gzipped) for every page.** The home
  page loads the whole Atelier, the geometry engine and the font outliner,
  and waits for four font files before drawing anything — it shows a blank
  page until then. Home, guide and downloads need none of it.
- The guide fetches every chapter on each visit only to read their titles.
- The home page draws its crest with SVG filters (marble turbulence,
  displacement, bevels) at 900 px — the heaviest paint on the page.

### Security

- No secrets, `.env` files or credentials in the repository (searched).
- Share links, imported designs and catalogue files are validated as
  untrusted input; share links unpack with a 256 kB ceiling (tested).
- Imported SVG logos are parsed into path data, never inserted into the page;
  marks are shown as `<img>` from blob URLs, so no imported script can run.
- The guide renders Markdown to HTML without sanitising it. The Markdown is
  the repository's own, served from the same site — acceptable, but any
  future user-supplied Markdown must be sanitised.
- The development file server rejects paths outside the published folders
  and any containing `..`. The production site is nginx serving static files
  with `script-src 'self'`.

### Code and dependencies

- `polygon-clipping` is a dependency that nothing imports.
- Small duplications: the seal-on-a-square icon is drawn in both
  `webicons.ts` and `integrations/kit.ts`; the QR-beside-lockup layout is
  repeated in the nameplate and the rack panel.
- `App.tsx` (≈ 560 lines) holds both the site's routing and the whole
  Atelier's state, which is why everything ships in one bundle.
- Dependencies are current; `opentype.js` 2 and TypeScript 7 are major
  releases away and not needed.

### Testing limitations

- OpenSCAD sources, theme kits and install scripts have no live target here.
- No physical print or sticker order has been made.
- Browser checks run in Chrome only.

## Roadmap (in order)

1. **Accessibility defects** — keyboard-reachable tables, real table headers,
   the Atelier's heading and landmarks.
2. **Architecture** — split the site shell from the Atelier: home, guide and
   downloads load without the geometry engine or the font gate; the Atelier
   and catalogue load on demand; guide titles come with the file index. A
   loading state instead of a blank page. Remove `polygon-clipping`.
3. **Responsive** — a menu for the site navigation on phones; the Atelier in
   three layouts (three columns from 1280 px, canvas and settings with the
   library in a drawer from 900 px, one pane at a time below); the guide's
   chapters behind a disclosure on phones; a denser catalogue on phones.
4. **Visual** — a fluid type scale and spacing tokens; sentence-case
   controls; a home page built around one centrepiece.
5. **3D** — the master medallion's real mesh (the STL in Downloads) in
   WebGL on the home page: lazy-loaded, paused when off screen, still under
   reduced motion, a static render where WebGL is missing or on phones until
   asked for.
6. **Verification** — the viewport check extended to clipped containers and
   made part of the routine; browser checks updated; documentation and
   project notes brought up to date.

## Outcome

What was done, and how it was verified (same machine, same tools as above).

### Fixed

| Finding | Change | Verified by |
|---|---|---|
| Atelier one long column below 1180 px | Three layouts: three columns from 1280 px; canvas and settings with the designs in a drawer from 900 px (Escape closes it); one pane at a time below, chosen from a bar — Designs, Preview, Settings | Screenshots at four sizes; browser checks drive the phone panes and the laptop drawer |
| Navigation cut off on phones | A menu button below 720 px | Browser check opens it and navigates |
| Guide chapters fill a phone's first screen | Chapter list behind a disclosure below 1024 px | Screenshots |
| Tables unreachable by keyboard (serious) | Each wide table and code block is a focusable, named region | axe-core: no violations on any page at any size |
| Empty table headers; Atelier without heading or landmarks | Headers named; a level-one heading; library, canvas and settings as landmarks; skip link | axe-core |
| One 781 kB bundle; blank page until the fonts load | The shell draws at once; Atelier, catalogue, guide and downloads load on first visit (the Atelier in the background once the page is idle); fonts only for the parts that draw lettering; guide titles in the file index | Build output: first load 73 kB of script compressed (was 246 kB) |
| `polygon-clipping` unused | Removed | Typecheck, tests |
| Clipped content went unmeasured | The viewport check also looks inside containers | `npm run app:viewports` |

### Added

- **The home page** rebuilt around one centrepiece: the master medallion —
  the STL from Downloads — lit in WebGL (three.js 0.186.1, loaded only for
  the home page, after the page is idle). A light sweeps across once; the
  medallion sways and turns under the pointer; it draws only while visible.
  Under reduced motion it holds still. Phones and data-saving connections
  get a still of the same scene (WebP, 48 kB / 99 kB) with a button to turn
  it live; where WebGL is missing, the still stays. The pantheon follows as a
  temple frieze, then the four ways in.
- **Interface type:** controls and labels in sentence case; section titles,
  navigation and page titles in Cinzel, the house's inscription voice.
- **Checks:** `npm run app:viewports` (every page × four sizes, reduced
  motion, overflow, clipped content, console errors, failed requests,
  axe-core) — in CI on every push. Browser checks grew to 22: the medallion
  moves, and holds still under reduced motion; phones and laptops.

### Measured after

| | Before | After |
|---|---|---|
| Script on first load (compressed) | 246 kB | 73 kB |
| Home, phone (4× slower CPU): largest paint | 1348 ms | ≈ 570 ms |
| Home, phone: transferred | 1.29 MB | 0.31 MB |
| Home, desktop: largest paint | 384 ms | ≈ 165 ms |
| Atelier, phone (4× slower CPU): content shown | 1173 ms | ≈ 1190 ms (median of three; runs varied 1.0–2.0 s) |
| axe-core violations (all pages, four sizes) | 4 kinds, 1 serious | none |

The machine was under memory pressure during measurement, so single runs
varied widely; medians are given. On desktop, building the 3D scene costs
about half a second of main-thread work, after the page has painted.

### Not done, and why

- **Video:** the live medallion is the motion; a video of it would add
  megabytes to say the same thing.
- **The model and sticker sheets** (Markdown beside each model and sticker)
  still have unnamed table headers: they are not shown in the guide, and
  changing them means regenerating committed models.
- **Browsers other than Chrome** are not checked automatically.

## Art direction: the cinematic home

A second pass, after studying three studio and resort sites (NUDOT, TRIONN,
Primland) for their craft: a held opening scene, oversized type with a
3D object between the words, kinetic bands of names, pinned sideways
showcases, and a guided entry through clouds. Nothing of theirs is copied;
every image on the page is made from the house's own geometry and files.

### The home page, in order

1. **The ascent.** THE · OLYMPUS across the top, the live medallion between
   and below the words, two banks of cloud drifting at different speeds in
   front of its foot. On wide screens the scene is held for one screen of
   scrolling: the words part, the medallion rises and tips back, and the
   clouds climb over it until the view is inside the cloud.
2. **The passage.** Out of the cloud: the domain, unscrambled once, and one
   sentence about what the house is.
3. **The band.** The gods' names in two moving rows, solid and outlined; the
   scroll quickens them.
4. **The anatomy.** The crest assembled part by part — rim, border, laurels,
   temple, name, clouds — as each is told. The parts are the crest's own
   geometry (`crestParts()`), so the drawing can never drift from the mark.
5. **The pantheon.** Every service as a card with its god, the god's title,
   its seal and its address. On wide screens vertical scrolling carries the
   row sideways; a keyboard reaching a card off to the side brings it into
   view. Narrower screens swipe the same row.
6. **The workshop.** The four parts of the site as large inscriptions; a
   preview of what each makes follows the mouse (on touch screens it sits
   beside each one).
7. **The closing.** One line and the way into the Atelier.

Around it: the header turns to stone over the opening scene, links draw a
rule under themselves, a short veil with the seal passes between pages, page
titles are larger and rise in once, the phone menu fills the screen with
large inscriptions, and catalogue cards lift under the pointer.

### Who moves what

| Motion | Owner | Without it |
|---|---|---|
| The entrance (words, medallion, clouds, text) | CSS, once | Everything in place |
| Clouds drifting, the band of names | CSS | Still |
| Held ascent, sideways pantheon, domain unscrambled, band speed | GSAP with ScrollTrigger and ScrambleText (`site/choreography.ts`, loaded after the page has drawn; 49 kB compressed) | Sections in normal flow; the pantheon scrolls sideways by hand |
| The medallion: light, sway, drag, tipping back as you scroll | three.js (`site/medallion-scene.ts`) | A still of the same scene |
| Anatomy steps | An IntersectionObserver and CSS | All parts drawn; the steps read in order |

Each element has one owner, so no two systems fight over it. The scenes are
held with `position: sticky` and only scrubbed by GSAP, so nothing is moved
in the page's structure. With reduced motion, GSAP is never loaded.
Motion, React Three Fiber, Drei and Swiper were evaluated and not needed:
CSS covers the interface's small motions, the medallion was already a plain
three.js scene, and native scroll snapping does the swiping.

### Art

`node scripts/dev/site-art.ts` draws, deterministically:
`app/public/anatomy/*.svg` (the crest's parts), `app/public/clouds/*.webp`
(two seeded cloud banks that wrap sideways, 44 and 36 kB) and
`app/public/showcase/*.webp` (previews of real outputs). The services index
now carries each god's title, so the home page needs no geometry code.

### Verified

- Desktop and phone, scrolled end to end in Chrome and inspected.
- Browser checks (now 23): the ascent holds while it plays, the temple is
  drawn as it is told, the pantheon moves more than 1000 px sideways and
  brings a keyboard-focused god into view, a card opens the catalogue; with
  reduced motion nothing is held, the choreography is not loaded and the
  pantheon scrolls by hand.
- `npm run app:viewports`: no overflow, no errors, no accessibility
  violations on any page at any size. (Receding anatomy steps first failed
  colour contrast; they are now grey at more than 4.5 : 1.)
- First load: 75 kB of script compressed (was 73 kB).

### Not done, and why

- **Video:** no footage the house owns; the clouds are drawn instead, and
  the medallion is live.
- **Smooth-scroll libraries:** native scrolling keeps keyboard, screen
  reader and trackpad behaviour intact.
- **The Atelier's working layout** keeps its tool density on purpose; it
  shares the new navigation, veil and type.
