// Start pages for the house: the catalogue written as the configuration files
// of the self-hosted dashboards that read their services from a file —
// Homepage, Dashy and Homer — plus a bookmarks file any browser imports and a
// table for the dashboards that are set up in their own interface (Heimdall,
// Homarr). Pure text; the icons are the coins from icons.ts.

import { CATEGORIES, type Category } from '../geometry/pantheon.ts';
import { PALETTE } from '../brand/palette.ts';
import { DOMAIN } from '../brand/identity.ts';
import { base64 } from '../export/png.ts';
import { mdText, oneLine } from '../catalog/text.ts';

export type Entry = { id: string; name: string; category: Category; description?: string; url?: string; app?: string };

/** Where the dashboards find the icons. `local`: each dashboard's own icon folder; otherwise a URL prefix. */
export type IconSource = { kind: 'local' } | { kind: 'url'; base: string };

export type DashboardOptions = { title?: string; icons?: IconSource };

/** Group names, in catalogue order. */
export const GROUPS: Record<Category, string> = {
  virtualization: 'Virtualisation',
  networking: 'Network',
  proxy: 'Gateways',
  storage: 'Storage',
  backup: 'Backup',
  monitoring: 'Monitoring',
  security: 'Security',
  cloud: 'Cloud',
  media: 'Media',
  home: 'Home',
  containers: 'Containers',
  web: 'Web',
  gaming: 'Game servers',
  sandbox: 'Sandbox games',
  competitive: 'Multiplayer',
  community: 'Community',
  other: 'Other',
};

/** A service's address: its own, or the house pattern. */
export const addressOf = (e: Entry) => e.url ?? `https://${e.id}.${DOMAIN}`;

/** File names of a service's icons (the master's are `olympus.*`). */
export const iconName = (id: string, variant: '' | '-light' = '', ext: 'png' | 'svg' = 'png') => `${id === 'master' ? 'olympus' : `olympus-${id}`}${variant}.${ext}`;

