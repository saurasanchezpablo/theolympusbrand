// The Olympus — Token
// Token — The seal raised on a small disc with a keyring lug — a key fob, a bag tag, a cable tag.
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
// It reads the-olympus-master-seal.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
diameter = 59;            // [20:1:80] Diameter (mm)
flange = 1.2;             // [0.6:0.1:4] Flange (mm)
base = 2.4;               // [1.2:0.1:6] Disc thickness (mm)
relief = 1;               // [0.4:0.1:3] Relief height (mm)
hole = 4.5;               // [2.5:0.1:8] Keyring hole (mm)

/* [Hidden] */
$fn = 160;

// The design, centred and scaled so its rim spans the plate inside the flange.
module mark(d) resize([d, 0], auto = true) import("the-olympus-master-seal.svg", center = true);

lug_r = hole / 2 + 3;
lug_y = diameter / 2 + lug_r * 0.55;
linear_extrude(base) difference() {
  union() {
    circle(d = diameter);
    translate([0, lug_y]) circle(r = lug_r);
  }
  translate([0, lug_y]) circle(d = hole);
}
translate([0, 0, base]) linear_extrude(relief) mark(diameter - 2 * flange);
