# The Olympus — Two-colour medallion

Plate and relief as separate parts — for a filament change at the relief, or a multi-material printer.

![Preview](the-olympus-master-two-colour-preview.png)

*Preview rendered from the mesh itself.*

| | |
|---|---|
| Size | 100 × 100 × 4.2 mm |
| Volume | 27.5 cm³ — at most 35 g of PLA solid; much less at 15–20 % infill |
| Mark prints from | Ø 67 mm on a 0.4 mm nozzle |

## Parameters

| Parameter | Value | |
|---|---|---|
| Diameter | 100 mm | Outer diameter of the plate. |
| Flange | 1.2 mm | Plate left around the crest’s rim. |
| Plate thickness | 3 mm | The colour changes at this height. |
| Relief height | 1.2 mm | Height of the second colour. |
| Magnet pockets | 0 | Round pockets in the back for disc magnets: hangs on a rack door, a fridge, a steel panel. Glue the magnets in after printing. |
| Magnet diameter | 10.2 mm | Pocket diameter: the magnet plus about 0.2 mm. |
| Magnet depth | 2.2 mm | Pocket depth: the magnet’s thickness plus about 0.2 mm. |

## Files

- `the-olympus-master-two-colour-plate.stl` — the plate
- `the-olympus-master-two-colour-relief.stl` — the relief
- `the-olympus-master-two-colour.3mf` — both parts as one object, each ready for its own filament
- `the-olympus-master-two-colour.scad` — parametric source for OpenSCAD, reading `the-olympus-master-crest-print.svg`

## Validation

- **plate**: valid — 1,504 triangles, closed and manifold (0 open or doubled edges), 0 degenerate triangles, no self-intersection (0 overlapping layers), volume 23.56 cm³ as designed.
- **relief**: valid — 20,124 triangles, closed and manifold (0 open or doubled edges), 0 degenerate triangles, no self-intersection (0 overlapping layers), volume 3.89 cm³ as designed.

## Printing

- Print flat on the bed, design facing up. No supports needed.
- Layer height 0.2 mm or finer; heights that are multiples of it come out exact.
- One printer, two filaments: change filament at 3.00 mm (the first layer of the relief). Multi-material: load the 3MF and give each part its filament.
- Thickest point 4.2 mm — the desk stand’s slot should match.
