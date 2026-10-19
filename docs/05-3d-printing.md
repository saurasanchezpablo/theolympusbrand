# 05 — 3D printing

Every crest and seal can be made into a printable object. The models are built
from the **print editions** — the versions already checked against a 0.4 mm
nozzle — so what is fine enough on screen is never asked of the printer.

## Products

| Product | What it is | Default |
|---|---|---|
| **Medallion** | The crest raised on a round backing plate. With magnet pockets it becomes a rack-door or panel badge. | Ø 100 × 4.2 mm |
| **Engraved medallion** | The crest cut into a solid plate. Quiet and stone-like; best in one light filament. | Ø 100 × 4 mm |
| **Two-colour medallion** | Plate and relief as separate parts: one filament change, or a multi-material printer. | Ø 100 × 4.2 mm |
| **Token** | A service's seal raised on a disc with a keyring lug. | Ø 40 mm (59 mm for the master) |
| **Desk stand** | A slotted foot that holds a medallion upright. Sized from the medallion. | 88 × 28 × 13 mm |

The master's set is in [`manufacturing/3d/master/`](../manufacturing/3d/master/).
Any service's set is one command or a few clicks away (below).

## Making a model

**In the Atelier** — open a design, choose **3D print** in the canvas, pick the
product and adjust its parameters. The preview is drawn from the mesh itself
and turns when dragged. Each change rebuilds and re-validates the model.
Download the STL, the 3MF, the OpenSCAD source, or the whole **model pack**.

**From the command line:**

```sh
npm run model -- master                          # every product, master crest
npm run model -- jellyfin                        # every product, one service
npm run model -- jellyfin --product token
npm run model -- master --product medallion --diameter 120 --relief 1.6 --magnets 2
npm run model -- products                        # every parameter and its range
```

Output goes to `manufacturing/3d/<id>/<product>/`. Only the master's models are
kept in the repository; the others are rebuilt on demand.

Both routes run the same code: an STL from the Atelier is byte-for-byte the
STL from the command line.

## What each model folder contains

| File | |
|---|---|
| `…-<product>.stl` | The solid, ready to slice (two-colour: `-plate.stl` and `-relief.stl`). |
| `…-<product>.3mf` | The same, in 3MF. A two-colour model is one object made of two parts, each ready for its own filament. |
| `…-<product>.scad` + `…-crest-print.svg` / `…-seal.svg` | Parametric source for OpenSCAD 2021.01 or later: every dimension is a variable (also in the Customizer). It reads the SVG beside it. |
| `…-<product>-preview.png` | A render of the mesh. |
| `…-<product>.md` | The sheet: size, volume and filament estimate, parameters, files, validation, printing notes. |

## Parameters

| Parameter | Products | Range | Default |
|---|---|---|---|
| Diameter | all | 40–300 mm (token 20–80) | 100 mm (token 40) |
| Flange — plate left around the rim | medallions, token | 0.6–6 mm | 1.2 mm (engraved 2) |
| Plate thickness | medallion, two-colour, token | 1.2–10 mm | 3 mm (token 2.4) |
| Relief height | medallion, two-colour, token | 0.4–4 mm | 1.2 mm (token 1) |
| Plate thickness, engraving depth | engraved | 2.4–12, 0.4–4 mm | 4, 1 mm |
| Magnet pockets, diameter, depth | medallions | 0–4; 3–20; 1–6 mm | 0; 10.2; 2.2 mm |
| Keyring hole | token | 2.5–8 mm | 4.5 mm |
| Medallion thickness, clearance, slot depth | stand | 1.6–16; 0–1; 4–30 mm | 4.2; 0.3; 10 mm |

The suggested size never goes below the size at which the design prints
cleanly. Choose smaller and the sheet says so.

## Printing on a 0.4 mm nozzle

- **Orientation:** flat on the bed, design facing up. Every model is built so
  that nothing overhangs: **no supports**.
- **Layers:** 0.2 mm, or 0.12–0.16 mm for crisper lettering. Plate, relief and
  engraving heights that are multiples of the layer height come out exact
  (the defaults are).
- **Walls:** 3 perimeters; 4–5 top layers on the engraved medallion, with
  **ironing** on the top surface if your slicer has it.
- **Infill:** 15–20 %. Volumes and the "at most" weights on each sheet are for
  a solid part; the real weight is lower.
- **Smallest size:** the crest prints cleanly from **Ø 67 mm** and a god's
  seal from **Ø 32 mm**; the master's seal, which carries the whole temple,
  from Ø 56 mm. Below that, the finest lines fall under what a 0.4 mm nozzle
  can draw.
- **Two colours, one extruder:** slice the 3MF and add a filament change (M600,
  or a "pause / colour change" at layer) at the plate thickness — 3 mm by
  default. Dark plate and light relief is the most legible pair.
- **Magnets:** the pockets open on the bed side and their ceilings bridge
  cleanly. Glue the magnets in after printing (a drop of CA glue). 10 × 2 mm
  neodymium discs fit the defaults.
- **Stand:** print it first and test the fit; adjust the clearance (0.3 mm by
  default) to your printer.

### Materials

The brand's marble is a look, not a material, and a print can only suggest it:

- **One filament:** matte white, grey or black PLA. The raised and engraved
  geometry does the work — light and shadow across the relief.
- **Stone-effect PLA** (speckled "marble" or granite blends) gives the most
  convincing stone in a single filament.
- **Two filaments:** dark plate, light relief (or the reverse) with the
  two-colour medallion.
- **Engraved medallion, painted:** wipe dark acrylic into the engraving, clean
  the top face with a damp cloth — the classic look of carved stone.

## How the models are made and checked

Each product is a stack of flat layers — plate, relief, pockets — extruded and
joined exactly, rather than combined with 3D booleans. The design is cleaned
first: parts that would touch at a single point are separated by 0.02 mm, fifty
times finer than anything the nozzle draws, so the solid never pinches.

Every model is checked when it is built, and the result is on its sheet:

- **closed and manifold** — every edge belongs to exactly two triangles, facing
  opposite ways, so the mesh is watertight and consistently oriented;
- **no degenerate triangles**;
- **no self-intersection** — no two outlines in a layer overlap;
- **the designed volume** — the mesh's volume equals the sum of its layers.

The test suite builds every product for every patron and checks all of this,
and that STL, 3MF and OpenSCAD files agree with the model. OrcaSlicer reports
the master's medallion and two-colour 3MF as manifold, with the same volume.

The OpenSCAD sources are generated from the same parameters but are not run
here (OpenSCAD is not installed on the build machine): they are the editable
form of the models, while the STL and 3MF files are the checked ones.
