// OpenSCAD source for each product: the editable, parametric form of the
// models. It rebuilds the same object from the print-edition SVG (or, for the
// nameplate, from its laid-out design; for the lithophane, from its
// heightmap), so dimensions can be changed in OpenSCAD and re-exported.
// The STL and 3MF files are generated and validated separately (mesh.ts);
// this file is their source, not their proof.

import { PRODUCTS, KEYHOLE_SPEC, type Model } from './products.ts';

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, ''));

/**
 * The SCAD source of a model. `files` names what it reads: the mark SVG, the
 * nameplate's design SVG, or the lithophane's heightmap PNG.
 */
export function scadSource(model: Model, title: string, files: { mark?: string; art?: string; heightmap?: { file: string; pixels: number } }): string {
  const spec = PRODUCTS[model.product];
  const p = model.params;
  const vars = spec.params.map((s) => {
    const range = s.kind === 'number' ? `[${s.min}:${s.step}:${s.max}] ` : s.kind === 'toggle' ? '[0:off, 1:on] ' : `[${s.options!.map((o, i) => `${i}:${o}`).join(', ')}] `;
    const line = `${snake(s.key)} = ${n(p[s.key])};`;
    return `${line}${' '.repeat(Math.max(1, 26 - line.length))}// ${range}${s.label}${s.unit && s.unit !== '%' ? ` (${s.unit})` : s.unit === '%' ? ' (%)' : ''}`;
  });
  const reads = [files.mark, files.art, files.heightmap?.file].filter(Boolean);
  const head = `// ${title}
// ${spec.name} — ${spec.summary}
//
// Parametric source for OpenSCAD 2021.01 or later. Change the values below
// (or use Window → Customizer), then Design → Render and File → Export → STL.
${reads.length ? `// It reads ${reads.join(' and ')}, which must stay beside it.\n` : ''}// Print flat, design up, no supports.

/* [Dimensions] */
${vars.join('\n')}

/* [Hidden] */
$fn = 160;
`;
  const mark = files.mark
    ? `
// The design, centred and scaled so its rim spans the plate inside the flange.
module mark(d) resize([d, 0], auto = true) import("${files.mark}", center = true);
`
    : '';
  const back = backModule(model);
  let body = '';
  switch (model.product) {
    case 'medallion':
      body = `
difference() {
  cylinder(d = diameter, h = base);
  back();
}
translate([0, 0, base]) linear_extrude(relief) mark(diameter - 2 * flange);
`;
      break;
    case 'two-colour':
      body = `
// Which part to export: "plate" and "relief" for two STLs, "both" to preview.
part = "both"; // [both, plate, relief]

if (part != "relief") color("#2B2B2B") difference() {
  cylinder(d = diameter, h = base);
  back();
}
if (part != "plate") color("#E6E6E6") translate([0, 0, base]) linear_extrude(relief) mark(diameter - 2 * flange);
`;
      break;
    case 'engraved':
      body = `
difference() {
  cylinder(d = diameter, h = thickness);
  translate([0, 0, thickness - depth]) linear_extrude(depth + 0.01) mark(diameter - 2 * flange);
  back();
}
`;
      break;
    case 'coaster':
      body = `
pad = diameter - 2 * max(3, flange);
difference() {
  cylinder(d = diameter, h = thickness);
  translate([0, 0, thickness - depth]) linear_extrude(depth + 0.01) mark(diameter - 2 * flange);
  if (recess == 1) translate([0, 0, -0.01]) cylinder(d = pad, h = recess_depth + 0.01);
}
`;
      break;
    case 'nameplate':
      body = `
// The plate's size follows the laid-out design (${model.size[0]} × ${model.size[1]} mm here):
// regenerate the design SVG to change the height, the layout or the caption.
plate = [${n(model.size[0])}, ${n(model.size[1])}];

difference() {
  linear_extrude(base) offset(r = corner) offset(delta = -corner) square(plate, center = true);
  back();
}
translate([0, 0, base]) linear_extrude(relief) import("${files.art}", center = true);
`;
      break;
    case 'lithophane': {
      const px = files.heightmap!.pixels;
      body = `
inner = diameter / 2 - frame;

// The picture: the heightmap's brightness is the thickness (white = thickest).
module picture() intersection() {
  translate([0, 0, min_thickness])
    scale([2 * inner / ${px}, 2 * inner / ${px}, (max_thickness - min_thickness) / 100])
      surface(file = "${files.heightmap!.file}", center = true);
  cylinder(r = inner, h = max_thickness + 1);
}

union() {
  cylinder(r = inner, h = min_thickness + 0.01);
  picture();
  difference() {
    cylinder(d = diameter, h = max_thickness);
    translate([0, 0, -1]) cylinder(r = inner, h = max_thickness + 2);
  }
}
`;
      break;
    }
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
translate([0, 0, base]) linear_extrude(relief) mark(diameter - 2 * flange);
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
  return head + mark + back + body;
}

/** The back features exactly where the model put them. */
function backModule(model: Model): string {
  if (!['medallion', 'two-colour', 'engraved', 'nameplate'].includes(model.product)) return '';
  const k = KEYHOLE_SPEC;
  const parts: string[] = [];
  for (const f of model.back) {
    if (f.kind === 'magnets')
      parts.push(`  // Magnet pockets.\n  for (c = [${f.centres.map(([x, y]) => `[${n(x)}, ${n(y)}]`).join(', ')}]) translate([c[0], c[1], -0.01]) cylinder(d = magnet_diameter, h = magnet_depth + 0.01);`);
    if (f.kind === 'keyhole')
      parts.push(`  // Keyhole: a lip over a wider chamber.
  translate([${n(f.x)}, ${n(f.y)}, 0]) {
    translate([0, 0, -0.01]) linear_extrude(${n(k.lip)} + 0.01) slot(${n(k.shank / 2)}, ${n(k.head / 2)}, 0);
    translate([0, 0, ${n(k.lip)}]) linear_extrude(${n(k.chamber)}) slot(${n(k.head / 2)}, ${n(k.head / 2 + 0.2)}, 0.4);
  }`);
    if (f.kind === 'inscription')
      parts.push(`  // Inscription, mirrored to read from behind (needs the Jost font installed).
  translate([0, ${n(f.y)}, -0.01]) mirror([1, 0, 0]) linear_extrude(${n(f.depth)} + 0.01) {
${f.lines.map((l, i) => `    translate([0, ${n(f.lines.slice(0, i + 1).reduce((s, x) => s - x.cap, f.lines.reduce((s, x) => s + x.cap, 0) / 2 + (0.75 * f.lines[0].cap * (f.lines.length - 1)) / 2) - 0.75 * f.lines[0].cap * i)}]) text("${l.text.replace(/"/g, '\\"')}", size = ${n(l.cap / 0.7)}, font = "Jost:style=SemiBold", halign = "center", spacing = 1.14);`).join('\n')}
  }`);
  }
  return `
// What is cut into the back. Positions are where the generator placed them.
module slot(hw, r, extra) union() {
  circle(r);
  translate([-hw, 0]) square([2 * hw, ${n(k.travel)} + extra]);
  translate([0, ${n(k.travel)} + extra]) circle(hw);
}
module back() {
${parts.join('\n') || '  // (none)'}
}
`;
}
