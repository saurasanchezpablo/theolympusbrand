// The integration kit: every dashboard configuration and theme kit, with the
// icons and grounds they use, as one list of files. The host renders SVG to
// PNG (resvg on the command line, a canvas in the browser); everything else
// is made here, so both write the same files. The theme kits themselves are
// modules in themes/, one per application.

import { DOMAIN } from '../brand/identity.ts';
import { png } from '../export/png.ts';
import { marbleScreen, type ScreenTone } from '../render/wallpaper.ts';
import { bookmarks, dashy, homepage, homer, iconName, servicesCsv, addressOf, type DashboardOptions, type Entry } from './dashboards.ts';
import { coinSvg, BACKGROUND, type KitMarks } from './marks.ts';
import { themeAssignments, type ThemeAssignment } from './themes/index.ts';
import { guideMarkdown } from './themes/shared.ts';
import { mdText } from '../catalog/text.ts';

export { coinSvg, bannerMark, BACKGROUND, type CoinTone, type KitMarks } from './marks.ts';

export type KitSource = {
  entries: Entry[];
  /** The marks of a service, or of the master for 'master'. */
  marks: (id: string) => KitMarks;
};
export type KitHost = { png: (svg: string, width: number) => Uint8Array | Promise<Uint8Array> };
export type KitFile = { path: string; data: string | Uint8Array };

/* ---------------------------------------------------------------- */
/* The kit                                                            */
/* ---------------------------------------------------------------- */

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

  // Theme kits: one per application, from the service that runs it (see themes/index.ts).
  const assignments = themeAssignments(src.entries);
  for (const { kit, entry, dir } of assignments) {
    const id = entry?.id ?? 'master';
    const ctx = { entry, id, name: entry?.name ?? 'The Olympus', url: entry ? addressOf(entry) : `https://${DOMAIN}`, marks: src.marks(id), png: render, ground };
    for (const [path, data] of await kit.files(ctx)) add(`themes/${dir}/${path}`, data);
    // The guide is Markdown the site renders: the service's name goes in escaped.
    add(`themes/${dir}/README.md`, guideMarkdown(kit.guide({ ...ctx, name: mdText(ctx.name) }), entry ? `${mdText(entry.name)}’s seal` : 'the master’s seal', dir));
  }

  add('README.md', kitReadme(src, opts, assignments));
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function kitReadme(src: KitSource, opts: DashboardOptions, assignments: ThemeAssignment[]): string {
  const rows = assignments.map(({ kit, entry, dir }) => {
    const label = dir === kit.id ? kit.label : `${kit.label} — ${mdText(entry!.name)} (\`${dir}/\`)`;
    return `| ${label} | ${kit.how} | ${entry ? `${mdText(entry.name)}’s seal` : 'the master’s seal'} |`;
  });
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
${rows.join('\n')}

Each is written for a current release of the application (named in the
file) and only uses what it offers for customisation. They have not been run
against live instances here: if an update renames something, the rest still
applies.
`;
}
