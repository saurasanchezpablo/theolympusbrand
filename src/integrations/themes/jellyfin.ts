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
  guide: (t) => ({
    title: 'Jellyfin',
    intro: `Jellyfin's own branding settings take a stylesheet, a line of text for the sign-in page and a splash screen. The kit fills all three, so the house's marks and greys replace Jellyfin's blue, with ${t.name}'s seal and name in the header.`,
    changes: [
      'The grounds: obsidian and charcoal instead of Jellyfin’s dark blue-grey.',
      'The accent: buttons, tabs, progress bars, check boxes and played markers in marble instead of blue.',
      `The header: ${t.name}'s seal and name in place of Jellyfin's logo.`,
      'The sign-in page: a line naming the house beneath the form.',
      'The splash screen shown while the apps start: the crest on black marble.',
    ],
    limits: ['The apps for TV and phone draw their own interface: the stylesheet reaches the web interface and the apps that show it (the desktop app, Android TV through the web view), not the native ones.'],
    requires: ['Jellyfin 10.10 or later, and an administrator account.', 'Each user’s *Display* setting on the **Dark** theme (the stylesheet is written over it).'],
    steps: [
      { text: 'Open **Dashboard → Branding**.' },
      { text: 'Paste the whole of `custom.css` into **Custom CSS code**.' },
      { text: 'Paste `login-disclaimer.html` into **Login disclaimer**.' },
      { text: 'Under **Splash screen**, enable it and upload `splashscreen.png`.' },
      { text: 'Save, then reload the page (Ctrl+Shift+R).' },
    ],
    check: ['The header shows the seal and the name instead of Jellyfin’s logo.', 'The *Save* buttons and the active tab are marble white, not blue.', 'Signed out, the sign-in page shows *The Olympus · theolympus.cloud* under the form.'],
    undo: [{ text: 'Clear **Custom CSS code** and **Login disclaimer**, disable the splash screen, and save.' }],
    updates: 'Updates keep the branding settings. A release that renames parts of the interface may leave some elements in Jellyfin’s own colours: rebuild the kit (`npm run integrations`) once a newer stylesheet is out.',
    files: [
      ['custom.css', 'The stylesheet, with the banner embedded in it'],
      ['login-disclaimer.html', 'The line under the sign-in form'],
      ['splashscreen.png', 'The crest on black marble, 1920 × 1080'],
    ],
    tested: 'Written for Jellyfin 10.10. The test suite decodes the banner embedded in the stylesheet; the kit has not been applied to a live server here.',
  }),
  files: async (t) => {
    const bg = t.ground(BACKGROUND.width, BACKGROUND.height, 'marble-dark');
    return [
      ['custom.css', jellyfinCss({ banner: markSvg(bannerMark(t.marks.seal, t.name), P.marble) })],
      ['login-disclaimer.html', jellyfinDisclaimer()],
      ['splashscreen.png', await t.png(screenSvg(bg, BACKGROUND.width, BACKGROUND.height, t.marks.crest, 0.5, P.marble), BACKGROUND.width)],
    ];
  },
};
