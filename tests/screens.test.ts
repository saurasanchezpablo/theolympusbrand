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
  const files = readdirSync(join(KIT, 'wallpapers')).filter((f) => f.endsWith('.png'));
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

/** The committed umbrella installer, pointed at a stand-in system and allowed to run unprivileged. */
function standInUmbrella(sys: string): string {
  return readFileSync(join(KIT, 'install.sh'), 'utf8')
    .replaceAll('/etc/', `${sys}/etc/`)
    .replaceAll('/usr/share/', `${sys}/usr/share/`)
    .replaceAll('command -v plymouth-set-default-theme >/dev/null 2>&1', `[ -e ${sys}/has-plymouth ]`)
    .replace('[ "$(id -u)" = 0 ]', 'true');
}

test('one command installs every screen part the machine can take, passes options on, restores, and fetches from the site with checksums', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-screens-'));
  try {
    const sys = join(dir, 'sys');
    const kit = join(dir, 'kit');
    const log = join(dir, 'log');
    mkdirSync(`${sys}/etc/default`, { recursive: true });
    writeFileSync(`${sys}/etc/default/grub`, 'GRUB_TIMEOUT=5\n');
    writeFileSync(`${sys}/etc/issue`, 'Debian\n');
    // The kit as committed, but each part's own installer replaced by one that records how it was called.
    const umbrella = readFileSync(join(KIT, 'install.sh'), 'utf8');
    const manifest = [...umbrella.matchAll(/^(?:MANIFEST=')?(\w+) (\S+) ([0-9a-f]{64})'?$/gm)].map(([, part, path]) => ({ part, path }));
    assert.deepEqual([...new Set(manifest.map((m) => m.part))], ['grub', 'plymouth', 'terminal', 'wallpapers']);
    for (const { path } of manifest) {
      mkdirSync(join(kit, path, '..'), { recursive: true });
      writeFileSync(join(kit, path), path.endsWith('install.sh') ? `#!/bin/sh\necho "${path.split('/').slice(-2, -1)[0]} $*" >> ${log}\n` : readFileSync(join(KIT, path)));
    }
    writeFileSync(join(kit, 'install.sh'), standInUmbrella(sys));
    const run = (...a: string[]) => execFileSync('sh', [join(kit, 'install.sh'), ...a], { encoding: 'utf8' });
    const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []);

    // What this machine can take: GRUB and the terminal; no Plymouth, no desktop.
    const list = run('--list');
    assert.match(list, /grub .*can be installed/);
    assert.match(list, /plymouth .*skipped: Plymouth is not installed/);
    assert.match(list, /wallpapers .*skipped: no desktop installed/);
    const out = run('--ascii');
    assert.deepEqual(calls(), ['grub ', 'terminal --ascii'], 'only the parts that fit; --ascii only to the terminal');
    assert.match(out, /Installed: grub terminal/);
    assert.match(out, /Skipped: plymouth wallpapers/);

    // Restore undoes only what is installed.
    rmSync(log);
    writeFileSync(`${sys}/etc/default/grub.the-olympus.orig`, 'GRUB_TIMEOUT=5\n');
    run('--restore');
    assert.deepEqual(calls(), ['grub --restore']);
    assert.throws(() => run('nonsense'), /unknown part/);
    assert.throws(() => run('--dark'), /unknown option/);

    // From the site: an empty folder, the script piped in, the files fetched and checked.
    rmSync(log);
    const piped = join(dir, 'piped');
    mkdirSync(piped);
    writeFileSync(join(piped, 'install.sh'), standInUmbrella(sys));
    const from = `file://${kit}/`;
    const real = (...a: string[]) => execFileSync('sh', [join(piped, 'install.sh'), ...a], { encoding: 'utf8', env: { ...process.env, OLYMPUS_FROM: from } });
    // The stand-in installers differ from the committed ones, so their checksums fail: nothing runs.
    assert.throws(() => real('grub'), /does not match its checksum/);
    assert.deepEqual(calls(), []);
    // With the real files, fetching works (GRUB's installer then refuses the stand-in system, as it should).
    const genuine = join(dir, 'genuine');
    for (const { path } of manifest.filter((m) => m.part === 'terminal')) {
      mkdirSync(join(genuine, path, '..'), { recursive: true });
      writeFileSync(join(genuine, path), readFileSync(join(KIT, path)));
    }
    const fetched = execFileSync('sh', ['-c', `sed 's|SRC=$(mktemp -d)|SRC=${dir}/fetched; mkdir -p "$SRC"|; s|trap .*EXIT INT TERM||; s|if sh "$SRC/$(dir_of "$p")/install.sh" $args|if true|' ${join(piped, 'install.sh')} | OLYMPUS_FROM=file://${genuine}/ sh -s -- terminal`], { encoding: 'utf8' });
    assert.match(fetched, /Installed: terminal/);
    for (const { path } of manifest.filter((m) => m.part === 'terminal')) assert.deepEqual(readFileSync(join(dir, 'fetched', path)), readFileSync(join(KIT, path)), path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the wallpapers are offered to GNOME and KDE Plasma, and removed again', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-wallpapers-'));
  try {
    const sys = join(dir, 'sys');
    const kit = join(dir, 'wallpapers');
    mkdirSync(kit, { recursive: true });
    for (const f of readdirSync(join(KIT, 'wallpapers'))) if (f.endsWith('.png')) writeFileSync(join(kit, f), `png ${f}`);
    writeFileSync(join(kit, 'install.sh'), readFileSync(join(KIT, 'wallpapers/install.sh'), 'utf8').replaceAll('/usr/share/', `${sys}/usr/share/`).replace('[ "$(id -u)" = 0 ]', 'true'));
    execFileSync('sh', [join(kit, 'install.sh')]);
    const xml = readFileSync(`${sys}/usr/share/gnome-background-properties/the-olympus.xml`, 'utf8');
    assert.ok(XMLValidator.validate(xml) === true);
    const named = [...xml.matchAll(/<filename>([^<]+)<\/filename>/g)].map((m) => m[1]);
    assert.equal(named.length, Object.keys(WALLPAPER_STYLES).length);
    for (const f of named) assert.ok(existsSync(f), f);
    const plasma = readdirSync(`${sys}/usr/share/wallpapers`);
    assert.equal(plasma.length, Object.keys(WALLPAPER_STYLES).length);
    for (const p of plasma) {
      const meta = JSON.parse(readFileSync(`${sys}/usr/share/wallpapers/${p}/metadata.json`, 'utf8'));
      assert.equal(meta.KPlugin.Id, p);
      const images = readdirSync(`${sys}/usr/share/wallpapers/${p}/contents/images`);
      assert.equal(images.length, Object.keys(WALLPAPER_SIZES).length);
      for (const i of images) assert.match(readFileSync(`${sys}/usr/share/wallpapers/${p}/contents/images/${i}`, 'utf8'), /^png /, `${p}/${i} resolves`);
    }
    execFileSync('sh', [join(kit, 'install.sh'), '--restore']);
    assert.ok(!existsSync(`${sys}/usr/share/backgrounds/the-olympus`) && !existsSync(`${sys}/usr/share/gnome-background-properties/the-olympus.xml`));
    assert.deepEqual(readdirSync(`${sys}/usr/share/wallpapers`), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