/** Entries grouped by category, in catalogue order, each group sorted by name. */
export function groups(entries: Entry[]): { category: Category; name: string; entries: Entry[] }[] {
  return (Object.keys(CATEGORIES) as Category[])
    .map((category) => ({ category, name: GROUPS[category], entries: entries.filter((e) => e.category === category).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.entries.length > 0);
}

/** A YAML scalar: JSON strings are valid YAML, and never need further escaping. */
const q = (s: string) => JSON.stringify(s);

const header = (what: string, where: string) =>
  `# The Olympus — ${what}\n# Generated from the catalogue (npm run integrations). ${where}\n`;

const iconRef = (opts: DashboardOptions, local: string, id: string) =>
  opts.icons?.kind === 'url' ? `${opts.icons.base.replace(/\/?$/, '/')}${iconName(id)}` : `${local}${iconName(id)}`;

/* ---------------------------------------------------------------- */
/* Homepage (gethomepage.dev)                                         */
/* ---------------------------------------------------------------- */

/** services.yaml and settings.yaml. Icons in /app/public/icons, the background in /app/public/images. */
export function homepage(entries: Entry[], opts: DashboardOptions = {}): { services: string; settings: string } {
  let services = header('Homepage services', 'Copy to the config folder as services.yaml.');
  for (const g of groups(entries)) {
    services += `\n- ${q(g.name)}:\n`;
    for (const e of g.entries) {
      services += `    - ${q(e.name)}:\n        icon: ${q(iconRef(opts, '/icons/', e.id))}\n        href: ${q(addressOf(e))}\n`;
      if (e.description) services += `        description: ${q(e.description)}\n`;
    }
  }
  const settings =
    header('Homepage settings', 'Merge into settings.yaml.') +
    `\ntitle: ${q(opts.title ?? 'The Olympus')}\ndescription: ${q(DOMAIN)}\nfavicon: ${q(iconRef(opts, '/icons/', 'master'))}\n` +
    `theme: dark\ncolor: neutral\nheaderStyle: clean\nbackground:\n  image: ${q('/images/olympus-background.png')}\n`;
  return { services, settings };
}

/* ---------------------------------------------------------------- */
/* Dashy (dashy.to)                                                   */
/* ---------------------------------------------------------------- */

/** conf.yml. Icons in user-data/item-icons/, referred to by file name. */
export function dashy(entries: Entry[], opts: DashboardOptions = {}): string {
  const icon = (id: string) => (opts.icons?.kind === 'url' ? iconRef(opts, '', id) : iconName(id));
  let out = header('Dashy', 'Copy to user-data/conf.yml.');
  out += `\npageInfo:\n  title: ${q(opts.title ?? 'The Olympus')}\n  description: ${q(DOMAIN)}\n  logo: ${q(opts.icons?.kind === 'url' ? iconRef(opts, '', 'master') : `/item-icons/${iconName('master')}`)}\n`;
  out += `appConfig:\n  theme: olympus\n  cssThemes: [olympus]\n  customColors:\n    olympus:\n      primary: ${q(PALETTE.marble)}\n      background: ${q(PALETTE.obsidian)}\n      background-darker: ${q('#000000')}\n  layout: auto\n  iconSize: large\n`;
  out += `sections:\n`;
  for (const g of groups(entries)) {
    out += `  - name: ${q(g.name)}\n    items:\n`;
    for (const e of g.entries) {
      out += `      - title: ${q(e.name)}\n`;
      if (e.description) out += `        description: ${q(e.description)}\n`;
      out += `        icon: ${q(icon(e.id))}\n        url: ${q(addressOf(e))}\n`;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- */
/* Homer (github.com/bastienwirtz/homer)                              */
/* ---------------------------------------------------------------- */

const HOMER_COLORS = {
  light: {
    'highlight-primary': PALETTE.charcoal,
    'highlight-secondary': PALETTE.graphite,
    'highlight-hover': PALETTE.slate,
    background: PALETTE.marble,
    'card-background': PALETTE.paper,
    text: PALETTE.charcoal,
    'text-header': PALETTE.paper,
    'text-title': PALETTE.charcoal,
    'text-subtitle': PALETTE.slate,
    'card-shadow': 'rgba(0, 0, 0, 0.08)',
    link: PALETTE.charcoal,
    'link-hover': PALETTE.slate,
  },
  dark: {
    'highlight-primary': PALETTE.charcoal,
    'highlight-secondary': PALETTE.graphite,
    'highlight-hover': PALETTE.slate,
    background: PALETTE.obsidian,
    'card-background': PALETTE.charcoal,
    text: PALETTE.marble,
    'text-header': PALETTE.marble,
    'text-title': PALETTE.paper,
    'text-subtitle': PALETTE.silver,
    'card-shadow': 'rgba(0, 0, 0, 0.4)',
    link: PALETTE.marble,
    'link-hover': PALETTE.silver,
  },
};

/** config.yml. Icons in assets/icons/. */
export function homer(entries: Entry[], opts: DashboardOptions = {}): string {
  let out = header('Homer', 'Copy to assets/config.yml; the icons to assets/icons/.');
  out += `\ntitle: ${q(opts.title ?? 'The Olympus')}\nsubtitle: ${q(DOMAIN)}\nlogo: ${q(iconRef(opts, 'assets/icons/', 'master'))}\nheader: true\nfooter: false\ntheme: default\n`;
  out += `colors:\n`;
  for (const [mode, colors] of Object.entries(HOMER_COLORS)) {
    out += `  ${mode}:\n`;
    for (const [k, v] of Object.entries(colors)) out += `    ${k}: ${q(v)}\n`;
  }
  out += `services:\n`;
  for (const g of groups(entries)) {
    out += `  - name: ${q(g.name)}\n    items:\n`;
    for (const e of g.entries) {
      out += `      - name: ${q(e.name)}\n        logo: ${q(iconRef(opts, 'assets/icons/', e.id))}\n`;
      if (e.description) out += `        subtitle: ${q(e.description)}\n`;
      out += `        url: ${q(addressOf(e))}\n        target: "_blank"\n`;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- */
/* Browser bookmarks and a plain table                                */
/* ---------------------------------------------------------------- */

const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Bookmarks in the Netscape format every browser imports: a folder "The
 * Olympus" with a subfolder per group, each bookmark with its seal as icon.
 * `favicon` gives a small PNG for an id (the master's is 'master').
 */
export function bookmarks(entries: Entry[], favicon: (id: string) => Uint8Array | undefined, opts: DashboardOptions = {}): string {
  const icon = (id: string) => {
    const p = favicon(id);
    return p ? ` ICON="data:image/png;base64,${base64(p)}"` : '';
  };
  const title = html(opts.title ?? 'The Olympus');
  let out = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n`;
  out += `    <DT><H3>${title}</H3>\n    <DL><p>\n`;
  out += `        <DT><A HREF="${html(`https://${DOMAIN}`)}"${icon('master')}>${title}</A>\n`;
  for (const g of groups(entries)) {
    out += `        <DT><H3>${html(g.name)}</H3>\n        <DL><p>\n`;
    for (const e of g.entries) out += `            <DT><A HREF="${html(addressOf(e))}"${icon(e.id)}>${html(e.name)}</A>\n`;
    out += `        </DL><p>\n`;
  }
  out += `    </DL><p>\n</DL><p>\n`;
  return out;
}

/** A CSV cell: quoted when it must be, and never read as a formula by a spreadsheet. */
const csvCell = (cell: string) => {
  const raw = oneLine(cell);
  const s = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per service, for dashboards set up in their own interface. */
export function servicesCsv(entries: Entry[]): string {
  const rows = [['name', 'url', 'group', 'description', 'icon']];
  for (const g of groups(entries)) for (const e of g.entries) rows.push([e.name, addressOf(e), g.name, e.description ?? '', iconName(e.id)]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/* ---------------------------------------------------------------- */
/* One service, to add to a dashboard that already exists             */
/* ---------------------------------------------------------------- */

/** The entries for one service, as Markdown with a block to paste into each dashboard. */
export function dashboardSnippets(e: Entry, opts: DashboardOptions = {}): string {
  const after = (text: string, marker: string) => text.slice(text.indexOf(marker) + marker.length).trimEnd();
  const fence = (s: string) => '```yaml\n' + s + '\n```';
  return `# ${mdText(e.name)} — dashboard entries

The icons beside this file are the service's seal struck as a coin:
\`${iconName(e.id)}\` (dark), \`${iconName(e.id, '-light')}\` (light) and \`${iconName(e.id, '', 'svg')}\`.
Its address: ${addressOf(e)}

## Homepage — services.yaml (icon in /app/public/icons)

${fence(after(homepage([e], opts).services, '\n\n'))}

## Dashy — conf.yml, under sections (icon in user-data/item-icons)

${fence(after(dashy([e], opts), 'sections:\n'))}

## Homer — config.yml, under services (icon in assets/icons)

${fence(after(homer([e], opts), 'services:\n'))}
`;
}
