// The Olympus — Rack panel
// Rack panel — A front panel for a 10-inch rack — the seal and the service’s name raised between the mounting slots, with vents either side.
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
// It reads the-olympus-master-rack-design.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
units = 2;                // [1:1:3] Height (U)
spacing = 236.5;          // [220:0.1:245] Hole spacing (mm)
hole = 6.5;               // [4:0.1:7] Slot width (mm)
vents = 1;                // [0:off, 1:on] Vents
caption = 0;              // [0:off, 1:on] Caption
qr = 0;                   // [0:off, 1:on] QR code
corner = 1.5;             // [0:0.5:5] Corner radius (mm)
base = 4;                 // [2.4:0.1:8] Panel thickness (mm)
relief = 1.2;             // [0.4:0.1:3] Relief height (mm)

/* [Hidden] */
$fn = 160;

// The panel's height follows the rack units (88.1 mm here); the mounting slots
// and vents are where the generator placed them: [x, y, width, height].
panel = [254, units * 44.45 - 0.79];
openings = [
  [-118.25, -38.1, 9.5, 6.5],
  [118.25, -38.1, 9.5, 6.5],
  [-118.25, -6.35, 9.5, 6.5],
  [118.25, -6.35, 9.5, 6.5],
  [-118.25, 6.35, 9.5, 6.5],
  [118.25, 6.35, 9.5, 6.5],
  [-118.25, 38.1, 9.5, 6.5],
  [118.25, 38.1, 9.5, 6.5]
];

module stadium(w, h) offset(r = min(w, h) / 2 - 0.01) square([max(0.02, w - min(w, h) + 0.02), max(0.02, h - min(w, h) + 0.02)], center = true);

difference() {
  linear_extrude(base) offset(r = corner) offset(delta = -corner) square(panel, center = true);
  for (o = openings) translate([o[0], o[1], -0.01]) linear_extrude(base + 0.02) stadium(o[2], o[3]);
}
translate([0, 0, base]) linear_extrude(relief) import("the-olympus-master-rack-design.svg", center = true);
