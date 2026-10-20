// Hostile text: a service whose name and caption try to break out of every
// kind of file the house writes. The validator refuses it; and every file is
// built safe on its own, so these tests feed the text straight in, past the
// validator — nothing may run, every file must still parse.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import './helpers.ts';
import { validateSpec, resolve, type ServiceSpec } from '../src/catalog/service.ts';
import { baseMarks } from '../src/catalog/fileset.ts';
import { webIcons } from '../src/catalog/webicons.ts';
import { integrationKit } from '../src/integrations/kit.ts';
import { servicesCsv } from '../src/integrations/dashboards.ts';
import { screensKit, motdScript, wallpaperInstall, wallpaperList, issue } from '../src/screens/screens.ts';
import { fastfetchConfig } from '../src/screens/shell.ts';
import { guideMarked } from '../app/src/site/markdown.ts';

const dir = mkdtempSync(join(tmpdir(), 'olympus-hostile-'));
const RAN = join(dir, 'RAN');
// Every way out we know of: newlines and heredoc ends, substitutions, quotes, comment ends, templates, markup.
const NAME = `Evil' "x" $(touch ${RAN}) \`touch ${RAN}\` */ --> {{x}} <img src=x onerror=alert(1)> | * _ [a](javascript:alert(1))\nXML\nART\ntouch ${RAN}\n#`;
const CAPTION = `x\nART\ntouch ${RAN} \\e[2J\u001b]52;c;cGF5bG9hZA==\u0007`;

const hostile = { ...resolve({ id: 'evil', name: 'Evil', category: 'security' }), name: NAME, caption: CAPTION, app: 'vaultwarden' };
const marks = baseMarks(hostile.patron);
const subject = { id: hostile.id, name: NAME, caption: CAPTION, url: 'https://evil.theolympus.cloud', marks: { crest: marks['crest-fine'], seal: marks.seal } };

test.after(() => rmSync(dir, { recursive: true, force: true }));

test('the validator refuses control characters, oversized text, odd addresses and logos outside catalog/logos/', () => {
  const ok: ServiceSpec = { id: 'fine', name: 'Fine', category: 'web' };
  assert.doesNotThrow(() => validateSpec(ok));
  for (const bad of [
    { name: 'two\nlines' },
    { name: 'x'.repeat(49) },
    { caption: 'a\u001b[2Jb' },
    { description: 'tab\there' },
    { url: "https://x.y/'$(id)'" },
    { url: 'https://x.y/<script>' },
    { url: 'javascript:alert(1)' },
    { logo: '../../etc/x.svg' },
    { logo: 'logos/../../x.svg' },
  ])
    assert.throws(() => validateSpec({ ...ok, ...bad }), JSON.stringify(bad));
});

test('the message of the day runs as root: hostile text is printed, never run', () => {
  const script = join(dir, 'motd');
  writeFileSync(script, motdScript(subject));
  for (const shell of ['dash', 'bash']) {
    const out = execFileSync(shell, [script], { encoding: 'utf8' });
    assert.ok(!existsSync(RAN), `${shell}: nothing ran`);
    assert.ok(!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(out), `${shell}: no control characters reach the terminal`);
  }
  // The console login: getty's backslash escapes are doubled.
  assert.ok(!/[^\\]\\e/.test(issue(subject).split('\n').filter((l) => !l.includes('\\n - \\l')).join('\n')));
});

test('the wallpaper installer runs as root: the name cannot add a line, and the GNOME list is well-formed', () => {
  const plain = wallpaperInstall({ ...subject, name: 'Plain' });
  assert.equal(wallpaperInstall(subject).split('\n').length, plain.split('\n').length, 'the same lines as with a plain name');
  execFileSync('dash', ['-n', '-c', wallpaperInstall(subject)]);
  assert.ok(XMLValidator.validate(wallpaperList(subject)) === true);
});

test('fastfetch, Vaultwarden, head.html: the text stays text', () => {
  const ff = JSON.parse(fastfetchConfig(subject).replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(ff.modules.filter((m: unknown) => typeof m === 'object').length, 1, 'one custom module, nothing injected');
  assert.ok(!/[{}]/.test(ff.modules[0].format), 'no fastfetch placeholders');
  const head = webIcons(marks.seal, { name: NAME, short: 'x' }).files.find((f) => f.path === 'head.html')!.data;
  assert.equal(head.split('-->').length, 2, 'the comment closes once');
  assert.ok(!head.includes('<img'));
});

test('the integration kit and the screens: every script parses, every guide renders without markup, every list keeps its rows', async () => {
  const entries = [{ id: hostile.id, name: NAME, category: hostile.category, description: CAPTION, app: 'vaultwarden' }];
  const kit = await integrationKit({ entries, marks: () => ({ seal: marks.seal, emblem: marks['emblem-fine'], crest: marks['crest-fine'] }) }, { png: () => new Uint8Array() });
  const screens = await screensKit(subject, { png: () => new Uint8Array(), ground: () => new Uint8Array(), sha256: () => '0'.repeat(64) }, { wallpapers: true });
  const scss = kit.find((f) => f.path === 'themes/vaultwarden/user.vaultwarden.scss.hbs')!.data as string;
  assert.ok(!/\{\{|\}\}/.test(scss), 'nothing for Handlebars');
  assert.equal(scss.split('*/').length, scss.split('/*').length, 'every comment closes where it should');
  for (const f of [...kit, ...screens]) {
    if (typeof f.data !== 'string') continue;
    if (f.path.endsWith('.sh')) execFileSync('dash', ['-n', '-c', f.data]);
    if (/\.(xml|svg|itermcolors|terminal)$/.test(f.path)) assert.ok(XMLValidator.validate(f.data) === true, f.path);
    if (f.path.endsWith('.md')) {
      const html = guideMarked.parse(f.data) as string;
      assert.ok(!/<(script|style|iframe|form|img(?![^>]*src="\.\.\/))\b|<[^>]+\son\w+=|href="javascript:/i.test(html), `${f.path}: renders without markup`);
    }
  }
  assert.ok(!existsSync(RAN));
  assert.equal(servicesCsv(entries).trim().split('\n').length, 2, 'the CSV keeps one row per service');
  assert.ok(readdirSync(dir).every((f) => f !== 'RAN'));
});
