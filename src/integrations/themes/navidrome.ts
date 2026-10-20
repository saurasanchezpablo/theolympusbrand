// Navidrome: no setting takes a stylesheet, so the kit uses what Navidrome
// offers — its most neutral built-in theme as the default, the house's black
// marble behind the sign-in form (served by the house's own site) and a
// welcome line — and, for those who want the blue gone too, a stylesheet a
// reverse proxy adds to the page. Written for Navidrome 0.64.

import { PALETTE } from '../../brand/palette.ts';
import { DOMAIN } from '../../brand/identity.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;
export const NAVIDROME_THEME = 'Extra Dark';
const BACKGROUND = 'files/assets/integrations/backgrounds/olympus-background.png';
const WELCOME = `The Olympus · ${DOMAIN}`;

export function navidromeCompose(): string {
  return `# The Olympus — Navidrome. Merge into the compose file that runs Navidrome
# (rename "navidrome" to your service's name), or keep it beside it as an
# override. OLYMPUS_SITE is the address of the house's site — the sign-in
# background is served from there:
#
#   OLYMPUS_SITE=http://olympus.lan:8080 docker compose up -d navidrome
services:
  navidrome:
    environment:
      ND_DEFAULTTHEME: "${NAVIDROME_THEME}"
      ND_UILOGINBACKGROUNDURL: "\${OLYMPUS_SITE:?set OLYMPUS_SITE to the address of the house's site}/${BACKGROUND}"
      ND_UIWELCOMEMESSAGE: "${WELCOME}"
`;
}

export function navidromeToml(): string {
  return `# The Olympus — Navidrome, installed without Docker: add these lines to
# navidrome.toml, putting the address of the house's site in the second.
DefaultTheme = "${NAVIDROME_THEME}"
UILoginBackgroundURL = "http://<the house's site>/${BACKGROUND}"
UIWelcomeMessage = "${WELCOME}"
`;
}

/** Optional: through a reverse proxy, the blue that remains in Extra Dark, in greys. */
export function navidromeCss(): string {
  const on = (sel: string[], body: string) => `${sel.join(',\n')} {\n${body}\n}`;
  return `/* The Olympus — Navidrome's accents in greys. Not a Navidrome setting: a
   reverse proxy adds this stylesheet to the page (see nginx.conf). It names
   the interface's component classes, which a Navidrome update may change. */

${on(['.MuiButton-containedPrimary', '.MuiButton-containedSecondary', '.MuiFab-primary', '.MuiFab-secondary', '.MuiChip-colorPrimary', '.MuiChip-colorSecondary'], `  background-color: ${P.marble} !important;\n  color: ${P.obsidian} !important;`)}

${on(['.MuiButton-textPrimary', '.MuiButton-textSecondary', '.MuiButton-outlinedPrimary', '.MuiButton-outlinedSecondary', '.MuiIconButton-colorPrimary', '.MuiIconButton-colorSecondary', '.MuiSvgIcon-colorPrimary', '.MuiSvgIcon-colorSecondary', '.MuiTab-textColorPrimary.Mui-selected', '.MuiTypography-colorPrimary', '.MuiLink-root'], `  color: ${P.marble} !important;`)}

${on(['.MuiTabs-indicator', '.MuiLinearProgress-barColorPrimary', '.MuiLinearProgress-barColorSecondary', '.MuiSlider-thumb', '.MuiSlider-track', '.MuiSwitch-colorPrimary.Mui-checked + .MuiSwitch-track', '.MuiSwitch-colorSecondary.Mui-checked + .MuiSwitch-track'], `  background-color: ${P.marble} !important;`)}

${on(['.MuiCheckbox-colorPrimary.Mui-checked', '.MuiCheckbox-colorSecondary.Mui-checked', '.MuiRadio-colorPrimary.Mui-checked', '.MuiRadio-colorSecondary.Mui-checked', '.MuiSwitch-colorPrimary.Mui-checked', '.MuiSwitch-colorSecondary.Mui-checked', '.MuiSlider-root'], `  color: ${P.marble} !important;`)}

${on(['.MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline'], `  border-color: ${P.silver} !important;`)}
${on(['.MuiInputLabel-root.Mui-focused', '.MuiFormLabel-root.Mui-focused'], `  color: ${P.silver} !important;`)}
`;
}

