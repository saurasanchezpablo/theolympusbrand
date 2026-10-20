// The Olympus — Wax-seal stamp
// Wax-seal stamp — The seal, mirrored, on a die with a turned handle — to seal letters in wax with the house’s mark.
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
// It reads the-olympus-master-seal.svg, which must stay beside it.
// Print flat, design up, no supports.

/* [Dimensions] */
diameter = 58;            // [20:0.5:60] Die diameter (mm)
flange = 0.8;             // [0.4:0.1:3] Flange (mm)
base = 7;                 // [4:0.1:14] Die thickness (mm)
relief = 1.2;             // [0.6:0.1:2.5] Relief depth (mm)
height = 60;              // [30:1:100] Handle length (mm)
clearance = 0.25;         // [0:0.05:0.6] Peg clearance (mm)

/* [Hidden] */
$fn = 160;

// The design, centred and scaled so its rim spans the plate inside the flange.
module mark(d) resize([d, 0], auto = true) import("the-olympus-master-seal.svg", center = true);

// Which part to export: "die" and "handle" for two STLs, "both" to preview.
part = "both"; // [both, die, handle]

socket_depth = min(5, base - 1.6);
peg_r = min(4.5, diameter / 2 * 0.3);

// The handle's profile, [r, z] from its knob (on the bed) to the tip of its peg.
profile = [[11.2, 0], [11.217, 0.48], [11.269, 0.96], [11.353, 1.44], [11.467, 1.92], [11.61, 2.4], [11.777, 2.88], [11.964, 3.36], [12.167, 3.84], [12.381, 4.32], [12.6, 4.8], [12.819, 5.28], [13.033, 5.76], [13.236, 6.24], [13.423, 6.72], [13.59, 7.2], [13.733, 7.68], [13.847, 8.16], [13.931, 8.64], [13.983, 9.12], [14, 9.6], [13.99, 10.094], [13.962, 10.588], [13.916, 11.082], [13.854, 11.576], [13.777, 12.071], [13.69, 12.565], [13.593, 13.059], [13.492, 13.553], [13.388, 14.047], [13.287, 14.541], [13.19, 15.035], [13.103, 15.529], [13.026, 16.024], [12.964, 16.518], [12.918, 17.012], [12.89, 17.506], [12.88, 18], [12.841, 18.5], [12.724, 19], [12.533, 19.5], [12.274, 20], [11.955, 20.5], [11.585, 21], [11.176, 21.5], [10.74, 22], [10.29, 22.5], [9.84, 23], [9.404, 23.5], [8.995, 24], [8.625, 24.5], [8.306, 25], [8.047, 25.5], [7.856, 26], [7.739, 26.5], [7.7, 27], [7.7, 27.488], [7.7, 27.975], [7.7, 28.463], [7.7, 28.95], [7.7, 29.438], [7.7, 29.925], [7.7, 30.412], [7.7, 30.9], [7.7, 31.388], [7.7, 31.875], [7.7, 32.362], [7.7, 32.85], [7.7, 33.338], [7.7, 33.825], [7.7, 34.313], [7.7, 34.8], [7.707, 35.292], [7.728, 35.785], [7.762, 36.277], [7.81, 36.769], [7.871, 37.262], [7.945, 37.754], [8.031, 38.246], [8.128, 38.738], [8.237, 39.231], [8.356, 39.723], [8.485, 40.215], [8.622, 40.708], [8.768, 41.2], [8.92, 41.692], [9.078, 42.185], [9.241, 42.677], [9.408, 43.169], [9.578, 43.662], [9.749, 44.154], [9.921, 44.646], [10.092, 45.138], [10.262, 45.631], [10.429, 46.123], [10.592, 46.615], [10.75, 47.108], [10.903, 47.6], [11.048, 48.092], [11.185, 48.585], [11.314, 49.077], [11.433, 49.569], [11.542, 50.062], [11.639, 50.554], [11.725, 51.046], [11.799, 51.538], [11.86, 52.031], [11.908, 52.523], [11.942, 53.015], [11.963, 53.508], [11.97, 54], [11.993, 54.5], [12.059, 55], [12.165, 55.5], [12.302, 56], [12.463, 56.5], [12.635, 57], [12.807, 57.5], [12.968, 58], [13.105, 58.5], [13.211, 59], [13.277, 59.5], [13.3, 60], [4.5, 60], [4.5, 64.1], [4, 64.6]];

if (part != "handle") {
  difference() {
    cylinder(d = diameter, h = base);
    translate([0, 0, -0.01]) cylinder(r = peg_r + clearance / 2, h = socket_depth + 0.01);
  }
  // Mirrored, so the impression reads the right way.
  translate([0, 0, base]) linear_extrude(relief) mirror([1, 0]) mark(diameter - 2 * flange);
}
if (part != "die") translate([49, 0, 0]) rotate_extrude($fn = 96) polygon(concat([[0, 0]], profile, [[0, profile[len(profile) - 1][1]]]));
