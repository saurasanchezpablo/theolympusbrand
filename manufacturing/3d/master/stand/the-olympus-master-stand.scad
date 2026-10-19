// The Olympus — Desk stand
// Desk stand — A slotted foot that holds a medallion upright on a desk or shelf.
//
// Parametric source for OpenSCAD 2021.01 or later. Open it, change the values
// below (or use Window → Customizer), then Design → Render and File → Export
// → STL. 
// Print flat, design up, no supports.

/* [Dimensions] */
diameter = 100;       // [40:1:300] Medallion diameter (mm)
slot = 4.2;           // [1.6:0.1:16] Medallion thickness (mm)
clearance = 0.3;      // [0:0.05:1] Clearance (mm)
depth = 10;           // [4:0.5:30] Slot depth (mm)

/* [Hidden] */
$fn = 160;

slot_w = slot + clearance;
r0 = diameter / 2;
chord = 2 * sqrt(max(0, r0 * r0 - pow(r0 - depth, 2)));
slot_l = chord + 4;
length = slot_l + 24;
width = max(28, slot_w + 20);
floor_h = 3;

module rounded(l, w, r) offset(r = r) square([l - 2 * r, w - 2 * r], center = true);

difference() {
  linear_extrude(floor_h + depth) rounded(length, width, 5);
  translate([0, 0, floor_h]) linear_extrude(depth + 0.01) rounded(slot_l, slot_w, min(slot_w / 2 - 0.01, 1));
}
