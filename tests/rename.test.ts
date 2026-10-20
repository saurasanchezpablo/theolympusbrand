// Fully modular: a service's name lives in its catalogue file and nowhere
// else. Rename it, rebuild, and nothing the house makes from it still says
// the old name — in capitals, letter-spaced, escaped, or in any other form.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.ts';
import { resolve, type ServiceSpec } from '../src/catalog/service.ts';
import { baseMarks, lockups, svgFiles } from '../src/catalog/fileset.ts';
import { webIcons } from '../src/catalog/webicons.ts';
import { integrationKit } from '../src/integrations/kit.ts';
import { screensKit } from '../src/screens/screens.ts';

const spec = (name: string): ServiceSpec => ({ id: 'vault', name, category: 'security', god: 'athena', app: 'vaultwarden', caption: `${name} · keys`, description: `${name}, the passwords` });

/** Every text the house makes from one service: its marks' files, web icons, integration kit, screens and terminal kit. */
async function everything(name: string): Promise<string[]> {
  const s = resolve(spec(name));
  const base = baseMarks(s.patron);
  const marks = { ...base, ...lockups(base['crest-fine'], s) };
  const texts: string[] = svgFiles(s, marks).map((f) => f.svg);
  const web = webIcons(marks.seal, { name: `${s.name} · The Olympus`, short: s.name });
  texts.push(...web.files.map((f) => f.data));
  const kit = await integrationKit(
    { entries: [{ id: s.id, name: s.name, category: s.category, description: s.description, url: s.url, app: s.app }], marks: () => ({ seal: marks.seal, emblem: marks['emblem-fine'], crest: marks['crest-fine'] }) },
    { png: () => new Uint8Array() },
  );
  const screens = await screensKit(
    { id: s.id, name: s.name, caption: s.caption, url: s.url, marks: { crest: marks['crest-fine'], seal: marks.seal } },
    { png: () => new Uint8Array(), ground: () => new Uint8Array(), sha256: () => '0'.repeat(64) },
    { wallpapers: false },
  );
  for (const f of [...kit, ...screens]) if (typeof f.data === 'string') texts.push(f.data);
  return texts;
}

/** The name as any output might set it: letters only, case and spacing and escapes ignored. */
const letters = (t: string) => t.toLowerCase().replace(/[^a-z]/g, '');

test('renaming a service changes everything made from it: no trace of the old name', async () => {
  const before = await everything('Zyxquor Vault');
  assert.ok(before.some((t) => letters(t).includes('zyxquor')), 'the name is used (the test would prove nothing otherwise)');
  const after = await everything('Plimbex Vault');
  const stale = after.filter((t) => letters(t).includes('zyxquor'));
  assert.equal(stale.length, 0, `still naming the old service:\n${stale.map((t) => t.slice(0, 120)).join('\n')}`);
  assert.ok(after.filter((t) => letters(t).includes('plimbex')).length >= before.filter((t) => letters(t).includes('zyxquor')).length, 'the new name everywhere the old one was');
});
