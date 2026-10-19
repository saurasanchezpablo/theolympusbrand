// 3MF: the parts of a model as one object, so a slicer loads them together
// and lets each part take its own filament. Millimetres.

import { zipSync, strToU8 } from 'fflate';
import type { Mesh } from '../manufacturing/mesh.ts';

export type ThreeMfPart = { name: string; mesh: Mesh; tone: 'light' | 'dark' };

const TONES = { light: '#E6E6E6', dark: '#2B2B2B' } as const;
const num = (x: number) => {
  const s = x.toFixed(4);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function objectXml(id: number, part: ThreeMfPart, pindex: number): string {
  const p = part.mesh.positions;
  const verts: string[] = [];
  for (let i = 0; i < p.length; i += 3) verts.push(`<vertex x="${num(p[i])}" y="${num(p[i + 1])}" z="${num(p[i + 2])}"/>`);
  const tris: string[] = [];
  const t = part.mesh.triangles;
  for (let i = 0; i < t.length; i += 3) tris.push(`<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>`);
  return `<object id="${id}" type="model" name="${esc(part.name)}" pid="1" pindex="${pindex}"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`;
}

export function threeMf(title: string, parts: ThreeMfPart[]): Uint8Array {
  const tones = [...new Set(parts.map((p) => p.tone))];
  const objects = parts.map((part, i) => objectXml(i + 2, part, tones.indexOf(part.tone)));
  const assemblyId = parts.length + 2;
  const assembly =
    parts.length > 1
      ? `<object id="${assemblyId}" type="model" name="${esc(title)}"><components>${parts.map((_, i) => `<component objectid="${i + 2}"/>`).join('')}</components></object>`
      : '';
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Designer">The Olympus</metadata>
<resources>
<basematerials id="1">${tones.map((t) => `<base name="${t === 'light' ? 'Light' : 'Dark'}" displaycolor="${TONES[t]}"/>`).join('')}</basematerials>
${objects.join('\n')}
${assembly}
</resources>
<build><item objectid="${parts.length > 1 ? assemblyId : 2}"/></build>
</model>
`;
  return zipSync(
    {
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>\n',
      ),
      '_rels/.rels': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>\n',
      ),
      '3D/3dmodel.model': strToU8(model),
    },
    { level: 6 },
  );
}
