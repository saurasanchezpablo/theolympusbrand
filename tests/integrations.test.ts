// Integrations: the dashboard files parse and list every service at its
// address, the icons they name exist, the shell scripts are valid and do what
// they say, and the committed kit is the catalogue's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import './helpers.ts';
import { loadCatalog } from '../src/node/catalog.ts';
import { seal } from '../src/geometry/crest.ts';
import { addressOf, bookmarks, dashboardSnippets, dashy, groups, homepage, homer, iconName, servicesCsv, type Entry } from '../src/integrations/dashboards.ts';
import { bannerMark, coinSvg } from '../src/integrations/kit.ts';
import { THEME_KITS, themeAssignments, unknownApps } from '../src/integrations/themes/index.ts';
import { jellyfinCss } from '../src/integrations/themes/jellyfin.ts';
import { nextcloudScript } from '../src/integrations/themes/nextcloud.ts';
import { proxmoxScript } from '../src/integrations/themes/proxmox.ts';
import { DOMAIN } from '../src/brand/identity.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const KIT = join(ROOT, 'assets/integrations');
const catalogue: Entry[] = loadCatalog().map((s) => ({ id: s.id, name: s.name, category: s.category, description: s.description, url: s.url }));
// Names a YAML writer gets wrong if it does not quote: a colon, quotes, a hash, an ampersand.
const awkward: Entry[] = [
  ...catalogue,
  { id: 'plex', name: 'Plex: "Movies" & Shows #1', category: 'media', description: "It's: a test — ünïcode" },
  { id: 'bare', name: 'yes', category: 'other' },
];

type Item = { name: string; href: string; icon: string; description?: string };

test('Homepage, Dashy and Homer files parse and list every service at its address', () => {
  const hp = homepage(awkward);
  const services = parse(hp.services) as Record<string, Record<string, Omit<Item, 'name'>>[]>[];
  const fromHomepage: Item[] = services.flatMap((g) => Object.values(g)[0].map((s) => ({ name: Object.keys(s)[0], ...Object.values(s)[0] })));
  const settings = parse(hp.settings);
  assert.equal(settings.color, 'neutral');
  assert.equal(settings.theme, 'dark');

  const d = parse(dashy(awkward));
  assert.equal(d.appConfig.theme, 'olympus');
  const fromDashy: Item[] = d.sections.flatMap((s: { items: { title: string; url: string; icon: string; description?: string }[] }) => s.items.map((i) => ({ name: i.title, href: i.url, icon: i.icon, description: i.description })));

  const h = parse(homer(awkward));
  assert.ok(h.colors.light && h.colors.dark);
  const fromHomer: Item[] = h.services.flatMap((s: { items: { name: string; url: string; logo: string; subtitle?: string }[] }) => s.items.map((i) => ({ name: i.name, href: i.url, icon: i.logo, description: i.subtitle })));

  for (const [label, items] of [['Homepage', fromHomepage], ['Dashy', fromDashy], ['Homer', fromHomer]] as const) {
    assert.equal(items.length, awkward.length, label);
    for (const e of awkward) {
      const it = items.find((i) => i.name === e.name);
      assert.ok(it, `${label}: ${e.name}`);
      assert.equal(it.href, addressOf(e), `${label}: ${e.name}`);
      assert.ok(it.icon.endsWith(iconName(e.id)), `${label}: ${it.icon}`);
      assert.equal(it.description, e.description, `${label}: ${e.name}`);
    }
    // Groups in catalogue order.
    assert.deepEqual(
      [...new Set(items.map((i) => groups(awkward).find((g) => g.entries.some((e) => e.name === i.name))!.name))],
      groups(awkward).map((g) => g.name),
      label,
    );
  }
  // The house pattern for a service without an address.
  assert.equal(addressOf({ id: 'bare', name: 'Bare', category: 'other' }), `https://bare.${DOMAIN}`);
});

test('icons can be served from a URL instead', () => {
  const base = 'https://brand.example/files/icons';
  const d = parse(dashy(catalogue, { icons: { kind: 'url', base } }));
  assert.equal(d.sections[0].items[0].icon, `${base}/${iconName(groups(catalogue)[0].entries[0].id)}`);
  assert.equal(d.pageInfo.logo, `${base}/olympus.png`);
  assert.ok(homepage(catalogue, { icons: { kind: 'url', base } }).services.includes(`"${base}/olympus-`));
});

