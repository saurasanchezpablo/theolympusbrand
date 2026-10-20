// Screens: wallpapers are the sizes they say, in gray; the terminal art is
// plain text a terminal shows as it is; the install scripts do what they say
// on a stand-in system, keep what they replace, and put it back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import './helpers.ts';
import { crest, seal } from '../src/geometry/crest.ts';
import { DOMAIN } from '../src/brand/identity.ts';
import { braille, ascii } from '../src/screens/terminal.ts';
import { grubScript, issue, motd, motdScript, plymouthInstall, plymouthScript, sshBanner, terminalInstall, wallpaperName, wallpaperSvg, WALLPAPER_SIZES, WALLPAPER_STYLES, type ScreenSubject, type WallpaperSize, type WallpaperStyle } from '../src/screens/screens.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const KIT = join(ROOT, 'assets/screens');
const master: ScreenSubject = { id: 'master', name: 'The Olympus', caption: DOMAIN, url: `https://${DOMAIN}`, marks: { crest: crest(), seal: seal() } };
const service: ScreenSubject = { id: 'jellyfin', name: 'Jellyfin', caption: 'The Olympus · APOLLO', url: 'https://jellyfin.theolympus.cloud', marks: { crest: crest({ patron: { god: 'apollo' } }), seal: seal({ patron: { god: 'apollo' } }) } };

const ihdr = (file: string) => {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], colour: b[25] };
};

test('terminal drawings: braille dots and ASCII ramp follow the ink', () => {
  const box = 'M0 0L100 0L100 100L0 100Z';
  assert.deepEqual(braille(box, 100, 100, 4), Array(2).fill('\u28FF'.repeat(4)));
  assert.deepEqual(ascii(box, 100, 100, 6), Array(3).fill('@'.repeat(6)));
  // Half the box inked: the left half only.
  const left = braille('M0 0L50 0L50 100L0 100Z', 100, 100, 4);
  assert.ok(left.every((l) => l === '\u28FF'.repeat(2)), left.join('|'));
});

test('the message of the day, console login and SSH banner are plain, narrow text', () => {
  for (const s of [master, service]) {
    for (const text of [motd(s, 'braille'), motd(s, 'ascii'), issue(s), sshBanner(s)]) {
      assert.ok(!text.includes('\u001b'), 'no escape codes');
      for (const l of text.split('\n')) assert.ok([...l].length <= 80, `${[...l].length}: ${l}`);
      assert.ok(text.includes(s.name.toUpperCase().split(' ').map((w) => [...w].join(' ')).join('   ')));
    }
    assert.ok([...sshBanner(s)].every((c) => c.charCodeAt(0) < 128), 'the SSH banner is ASCII');
    assert.ok([...motd(s, 'ascii')].every((c) => c.charCodeAt(0) < 128));
    // Getty expands backslash sequences in /etc/issue: only the two meant ones.
    assert.deepEqual(issue(s).match(/\\./g), ['\\n', '\\l']);
  }
  assert.ok(motd(service, 'braille').includes('https://jellyfin.theolympus.cloud'));
  assert.ok(!motd(master, 'braille').includes('https://'), 'the master’s caption is its address already');
  assert.ok(sshBanner(master).includes('Authorised access only'));
});

