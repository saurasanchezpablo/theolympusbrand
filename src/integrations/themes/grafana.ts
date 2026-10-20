// Grafana (open-source edition): logo, favicon and home-screen icon,
// mounted over Grafana's own by a compose override.

import { coinSvg, tileSvg } from '../marks.ts';
import type { ThemeKit } from './types.ts';

const GRAFANA_IMG = '/usr/share/grafana/public/img';
export const GRAFANA_FILES = ['grafana_icon.svg', 'fav32.png', 'apple-touch-icon.png'] as const;

export function grafanaCompose(): string {
  return `# The Olympus — Grafana (open-source edition).
# Merge into the compose file that runs Grafana (rename "grafana" to your
# service's name), with this folder beside it as ./the-olympus/grafana.
# Grafana serves these files as its logo, favicon and home-screen icon; they
# are replaced at start-up, so updates keep them. Remove the lines to undo.
services:
  grafana:
    volumes:
${GRAFANA_FILES.map((f) => `      - ./the-olympus/grafana/${f}:${GRAFANA_IMG}/${f}:ro`).join('\n')}
    environment:
      GF_USERS_DEFAULT_THEME: dark
`;
}

export const grafana: ThemeKit = {
  id: 'grafana',
  label: 'Grafana',
  match: { ids: ['grafana'], category: 'monitoring' },
  how: '`docker-compose.override.yml` mounts the logo, favicon and icon',
  guide: (t) => ({
    title: 'Grafana',
    intro: `Grafana's open-source edition has no branding settings, but it serves its logo, favicon and home-screen icon as plain files. The kit replaces those three with ${t.name}'s seal and makes the dark theme the default.`,
    changes: ['The logo on the sign-in page and in the menu.', 'The favicon and the icon for a phone’s home screen.', 'The default theme for new users: dark.'],
    limits: ['Colours and the *Welcome to Grafana* text: changing them is a feature of Grafana Enterprise, not of the open-source edition.'],
    requires: ['Grafana run with Docker Compose (for an installed Grafana, see step 4).'],
    steps: [
      { text: 'Copy this folder next to the compose file that runs Grafana, as `the-olympus/grafana/`.' },
      { text: 'Merge `docker-compose.override.yml` into that compose file, renaming `grafana` to your service’s name if it differs (or keep it beside it as an override file).' },
      { text: 'Recreate the container.', code: 'docker compose up -d grafana' },
      { text: 'Installed without Docker: copy `grafana_icon.svg`, `fav32.png` and `apple-touch-icon.png` to `/usr/share/grafana/public/img/` instead (an update puts Grafana’s back).' },
    ],
    check: ['Signed out, the sign-in page shows the seal instead of Grafana’s logo.', 'The browser tab shows the seal.'],
    undo: [{ text: 'Remove the volume lines and the `GF_USERS_DEFAULT_THEME` line, then recreate the container.' }],
    updates: 'With Docker the files are mounted read-only over Grafana’s, so updates keep them.',
    files: [
      ['docker-compose.override.yml', 'The mounts and the default theme'],
      ['grafana_icon.svg', 'The logo: the seal on its own disc'],
      ['fav32.png', 'The favicon'],
      ['apple-touch-icon.png', 'The home-screen icon'],
    ],
    tested: 'Written for the open-source edition, which has served these three files under these names for several releases. Not applied to a live server here: if an update renames one, it simply stays Grafana’s.',
  }),
  files: async (t) => {
    const [icon, fav, touch] = GRAFANA_FILES;
    return [
      ['docker-compose.override.yml', grafanaCompose()],
      [icon, coinSvg(t.marks.seal, 'dark', `The Olympus — ${t.name}`)],
      [fav, await t.png(coinSvg(t.marks.seal, 'dark'), 32)],
      [touch, await t.png(tileSvg(t.marks.seal), 180)],
    ];
  },
};
