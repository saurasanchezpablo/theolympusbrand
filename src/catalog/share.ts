// A design in a link: the spec and its logo, compressed into the part of the
// address after the #, which browsers never send to the server. Opening the
// link opens the design in the Atelier, unsaved. What a link carries is read
// as untrusted input: decompressed with a ceiling and validated like any
// imported file.

import { deflateSync, Inflate, strFromU8, strToU8 } from 'fflate';
import { validateSpec, type ServiceSpec } from './service.ts';

export type Shared = { spec: ServiceSpec; logoSvg?: string };

/** Format marker: a future format can be told apart and refused cleanly. */
const PREFIX = '1.';
/** The most a link may unpack to. A design is a few hundred bytes; a logo, some kilobytes. */
export const SHARE_MAX_BYTES = 256 * 1024;
/** Links longer than this may be cut short by chat apps and mail clients. */
export const SHARE_LONG_LINK = 8000;

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('The link is damaged: it has characters a design link never contains.');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** The code for a design: what follows `#/atelier/share/`. */
export function shareCode(d: Shared): string {
  const { logo: _, ...spec } = d.spec;
  const json = JSON.stringify(d.logoSvg ? { spec, logoSvg: d.logoSvg } : { spec });
  return PREFIX + toBase64Url(deflateSync(strToU8(json), { level: 9 }));
}

/** Read a code back; throws a readable message when it cannot be used. */
export function readShareCode(code: string): Shared {
  if (!code.startsWith(PREFIX)) throw new Error('This link was made by a different version of the Atelier, or is not a design link.');
  const packed = fromBase64Url(code.slice(PREFIX.length));
  const chunks: Uint8Array[] = [];
  let size = 0;
  const inflate = new Inflate((chunk) => {
    size += chunk.length;
    if (size > SHARE_MAX_BYTES) throw new Error('The link unpacks to more than a design can hold.');
    chunks.push(chunk);
  });
  try {
    inflate.push(packed, true);
  } catch (e) {
    throw new Error((e as Error).message.startsWith('The link') ? (e as Error).message : 'The link is damaged: it could not be unpacked.');
  }
  const bytes = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    bytes.set(c, o);
    o += c.length;
  }
  let raw: { spec?: unknown; logoSvg?: unknown };
  try {
    raw = JSON.parse(strFromU8(bytes));
  } catch {
    throw new Error('The link is damaged: its contents are not a design.');
  }
  if (!raw || typeof raw !== 'object') throw new Error('The link is damaged: its contents are not a design.');
  const spec = validateSpec(raw.spec, 'shared design');
  if (raw.logoSvg !== undefined && typeof raw.logoSvg !== 'string') throw new Error('The link is damaged: its logo is not SVG text.');
  const { logo: _, ...rest } = spec;
  return raw.logoSvg ? { spec: { ...rest, logo: `logos/${spec.id}.svg` }, logoSvg: raw.logoSvg as string } : { spec: rest };
}