test('bookmarks and the table: every service, escaped, with icons', () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  const html = bookmarks(awkward, (id) => (id === 'bare' ? undefined : png));
  for (const e of awkward) assert.ok(html.includes(`HREF="${addressOf(e)}"`), e.name);
  assert.ok(html.includes('Plex: &quot;Movies&quot; &amp; Shows #1</A>'));
  assert.equal((html.match(/ICON="data:image\/png;base64,/g) ?? []).length, awkward.length); // master included, 'bare' without
  assert.equal((html.match(/<DL><p>/g) ?? []).length, (html.match(/<\/DL><p>/g) ?? []).length);

  const csv = servicesCsv(awkward).trim().split('\n');
  assert.equal(csv.length, awkward.length + 1);
  // A small CSV reader: quoted cells, doubled quotes.
  const cells = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[1].startsWith('"') ? m[1].slice(1, -1).replace(/""/g, '"') : m[1]));
  const row = csv.map(cells).find((r) => r[0].startsWith('Plex'))!;
  assert.deepEqual(row, ['Plex: "Movies" & Shows #1', `https://plex.${DOMAIN}`, 'Media', "It's: a test — ünïcode", 'olympus-plex.png']);
});

test('one service’s snippets parse as the lists they are pasted into', () => {
  const e = awkward.find((x) => x.id === 'plex')!;
  const blocks = [...dashboardSnippets(e).matchAll(/```yaml\n([\s\S]*?)\n```/g)].map((m) => parse(m[1]));
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0][0].Media[0][e.name].href, addressOf(e));
  assert.equal(blocks[1][0].items[0].title, e.name);
  assert.equal(blocks[2][0].items[0].url, addressOf(e));
});