test('the MOTD script prints the art and the host', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-motd-'));
  try {
    const script = join(dir, '20-the-olympus');
    writeFileSync(script, motdScript(service).replaceAll('/etc/default/the-olympus', join(dir, 'default')));
    for (const shell of ['dash', 'bash']) {
      execFileSync(shell, ['-n', script]);
      const out = execFileSync(shell, [script]).toString();
      assert.ok(out.includes(motd(service, 'braille').trimEnd()), shell);
      assert.match(out, / · up /);
    }
    writeFileSync(join(dir, 'default'), 'OLYMPUS_ART=ascii\n');
    assert.ok(execFileSync('sh', [script]).toString().includes(motd(service, 'ascii').trimEnd()));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A stand-in system: the script's absolute paths moved under `sys`, the root check passed, commands stubbed. */
function standIn(script: string, sys: string, paths: string[]) {
  let s = script.replace('[ "$(id -u)" = 0 ]', 'true');
  for (const p of paths) s = s.split(p).join(join(sys, p));
  return s;
}

function stub(bin: string, name: string, body: string) {
  writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
}

test('the GRUB script sets the background once, keeps the original and restores it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-grub-'));
  try {
    const sys = join(dir, 'sys');
    const bin = join(dir, 'bin');
    mkdirSync(join(sys, 'etc/default'), { recursive: true });
    mkdirSync(join(sys, 'boot/grub'), { recursive: true });
    mkdirSync(bin);
    const original = 'GRUB_DEFAULT=0\n#GRUB_BACKGROUND="/old.png"\nGRUB_TIMEOUT=5\n';
    writeFileSync(join(sys, 'etc/default/grub'), original);
    stub(bin, 'update-grub', `echo ran >> ${join(dir, 'updates')}`);
    writeFileSync(join(dir, 'background.png'), 'png');
    writeFileSync(join(dir, 'install.sh'), standIn(grubScript(), sys, ['/etc/default/grub', '/boot/grub/']));
    const run = (...a: string[]) => execFileSync('sh', [join(dir, 'install.sh'), ...a], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }).toString();
    execFileSync('dash', ['-n', join(dir, 'install.sh')]);
    run();
    run(); // twice: still one line
    const conf = readFileSync(join(sys, 'etc/default/grub'), 'utf8');
    assert.equal(conf.match(/GRUB_BACKGROUND=/g)?.length, 1);
    assert.ok(conf.includes(`GRUB_BACKGROUND="${join(sys, '/boot/grub/')}the-olympus.png"`), conf);
    assert.ok(conf.includes('GRUB_GFXMODE='));
    assert.equal(readFileSync(join(sys, 'boot/grub/the-olympus.png'), 'utf8'), 'png');
    assert.equal(readFileSync(join(sys, 'etc/default/grub.the-olympus.orig'), 'utf8'), original);
    run('--restore');
    assert.equal(readFileSync(join(sys, 'etc/default/grub'), 'utf8'), original);
    assert.ok(!existsSync(join(sys, 'boot/grub/the-olympus.png')));
    assert.equal(readFileSync(join(dir, 'updates'), 'utf8').trim().split('\n').length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the terminal script installs the MOTD, login and SSH banner, checks sshd, and restores', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-term-'));
  try {
    const sys = join(dir, 'sys');
    const bin = join(dir, 'bin');
    for (const d of ['etc/update-motd.d', 'etc/ssh/sshd_config.d', 'etc/default']) mkdirSync(join(sys, d), { recursive: true });
    mkdirSync(bin);
    writeFileSync(join(sys, 'etc/issue'), 'Debian GNU/Linux 12 \\n \\l\n');
    writeFileSync(join(sys, 'etc/ssh/sshd_config'), 'Include /etc/ssh/sshd_config.d/*.conf\nPermitRootLogin no\n');
    stub(bin, 'sshd', `[ -f ${join(dir, 'sshd-fails')} ] && exit 1; exit 0`);
    stub(bin, 'systemctl', `echo "$@" >> ${join(dir, 'reloads')}`);
    for (const f of ['20-the-olympus', 'issue', 'issue.net']) writeFileSync(join(dir, f), f);
    writeFileSync(join(dir, 'install.sh'), standIn(terminalInstall(), sys, ['/etc/update-motd.d', '/etc/ssh/the-olympus-banner', '/etc/ssh/sshd_config.d/the-olympus.conf', '/etc/default/the-olympus', '/etc/issue']).replace("grep -qi '^Include /etc/ssh/sshd_config.d/' /etc/ssh/sshd_config", `grep -qi '^Include /etc/ssh/sshd_config.d/' ${join(sys, 'etc/ssh/sshd_config')}`).replace('[ -d /etc/ssh/sshd_config.d ]', `[ -d ${join(sys, 'etc/ssh/sshd_config.d')} ]`));
    execFileSync('dash', ['-n', join(dir, 'install.sh')]);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
    const run = (...a: string[]) => execFileSync('sh', [join(dir, 'install.sh'), ...a], { env, stdio: 'pipe' }).toString();
    run('--ascii');
    run('--ascii'); // twice: the original /etc/issue is still the one kept
    const motdFile = join(sys, 'etc/update-motd.d/20-the-olympus');
    assert.equal(readFileSync(motdFile, 'utf8'), '20-the-olympus');
    assert.ok(statSync(motdFile).mode & 0o100, 'the MOTD script is executable');
    assert.equal(readFileSync(join(sys, 'etc/default/the-olympus'), 'utf8'), 'OLYMPUS_ART=ascii\n');
    assert.equal(readFileSync(join(sys, 'etc/issue'), 'utf8'), 'issue');
    assert.equal(readFileSync(join(sys, 'etc/issue.the-olympus.orig'), 'utf8'), 'Debian GNU/Linux 12 \\n \\l\n');
    assert.equal(readFileSync(join(sys, 'etc/ssh/sshd_config.d/the-olympus.conf'), 'utf8').trim(), `Banner ${join(sys, 'etc/ssh/the-olympus-banner')}`);
    assert.ok(readFileSync(join(dir, 'reloads'), 'utf8').includes('reload ssh'));
    run('--restore');
    assert.equal(readFileSync(join(sys, 'etc/issue'), 'utf8'), 'Debian GNU/Linux 12 \\n \\l\n');
    for (const f of ['etc/update-motd.d/20-the-olympus', 'etc/ssh/sshd_config.d/the-olympus.conf', 'etc/ssh/the-olympus-banner', 'etc/default/the-olympus']) assert.ok(!existsSync(join(sys, f)), f);
    // A configuration sshd rejects is taken back out, and the script says so.
    writeFileSync(join(dir, 'sshd-fails'), '');
    assert.throws(() => run());
    assert.ok(!existsSync(join(sys, 'etc/ssh/sshd_config.d/the-olympus.conf')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Plymouth theme: the script uses only the files it ships, and every callback is registered', () => {
  const script = plymouthScript();
  const images = [...script.matchAll(/Image\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(images)].sort(), ['background.png', 'crest.png', 'fill.png', 'track.png']);
  for (const [, fn] of script.matchAll(/Plymouth\.Set\w+Function\((\w+)\)/g)) assert.match(script, new RegExp(`fun ${fn}\\(`), fn);
  assert.match(script, /SetDisplayPasswordFunction/, 'encrypted disks can still be unlocked');
  const count = (c: string) => script.split(c).length - 1;
  assert.equal(count('{'), count('}'));
  assert.equal(count('('), count(')'));
  const dir = mkdtempSync(join(tmpdir(), 'olympus-ply-'));
  writeFileSync(join(dir, 'install.sh'), plymouthInstall());
  execFileSync('dash', ['-n', join(dir, 'install.sh')]);
  rmSync(dir, { recursive: true, force: true });
});

test('wallpapers: well-formed SVG at every size and style', () => {
  const png1 = new Uint8Array([137, 80, 78, 71]);
  for (const style of Object.keys(WALLPAPER_STYLES) as WallpaperStyle[])
    for (const size of Object.keys(WALLPAPER_SIZES) as WallpaperSize[]) {
      const svg = wallpaperSvg(service, style, size, png1);
      assert.equal(XMLValidator.validate(svg), true, `${style} ${size}`);
      const { w, h } = WALLPAPER_SIZES[size];
      assert.ok(svg.includes(`viewBox="0 0 ${w} ${h}"`));
    }
  assert.throws(() => wallpaperSvg(service, 'marble', '4k'), /ground/);
});

test('the committed screens: every wallpaper at its size, in gray; GRUB’s background in RGBA', () => {
  const files = readdirSync(join(KIT, 'wallpapers'));
  assert.equal(files.length, Object.keys(WALLPAPER_STYLES).length * Object.keys(WALLPAPER_SIZES).length);
  for (const style of Object.keys(WALLPAPER_STYLES) as WallpaperStyle[])
    for (const size of Object.keys(WALLPAPER_SIZES) as WallpaperSize[]) {
      const info = ihdr(join(KIT, 'wallpapers', wallpaperName('master', style, size)));
      assert.deepEqual([info.w, info.h, info.colour], [WALLPAPER_SIZES[size].w, WALLPAPER_SIZES[size].h, 0], `${style} ${size}`);
    }
  const grub = ihdr(join(KIT, 'boot/grub/background.png'));
  assert.deepEqual([grub.w, grub.h, grub.depth, grub.colour], [1920, 1080, 8, 6]);
  for (const f of ['boot/grub/install.sh', 'boot/plymouth/install.sh', 'terminal/install.sh', 'terminal/20-the-olympus']) {
    execFileSync('dash', ['-n', join(KIT, f)]);
    assert.ok(statSync(join(KIT, f)).mode & 0o100, `${f} is executable`);
  }
  assert.equal(readFileSync(join(KIT, 'terminal/motd-braille.txt'), 'utf8'), motd(master, 'braille'), 'assets/screens is stale: npm run screens');
});
