// The integration kit: every dashboard configuration and theme kit, with the
// icons and grounds they use, as one list of files. The host renders SVG to
// PNG (resvg on the command line, a canvas in the browser); everything else
// is made here, so both write the same files.

import type { Mark } from '../geometry/crest.ts';
import { lockupParts } from '../geometry/lockup.ts';
import { transformPath } from '../geometry/path.ts';
import { ARTBOARD } from '../geometry/math.ts';
import { PALETTE } from '../brand/palette.ts';
import { DOMAIN } from '../brand/identity.ts';
import { png, base64 } from '../export/png.ts';
import { ico } from '../export/ico.ts';
import { marbleScreen, type ScreenTone } from '../render/wallpaper.ts';
import { bookmarks, dashy, homepage, homer, iconName, servicesCsv, addressOf, type DashboardOptions, type Entry } from './dashboards.ts';
import { grafanaCompose, jellyfinCss, jellyfinDisclaimer, nextcloudScript, proxmoxScript, uptimeKumaCss, GRAFANA_FILES } from './themes.ts';

const S = ARTBOARD;
const P = PALETTE;

export type KitMarks = { seal: Mark; emblem: Mark; crest: Mark };
export type KitSource = {
  entries: Entry[];
  /** The marks of a service, or of the master for 'master'. */
  marks: (id: string) => KitMarks;
};
export type KitHost = { png: (svg: string, width: number) => Uint8Array | Promise<Uint8Array> };
export type KitFile = { path: string; data: string | Uint8Array };

/* ---------------------------------------------------------------- */
/* Drawings                                                           */
/* ---------------------------------------------------------------- */

export type CoinTone = 'dark' | 'light';
const COIN = { dark: { disc: P.obsidian, ink: P.marble }, light: { disc: P.paper, ink: P.charcoal } } as const;

/**
 * A coin: the seal struck on a disc of its own ground, so it reads on any
 * dashboard, light or dark. The disc stops inside the seal's rim.
 */
export function coinSvg(seal: Mark, tone: CoinTone, title = 'The Olympus'): string {
  const c = COIN[tone];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <title>${esc(title)}</title>
  <circle cx="${S / 2}" cy="${S / 2}" r="${S / 2 - 6}" fill="${c.disc}"/>
  <path d="${seal.d}" fill="${c.ink}"/>
</svg>
`;
}

/**
 * A banner for an application's header: the seal and a name, set tight —
 * the name's capitals are 0.4 of the seal's height, so it reads at 30 px.
 */
export function bannerMark(seal: Mark, name: string): Mark {
  const parts = lockupParts(seal, { name, caption: '', layout: 'horizontal' });
  const k = 0.5;
  const shift = S + 72 - (S * k + 40);
  return {
    id: `${seal.id}-banner`,
    d: transformPath(seal.d, k, 0, 0) + transformPath(parts.name, 1, -shift, -(S * (1 - k)) / 2),
    width: parts.width - shift,
    height: S * k,
  };
}

const markSvg = (m: Mark, ink: string, ground: string | null = null) => {
  const w = m.width ?? S;
  const h = m.height ?? S;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${ground ? `<rect width="${w}" height="${h}" fill="${ground}"/>` : ''}<path d="${m.d}" fill="${ink}"/></svg>\n`;
};

