// The Olympus — Engraved medallion
// Engraved medallion — The crest cut into a solid plate — quiet, stone-like, best in one light filament.
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
// It reads the-olympus-master-crest-print.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
diameter = 100;           // [40:1:300] Diameter (mm)
flange = 2;               // [0.8:0.1:8] Flange (mm)
thickness = 4;            // [2.4:0.1:12] Plate thickness (mm)
depth = 1;                // [0.4:0.1:4] Engraving depth (mm)
magnets = 0;              // [0:1:4] Magnet pockets
magnet_diameter = 10.2;   // [3:0.1:20] Magnet diameter (mm)
magnet_depth = 2.2;       // [1:0.1:6] Magnet depth (mm)
keyhole = 0;              // [0:off, 1:on] Keyhole hanger
inscription = 1;          // [0:off, 1:on] Back inscription

/* [Hidden] */
$fn = 160;

// The design, centred and scaled so its rim spans the plate inside the flange.
module mark(d) resize([d, 0], auto = true) import("the-olympus-master-crest-print.svg", center = true);

// What is cut into the back. Positions are where the generator placed them.
module slot(hw, r, extra) union() {
  circle(r);
  translate([-hw, 0]) square([2 * hw, 8 + extra]);
  translate([0, 8 + extra]) circle(hw);
}
module back() {
  // Inscription, mirrored to read from behind (needs the Jost font installed).
  translate([0, -21, -0.01]) mirror([1, 0, 0]) linear_extrude(0.6 + 0.01) {
    translate([0, 1.457]) text("THE OLYMPUS", size = 7.857, font = "Jost:style=SemiBold", halign = "center", spacing = 1.14);
    translate([0, -6.958]) text("THEOLYMPUS.CLOUD", size = 6.129, font = "Jost:style=SemiBold", halign = "center", spacing = 1.14);
  }
}

difference() {
  cylinder(d = diameter, h = thickness);
  translate([0, 0, thickness - depth]) linear_extrude(depth + 0.01) mark(diameter - 2 * flange);
  back();
}
