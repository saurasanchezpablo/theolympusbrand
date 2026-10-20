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