export function navidromeNginx(): string {
  return `# The Olympus — Navidrome through nginx, with the house's stylesheet added to
# the page. Put navidrome.css in /etc/nginx/the-olympus/ and merge these
# locations into the server block that proxies Navidrome.
location / {
    proxy_pass http://127.0.0.1:4533;
    # nginx can only change pages it receives uncompressed.
    proxy_set_header Accept-Encoding "";
    sub_filter '</head>' '<link rel="stylesheet" href="/the-olympus/navidrome.css"></head>';
    sub_filter_once on;
}

location = /the-olympus/navidrome.css {
    alias /etc/nginx/the-olympus/navidrome.css;
}
`;
}

export const navidrome: ThemeKit = {
  id: 'navidrome',
  label: 'Navidrome',
  match: { ids: ['navidrome', 'music'] },
  how: 'compose override or `navidrome.toml` lines: the neutral theme, marble behind the sign-in, a welcome line; optionally greys through a reverse proxy',
  guide: () => ({
    title: 'Navidrome',
    intro: `Navidrome has no setting for a stylesheet or a logo, so the kit uses what it does offer: its most neutral built-in theme (*${NAVIDROME_THEME}*: black and greys, with a blue accent) as the default, the house's black marble behind the sign-in form, and a welcome line naming the house. If you run Navidrome behind nginx, an optional stylesheet turns the remaining blue grey as well.`,
    changes: [
      `The default theme for new browsers: *${NAVIDROME_THEME}*.`,
      'The sign-in background: black marble, served from the house’s own site.',
      `The sign-in page’s welcome message: *${WELCOME}*.`,
      'Optionally, through nginx: buttons, tabs, sliders, switches and links in greys instead of blue.',
    ],
    limits: [
      'The logo and the name *Navidrome*: no setting changes them.',
      `The default theme applies to browsers that have not chosen one; a listener who picked another keeps it (*Personal → Theme*).`,
      'The stylesheet through nginx is not a Navidrome feature: it names the interface’s component classes, which an update may change — then parts turn blue again, and nothing breaks.',
      'The apps (Subsonic clients) draw their own interface.',
    ],
    requires: ['Navidrome 0.64 or close to it.', 'The house’s site reachable from the listeners’ browsers (for the background).', 'For the optional stylesheet: Navidrome behind nginx.'],
    steps: [
      { text: 'With Docker: merge `docker-compose.override.yml` into Navidrome’s compose file (or keep it beside it), then recreate the container with the address of the house’s site.', code: 'OLYMPUS_SITE=http://olympus.lan:8080 docker compose up -d navidrome' },
      { text: 'Without Docker: add the three lines of `navidrome.toml` to Navidrome’s configuration, putting in the site’s address, and restart Navidrome.' },
      { text: 'Optional — the greys, through nginx: copy `navidrome.css` to `/etc/nginx/the-olympus/`, merge the two locations of `nginx.conf` into the server block that proxies Navidrome, and reload nginx.', code: 'sudo mkdir -p /etc/nginx/the-olympus\nsudo cp navidrome.css /etc/nginx/the-olympus/\nsudo nginx -t && sudo systemctl reload nginx' },
    ],
    check: ['Signed out, the sign-in form stands on black marble with the welcome line.', 'In a private window, the interface opens in *Extra Dark*.', 'With the stylesheet: the play buttons and the active tab are marble white, not blue.'],
    undo: [{ text: 'Remove the three settings (or the override) and restart Navidrome.' }, { text: 'Remove the two nginx locations (or just the `sub_filter` lines) and reload nginx.' }],
    updates: 'The settings stay across updates. If an update renames the interface’s classes, the optional stylesheet stops reaching some parts: rebuild the kit when a newer one is out.',
    files: [
      ['docker-compose.override.yml', 'The three settings, for Docker'],
      ['navidrome.toml', 'The same, for navidrome.toml'],
      ['navidrome.css', 'Optional: the accents in greys'],
      ['nginx.conf', 'Optional: how nginx adds the stylesheet to the page'],
    ],
    tested: 'Written for Navidrome 0.64. The test suite parses the compose file and checks the stylesheet is grey; nothing here was applied to a live server, and the optional stylesheet in particular is unofficial.',
  }),
  files: async () => [
    ['docker-compose.override.yml', navidromeCompose()],
    ['navidrome.toml', navidromeToml()],
    ['navidrome.css', navidromeCss()],
    ['nginx.conf', navidromeNginx()],
  ],
};
