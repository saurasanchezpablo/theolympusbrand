// The Olympus — the one-command installer: writes assets/install.sh from what
// the house has built — the screens' parts, your terminal's parts, every theme
// kit with the checksum of each of its files — and who a machine can be (the
// master or a service). The site serves it at /install.sh.
//
//   npm run installer        (part of npm run build; after screens and integrations)

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { loadCatalog } from '../src/node/catalog.ts';
import { SCREEN_PARTS } from '../src/screens/parts.ts';
import { SHELL_PARTS } from '../src/screens/shell.ts';
import { THEME_KITS } from '../src/integrations/themes/index.ts';
import { launcher, type LauncherKit } from '../src/installer/launcher.ts';
import { ROOT } from './lib/build-service.ts';

const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const SCREENS = join(ROOT, 'assets', 'screens');
const THEMES = join(ROOT, 'assets', 'integrations', 'themes');
for (const f of [join(SCREENS, 'install.sh'), join(SCREENS, 'shell', 'install.sh'), THEMES]) if (!existsSync(f)) throw new Error(`${relative(ROOT, f)} is missing: run npm run screens and npm run integrations first`);

const walk = (dir: string): string[] => readdirSync(dir).sort().flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

const services = loadCatalog();
const kits: LauncherKit[] = readdirSync(THEMES)
  .sort()
  .map((dir) => {
    // themes/<kit>/ or themes/<kit>-<service>/: the longest kit id that names it.
    const kit = [...THEME_KITS].sort((a, b) => b.id.length - a.id.length).find((k) => dir === k.id || dir.startsWith(`${k.id}-`));
    if (!kit) throw new Error(`themes/${dir}/ belongs to no theme kit`);
    const service = dir === kit.id ? null : services.find((s) => dir === `${kit.id}-${s.id}`);
    return {
      dir,
      label: service ? `${kit.label} (${service.name})` : kit.label,
      installer: kit.installer,
      files: walk(join(THEMES, dir)).map((f) => ({ path: relative(join(THEMES, dir), f).split(sep).join('/'), sha256: sha(f) })),
    };
  });

const present = (dir: string) => existsSync(join(SCREENS, dir));
const script = launcher({
  system: SCREEN_PARTS.filter((p) => present(p.dir)),
  user: SHELL_PARTS.filter((p) => present(p.dir)),
  kits,
  identities: [{ id: 'master', name: 'The Olympus' }, ...services.map((s) => ({ id: s.id, name: s.name }))],
  systemSum: sha(join(SCREENS, 'install.sh')),
  userSum: sha(join(SCREENS, 'shell', 'install.sh')),
});
writeFileSync(join(ROOT, 'assets', 'install.sh'), script, { mode: 0o755 });
console.log(`✔ assets/install.sh — ${kits.length} application kits, ${services.length + 1} identities`);
