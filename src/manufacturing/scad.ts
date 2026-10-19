// OpenSCAD source for each product: the editable, parametric form of the
// models. It rebuilds the same object from the print-edition SVG, so every
// dimension can be changed in OpenSCAD (or its Customizer) and re-exported.
// The STL and 3MF files are generated and validated separately (mesh.ts);
// this file is their source, not their proof.

import { PRODUCTS, type ProductId, type Params } from './products.ts';

const line = (key: string, value: number, comment: string, range?: [number, number, number]) =>
  `${key} = ${value};${' '.repeat(Math.max(1, 18 - key.length - String(value).length))}// ${range ? `[${range[0]}:${range[2]}:${range[1]}] ` : ''}${comment}`;

/** The SCAD source of a product. `markFile` is the print SVG placed beside it. */
export function scadSource(id: ProductId, params: Required<Params>, title: string, markFile: string | null): string {
  const spec = PRODUCTS[id];
  const keys = spec.params.map((p) => p.key);
  const vars = spec.params.map((p) => line(p.key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), params[p.key], `${p.label}${p.unit ? ` (${p.unit})` : ''}`, [p.min, p.max, p.step]));
  const head = `// ${title}
// ${spec.name} — ${spec.summary}
//
// Parametric source for OpenSCAD 2021.01 or later. Open it, change the values
// below (or use Window → Customizer), then Design → Render and File → Export
// → STL. ${markFile ? `It reads ${markFile}, which must stay beside it.` : ''}
// Print flat, design up, no supports.

/* [Dimensions] */
${vars.join('\n')}

/* [Hidden] */
$fn = 160;
`;
  const mark = markFile
    ? `
// The design, centred and scaled so its rim spans the plate inside the flange.
module mark() resize([diameter - 2 * flange, 0], auto = true) import("${markFile}", center = true);
`
    : '';
  const pockets = keys.includes('magnets')
    ? `
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
`
    : '';
  let body = '';
  switch (id) {
    case 'medallion':
      body = `
difference() {
  cylinder(d = diameter, h = base);
  pockets();
}
translate([0, 0, base]) linear_extrude(relief) mark();
`;
      break;
    case 'two-colour':
      body = `
// Which part to export: "plate" and "relief" for two STLs, "both" to preview.
part = "both"; // [both, plate, relief]

if (part != "relief") color("#2B2B2B") difference() {
  cylinder(d = diameter, h = base);
  pockets();
}
if (part != "plate") color("#E6E6E6") translate([0, 0, base]) linear_extrude(relief) mark();
`;
      break;
    case 'engraved':
      body = `
difference() {
  cylinder(d = diameter, h = thickness);
  translate([0, 0, thickness - depth]) linear_extrude(depth + 0.01) mark();
  pockets();
}
`;
      break;
    case 'token':
      body = `
lug_r = hole / 2 + 3;
lug_y = diameter / 2 + lug_r * 0.55;
linear_extrude(base) difference() {
  union() {
    circle(d = diameter);
    translate([0, lug_y]) circle(r = lug_r);
  }
  translate([0, lug_y]) circle(d = hole);
}
translate([0, 0, base]) linear_extrude(relief) mark();
`;
      break;
    case 'stand':
      body = `
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
`;
      break;
  }
  return head + mark + pockets + body;
}
