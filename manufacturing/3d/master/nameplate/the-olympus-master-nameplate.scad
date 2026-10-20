// The Olympus — Nameplate
// Nameplate — The crest with the service’s name and caption on a plate — for a server, a rack, a door.
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
// It reads the-olympus-master-nameplate-design.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
height = 80;              // [40:1:200] Height (mm)
layout = 0;               // [0:Horizontal, 1:Vertical] Layout
caption = 1;              // [0:off, 1:on] Caption
qr = 0;                   // [0:off, 1:on] QR code
margin = 5;               // [3:0.5:20] Margin (mm)
corner = 6;               // [0:0.5:20] Corner radius (mm)
base = 3;                 // [1.6:0.1:10] Plate thickness (mm)
relief = 1.2;             // [0.4:0.1:4] Relief height (mm)
bed = 256;                // [100:1:400] Bed size (mm)
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
  translate([0, -17.4, -0.01]) mirror([1, 0, 0]) linear_extrude(0.6 + 0.01) {
    translate([0, -2.966]) text("THEOLYMPUS.CLOUD", size = 8.474, font = "Jost:style=SemiBold", halign = "center", spacing = 1.14);
  }
}

// The plate's size follows the laid-out design (256 × 79.1 mm here):
// regenerate the design SVG to change the height, the layout or the caption.
plate = [256, 79.1];

difference() {
  linear_extrude(base) offset(r = corner) offset(delta = -corner) square(plate, center = true);
  back();
}
translate([0, 0, base]) linear_extrude(relief) import("the-olympus-master-nameplate-design.svg", center = true);
