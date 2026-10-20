// The Olympus — Medallion
// Medallion — The crest raised on a round backing plate — a wall or desk piece, a rack badge with magnets.
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
// It reads the-olympus-master-crest-print.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
diameter = 100;           // [40:1:300] Diameter (mm)
flange = 1.2;             // [0.6:0.1:6] Flange (mm)
base = 3;                 // [1.6:0.1:10] Plate thickness (mm)
relief = 1.2;             // [0.4:0.1:4] Relief height (mm)
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
  cylinder(d = diameter, h = base);
  back();
}
translate([0, 0, base]) linear_extrude(relief) mark(diameter - 2 * flange);
