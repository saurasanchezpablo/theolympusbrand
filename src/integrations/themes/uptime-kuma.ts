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
  guide: (t) => ({
    title: 'Uptime Kuma',
    intro: `Uptime Kuma lets each public status page carry its own logo and stylesheet. The kit gives a status page ${t.name}'s seal and the house's dark grounds; the up and down colours keep their meaning.`,
    changes: ['The status page’s logo.', 'Its grounds and cards: obsidian and charcoal.', 'Its title, set in capitals like the house’s inscriptions.'],
    limits: ['The dashboard you manage monitors from: Uptime Kuma has no setting for it.', 'Green, amber and red: they say whether a service is up, and stay as they are.'],
    requires: ['Uptime Kuma 1.23 or later, with a status page.', 'The status page on the dark theme.'],
    steps: [
      { text: 'Open the status page and choose **Edit Status Page**.' },
      { text: 'Click the logo and upload `logo.png`.' },
      { text: 'Paste `status-page.css` into **Custom CSS**.' },
      { text: 'Choose **Save**.' },
    ],
    check: ['The status page shows the seal, on dark grounds, with the title in capitals.'],
    undo: [{ text: 'In **Edit Status Page**, clear **Custom CSS** and put your own logo back.' }],
    files: [
      ['status-page.css', 'The stylesheet'],
      ['logo.png', 'The seal on its own disc, 512 px'],
    ],
    tested: 'Written for Uptime Kuma 1.23. Not applied to a live server here.',
  }),
  files: async (t) => [
    ['status-page.css', uptimeKumaCss()],
    ['logo.png', await t.png(coinSvg(t.marks.seal, 'dark', `The Olympus — ${t.name}`), 512)],
  ],
};
