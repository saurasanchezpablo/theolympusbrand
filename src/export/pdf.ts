// A small PDF writer for print-ready vector files: filled and stroked paths in
// millimetres, embedded grayscale images, named layers (optional content), and
// spot colours — "CutContour" for a cutter's path and "White" for an underbase,
// the names print providers' RIPs look for. Their on-screen alternate is gray,
// so the files stay in the brand's grayscale. No dates: the same input always
// gives the same bytes.

import { zlibSync, strToU8 } from 'fflate';
import type { Ring } from '../geometry/math.ts';

/** Gray 0 (black) – 1 (white), or a spot colour at a tint (1 = full). */
export type Paint = { gray: number } | { spot: string; tint?: number };

export type PdfItem =
  | { kind: 'fill'; layer: string; rings: Ring[]; paint: Paint; evenOdd?: boolean }
  | { kind: 'stroke'; layer: string; rings: Ring[]; paint: Paint; width: number }
  | { kind: 'image'; layer: string; gray: Uint8Array; px: [number, number]; at: [number, number, number, number]; clip?: Ring[] };

export type PdfPage = { width: number; height: number; items: PdfItem[] };

const MM = 72 / 25.4;
const f = (v: number) => {
  const s = v.toFixed(3);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};
const pdfString = (s: string) => `(${s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '?')})`;

function path(rings: Ring[]): string {
  return rings.map((r) => `${f(r[0][0])} ${f(r[0][1])} m ${r.slice(1).map(([x, y]) => `${f(x)} ${f(y)} l`).join(' ')} h`).join('\n');
}

/** A PDF of one or more pages (sizes in mm; coordinates in mm, origin bottom-left). */
export function pdf(title: string, pages: PdfPage[]): Uint8Array {
  const objects: (string | Uint8Array)[] = [];
  const add = (body: string | Uint8Array) => {
    objects.push(body);
    return objects.length;
  };
  const stream = (dict: string, data: Uint8Array) => {
    const head = strToU8(`<< ${dict} /Length ${data.length} >>\nstream\n`);
    const tail = strToU8('\nendstream');
    const out = new Uint8Array(head.length + data.length + tail.length);
    out.set(head);
    out.set(data, head.length);
    out.set(tail, head.length + data.length);
    return out;
  };

  // Reserve the catalogue and page tree.
  add('');
  add('');
  const layerNames = [...new Set(pages.flatMap((p) => p.items.map((i) => i.layer)))];
  const ocgs = layerNames.map((name) => add(`<< /Type /OCG /Name ${pdfString(name)} >>`));
  const spots = [...new Set(pages.flatMap((p) => p.items.flatMap((i) => (i.kind !== 'image' && 'spot' in i.paint ? [i.paint.spot] : []))))];
  // How each spot shows on screen: a cut path in black, white ink as a pale gray.
  const spotObjs = spots.map((name) => {
    const tint = add(`<< /FunctionType 2 /Domain [0 1] /C0 [1] /C1 [${name === 'White' ? '0.82' : '0'}] /N 1 >>`);
    return add(`[/Separation /${name.replace(/[^A-Za-z0-9]/g, '')} /DeviceGray ${tint} 0 R]`);
  });
  const overprint = add('<< /Type /ExtGState /OP true /op true /OPM 1 >>');

  const pageIds: number[] = [];
  for (const page of pages) {
    const images: number[] = [];
    let content = `${f(MM)} 0 0 ${f(MM)} 0 0 cm\n`;
    for (const it of page.items) {
      content += `/OC /oc${layerNames.indexOf(it.layer)} BDC\n`;
      if (it.kind === 'image') {
        const id = add(stream(`/Type /XObject /Subtype /Image /Width ${it.px[0]} /Height ${it.px[1]} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, zlibSync(it.gray, { level: 9 })));
        images.push(id);
        const [x, y, w, h] = it.at;
        content += `q\n${it.clip ? `${path(it.clip)}\nW n\n` : ''}${f(w)} 0 0 ${f(h)} ${f(x)} ${f(y)} cm /Im${images.length - 1} Do\nQ\n`;
      } else {
        const p = it.paint;
        const spot = 'spot' in p;
        const set = spot ? `/CS${spots.indexOf(p.spot)} ${it.kind === 'fill' ? 'cs' : 'CS'} ${f(p.tint ?? 1)} ${it.kind === 'fill' ? 'scn' : 'SCN'}` : `${f(p.gray)} ${it.kind === 'fill' ? 'g' : 'G'}`;
        content += `q\n${spot ? '/GSop gs\n' : ''}${set}\n`;
        if (it.kind === 'stroke') content += `${f(it.width / MM)} w 1 J 1 j\n${path(it.rings)}\nS\n`;
        else content += `${path(it.rings)}\n${it.evenOdd ? 'f*' : 'f'}\n`;
        content += 'Q\n';
      }
      content += 'EMC\n';
    }
    const contentId = add(stream('/Filter /FlateDecode', zlibSync(strToU8(content), { level: 9 })));
    const resources = `<< /Properties << ${layerNames.map((_, i) => `/oc${i} ${ocgs[i]} 0 R`).join(' ')} >> /ColorSpace << ${spots.map((_, i) => `/CS${i} ${spotObjs[i]} 0 R`).join(' ')} >> /ExtGState << /GSop ${overprint} 0 R >> /XObject << ${images.map((id, i) => `/Im${i} ${id} 0 R`).join(' ')} >> >>`;
    const w = f(page.width * MM);
    const h = f(page.height * MM);
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /TrimBox [0 0 ${w} ${h}] /Resources ${resources} /Contents ${contentId} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const info = add(`<< /Title ${pdfString(title)} /Producer (The Olympus) >>`);
  objects[0] = `<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [${ocgs.map((i) => `${i} 0 R`).join(' ')}] /D << /Order [${ocgs.map((i) => `${i} 0 R`).join(' ')}] /ON [${ocgs.map((i) => `${i} 0 R`).join(' ')}] >> >> >>`;

  // Serialise with a cross-reference table.
  const chunks: Uint8Array[] = [strToU8('%PDF-1.6\n%\xE2\xE3\xCF\xD3\n'.replace('\xE2\xE3\xCF\xD3', 'OLYM'))];
  let offset = chunks[0].length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const head = strToU8(`${i + 1} 0 obj\n`);
    const data = typeof body === 'string' ? strToU8(body) : body;
    const tail = strToU8('\nendobj\n');
    chunks.push(head, data, tail);
    offset += head.length + data.length + tail.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(strToU8(xref));
  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
