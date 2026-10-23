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
| **Designs** (left) | The master, the house catalogue (`catalog/services/`, read-only) and your designs, with **New design**, **Import** and **Export library** at the top. Search by name, god, category or description; filter by origin and category. Hover a row to duplicate it, download its design file, or delete it (your designs only). |
| **Canvas** (centre) | Live preview. **View**: crest, emblem, seal, horizontal and vertical lockups, a sheet of small sizes (16–64 px seals, emblems, crest), **Sticker** ([die-cut stickers](06-stickers.md)) and **3D print** ([printable models](05-3d-printing.md)). **Edition**: fine or print. **Surface**: flat vector, white marble, black marble, engraved. **Background**: light, dark or transparent. |
| **Configuration** (right) | Name and identifier, category, patron, logo slot, lockup caption. Below it, the exports. The bar at the bottom saves. |

The three areas sit side by side from 1280 px wide. On a laptop or a tablet
on its side, the canvas and the settings share the screen and the designs
open in a drawer (**Designs**, top left of the canvas; Escape closes it). On a
tablet held upright or a phone, one area shows at a time, chosen from the bar
at the bottom — **Designs**, **Preview**, **Settings**; choosing a design shows
its preview. The Atelier loads the first time it is opened and stays loaded
while you read other pages, so nothing in progress is lost.

## Making a design

1. **New design** — or duplicate any library entry.
2. Type the **name**. The identifier (file names) follows it until you edit it.
   Add the service's **address** if it has one — QR labels and nameplates use it.
3. Pick the **category**. It works as a preset: it chooses the patron god
   (Media → Apollo, Security → Athena…).
4. Keep that **patron** or choose another god — or the **monogram**, the
   service's initial cut in Cinzel — or **Your logo**, once you have imported
   one (step 5).
5. Optionally put an **application logo** in the logo slot (an SVG file).
   Chosen as the patron too, it stands in the temple's bay and on the seal
   as well. Print editions cut it in the bay only if it keeps its shape on a
   0.4 mm nozzle; otherwise they carry the initial, and the patron's note
   says so.
6. Optionally change the **caption**, the lockup's second line.
7. **Save** (or Ctrl+S). Each save increments the design's version.
8. **Export** — or **share** it as a link.

What the system lets a design change is exactly what keeps the family
consistent: the god in the central bay, the logo slot, and the lockup's
wording (the bay may carry your own logo). The rim, border, temple, thunderbolt, name plinth, clouds and
proportions are the master's and cannot be edited — the master itself is
shown read-only.

## Exports

| Export | Contents |
|---|---|
| **SVG** (this view) | The production file for the current view, on any of the four grounds: transparent with dark ink, transparent with white ink, on light, on dark. |
| **PNG** (this view) | The same, rasterised at the chosen width. |
| **Presentation render** | With a marble or engraved surface: a 2048 px PNG of that render, named `…-mockup.png`. |
| **Asset pack (.zip)** | Everything `npm run service -- build` makes for a service — 28 SVGs, 11 PNGs, `favicon.ico`, the `web/` icon set, `manifest.json` — plus `catalog/services/<id>.json`, the logo in `catalog/logos/`, the design file, a `dashboard/` folder with the service's coin icons and its entries for Homepage, Dashy and Homer (see [Integrations](08-integrations.md)), and a `terminal/` folder with its message of the day, console login and SSH banner (see [Screens](09-screens.md)). |
| **Wallpaper** | The crest on black or white marble, graphite or a blueprint sheet, for a 1080p, 1440p or 4K desktop, an ultrawide or a phone. The stone is drawn in the browser; a 4K one takes a few seconds. |
| **Design file (.json)** | The design itself, with its history, to back up, share or import elsewhere. |
| **Link to this design** | The design in an address — see below. |
| **Sticker** view | Production PDF and SVG (Bleed, Artwork, White, CutContour layers), the cut path alone, a sheet, mockups. See [Stickers](06-stickers.md). |
| **3D print** view | STL, 3MF and OpenSCAD source of every printable product, or the whole model pack. See [3D printing](05-3d-printing.md). |

The asset pack is laid out like the repository: unzip it at the repository
root and the new service is part of the catalogue (`npm run service -- build`
regenerates the same files, and its preview board).

PNGs from the app are rasterised by the browser; the command line uses resvg.
The geometry is identical; anti-aliasing can differ by a hair.

**Marble, relief and engraving are presentation mockups.** They are rendered
effects for previews and documentation. The production file is always the flat
vector, and a marble texture is not printable geometry.

## Sharing a design

**Link to this design** (under Export) puts the whole design — its settings,
and its logo if it has one — into an address and copies it. Whoever opens it
gets the design in their Atelier as an unsaved copy, to look at, change or
save as theirs.

- **Nothing is uploaded.** The design travels in the part of the address
  after `#`, which the browser keeps to itself: the server never sees it.
- Copying needs a secure (https) page; on a plain-http network the link is
  shown to select and copy by hand.
- A design is a few hundred characters; a logo makes the link longer, and
  very long links can be cut short by chat apps — the panel warns, and the
  design file is the alternative.
- What a link carries is checked like an imported file, and a damaged or
  foreign link is refused with a reason.

## History, undo and redo

- **Undo and redo** — the arrows beside Save, or Ctrl+Z and Ctrl+Shift+Z
  (Ctrl+Y) when you are not typing in a field — step through every change to
  the open design since it was opened. A burst of typing is one step.
- **History** — each save keeps the version before it (the last 15). The
  History panel lists them with what changed; **Restore** opens a version as
  unsaved changes, so saving it makes a new version and nothing is lost.
  History is part of the design: it is kept in the browser and travels in
  the design and library files.

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

## The lab

`app/lab.html` is a development page with one bench for each interface
library the site can use: shadcn/ui and Aceternity UI components, Motion,
GSAP, React Three Fiber with Drei, Swiper and Rive. Each is drawn in the
house's grays. Start the development server with `npm run app` and open
`/lab.html`. The lab is not part of the built site.

Components are added with the shadcn command line, configured in
`components.json`:

```sh
npx shadcn@4.21.2 add button
npx shadcn@4.21.2 add @aceternity/text-generate-effect --path app/src/components/aceternity
```

Only the grays are allowed. The palette test rejects Tailwind's tinted colour
classes, and `npm run app:viewports` rejects any colour with a hue in the
built stylesheets.