test('the Nextcloud script sets the Theming app, falling back for older releases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-nc-'));
  try {
    const script = join(dir, 'apply.sh');
    writeFileSync(script, nextcloudScript({ name: "The Olympus's cloud", url: 'https://nextcloud.theolympus.cloud' }));
    for (const f of ['logo.svg', 'logoheader.svg', 'favicon.png', 'background.png']) writeFileSync(join(dir, f), '');
    // A stand-in for occ: records its arguments; refuses primary_color like Nextcloud 27 does.
    const log = join(dir, 'log');
    const occ = join(dir, 'occ');
    writeFileSync(occ, `#!/bin/sh\n[ "$2" = primary_color ] && exit 1\nprintf '%s|' "$@" >> ${log}\necho >> ${log}\n`);
    chmodSync(occ, 0o755);
    for (const shell of ['dash', 'bash']) {
      rmSync(log, { force: true });
      execFileSync(shell, ['-n', script]);
      execFileSync(shell, [script], { env: { ...process.env, OCC: occ, NEXTCLOUD_CONTAINER: '' } });
      const calls = readFileSync(log, 'utf8').trim().split('\n');
      assert.ok(calls.includes("theming:config|name|The Olympus's cloud|"), shell);
      assert.ok(calls.includes('theming:config|color|#1C1C1C|'), `${shell}: falls back to color`);
      assert.ok(calls.includes(`theming:config|logo|${dir}/logo.svg|`), shell);
      assert.ok(calls.includes(`theming:config|background|${dir}/background.png|`), shell);
      assert.ok(!calls.some((c) => c.startsWith('config:app:set|theming_customcss')), `${shell}: no stylesheet without the Custom CSS app`);
    }
    // With the Custom CSS app enabled (and --with-css installing it), the stylesheet goes in, whole.
    writeFileSync(join(dir, 'custom.css'), 'body[data-theme-dark] { --color-primary: #EDEDED; }\n');
    writeFileSync(occ, `#!/bin/sh\n[ "$1 $2 $3" = "config:app:get theming_customcss enabled" ] && { echo yes; exit 0; }\nprintf '%s|' "$@" >> ${log}\necho >> ${log}\n`);
    rmSync(log, { force: true });
    execFileSync('sh', [script, '--with-css'], { env: { ...process.env, OCC: occ, NEXTCLOUD_CONTAINER: '' } });
    const withCss = readFileSync(log, 'utf8').trim().split('\n');
    assert.ok(withCss.includes('app:install|theming_customcss|'));
    assert.ok(withCss.includes('config:app:set|theming_customcss|customcss|--value=body[data-theme-dark] { --color-primary: #EDEDED; }|'));
    assert.ok(withCss.some((c) => /^config:app:set\|theming_customcss\|cachebuster\|--value=\d+\|$/.test(c)));
    rmSync(log, { force: true });
    execFileSync('sh', [script, '--restore'], { env: { ...process.env, OCC: occ, NEXTCLOUD_CONTAINER: '' } });
    const restored = readFileSync(log, 'utf8').trim().split('\n');
    for (const k of ['name', 'primary_color', 'logo', 'background']) assert.ok(restored.includes(`theming:config|${k}|--reset|`), k);
    assert.ok(restored.includes('config:app:delete|theming_customcss|customcss|'));
    assert.throws(() => execFileSync('sh', [script, '--bogus'], { stdio: 'ignore' }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Proxmox script: a grey theme made from the dark one, the logo, a hook that makes it again, and a full restore', () => {
  const dir = mkdtempSync(join(tmpdir(), 'olympus-pve-'));
  try {
    // A stand-in node, and the script pointed at it and allowed to run unprivileged.
    const sys = join(dir, 'sys');
    const kit = join(dir, 'kit');
    for (const d of ['images', 'css', 'themes', 'apt']) execFileSync('mkdir', ['-p', `${sys}/${d}`]);
    execFileSync('mkdir', ['-p', kit]);
    writeFileSync(`${sys}/images/proxmox_logo.png`, 'original logo');
    writeFileSync(`${sys}/images/favicon.ico`, 'original icon');
    const template = '<html>\n  <head>\n    <title>[% nodename %] - Proxmox Virtual Environment</title>\n  </head>\n  <body></body>\n</html>\n';
    writeFileSync(`${sys}/index.html.tpl`, template);
    // A sample of Proxmox's dark theme: blue accents, blue-grey grounds, status colours.
    writeFileSync(`${sys}/themes/theme-proxmox-dark.css`, '.x-btn { background-color: #3892d4; }\n.x-panel { background: #262b31; color: #f5f5f5 }\n.running { color: #21bf4b; }\n.error { color: #c60f0f !important; }\n.warn { color: #ff9b00; }\n.sel { background: rgba(56, 146, 212, 0.4); }\n#ace { color: #fff; }\n');
    for (const f of ['logo-light-theme.png', 'logo-dark-theme.png', 'favicon.ico']) writeFileSync(join(kit, f), `olympus ${f}`);
    const script = proxmoxScript()
      .replace('IMG=/usr/share/pve-manager/images', `IMG=${sys}/images`)
      .replace('CSS=/usr/share/pve-manager/css', `CSS=${sys}/css`)
      .replace('TPL=/usr/share/pve-manager/index.html.tpl', `TPL=${sys}/index.html.tpl`)
      .replace('DARK=/usr/share/javascript/proxmox-widget-toolkit/themes/theme-proxmox-dark.css', `DARK=${sys}/themes/theme-proxmox-dark.css`)
      .replace('KEEP=/usr/local/share/the-olympus/proxmox', `KEEP=${sys}/keep`)
      .replace('HOOK=/etc/apt/apt.conf.d/99-the-olympus-logo', `HOOK=${sys}/apt/99-the-olympus-logo`)
      .replace('[ "$(id -u)" = 0 ]', 'true');
    writeFileSync(join(kit, 'apply.sh'), script);
    for (const shell of ['dash', 'bash']) execFileSync(shell, ['-n', join(kit, 'apply.sh')]);
    const run = (...a: string[]) => execFileSync('sh', [join(kit, 'apply.sh'), ...a], { env: { ...process.env, PATH: process.env.PATH } }).toString();
    const read = (f: string) => readFileSync(`${sys}/${f}`, 'utf8');

    run();
    const css = read('css/the-olympus.css');
    assert.match(css, /\.x-btn \{ background-color: #848484; \}/, 'blue accent → grey of the same lightness');
    assert.match(css, /\.x-panel \{ background: #2a2a2a; color: #f5f5f5 \}/, 'blue-grey ground → grey');
    assert.match(css, /#21bf4b/, 'running stays green');
    assert.match(css, /#c60f0f !important/, 'errors stay red');
    assert.match(css, /#ff9b00/, 'warnings stay orange');
    assert.match(css, /rgba\(132, 132, 132, 0\.4\)/);
    assert.match(css, /#ace \{ color: #ffffff; \}/, 'an id selector is not mistaken for a colour');
    for (const [, hex] of css.matchAll(/#([0-9a-f]{6})\b/g)) if (!['21bf4b', 'c60f0f', 'ff9b00'].includes(hex)) assert.ok(hex.slice(0, 2) === hex.slice(2, 4) && hex.slice(2, 4) === hex.slice(4, 6), `#${hex} is grey`);
    assert.equal(read('index.html.tpl').split('/pve2/css/the-olympus.css').length, 2, 'the template links the theme once');
    assert.ok(read('index.html.tpl').indexOf('the-olympus.css') < read('index.html.tpl').indexOf('</head>'));
    assert.equal(read('images/proxmox_logo.png'), 'olympus logo-dark-theme.png');
    assert.equal(read('images/proxmox_logo.png.orig'), 'original logo');
    const hook = read('apt/99-the-olympus-logo');
    assert.ok(hook.includes(`sh ${sys}/keep/apply.sh --reapply`), 'the hook runs the kept copy');

    // Run again: still linked once, the originals not overwritten by ours.
    run();
    assert.equal(read('index.html.tpl').split('/pve2/css/the-olympus.css').length, 2);
    assert.equal(read('images/proxmox_logo.png.orig'), 'original logo');

    // An update puts Proxmox's template and logo back; the hook (the kept copy) makes them again.
    writeFileSync(`${sys}/index.html.tpl`, template);
    writeFileSync(`${sys}/images/proxmox_logo.png`, 'updated logo');
    execFileSync('sh', [`${sys}/keep/apply.sh`, '--reapply']);
    assert.equal(read('index.html.tpl').split('/pve2/css/the-olympus.css').length, 2, 'the theme is linked again after the update');
    assert.equal(read('images/proxmox_logo.png'), 'olympus logo-dark-theme.png');

    // Logo only: the theme is taken back out.
    run('--logo-only');
    assert.ok(!read('index.html.tpl').includes('the-olympus.css') && !existsSync(`${sys}/css/the-olympus.css`));
    assert.equal(read('images/proxmox_logo.png'), 'olympus logo-light-theme.png');

    run('--restore');
    assert.equal(read('index.html.tpl'), template, 'the template exactly as it was');
    assert.equal(read('images/proxmox_logo.png'), 'updated logo');
    assert.equal(read('images/favicon.ico'), 'original icon');
    assert.ok(!existsSync(`${sys}/images/proxmox_logo.png.orig`) && !existsSync(`${sys}/apt/99-the-olympus-logo`) && !existsSync(`${sys}/keep`));
    assert.throws(() => execFileSync('sh', [join(kit, 'apply.sh'), '--bogus'], { stdio: 'ignore' }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('drawings: the coin, the banner, the CSS-embedded banner', () => {
  const s = seal();
  for (const tone of ['dark', 'light'] as const) assert.ok(XMLValidator.validate(coinSvg(s, tone, 'A & B <C>')) === true, tone);
  const b = bannerMark(s, 'The Olympus');
  assert.equal(b.height, 256);
  assert.ok(b.width! > 3 * b.height!);
  // The banner travels inside the CSS as a data URL; it must decode to the same SVG.
  const css = jellyfinCss({ banner: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b.width} ${b.height}"><path d="${b.d}" fill="#EDEDED"/></svg>` });
  const url = css.match(/url\("data:image\/svg\+xml,([^"]*)"\)/)![1];
  const svg = decodeURIComponent(url);
  assert.ok(XMLValidator.validate(svg) === true);
  assert.equal(new XMLParser({ ignoreAttributes: false }).parse(svg).svg.path['@_d'], b.d);
});

test('each application is themed by the service that names it, then by id, then by category, then by the master', () => {
  const dirOf = (entries: Entry[], app: string) => themeAssignments(entries).filter((a) => a.kit.id === app);
  assert.equal(dirOf(catalogue, 'jellyfin')[0].entry?.id, 'jellyfin');
  assert.equal(dirOf(catalogue, 'grafana')[0].entry?.category, 'monitoring');
  assert.equal(dirOf([], 'proxmox')[0].entry, null);
  // Naming the application wins, and a second service running it gets a kit of its own.
  const named: Entry[] = [...catalogue, { id: 'films', name: 'Films', category: 'media', app: 'jellyfin' }, { id: 'kids', name: 'Kids', category: 'media', app: 'jellyfin' }];
  assert.deepEqual(dirOf(named, 'jellyfin').map((a) => [a.dir, a.entry?.id]), [['jellyfin', 'films'], ['jellyfin-kids', 'kids']]);
  // A service that names one application is not borrowed by another.
  assert.equal(dirOf([{ id: 'grafana', name: 'Grafana', category: 'monitoring', app: 'uptime-kuma' }], 'grafana')[0].entry, null);
  // An application the house has no kit for is reported, not themed.
  assert.deepEqual(unknownApps([{ id: 'x', name: 'X', category: 'other', app: 'no-such-app' }]).map((e) => e.id), ['x']);
});

test('the theme kit registry: unique ids, folders that cannot collide, every kit described', () => {
  const ids = THEME_KITS.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const k of THEME_KITS) {
    assert.match(k.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(k.label && k.how, k.id);
  }
});

test('the committed kit lists the catalogue and has every icon it names', () => {
  const icons = new Set(readdirSync(join(KIT, 'icons')));
  for (const e of catalogue) for (const v of [iconName(e.id), iconName(e.id, '-light'), iconName(e.id, '', 'svg')]) assert.ok(icons.has(v), v);
  assert.ok(icons.has('olympus.png'));
  const hp = readFileSync(join(KIT, 'dashboards/homepage/services.yaml'), 'utf8');
  assert.equal(hp, homepage(catalogue).services, 'assets/integrations is stale: npm run integrations');
  for (const f of ['dashboards/dashy/conf.yml', 'dashboards/homer/config.yml', 'dashboards/homepage/settings.yaml']) parse(readFileSync(join(KIT, f), 'utf8'));
  for (const f of ['themes/nextcloud/apply.sh', 'themes/proxmox/apply.sh']) execFileSync('dash', ['-n', join(KIT, f)]);
  for (const f of ['themes/nextcloud/logo.svg', 'themes/nextcloud/logoheader.svg', 'themes/grafana/grafana_icon.svg']) assert.ok(XMLValidator.validate(readFileSync(join(KIT, f), 'utf8')) === true, f);
});

test('the Home Assistant kit: the theme parses with both modes in greys; the script installs, asks for the include once, and undoes', () => {
  const theme = parse(readFileSync(join(KIT, 'themes/home-assistant/the-olympus.yaml'), 'utf8'))['The Olympus'];
  assert.deepEqual(Object.keys(theme.modes), ['light', 'dark']);
  for (const mode of ['light', 'dark']) assert.ok(theme.modes[mode]['primary-color'] && theme.modes[mode]['primary-background-color'], mode);
  assert.ok(theme['ha-color-primary-40'], 'the primary scale is set, or blue shows through');
  const dir = mkdtempSync(join(tmpdir(), 'olympus-ha-'));
  try {
    const config = join(dir, 'config');
    execFileSync('mkdir', ['-p', config]);
    writeFileSync(join(config, 'configuration.yaml'), 'default_config:\n');
    const run = (...a: string[]) => execFileSync('sh', [join(KIT, 'themes/home-assistant/apply.sh'), ...a]).toString();
    assert.match(run(config), /include_dir_merge_named themes/, 'tells the user the one line to add');
    assert.equal(readFileSync(join(config, 'themes/the-olympus.yaml'), 'utf8'), readFileSync(join(KIT, 'themes/home-assistant/the-olympus.yaml'), 'utf8'));
    assert.ok(existsSync(join(config, 'www/the-olympus/banner.svg')) && existsSync(join(config, 'www/the-olympus/seal.svg')));
    writeFileSync(join(config, 'configuration.yaml'), 'frontend:\n  themes: !include_dir_merge_named themes\n');
    assert.doesNotMatch(run(config), /One more step/, 'not asked again once it is there');
    run(config, '--restore');
    assert.ok(!existsSync(join(config, 'themes/the-olympus.yaml')) && !existsSync(join(config, 'www/the-olympus')));
    assert.throws(() => execFileSync('sh', [join(KIT, 'themes/home-assistant/apply.sh'), dir], { stdio: 'ignore' }), 'refuses a folder that is not Home Assistant’s');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Vaultwarden kit: a stylesheet Handlebars leaves alone, grey in both themes, installed and removed by its script', () => {
  const scss = readFileSync(join(KIT, 'themes/vaultwarden/user.vaultwarden.scss.hbs'), 'utf8');
  assert.ok(!/\{\{|\}\}/.test(scss), 'no Handlebars expressions');
  assert.ok(scss.includes(':root {') && scss.includes('.theme_dark {'));
  for (const [, r, g, b] of scss.matchAll(/--color-[\w-]+: (\d+),? (\d+),? (\d+);/g)) assert.ok(r === g && g === b, `${r} ${g} ${b}`);
  const dir = mkdtempSync(join(tmpdir(), 'olympus-vw-'));
  try {
    const data = join(dir, 'data');
    execFileSync('mkdir', ['-p', data]);
    const script = join(KIT, 'themes/vaultwarden/apply.sh');
    execFileSync('sh', [script, data]);
    const installed = join(data, 'templates/scss/user.vaultwarden.scss.hbs');
    assert.equal(readFileSync(installed, 'utf8'), scss);
    assert.ok(!existsSync(join(data, 'templates/scss/vaultwarden.scss.hbs')), 'Vaultwarden’s own rules are not replaced');
    execFileSync('sh', [script, data, '--restore']);
    assert.ok(!existsSync(installed));
    // The Docker form, against a stand-in docker that records what it is asked to do.
    const bin = join(dir, 'bin');
    execFileSync('mkdir', ['-p', bin]);
    writeFileSync(join(bin, 'docker'), `#!/bin/sh\necho "$@" >> "${dir}/docker.log"\n`);
    chmodSync(join(bin, 'docker'), 0o755);
    execFileSync('sh', [script], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, VAULTWARDEN_CONTAINER: 'vw' } });
    const log = readFileSync(join(dir, 'docker.log'), 'utf8');
    assert.match(log, /cp .*user\.vaultwarden\.scss\.hbs vw:\/data\/templates\/scss\/user\.vaultwarden\.scss\.hbs/);
    assert.match(log, /restart vw/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Navidrome kit: the settings it can make, a background the house serves, and greys for the optional stylesheet', () => {
  const compose = parse(readFileSync(join(KIT, 'themes/navidrome/docker-compose.override.yml'), 'utf8'));
  const env = compose.services.navidrome.environment;
  assert.equal(env.ND_DEFAULTTHEME, 'Extra Dark');
  assert.match(env.ND_UILOGINBACKGROUNDURL, /^\$\{OLYMPUS_SITE:\?.+\}\/files\/assets\/integrations\/backgrounds\/olympus-background\.png$/);
  assert.ok(existsSync(join(KIT, 'backgrounds/olympus-background.png')), 'the background it names is published');
  const css = readFileSync(join(KIT, 'themes/navidrome/navidrome.css'), 'utf8');
  for (const [hex] of css.matchAll(/#[0-9A-Fa-f]{6}\b/g)) assert.ok(hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7), hex);
  assert.match(readFileSync(join(KIT, 'themes/navidrome/nginx.conf'), 'utf8'), /sub_filter '<\/head>' '<link rel="stylesheet" href="\/the-olympus\/navidrome\.css"><\/head>';/);
});

test('every kit has its guide: the folder’s README, the same as its chapter of the site’s guide', () => {
  const chapters = readdirSync(join(ROOT, 'docs/integrations')).filter((f) => f.endsWith('.md')).sort();
  const kits = readdirSync(join(KIT, 'themes')).sort();
  assert.deepEqual(chapters, kits.map((k) => `${k}.md`));
  for (const k of kits) {
    const readme = readFileSync(join(KIT, 'themes', k, 'README.md'), 'utf8');
    assert.equal(readFileSync(join(ROOT, 'docs/integrations', `${k}.md`), 'utf8'), readme, k);
    for (const section of ['## What it changes', '## Before you start', '## Install', '## Check that it worked', '## Undo', '## Files']) assert.ok(readme.includes(section), `${k}: ${section}`);
    // Every file the guide lists is in the kit, and every file in the kit is listed.
    const listed = [...readme.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]).sort();
    const walk = (d: string, p = ''): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name), `${p}${e.name}/`) : [`${p}${e.name}`]));
    assert.deepEqual(listed, walk(join(KIT, 'themes', k)).filter((f) => f !== 'README.md').sort(), `${k}: the files table`);
  }
  for (const kit of THEME_KITS) assert.ok(kits.includes(kit.id), `${kit.id} has a folder`);
});
