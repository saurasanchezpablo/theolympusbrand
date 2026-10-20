# 05 — 3D printing

Every crest and seal can be made into a printable object. The models are built
from the **print editions** — the versions already checked against a 0.4 mm
nozzle — so what is fine enough on screen is never asked of the printer.

## Products

| Product | What it is | Default |
|---|---|---|
| **Medallion** | The crest raised on a round backing plate — a wall or desk piece, or a rack badge with magnets. | Ø 100 × 4.2 mm |
| **Engraved medallion** | The crest cut into a solid plate. Quiet and stone-like; best in one light filament. | Ø 100 × 4 mm |
| **Two-colour medallion** | Plate and relief as separate parts: one filament change, or a multi-material printer. | Ø 100 × 4.2 mm |
| **Coaster** | The crest engraved flush, so a glass stands level, with a recess underneath for a felt or cork pad. | Ø 100 × 5 mm |
| **Nameplate** | The crest with the service's name and caption — for a server, a rack, a door. Horizontal or vertical; sized to your bed; optionally with a QR code to the service. | 80 mm tall |
| **Marble lithophane** | A thin disc whose thickness carries the crest and a marble veining: held to the light it glows like backlit stone. | Ø 100 × 0.8–3 mm |
| **Token** | A service's seal raised on a disc with a keyring lug. | Ø 40 mm (59 mm for the master) |
| **Desk stand** | A slotted foot that holds a medallion or lithophane upright. Sized from the medallion. | 88 × 28 × 13 mm |

The master's set is in [`manufacturing/3d/master/`](../manufacturing/3d/master/);
its nameplate reads THE OLYMPUS over *theolympus.cloud*. Any service's set is
one command or a few clicks away.

## A QR code on the nameplate

Turn on **QR code** and the service's address (its `url`) stands beside the
name as a raised code, as tall as the crest. A code in one colour reads
poorly — the plate and the modules reflect the same light — so print the
relief in a contrasting colour: the sheet gives the layer for the filament
change. The test suite reads the code back from the raised layer of the model
itself. Modules under 1 mm are warned about.

## The back of the plate

Medallions (raised, engraved, two-colour) and nameplates can carry, on the
side that faces the bed:

- **Magnet pockets** — up to four, for disc magnets (10 × 2 mm fits the
  defaults). The piece then holds to a rack door, a steel panel, a fridge.
- **A keyhole hanger** — a real keyhole: the screw head enters the round
  opening, the piece drops, and the shank rides up a slot under a 1.2 mm lip.
  For a 3.5–4 mm screw with a head up to 8 mm; it needs a plate of 4.2 mm or
  more (the default 3 mm plate is too thin — the sheet says so).
- **A back inscription** — the service's name and **theolympus.cloud**,
  engraved 0.6 mm deep and mirrored so it reads when the piece is turned over.
  On by default.

Features are placed in that order. One that would not fit — too deep for the
plate, too close to the edge or to another feature, or lettering too fine to
print at that size — is left out, and the model's warnings say which and why.
Every pocket keeps at least 0.8 mm (four layers) of plastic above it.

## Making a model

**In the Atelier** — open a design, choose **3D print** in the canvas, pick the
product and adjust its parameters. Models build in the background as you move
the sliders and are re-validated each time. The canvas shows:

- **3D** — the mesh itself, turned by dragging;
- **Back** — the same, from underneath: pockets, keyhole, inscription;
- **Layers** — what the printer lays down, layer by layer, with the layers
  where something changes (a pocket ends, the relief begins) one click away;
- **Backlit** (lithophane) — a simulation of the disc held to the light.

**Print settings** — layer height, infill, filament diameter and material —
drive the filament estimate, the colour-change layer of the two-colour
medallion, and a warning when a height is not a whole number of layers. The
Atelier remembers them in this browser.

Download the STL, the 3MF, the OpenSCAD source, or the whole **model pack**.

**From the command line:**

```sh
npm run model -- master                          # every product, master crest
npm run model -- jellyfin                        # every product, one service
npm run model -- jellyfin --product token
npm run model -- vpn --product medallion --magnets 2 --keyhole on --base 4.4
npm run model -- vpn --product nameplate --layout vertical --caption off
npm run model -- master --product lithophane --diameter 120 --veins 70
npm run model -- master --layer 0.16 --infill 20 # print settings
npm run model -- products                        # every parameter and its range
```

Output goes to `manufacturing/3d/<id>/<product>/`. Only the master's models are
kept in the repository; the others are rebuilt on demand. Both routes run the
same code: an STL from the Atelier is byte-for-byte the STL from the command
line.

