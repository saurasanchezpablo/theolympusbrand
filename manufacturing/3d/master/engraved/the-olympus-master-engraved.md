# The Olympus — Engraved medallion

The crest cut into a solid plate — quiet, stone-like, best in one light filament.

![Preview](the-olympus-master-engraved-preview.png)

*Preview rendered from the mesh itself.*

| | |
|---|---|
| Size | 100 × 100 × 4 mm |
| Volume | 28.3 cm³ — at most 36 g of PLA solid; much less at 15–20 % infill |
| Mark prints from | Ø 67 mm on a 0.4 mm nozzle |

## Parameters

| Parameter | Value | |
|---|---|---|
| Diameter | 100 mm | Outer diameter of the plate. |
| Flange | 2 mm | Solid border left around the crest’s rim. |
| Plate thickness | 4 mm | Total thickness. |
| Engraving depth | 1 mm | How deep the design is cut. |
| Magnet pockets | 0 | Round pockets in the back for disc magnets: hangs on a rack door, a fridge, a steel panel. Glue the magnets in after printing. |
| Magnet diameter | 10.2 mm | Pocket diameter: the magnet plus about 0.2 mm. |
| Magnet depth | 2.2 mm | Pocket depth: the magnet’s thickness plus about 0.2 mm. |

## Files

- `the-olympus-master-engraved.stl` — the solid, ready to slice
- `the-olympus-master-engraved.3mf` — the same solid, in 3MF
- `the-olympus-master-engraved.scad` — parametric source for OpenSCAD, reading `the-olympus-master-crest-print.svg`

## Validation

- **engraved medallion**: valid — 22,694 triangles, closed and manifold (0 open or doubled edges), 0 degenerate triangles, no self-intersection (0 overlapping layers), volume 28.27 cm³ as designed.

## Printing

- Print flat on the bed, design facing up. No supports needed.
- Layer height 0.2 mm or finer; heights that are multiples of it come out exact.
- For contrast, wipe dark acrylic paint into the engraving and clean the top face; or print in a speckled “marble” filament.