/** The seal centred on an opaque square — for home-screen icons. */
const tileSvg = (seal: Mark, fill = 0.78) => {
  const t = (S * (1 - fill)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="${P.obsidian}"/><path transform="translate(${t} ${t}) scale(${fill})" d="${seal.d}" fill="${P.marble}"/></svg>`;
};

/** A screen: a marble ground with a mark centred on it, `scale` of the height. */
function screenSvg(ground: Uint8Array, w: number, h: number, mark: Mark, scale: number, ink: string): string {
  const size = h * scale;
  const k = size / S;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image width="${w}" height="${h}" href="data:image/png;base64,${base64(ground)}"/><path transform="translate(${(w - size) / 2} ${(h - size) / 2}) scale(${k})" d="${mark.d}" fill="${ink}"/></svg>`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ---------------------------------------------------------------- */
/* Which service themes which application                             */
/* ---------------------------------------------------------------- */

export const THEMED = {
  nextcloud: { label: 'Nextcloud', ids: ['nextcloud'], category: 'cloud' },
  jellyfin: { label: 'Jellyfin', ids: ['jellyfin'], category: 'media' },
  proxmox: { label: 'Proxmox VE', ids: ['proxmox', 'pve'], category: 'virtualization' },
  grafana: { label: 'Grafana', ids: ['grafana'], category: 'monitoring' },
  'uptime-kuma': { label: 'Uptime Kuma', ids: ['uptime-kuma', 'uptime'], category: 'monitoring' },
} as const;
export type ThemedApp = keyof typeof THEMED;

/** The catalogue entry an application's kit is made from: by id, then by category; none means the master. */
export function themedEntry(entries: Entry[], app: ThemedApp): Entry | null {
  const t = THEMED[app];
  return entries.find((e) => (t.ids as readonly string[]).includes(e.id)) ?? entries.find((e) => e.category === t.category) ?? null;
}

/* ---------------------------------------------------------------- */
/* The kit                                                            */
/* ---------------------------------------------------------------- */

export const BACKGROUND = { width: 1920, height: 1080 } as const;
export const LOGIN_BACKGROUND = { width: 2560, height: 1440 } as const;

export async function integrationKit(src: KitSource, host: KitHost, opts: DashboardOptions = {}): Promise<KitFile[]> {
  const files: KitFile[] = [];
  const add = (path: string, data: string | Uint8Array) => files.push({ path, data });
  const render = async (svg: string, width: number) => await host.png(svg, width);
  const grounds = new Map<string, Uint8Array>();
  const ground = (w: number, h: number, tone: ScreenTone) => {
    const key = `${w}x${h}-${tone}`;
    if (!grounds.has(key)) grounds.set(key, png(marbleScreen(w, h, tone), w, h, 1));
    return grounds.get(key)!;
  };

  // Icons: a dark and a light coin for every service and the master.
  const favicons = new Map<string, Uint8Array>();
  for (const id of ['master', ...src.entries.map((e) => e.id)]) {
    const seal = src.marks(id).seal;
    const title = id === 'master' ? 'The Olympus' : `The Olympus — ${src.entries.find((e) => e.id === id)!.name}`;
    add(`icons/${iconName(id, '', 'svg')}`, coinSvg(seal, 'dark', title));
    add(`icons/${iconName(id)}`, await render(coinSvg(seal, 'dark', title), 256));
    add(`icons/${iconName(id, '-light')}`, await render(coinSvg(seal, 'light', title), 256));
    favicons.set(id, await render(coinSvg(seal, 'dark', title), 32));
  }
  const bg = ground(BACKGROUND.width, BACKGROUND.height, 'marble-dark');
  add('backgrounds/olympus-background.png', bg);
  add('backgrounds/olympus-background-light.png', ground(BACKGROUND.width, BACKGROUND.height, 'marble-light'));

  // Dashboards.
  const hp = homepage(src.entries, opts);
  add('dashboards/homepage/services.yaml', hp.services);
  add('dashboards/homepage/settings.yaml', hp.settings);
  add('dashboards/dashy/conf.yml', dashy(src.entries, opts));
  add('dashboards/homer/config.yml', homer(src.entries, opts));
  add('dashboards/bookmarks.html', bookmarks(src.entries, (id) => favicons.get(id), opts));
  add('dashboards/services.csv', servicesCsv(src.entries));

  // Theme kits.
  const pick = (app: ThemedApp) => {
    const e = themedEntry(src.entries, app);
    return { entry: e, id: e?.id ?? 'master', name: e?.name ?? 'The Olympus', url: e ? addressOf(e) : `https://${DOMAIN}`, marks: src.marks(e?.id ?? 'master') };
  };

  {
    const t = pick('nextcloud');
    add('themes/nextcloud/apply.sh', nextcloudScript({ name: 'The Olympus', url: t.url }));
    add('themes/nextcloud/logo.svg', markSvg(t.marks.emblem, P.marble));
    add('themes/nextcloud/logoheader.svg', markSvg(t.marks.seal, P.marble));
    add('themes/nextcloud/favicon.png', await render(coinSvg(t.marks.seal, 'dark'), 256));
    add('themes/nextcloud/background.png', ground(LOGIN_BACKGROUND.width, LOGIN_BACKGROUND.height, 'marble-dark'));
  }
  {
    const t = pick('jellyfin');
    add('themes/jellyfin/custom.css', jellyfinCss({ banner: markSvg(bannerMark(t.marks.seal, t.name), P.marble) }));
    add('themes/jellyfin/login-disclaimer.html', jellyfinDisclaimer());
    add('themes/jellyfin/splashscreen.png', await render(screenSvg(bg, BACKGROUND.width, BACKGROUND.height, t.marks.crest, 0.5, P.marble), BACKGROUND.width));
  }
  {
    const t = pick('proxmox');
    const banner = bannerMark(t.marks.seal, t.name);
    const height = 30;
    const width = Math.round((banner.width! * height) / banner.height!);
    add('themes/proxmox/apply.sh', proxmoxScript());
    add('themes/proxmox/logo-light-theme.png', await render(markSvg(banner, P.charcoal), width));
    add('themes/proxmox/logo-dark-theme.png', await render(markSvg(banner, P.marble), width));
    const coin = coinSvg(t.marks.seal, 'dark');
    add('themes/proxmox/favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await render(coin, size) })))));
  }
  {
    const t = pick('grafana');
    const [icon, fav, touch] = GRAFANA_FILES;
    add('themes/grafana/docker-compose.override.yml', grafanaCompose());
    add(`themes/grafana/${icon}`, coinSvg(t.marks.seal, 'dark', `The Olympus — ${t.name}`));
    add(`themes/grafana/${fav}`, await render(coinSvg(t.marks.seal, 'dark'), 32));
    add(`themes/grafana/${touch}`, await render(tileSvg(t.marks.seal), 180));
  }
  {
    const t = pick('uptime-kuma');
    add('themes/uptime-kuma/status-page.css', uptimeKumaCss());
    add('themes/uptime-kuma/logo.png', await render(coinSvg(t.marks.seal, 'dark', `The Olympus — ${t.name}`), 512));
  }

  add('README.md', kitReadme(src, opts));
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function kitReadme(src: KitSource, opts: DashboardOptions): string {
  const from = (app: ThemedApp) => {
    const e = themedEntry(src.entries, app);
    return e ? `${e.name}’s seal` : 'the master’s seal';
  };
  return `# The Olympus — integrations

Start pages and themes for the house's self-hosted services, generated from
the catalogue (${src.entries.length} services). Rebuild with \`npm run integrations\`.
The guide's chapter *Integrations* explains each one step by step.

## Dashboards — \`dashboards/\`

| Dashboard | File | Icons go in |
|---|---|---|
| Homepage | \`homepage/services.yaml\`, \`homepage/settings.yaml\` | \`/app/public/icons\`; the background in \`/app/public/images\` |
| Dashy | \`dashy/conf.yml\` | \`user-data/item-icons/\` |
| Homer | \`homer/config.yml\` | \`assets/icons/\` |
| Heimdall, Homarr | \`services.csv\` — set up in their own interface | upload from \`icons/\` |
| Any browser | \`bookmarks.html\` — Import bookmarks | built in |

${opts.icons?.kind === 'url' ? `Icons are referred to at ${opts.icons.base}.` : 'Icons are referred to in each dashboard\'s own icon folder: copy `icons/` there.'}
Every service links to its address (\`https://<service>.${DOMAIN}\` unless the
catalogue says otherwise).

## Icons — \`icons/\`

Each service's seal struck as a coin: \`olympus-<id>.png\` (dark, 256 px),
\`olympus-<id>-light.png\` (light) and \`olympus-<id>.svg\`. The master's are
\`olympus.*\`. The coins read on light and dark dashboards alike.

## Themes — \`themes/\`

| Application | How | Made from |
|---|---|---|
| Nextcloud | \`apply.sh\` sets the Theming app with \`occ\` | ${from('nextcloud')} |
| Jellyfin | \`custom.css\`, \`login-disclaimer.html\`, \`splashscreen.png\` — Dashboard → Branding | ${from('jellyfin')} |
| Proxmox VE | \`apply.sh\` installs the header logo and favicon (\`--restore\` undoes) | ${from('proxmox')} |
| Grafana | \`docker-compose.override.yml\` mounts the logo, favicon and icon | ${from('grafana')} |
| Uptime Kuma | \`status-page.css\` and \`logo.png\` — status page settings | ${from('uptime-kuma')} |

Each is written for a current release of the application (named in the
file) and only uses what it offers for customisation. They have not been run
against live instances here: if an update renames something, the rest still
applies.
`;
}
