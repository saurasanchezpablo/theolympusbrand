// Uptime Kuma: a status page stylesheet and logo. Uptime Kuma 1.23.

import { PALETTE } from '../../brand/palette.ts';
import { coinSvg } from '../marks.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;

export function uptimeKumaCss(): string {
  return `/* The Olympus — Uptime Kuma status page.
   Status page → Edit Status Page → Custom CSS. Written for Uptime Kuma 1.23
   with the dark theme. The up / down colours keep their meaning. */

body, .dark body, body.dark { background-color: ${P.obsidian}; }
.dark .shadow-box:not(.alert), .shadow-box:not(.alert) { background-color: ${P.charcoal}; }
.dark .shadow-box .item:hover { background-color: ${P.graphite}; }
.title-flex .title, h1 { letter-spacing: 0.12em; text-transform: uppercase; }
.description, footer, footer a, .footer { color: ${P.silver}; }
`;
}

export const uptimeKuma: ThemeKit = {
  id: 'uptime-kuma',
  label: 'Uptime Kuma',
  match: { ids: ['uptime-kuma', 'uptime'], category: 'monitoring' },
  how: '`status-page.css` and `logo.png` — status page settings',
  files: async (t) => [
    ['status-page.css', uptimeKumaCss()],
    ['logo.png', await t.png(coinSvg(t.marks.seal, 'dark', `The Olympus — ${t.name}`), 512)],
  ],
};
