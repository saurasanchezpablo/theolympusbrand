# 04 — The Atelier (logo generator)

The Atelier is a web app for making new members of the family. It runs the
same geometry code as `npm run service`, in the browser, so a logo made in the
app is the same logo — the exported SVG files are byte-for-byte identical to
the command line's.

```sh
npm install
npm run app            # http://localhost:5173
```

`npm run app:build` writes a static site to `app/dist/`. It needs no server
logic and no account: open it from any static host, or run
`npm run app:preview` to serve the build locally.

## The workspace

| Area | What it does |
|---|---|
| **Library** (left) | The master, the house catalogue (`catalog/services/`, read-only) and your designs. Search by name, god, category or description; filter by origin and category. Hover a row to duplicate it, download its design file, or delete it (your designs only). |
| **Canvas** (centre) | Live preview. **View**: crest, emblem, seal, horizontal and vertical lockups, and a sheet of small sizes (16–64 px seals, emblems, crest). **Edition**: fine or print. **Surface**: flat vector, white marble, black marble, engraved. **Background**: light, dark or transparent. |
| **Configuration** (right) | Name and identifier, category, patron, logo slot, lockup caption. Below it, the exports. The bar at the bottom saves. |

## Making a design

1. **New design** — or duplicate any library entry.
2. Type the **name**. The identifier (file names) follows it until you edit it.
3. Pick the **category**. It works as a preset: it chooses the patron god
   (Media → Apollo, Security → Athena…).
4. Keep that **patron** or choose another god — or the **monogram**, the
   service's initial cut in Cinzel.
5. Optionally put an **application logo** in the logo slot (an SVG file).
6. Optionally change the **caption**, the lockup's second line.
7. **Save** (or Ctrl+S). Each save increments the design's version.
8. **Export**.

What the system lets a design change is exactly what keeps the family
consistent: the god in the central bay, the logo slot, and the lockup's
wording. The rim, border, temple, thunderbolt, name plinth, clouds and
proportions are the master's and cannot be edited — the master itself is
shown read-only.

## Exports

| Export | Contents |
|---|---|
| **SVG** (this view) | The production file for the current view, on any of the four grounds: transparent with dark ink, transparent with white ink, on light, on dark. |
| **PNG** (this view) | The same, rasterised at the chosen width. |
| **Presentation render** | With a marble or engraved surface: a 2048 px PNG of that render, named `…-mockup.png`. |
| **Asset pack (.zip)** | Everything `npm run service -- build` makes for a service — 28 SVGs, 11 PNGs, `favicon.ico`, `manifest.json` — plus `catalog/services/<id>.json`, the logo in `catalog/logos/`, and the design file. |
| **Design file (.json)** | The design itself, to back up, share or import elsewhere. |

The asset pack is laid out like the repository: unzip it at the repository
root and the new service is part of the catalogue (`npm run service -- build`
regenerates the same files, and its preview board).

PNGs from the app are rasterised by the browser; the command line uses resvg.
The geometry is identical; anti-aliasing can differ by a hair.

**Marble, relief and engraving are presentation mockups.** They are rendered
effects for previews and documentation. The production file is always the flat
vector, and a marble texture is not printable geometry.

## Print check

The print edition's caption reports the smallest diameter the crest prints at
on the house printer (filament, 0.4 mm nozzle), measured on the real geometry
the same way the command line measures it. If a patron loses detail, the
configuration panel says so.

## Where designs are kept

Your designs are stored in the **browser's local storage**, on this machine,
for this browser only. They survive reloads and restarts, but not clearing
site data, a private window, or a different browser or computer.

So that nothing is ever trapped there:

- **Export library** downloads every saved design as one `.json` file;
- **Import** reads a library file, a design file, a catalogue file from
  `catalog/services/`, or a JSON list of them;
- every design can be downloaded on its own from the library or the export
  panel.

If the browser refuses storage, the library says so and designs last only
until the page is closed — export them.

## Checking the app

```sh
npm run app:build
npm run app:check      # drives the built app in Chrome or Chromium
```

The check serves the build and walks through the workflows above. It confirms
that an exported SVG equals the command line's file, that saving and versions
survive a reload, that an SVG logo imports, that the asset pack has the full
file set, and that a design exports and imports back with its logo, with no
console errors. It needs an installed Chrome or Chromium (`CHROME_PATH` to
point at one).
