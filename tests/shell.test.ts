// The terminal kit: every colour file in its format and in greys, the bash
// prompt as bash shows it (a branch name cannot run code), and the per-user
// installer run end to end in a stand-in home folder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import './helpers.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const SHELL = join(ROOT, 'assets/screens/shell');
const read = (f: string) => readFileSync(join(SHELL, f), 'utf8');
const grey = (hex: string) => {
  const h = hex.replace('#', '').toLowerCase();
  return h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6);
};

test('every colour in the terminal kit is a grey', () => {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  let seen = 0;
  for (const f of walk(SHELL)) {
    const text = readFileSync(f, 'utf8');
    for (const [hex] of text.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      assert.ok(grey(hex), `${f}: ${hex}`);
      seen++;
    }
    for (const [, r, g, b] of text.matchAll(/38;2;(\d+);(\d+);(\d+)/g)) assert.ok(r === g && g === b, `${f}: ${r};${g};${b}`);
  }
  assert.ok(seen > 200, `${seen} colours checked`);
});

test('the colour schemes, each in its own format', () => {
  // Windows Terminal: two schemes, every key it needs.
  const wt = JSON.parse(read('schemes/windows-terminal.json')) as Record<string, string>[];
  assert.deepEqual(wt.map((s) => s.name), ['The Olympus', 'The Olympus Light']);
  for (const s of wt) for (const k of ['background', 'foreground', 'cursorColor', 'selectionBackground', 'black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white', 'brightBlack', 'brightPurple', 'brightWhite']) assert.match(s[k], /^#[0-9A-F]{6}$/, `${s.name}: ${k}`);
  // iTerm2 and macOS Terminal: property lists.
  for (const f of ['schemes/The Olympus.itermcolors', 'schemes/The Olympus.terminal', 'schemes/The Olympus Light.terminal']) assert.ok(XMLValidator.validate(read(f)) === true, f);
  assert.equal([...read('schemes/The Olympus.itermcolors').matchAll(/<key>Ansi \d+ Color<\/key>/g)].length, 16);
  // Terminal stores each colour as an archived object: a compact (bplist00) property list holding "r g b".
  const terminal = read('schemes/The Olympus.terminal');
  const colours = [...terminal.matchAll(/<key>(\w+Color)<\/key>\s*<data>([^<]+)<\/data>/g)];
  assert.equal(colours.length, 21);
  for (const [, key, b64] of colours) {
    const bytes = Buffer.from(b64, 'base64');
    assert.equal(bytes.subarray(0, 8).toString(), 'bplist00', key);
    const rgb = bytes.toString('latin1').match(/([\d.]+) ([\d.]+) ([\d.]+)\0/);
    assert.ok(rgb && rgb[1] === rgb[2] && rgb[2] === rgb[3], `${key} is grey`);
    assert.ok(bytes.includes(Buffer.from('NSKeyedArchiver')) && bytes.includes(Buffer.from('NSColor')), key);
  }
  // kitty, Alacritty, WezTerm, Ptyxis, GNOME Terminal.
  const kitty = read('kitty/the-olympus.conf');
  for (let i = 0; i < 16; i++) assert.match(kitty, new RegExp(`^color${i} #[0-9a-f]{6}$`, 'm'));
  const alacritty = read('alacritty/the-olympus.toml');
  for (const section of ['[colors.primary]', '[colors.cursor]', '[colors.selection]', '[colors.normal]', '[colors.bright]']) assert.ok(alacritty.includes(section), section);
  assert.equal([...alacritty.matchAll(/^(black|red|green|yellow|blue|magenta|cyan|white) = "#[0-9a-f]{6}"$/gm)].length, 16);
  const wez = read('wezterm/the-olympus.toml');
  for (const k of ['ansi', 'brights']) assert.equal(wez.match(new RegExp(`^${k} = \\[(.+)\\]$`, 'm'))![1].split(',').length, 8, k);
  const ptyxis = read('ptyxis/the-olympus.palette');
  for (const s of ['[Palette]', '[Light]', '[Dark]']) assert.ok(ptyxis.includes(s), s);
  assert.equal([...ptyxis.matchAll(/^Color\d+=#[0-9A-F]{6}$/gm)].length, 32);
  const dconf = read('gnome-terminal/the-olympus.dconf');
  assert.equal(dconf.match(/^palette=\[(.+)\]$/m)![1].split(',').length, 16);
  assert.match(dconf, /^use-theme-colors=false$/m);
});

test('fastfetch: a valid configuration naming its logo, and the seal in braille', () => {
  const config = JSON.parse(read('fastfetch/the-olympus.jsonc').replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(config.logo.type, 'file');
  assert.equal(config.logo.source, '~/.config/fastfetch/the-olympus-logo.txt');
  assert.ok(config.modules.includes('os'));
  const logo = read('fastfetch/the-olympus-logo.txt');
  assert.ok(logo.startsWith('$1'));
  assert.ok(/[⠀-⣿]/.test(logo) && !/\$[2-9]/.test(logo));
});

test('the bash prompt: the branch and a failed command shown, a branch name never run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-prompt-'));
  try {
    execFileSync('git', ['init', '-q', '-b', 'x$(touch$IFS"RAN")'], { cwd: dir });
    const show = (cmd: string) =>
      execFileSync('bash', ['--norc', '-c', `source ${join(SHELL, 'bash/prompt.bash')}; ${cmd}; __olympus_prompt; printf '%s' "\${PS1@P}"`], { cwd: dir, encoding: 'utf8' }).replace(/\x1b\[[0-9;]*m/g, '');
    const failed = show('false');
    assert.match(failed, /^\n▲ \S+ .+ · x\$\(touch\$IFS"RAN"\) ✕ 1\n❯ $/);
    assert.doesNotMatch(show('true'), /✕/);
    assert.ok(!existsSync(join(dir, 'RAN')), 'the branch name was not run');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the per-user installer: installs what the machine has, into the home folder only, once; --restore leaves nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-shell-'));
  try {
    const home = join(dir, 'home');
    const bin = join(dir, 'bin');
    mkdirSync(home);
    mkdirSync(bin);
    // Stand-ins: programs that are "installed", and a dconf that keeps GNOME Terminal's settings in a file.
    for (const p of ['tmux', 'kitty', 'wezterm', 'alacritty', 'gnome-terminal']) {
      writeFileSync(join(bin, p), p === 'alacritty' ? '#!/bin/sh\necho "alacritty 0.15.1"\n' : '#!/bin/sh\nexit 0\n');
      chmodSync(join(bin, p), 0o755);
    }
    const db = join(dir, 'dconf.db');
    writeFileSync(db, "list=['b1dcc9dd-5262-4d8d-a863-c897e6d979b9']\n");
    writeFileSync(
      join(bin, 'dconf'),
      `#!/bin/sh\ncase "$1" in\n  read) sed -n 's/^list=//p' ${db} ;;\n  write) grep -v '^list=' ${db} > ${db}.t; echo "list=$3" >> ${db}.t; mv ${db}.t ${db} ;;\n  load) cat > ${dir}/profile.loaded; echo "loaded=$2" >> ${db} ;;\n  reset) grep -v '^loaded=' ${db} > ${db}.t; mv ${db}.t ${db} ;;\nesac\n`,
    );
    chmodSync(join(bin, 'dconf'), 0o755);
    writeFileSync(join(home, '.bashrc'), '# my own line\n');
    const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: '', XDG_DATA_HOME: '', PATH: `${bin}:/usr/bin:/bin` };
    const run = (...a: string[]) => execFileSync('sh', [join(SHELL, 'install.sh'), ...a], { env, encoding: 'utf8' });

    assert.match(run('--list'), /bash +bash prompt — can be installed/);
    const out = run();
    assert.match(out, /Installed: bash tmux gnome-terminal kitty alacritty wezterm/);
    assert.match(out, /Skipped: fish fastfetch ptyxis omarchy/);
    run(); // a second time changes nothing more
    const bashrc = readFileSync(join(home, '.bashrc'), 'utf8');
    assert.equal(bashrc.split('# The Olympus prompt').length, 2, 'one line in .bashrc');
    assert.ok(bashrc.startsWith('# my own line\n'));
    assert.ok(existsSync(join(home, '.config/the-olympus/prompt.bash')));
    assert.equal(readFileSync(join(home, '.tmux.conf'), 'utf8').split('# The Olympus').length, 2);
    assert.equal(readFileSync(join(home, '.config/kitty/kitty.conf'), 'utf8'), 'include the-olympus.conf\n');
    assert.match(readFileSync(join(home, '.config/alacritty/alacritty.toml'), 'utf8'), /^# The Olympus\n\[general\]\nimport = \[".+the-olympus\.toml"\]\n$/);
    assert.match(readFileSync(join(home, '.config/wezterm/wezterm.lua'), 'utf8'), /require 'wezterm'[\s\S]*config\.color_scheme = 'The Olympus'/);
    const list = readFileSync(db, 'utf8').match(/^list=(.*)$/m)![1];
    assert.equal(list, "['b1dcc9dd-5262-4d8d-a863-c897e6d979b9', '7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11']", 'the profile added once, the default kept');
    assert.equal(readFileSync(join(dir, 'profile.loaded'), 'utf8'), read('gnome-terminal/the-olympus.dconf'));

    run('--restore');
    assert.equal(readFileSync(join(home, '.bashrc'), 'utf8'), '# my own line\n');
    assert.equal(readFileSync(join(home, '.tmux.conf'), 'utf8'), '');
    assert.equal(readFileSync(join(home, '.config/kitty/kitty.conf'), 'utf8'), '');
    for (const f of ['.config/the-olympus/prompt.bash', '.config/tmux/the-olympus.conf', '.config/kitty/the-olympus.conf', '.config/alacritty/the-olympus.toml', '.config/alacritty/alacritty.toml', '.config/wezterm/colors/the-olympus.toml', '.config/wezterm/wezterm.lua']) assert.ok(!existsSync(join(home, f)), f);
    assert.equal(readFileSync(db, 'utf8').match(/^list=(.*)$/m)![1], "['b1dcc9dd-5262-4d8d-a863-c897e6d979b9']");
    assert.ok(!/^loaded=/m.test(readFileSync(db, 'utf8')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an existing configuration is left alone: the house’s is added beside it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-shell-'));
  try {
    const home = join(dir, 'home');
    const bin = join(dir, 'bin');
    mkdirSync(join(home, '.config/alacritty'), { recursive: true });
    mkdirSync(join(home, '.config/fastfetch'), { recursive: true });
    mkdirSync(bin);
    writeFileSync(join(home, '.config/alacritty/alacritty.toml'), '[font]\nsize = 11\n');
    writeFileSync(join(home, '.config/fastfetch/config.jsonc'), '{ "modules": ["os"] }\n');
    for (const p of ['alacritty', 'fastfetch']) {
      writeFileSync(join(bin, p), '#!/bin/sh\nexit 0\n');
      chmodSync(join(bin, p), 0o755);
    }
    const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: '', PATH: `${bin}:/usr/bin:/bin` };
    const out = execFileSync('sh', [join(SHELL, 'install.sh'), 'alacritty', 'fastfetch'], { env, encoding: 'utf8' });
    assert.match(out, /Add this file to the imports/);
    assert.match(out, /fastfetch -c the-olympus/);
    assert.equal(readFileSync(join(home, '.config/alacritty/alacritty.toml'), 'utf8'), '[font]\nsize = 11\n');
    assert.equal(readFileSync(join(home, '.config/fastfetch/config.jsonc'), 'utf8'), '{ "modules": ["os"] }\n');
    assert.ok(existsSync(join(home, '.config/fastfetch/the-olympus.jsonc')));
    execFileSync('sh', [join(SHELL, 'install.sh'), '--restore'], { env });
    assert.equal(readFileSync(join(home, '.config/fastfetch/config.jsonc'), 'utf8'), '{ "modules": ["os"] }\n', 'yours survives the restore');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Omarchy: a theme for 3 and 4 alike, set as the theme, and the one before it given back on --restore', () => {
  const toml = read('omarchy/the-olympus/colors.toml');
  const keys = [...toml.matchAll(/^([a-z_0-9]+) = /gm)].map((m) => m[1]);
  assert.equal(new Set(keys).size, keys.length, 'no key twice (TOML forbids it)');
  for (const k of ['accent', 'background', 'foreground', 'selection', 'red', 'bright_cyan', 'selection_background', 'color0', 'color15']) assert.ok(keys.includes(k), k);
  assert.ok(readdirSync(join(SHELL, 'omarchy/the-olympus/backgrounds')).length >= 1, 'backgrounds');

  const dir = mkdtempSync(join(tmpdir(), 'olympus-omarchy-'));
  try {
    const home = join(dir, 'home');
    const bin = join(dir, 'bin');
    mkdirSync(home);
    mkdirSync(bin);
    const log = join(dir, 'log');
    writeFileSync(join(bin, 'omarchy-theme-set'), `#!/bin/sh\necho "set $1" >> ${log}\n`);
    writeFileSync(join(bin, 'omarchy-theme-current'), '#!/bin/sh\necho tokyo-night\n');
    for (const f of ['omarchy-theme-set', 'omarchy-theme-current']) chmodSync(join(bin, f), 0o755);
    const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: '', PATH: `${bin}:/usr/bin:/bin` };
    execFileSync('sh', [join(SHELL, 'install.sh'), 'omarchy'], { env });
    assert.ok(existsSync(join(home, '.config/omarchy/themes/the-olympus/colors.toml')));
    assert.equal(readFileSync(log, 'utf8'), 'set the-olympus\n');
    execFileSync('sh', [join(SHELL, 'install.sh'), '--restore'], { env });
    assert.equal(readFileSync(log, 'utf8'), 'set the-olympus\nset tokyo-night\n', 'back to the theme before');
    assert.ok(!existsSync(join(home, '.config/omarchy/themes/the-olympus')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
