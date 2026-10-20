// The Olympus — Layered medallion
// Layered medallion — The crest in tiers of relief — rim, border, temple, name, laurels and clouds each at its own height, like a struck coin. One filament, or a colour per tier.
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
// It reads the-olympus-master-layered-tier-1.svg and the-olympus-master-layered-tier-2.svg and the-olympus-master-layered-tier-3.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
diameter = 100;           // [40:1:300] Diameter (mm)
flange = 1.2;             // [0.6:0.1:6] Flange (mm)
base = 3;                 // [1.6:0.1:10] Plate thickness (mm)
style = 0;                // [0:Coin, 1:Temple forward, 2:Frame forward, 3:Custom] Depth
relief = 2.4;             // [0.8:0.2:5] Deepest relief (mm)
tiers = 0;                // [0:One part, 1:A part per tier] Parts
h_rim = 100;              // [10:5:100] Rim (%)
h_ornament = 50;          // [10:5:100] Border ornament (%)
h_temple = 100;           // [10:5:100] Temple (%)
h_plinth = 75;            // [10:5:100] Name plinth (%)
h_laurels = 50;           // [10:5:100] Laurels (%)
h_clouds = 50;            // [10:5:100] Clouds and logo slot (%)
magnets = 0;              // [0:1:4] Magnet pockets
magnet_diameter = 10.2;   // [3:0.1:20] Magnet diameter (mm)
magnet_depth = 2.2;       // [1:0.1:6] Magnet depth (mm)
keyhole = 0;              // [0:off, 1:on] Keyhole hanger
inscription = 1;          // [0:off, 1:on] Back inscription

/* [Hidden] */
$fn = 160;

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

// The tiers, lowest first: [file, centre x, centre y, bottom, top] (mm above the bed).
// Their heights come from the depth style and were rounded to whole layers when
// this file was made: rebuild it to change them.
tiers = [
  ["the-olympus-master-layered-tier-1.svg", 0, 0, 3, 4.2],
  ["the-olympus-master-layered-tier-2.svg", 0, 0, 4.2, 4.8],
  ["the-olympus-master-layered-tier-3.svg", 0, 0, 4.8, 5.4]
];

difference() {
  cylinder(d = diameter, h = base);
  back();
}
for (t = tiers) translate([t[1], t[2], t[3]]) linear_extrude(t[4] - t[3]) import(t[0], center = true);
