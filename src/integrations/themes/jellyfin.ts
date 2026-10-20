// Jellyfin: custom CSS for the Dark theme, a login disclaimer and a splash
// screen — Dashboard → Branding. Jellyfin 10.10.

import { PALETTE } from '../../brand/palette.ts';
import { DOMAIN } from '../../brand/identity.ts';
import { bannerMark, markSvg, screenSvg, BACKGROUND } from '../marks.ts';
import { cssSvg } from './shared.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;

/** Custom CSS for Jellyfin's Dark theme. `banner` is the light lockup SVG shown in the header. */
export function jellyfinCss({ banner }: { banner: string }): string {
  return `/* The Olympus — Jellyfin.
   Dashboard → Branding → Custom CSS code. Written for Jellyfin 10.10 with the
   Dark theme (user settings → Display). */

/* Grounds */
.backgroundContainer, .skinHeader.semiTransparent, .mainDrawer, .dialog, .actionSheet {
  background-color: ${P.obsidian};
}
.skinHeader-withBackground, .appfooter {
  background-color: ${P.charcoal};
}
.cardBox:not(.visualCardBox) .cardScalable, .visualCardBox, .listItem:hover, .navMenuOption:hover {
  background-color: ${P.charcoal};
}

/* The house's mark in the header */
.pageTitleWithDefaultLogo, .pageTitleWithLogo {
  background-image: ${cssSvg(banner)} !important;
  background-size: contain;
  background-position: left center;
}

/* Accent: marble instead of blue */
.button-submit, .raised.button-submit, .emby-button.button-submit {
  background-color: ${P.marble};
  color: ${P.obsidian};
}
.button-submit:hover, .raised.button-submit:hover {
  background-color: ${P.paper};
}
.emby-tab-button-active, .emby-tab-button.emby-button-foreground, .button-link, a.button-link {
  color: ${P.paper};
}
.navMenuOption-selected {
  background-color: ${P.graphite};
  color: ${P.paper};
}
.itemProgressBarForeground, .sliderBubble, .mdl-slider-background-lower {
  background-color: ${P.marble};
}
.emby-checkbox:checked + span + .checkboxOutline {
  background-color: ${P.marble};
  border-color: ${P.marble};
}
.emby-checkbox:checked + span + .checkboxOutline > .checkboxIcon-checked {
  color: ${P.obsidian};
}
.playedIndicator, .countIndicator, .indicator {
  background-color: ${P.marble};
  color: ${P.obsidian};
}
.emby-input:focus, .emby-textarea:focus, .emby-select-withcolor:focus {
  border-color: ${P.silver};
}
`;
}

export function jellyfinDisclaimer(): string {
  return `<p style="text-align:center; letter-spacing:0.24em; text-transform:uppercase; opacity:0.6;">The Olympus · ${DOMAIN}</p>\n`;
}

export const jellyfin: ThemeKit = {
  id: 'jellyfin',
  label: 'Jellyfin',
  match: { ids: ['jellyfin'], category: 'media' },
  how: '`custom.css`, `login-disclaimer.html`, `splashscreen.png` — Dashboard → Branding',
  files: async (t) => {
    const bg = t.ground(BACKGROUND.width, BACKGROUND.height, 'marble-dark');
    return [
      ['custom.css', jellyfinCss({ banner: markSvg(bannerMark(t.marks.seal, t.name), P.marble) })],
      ['login-disclaimer.html', jellyfinDisclaimer()],
      ['splashscreen.png', await t.png(screenSvg(bg, BACKGROUND.width, BACKGROUND.height, t.marks.crest, 0.5, P.marble), BACKGROUND.width)],
    ];
  },
};
