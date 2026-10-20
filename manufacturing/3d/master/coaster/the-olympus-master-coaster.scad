// The Olympus — Coaster
// Coaster — The crest engraved flush, so a glass stands level — with a recess underneath for a felt or cork pad.
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
// It reads the-olympus-master-crest-print.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
diameter = 100;           // [70:1:130] Diameter (mm)
flange = 3;               // [1:0.1:10] Flange (mm)
thickness = 5;            // [3:0.1:10] Thickness (mm)
depth = 0.8;              // [0.4:0.1:2] Engraving depth (mm)
recess = 1;               // [0:off, 1:on] Pad recess
recess_depth = 1;         // [0.4:0.1:3] Recess depth (mm)

/* [Hidden] */
$fn = 160;

// The design, centred and scaled so its rim spans the plate inside the flange.
module mark(d) resize([d, 0], auto = true) import("the-olympus-master-crest-print.svg", center = true);

pad = diameter - 2 * max(3, flange);
difference() {
  cylinder(d = diameter, h = thickness);
  translate([0, 0, thickness - depth]) linear_extrude(depth + 0.01) mark(diameter - 2 * flange);
  if (recess == 1) translate([0, 0, -0.01]) cylinder(d = pad, h = recess_depth + 0.01);
}
