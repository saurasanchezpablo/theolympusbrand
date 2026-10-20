// The one command: assets/install.sh, run against a stand-in site (the
// repository itself, through file://) and a stand-in home — listing, the
// menu-less options, a kit found on the machine, a file that does not match
// its checksum, and the menu itself, driven through a pseudo-terminal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './helpers.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const LAUNCHER = join(ROOT, 'assets/install.sh');
const script = readFileSync(LAUNCHER, 'utf8');

/** A stand-in site (/files → the repository), a home folder, and a bin folder that comes first on PATH. */
function machine() {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-launcher-'));
  for (const d of ['site', 'home', 'bin', 'work']) mkdirSync(join(dir, d));
  symlinkSync(ROOT, join(dir, 'site', 'files'));
  const env = { ...process.env, HOME: join(dir, 'home'), XDG_CONFIG_HOME: '', OLYMPUS_SITE: `file://${join(dir, 'site')}`, PATH: `${join(dir, 'bin')}:/usr/bin:/bin` };
  const stub = (name: string, body: string) => {
    writeFileSync(join(dir, 'bin', name), `#!/bin/sh\n${body}\n`);
    chmodSync(join(dir, 'bin', name), 0o755);
  };
  // Without a terminal (setsid: no controlling terminal), as a script or a CI machine runs it.
  const run = (args: string[], file = LAUNCHER) => spawnSync('setsid', ['sh', file, ...args], { env, cwd: join(dir, 'work'), encoding: 'utf8' });
  return { dir, env, stub, run, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('the launcher is a POSIX script that lists everything the house can install, from the registries', () => {
  for (const sh of ['dash', 'bash']) execFileSync(sh, ['-n', LAUNCHER]);
  const m = machine();
  try {
    const list = m.run(['--list']);
    assert.equal(list.status, 0, list.stderr);
    for (const id of ['sys:grub', 'sys:limine', 'sys:terminal', 'usr:bash', 'usr:omarchy', 'kit:proxmox', 'kit:nextcloud', 'kit:home-assistant', 'kit:vaultwarden', 'doc:jellyfin']) assert.match(list.stdout, new RegExp(`^${id} `, 'm'), id);
    assert.match(list.stdout, /^kit:proxmox .*skipped: Proxmox VE is not on this machine$/m);
    // Without a terminal and without options, there is nothing to show the menu on.
    assert.equal(m.run([]).status, 2);
    assert.match(m.run(['--only', 'sys:nonsense']).stderr, /unknown item/);
    assert.match(m.run(['--only', 'usr:tmux', '--as', 'nobody']).stderr, /unknown identity/);
  } finally {
    m.done();
  }
});

test('without the menu: install a part of your terminal, then undo it', () => {
  const m = machine();
  try {
    m.stub('tmux', 'exit 0');
    const out = m.run(['--only', 'usr:tmux']);
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /Done: tmux/);
    assert.ok(existsSync(join(m.dir, 'home/.config/tmux/the-olympus.conf')));
    assert.match(m.run(['--list']).stdout, /^usr:tmux .*installed$/m);
    const undo = m.run(['--restore', '--only', 'usr:tmux']);
    assert.equal(undo.status, 0, undo.stderr);
    assert.ok(!existsSync(join(m.dir, 'home/.config/tmux/the-olympus.conf')));
  } finally {
    m.done();
  }
});

test('a kit set up by hand: its files and guide saved beside you, never over something already there', () => {
  const m = machine();
  try {
    const out = m.run(['--only', 'doc:grafana']);
    assert.equal(out.status, 0, out.stderr);
    for (const f of ['README.md', 'docker-compose.override.yml', 'grafana_icon.svg']) assert.deepEqual(readFileSync(join(m.dir, 'work/the-olympus-grafana', f)), readFileSync(join(ROOT, 'assets/integrations/themes/grafana', f)), f);
    assert.notEqual(m.run(['--only', 'doc:grafana']).status, 0, 'refuses to overwrite');
  } finally {
    m.done();
  }
});

test('a file that does not match its checksum is never used', () => {
  const m = machine();
  try {
    const sum = script.match(/grafana README\.md ([0-9a-f]{64})/)![1];
    const tampered = join(m.dir, 'tampered.sh');
    writeFileSync(tampered, script.replace(`grafana README.md ${sum}`, `grafana README.md ${'0'.repeat(64)}`));
    const out = m.run(['--only', 'doc:grafana'], tampered);
    assert.notEqual(out.status, 0);
    assert.match(out.stderr, /does not match its checksum/);
    assert.ok(!existsSync(join(m.dir, 'work/the-olympus-grafana')));
  } finally {
    m.done();
  }
});

test('an application found on the machine: Vaultwarden in Docker, its kit applied to the container it found', () => {
  const m = machine();
  try {
    const log = join(m.dir, 'docker.log');
    m.stub('docker', `if [ "$1" = ps ]; then echo "vault vaultwarden/server:1.37"; exit 0; fi\necho "$@" >> ${log}`);
    // As root would: no sudo in the way of the stand-in docker.
    const asRoot = join(m.dir, 'root.sh');
    writeFileSync(asRoot, script.replace('if [ "$(id -u)" = 0 ]; then SUDO=; else SUDO=sudo; fi', 'SUDO='));
    assert.match(m.run(['--list'], asRoot).stdout, /^kit:vaultwarden .*can be installed$/m);
    const out = m.run(['--only', 'kit:vaultwarden'], asRoot);
    assert.equal(out.status, 0, out.stderr);
    const calls = readFileSync(log, 'utf8');
    assert.match(calls, /cp .*user\.vaultwarden\.scss\.hbs vault:\/data\/templates\/scss\/user\.vaultwarden\.scss\.hbs/, 'into the container it found');
    assert.match(calls, /restart vault/);
  } finally {
    m.done();
  }
});

test('the menu: chosen with the keys through a terminal, installed, then undone', { skip: !existsSync('/usr/bin/python3') && 'needs python3 for a pseudo-terminal' }, () => {
  const m = machine();
  try {
    m.stub('tmux', 'exit 0');
    // Drive the menu as a person would: the script piped into sh, keys from the terminal.
    const drive = `
import os, pty, sys, time, select
env = dict(os.environ)
pid, fd = pty.fork()
if pid == 0:
    os.execvpe('sh', ['sh', '-c', 'stty rows 40 cols 120; cat "$0" | sh', sys.argv[1]], env)
out = b''
def drain(t):
    global out
    end = time.time() + t
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.05)
        if r:
            try: out += os.read(fd, 65536)
            except OSError: return
drain(2.5)
for k in sys.argv[2:]:
    os.write(fd, {'down': b'\\x1b[B', 'enter': b'\\r', 'space': b' '}.get(k, k.encode())); drain(0.6)
drain(4)
sys.stdout.write(out.decode('utf8', 'replace'))
`;
    const keys = (...k: string[]) => execFileSync('python3', ['-c', drive, LAUNCHER, ...k], { env: m.env, cwd: join(m.dir, 'work'), encoding: 'utf8' });
    // Install: nothing chosen to begin with, then down to the tmux item, choose it, continue, keep the master's seal.
    const usrTmux = script.match(/^ITEMS='([\s\S]*?)'$/m)![1].split('\n').findIndex((l) => l.startsWith('usr:tmux|'));
    const installed = keys('enter', 'n', ...Array(usrTmux).fill('down'), 'space', 'enter', 'enter');
    assert.match(installed, /Done: tmux/);
    assert.ok(existsSync(join(m.dir, 'home/.config/tmux/the-olympus.conf')));
    // Undo: what is installed is chosen to begin with.
    const undone = keys('down', 'enter', 'enter', 'enter');
    assert.match(undone, /Undone: tmux/);
    assert.ok(!existsSync(join(m.dir, 'home/.config/tmux/the-olympus.conf')));
    assert.ok(!/\x1b\[3\dm|\x1b\[4\dm|\x1b\[38;5|\x1b\[38;2/.test(installed), 'the menu uses no colour: bold, dim and reverse only');
  } finally {
    m.done();
  }
});
