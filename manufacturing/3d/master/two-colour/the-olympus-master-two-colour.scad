// The Olympus — Two-colour medallion
// Two-colour medallion — Plate and relief as separate parts — for a filament change at the relief, or a multi-material printer.
//
// Parametric source for OpenSCAD 2021.01 or later. Open it, change the values
// below (or use Window → Customizer), then Design → Render and File → Export
// → STL. It reads the-olympus-master-crest-print.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
diameter = 100;       // [40:1:300] Diameter (mm)
flange = 1.2;         // [0.6:0.1:6] Flange (mm)
base = 3;             // [1.6:0.1:10] Plate thickness (mm)
relief = 1.2;         // [0.4:0.1:4] Relief height (mm)
magnets = 0;          // [0:1:4] Magnet pockets
magnet_diameter = 10.2; // [3:0.1:20] Magnet diameter (mm)
magnet_depth = 2.2;   // [1:0.1:6] Magnet depth (mm)

/* [Hidden] */
$fn = 160;

// The design, centred and scaled so its rim spans the plate inside the flange.
module mark() resize([diameter - 2 * flange, 0], auto = true) import("the-olympus-master-crest-print.svg", center = true);

// Magnet pockets, open on the bed side.
module pockets() {
  r = diameter / 2 * 0.45;
  if (magnets == 1) translate([0, 0, -0.01]) cylinder(d = magnet_diameter, h = magnet_depth + 0.01);
  else if (magnets > 1)
    for (i = [0 : magnets - 1]) {
      a = 90 + 360 * i / magnets + (magnets == 2 ? 90 : 0);
      translate([r * cos(a), r * sin(a), -0.01]) cylinder(d = magnet_diameter, h = magnet_depth + 0.01);
    }
}

// Which part to export: "plate" and "relief" for two STLs, "both" to preview.
part = "both"; // [both, plate, relief]

if (part != "relief") color("#2B2B2B") difference() {
  cylinder(d = diameter, h = base);
  pockets();
}
if (part != "plate") color("#E6E6E6") translate([0, 0, base]) linear_extrude(relief) mark();