## What each model folder contains

| File | |
|---|---|
| `…-<product>.stl` | The solid, ready to slice (two-colour: `-plate.stl` and `-relief.stl`). |
| `…-<product>.3mf` | The same, in 3MF. A two-colour model is one object made of two parts, each ready for its own filament. |
| `…-<product>.scad` | Parametric source for OpenSCAD 2021.01 or later, with what it reads beside it: the print SVG of the mark, the nameplate's laid-out design (`-design.svg`, in millimetres), or the lithophane's heightmap (`-heightmap.png`, for `surface()`). |
| `…-preview.png`, `…-back.png` | Renders of the mesh, from the front and (when something is cut into it) the back. |
| `…-backlit.png` | Lithophane only: the simulated view against the light. |
| `…-<product>.md` | The sheet: size, filament estimate, parameters, files, validation, printing notes and warnings. |

## Printing on a 0.4 mm nozzle

- **Orientation:** flat on the bed, design facing up. Nothing overhangs, so
  **no supports**; pocket ceilings and the keyhole's lip are short bridges.
- **Layers:** 0.2 mm, or 0.12–0.16 mm for crisper lettering. Plate, relief and
  engraving heights that are whole numbers of layers come out exact — the
  defaults are, and the sheet warns when a height is not.
- **Walls:** 3 perimeters; 4–5 top layers on engraved pieces, with **ironing**
  on the top surface if your slicer has it.
- **Infill:** 15–20 %. The estimate on each sheet follows the infill you set.
- **Smallest size:** the crest prints cleanly from **Ø 67 mm**, a god's seal
  from **Ø 32 mm**, the master's seal from Ø 56 mm. The suggested sizes never
  go below these; choose smaller and the sheet says so.
- **Two colours, one extruder:** the sheet gives the layer for the filament
  change (layer 16 at 0.2 mm with the default 3 mm plate). Dark plate and
  light relief is the most legible pair.
- **Magnets:** glue them in after printing (a drop of CA glue).
- **Stand:** print it first and test the fit; adjust the clearance (0.3 mm by
  default) to your printer.

### The marble lithophane

The brand's marble is a look, not a material — except here. A lithophane is
printed thin where the picture is light and thick where it is dark; against a
light, white plastic becomes a picture. This one carries the crest over a
veined marble pattern (seeded, so identical on every build).

- **Filament:** white or natural PLA. **100 % infill** — light must pass
  through solid plastic.
- **Layers:** 0.12 mm and 3–4 walls give the smoothest tones; slow outer walls
  avoid streaks.
- **Thickness:** 0.8–3 mm by default. Thinner glows brighter but is fragile.
- **Display:** in a window, in front of a warm white LED, or upright in the
  desk stand before a lamp (its slot takes the 3 mm frame).

### Materials

- **One filament:** matte white, grey or black PLA. The relief does the work.
- **Stone-effect PLA** (speckled "marble" or granite blends) gives the most
  convincing stone in a single filament.
- **Two filaments:** dark plate, light relief, with the two-colour medallion.
- **Engraved pieces, painted:** wipe dark acrylic into the engraving and clean
  the top face — the classic look of carved stone.
- **Coasters and tokens:** PETG copes better with heat and wear than PLA.
  Neither is for food contact.

## How the models are made and checked

Most products are stacks of flat layers — plate, pockets, relief — extruded and
joined exactly, rather than combined with 3D booleans. The lithophane is a
heightfield on a polar grid, so its edge is a true circle. The design is
cleaned first: parts that would touch at a single point are separated by
0.02 mm, fifty times finer than anything the nozzle draws.

Every model is checked when it is built, and the result is on its sheet:

- **closed and manifold** — every edge belongs to exactly two triangles,
  facing opposite ways, so the mesh is watertight and consistently oriented;
- **no degenerate triangles**;
- **no self-intersection** — no two outlines in a layer overlap;
- **the designed volume** — the mesh's volume equals what its layers (or its
  heightfield) should hold.

The test suite builds every product for every patron, checks all of this, and
checks that the back features, STL, 3MF and OpenSCAD files agree with the
model. OrcaSlicer reports the master's medallion and two-colour 3MF as
manifold, with the same volume.

The OpenSCAD sources are generated from the same parameters but are not run
here (OpenSCAD is not installed on the build machine). They are the editable
form of the models; the STL and 3MF files are the checked ones. The back
inscription in OpenSCAD uses `text()` and needs the Jost font installed.
