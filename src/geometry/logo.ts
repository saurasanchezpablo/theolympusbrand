// Import an external application logo (SVG) for the logo slot.
//
// The logo is reduced to its filled shapes in a single ink: colour, gradients
// and strokes are dropped, transforms are applied, and the result is one clean
// path at its own scale (the crest fits it into the slot). Shapes are painted
// in document order; a white (or near-white) fill cuts out what lies beneath. Supported: path,
// rect, circle, ellipse, polygon, polyline, nested <g> with transforms.
// Anything else is reported in `warnings` so the result can be checked.

import { XMLParser } from 'fast-xml-parser';
import svgpath from 'svgpath';
import { flatten, union, unionEvenOdd, difference, ringsPath } from './poly.ts';
import type { Ring } from './math.ts';

type Node = Record<string, unknown> & { ':@'?: Record<string, string> };

const SKIP = new Set(['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'linearGradient', 'radialGradient', 'filter', 'style', 'title', 'desc', 'metadata']);
const UNSUPPORTED = new Set(['use', 'text', 'image', 'foreignObject', 'line']);

const num = (v: string | undefined, fallback = 0) => (v === undefined ? fallback : parseFloat(v));

/** True for white and near-white fills (luminance ≥ 0.9): the logo's cut-outs. */
function isKnockout(fill: string | undefined): boolean {
  if (!fill) return false;
  const f = fill.trim().toLowerCase();
  if (f === 'white') return true;
  let rgb: number[] | null = null;
  const hex = f.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const fn = f.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (fn) rgb = fn.slice(1, 4).map(Number);
  if (!rgb) return false;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 >= 0.9;
}

function style(attrs: Record<string, string>, key: string): string | undefined {
  const inline = attrs.style?.split(';').map((s) => s.split(':').map((t) => t.trim())).find(([k]) => k === key)?.[1];
  return inline ?? attrs[key];
}

function shapeToPath(tag: string, a: Record<string, string>): string | null {
  switch (tag) {
    case 'path':
      return a.d ?? null;
    case 'rect': {
      const [x, y, w, h] = [num(a.x), num(a.y), num(a.width), num(a.height)];
      if (!(w > 0 && h > 0)) return null;
      const rx = Math.min(num(a.rx, num(a.ry)), w / 2);
      const ry = Math.min(num(a.ry, rx), h / 2);
      if (!rx) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case 'circle':
    case 'ellipse': {
      const [cx, cy] = [num(a.cx), num(a.cy)];
      const rx = tag === 'circle' ? num(a.r) : num(a.rx);
      const ry = tag === 'circle' ? num(a.r) : num(a.ry);
      if (!(rx > 0 && ry > 0)) return null;
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case 'polygon':
    case 'polyline': {
      const n = (a.points ?? '').trim().split(/[\s,]+/).map(Number);
      if (n.length < 6) return null;
      let d = `M${n[0]} ${n[1]}`;
      for (let i = 2; i + 1 < n.length; i += 2) d += `L${n[i]} ${n[i + 1]}`;
      return d + 'Z';
    }
    default:
      return null;
  }
}

/** Normalise any SVG path data to absolute M L C Q Z (arcs → curves, shorthands expanded, transform applied). */
function normalise(d: string, transform: string): string {
  return svgpath(d)
    .transform(transform)
    .abs()
    .unarc()
    .unshort()
    .iterate((seg, _i, x, y) => {
      if (seg[0] === 'H') return [['L', seg[1] as number, y]];
      if (seg[0] === 'V') return [['L', x, seg[1] as number]];
      return [seg];
    })
    .round(3)
    .toString();
}

export function importLogo(svgText: string): { d: string; warnings: string[] } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', preserveOrder: true });
  const tree = parser.parse(svgText) as Node[];
  const warnings = new Set<string>();
  let ink: Ring[] = [];

  const walk = (nodes: Node[], transform: string, inheritedFill: string | undefined, inheritedRule: string | undefined) => {
    for (const node of nodes) {
      const tag = Object.keys(node).find((k) => k !== ':@');
      if (!tag || tag === '#text' || tag === '?xml') continue;
      const attrs = node[':@'] ?? {};
      const children = (node[tag] as Node[]) ?? [];
      if (SKIP.has(tag)) continue;
      if (UNSUPPORTED.has(tag)) {
        warnings.add(tag === 'text' ? '<text> ignored — convert text to outlines before importing' : `<${tag}> ignored`);
        continue;
      }
      if (style(attrs, 'display') === 'none' || style(attrs, 'visibility') === 'hidden') continue;
      const t = `${transform} ${attrs.transform ?? ''}`.trim();
      const fill = style(attrs, 'fill') ?? inheritedFill;
      const rule = style(attrs, 'fill-rule') ?? inheritedRule;
      if (tag === 'svg' || tag === 'g' || tag === 'a') {
        walk(children, t, fill, rule);
        continue;
      }
      const d = shapeToPath(tag, attrs);
      if (!d) continue;
      if (fill === 'none') {
        if (style(attrs, 'stroke') && style(attrs, 'stroke') !== 'none') warnings.add('stroke-only shapes ignored — expand strokes to fills before importing');
        continue;
      }
      if (style(attrs, 'stroke') && style(attrs, 'stroke') !== 'none') warnings.add('strokes dropped — only fills are imported');
      if (style(attrs, 'opacity') || style(attrs, 'fill-opacity')) warnings.add('opacity ignored — the logo is drawn in one solid ink');
      const rings = flatten(normalise(d, t));
      const shape = rule === 'evenodd' ? unionEvenOdd(rings) : union(rings);
      ink = isKnockout(fill) ? difference(ink, shape) : union(ink, shape);
    }
  };
  walk(tree, '', undefined, undefined);
  if (!ink.length) throw new Error('importLogo: no filled shapes found in the SVG');
  return { d: ringsPath(ink), warnings: [...warnings] };
}
