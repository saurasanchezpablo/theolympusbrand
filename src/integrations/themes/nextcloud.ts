// Nextcloud: the Theming app, set with occ — name, address, colours, logo,
// header logo, favicon and login background. Nextcloud 28 or later.

import { PALETTE } from '../../brand/palette.ts';
import { DOMAIN } from '../../brand/identity.ts';
import { coinSvg, markSvg } from '../marks.ts';
import { containerOf, PODMAN, sq } from './shared.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;
export const LOGIN_BACKGROUND = { width: 2560, height: 1440 } as const;

/**
 * The stylesheet for the Custom CSS app: Nextcloud already takes the house's
 * charcoal as its primary colour, but in its dark themes charcoal sinks into
 * the ground — there the accent becomes marble. Status and favourite colours
 * keep their meaning.
 */
const OCC_DETECT = [
  'if command -v nextcloud.occ >/dev/null 2>&1; then echo nextcloud.occ; exit 0; fi',
  // Arch's package has an occ command that runs as the right user.
  'if [ -f /usr/share/webapps/nextcloud/occ ] && command -v occ >/dev/null 2>&1; then echo occ; exit 0; fi',
  'for f in /var/www/nextcloud/occ /var/www/html/nextcloud/occ /var/www/html/occ /srv/www/nextcloud/occ /srv/http/nextcloud/occ /usr/local/www/nextcloud/occ; do',
  '  [ -f "$f" ] || continue',
  // occ runs as the owner of config.php.
  '  u=$(stat -c %U "${f%/occ}/config/config.php" 2>/dev/null || stat -c %U "$f" 2>/dev/null || echo www-data)',
  '  if command -v sudo >/dev/null 2>&1; then echo "sudo -u $u php $f"; else echo "runuser -u $u -- php $f"; fi; exit 0',
  'done',
].join('\n');

export function nextcloudCss(): string {
  const dark = `  --color-primary: ${P.marble};
  --color-primary-hover: ${P.paper};
  --color-primary-text: ${P.obsidian};
  --color-primary-light: ${P.graphite};
  --color-primary-light-hover: #4A4A4A;
  --color-primary-light-text: ${P.marble};
  --color-primary-element: ${P.marble};
  --color-primary-element-hover: ${P.paper};
  --color-primary-element-text: ${P.obsidian};
  --color-primary-element-light: ${P.graphite};
  --color-primary-element-light-hover: #4A4A4A;
  --color-primary-element-light-text: ${P.marble};`;
  return `/* The Olympus — Nextcloud (Custom CSS app). In the dark themes the accent
   is marble rather than charcoal, so it stays visible on dark grounds. */
body[data-theme-dark],
body[data-theme-dark-highcontrast] {
${dark}
}

@media (prefers-color-scheme: dark) {
  body[data-theme-default] {
${dark.replace(/^/gm, '  ')}
  }
}
`;
}

export function nextcloudScript({ name, url }: { name: string; url: string }): string {
  return `#!/bin/sh
# The Olympus — Nextcloud theming (the Theming app; Nextcloud 28 or later).
#
#   Docker:     NEXTCLOUD_CONTAINER=nextcloud sh apply.sh
#               (All-in-One: NEXTCLOUD_CONTAINER=nextcloud-aio-nextcloud; Podman works the same)
#   Bare metal: OCC="sudo -u www-data php /var/www/nextcloud/occ" sh apply.sh
#   Snap:       OCC=nextcloud.occ sh apply.sh
#
#   --with-css  also install and enable the Custom CSS app, for the dark themes' accent
#   --restore   Nextcloud's own name, colours, images and stylesheet back
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
FILES="logo.svg logoheader.svg favicon.png background.png"
with_css=0
restore=0
for a in "$@"; do
  case "$a" in
    --with-css) with_css=1 ;;
    --restore) restore=1 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

${PODMAN}
if [ -n "\${NEXTCLOUD_CONTAINER:-}" ]; then
  SRC=
  C=$NEXTCLOUD_CONTAINER
  # The official image and All-in-One keep occ in /var/www/html, run as www-data; linuxserver's has its own occ command.
  if docker exec "$C" test -f /var/www/html/occ 2>/dev/null; then occ() { docker exec -u www-data "$C" php /var/www/html/occ "$@"; }
  elif docker exec "$C" sh -c 'command -v occ' >/dev/null 2>&1; then occ() { docker exec "$C" occ "$@"; }
  else
    echo "$C has no occ: is it Nextcloud's own container? (with All-in-One it is nextcloud-aio-nextcloud, not the mastercontainer)" >&2
    exit 1
  fi
else
  SRC=$DIR
  occ() { \${OCC:-php occ} "$@"; }
fi

if [ "$restore" = 1 ]; then
  for k in name url slogan primary_color color background_color logo logoheader favicon background; do occ theming:config "$k" --reset >/dev/null 2>&1 || true; done
  occ config:app:delete theming_customcss customcss >/dev/null 2>&1 || true
  echo "Nextcloud's own look is back. Reload Nextcloud (Ctrl+Shift+R)."
  exit 0
fi

if [ -n "\${NEXTCLOUD_CONTAINER:-}" ]; then
  # A fresh folder of its own in the container, not a name another process could have prepared.
  SRC=$(docker exec "$NEXTCLOUD_CONTAINER" mktemp -d)
  for f in $FILES; do docker cp "$DIR/$f" "$NEXTCLOUD_CONTAINER:$SRC/$f"; done
  docker exec "$NEXTCLOUD_CONTAINER" chmod -R a+rX "$SRC"
fi

occ theming:config name ${sq(name)}
occ theming:config url ${sq(url)}
occ theming:config slogan ${sq(DOMAIN)}
# Nextcloud 28+ calls it primary_color; older releases, color.
occ theming:config primary_color ${sq(P.charcoal)} 2>/dev/null || occ theming:config color ${sq(P.charcoal)}
occ theming:config background_color ${sq(P.obsidian)} 2>/dev/null || true
occ theming:config logo "$SRC/logo.svg"
occ theming:config logoheader "$SRC/logoheader.svg"
occ theming:config favicon "$SRC/favicon.png"
occ theming:config background "$SRC/background.png"

if [ -n "\${NEXTCLOUD_CONTAINER:-}" ] && [ -n "$SRC" ]; then docker exec "$NEXTCLOUD_CONTAINER" rm -rf "$SRC"; fi

# The dark themes' accent, through the Custom CSS app.
if [ "$with_css" = 1 ]; then occ app:install theming_customcss >/dev/null 2>&1 || occ app:enable theming_customcss; fi
if [ "$(occ config:app:get theming_customcss enabled 2>/dev/null || true)" = yes ]; then
  occ config:app:set theming_customcss customcss --value="$(cat "$DIR/custom.css")"
  occ config:app:set theming_customcss cachebuster --value="$(date +%s)"
  echo "The Olympus theme and stylesheet applied. Reload Nextcloud (Ctrl+Shift+R)."
else
  echo "The Olympus theme applied. Reload Nextcloud (Ctrl+Shift+R)."
  echo "For the dark themes' accent too, run again with --with-css (it installs the Custom CSS app)."
fi
`;
}

export const nextcloud: ThemeKit = {
  id: 'nextcloud',
  label: 'Nextcloud',
  match: { ids: ['nextcloud'], category: 'cloud' },
  how: '`apply.sh` sets the Theming app with `occ`, and the dark themes’ accent through the Custom CSS app (`--with-css`)',
  installer: {
    summary: 'name, colours, logos and background, through occ',
    places: [
      // All-in-One's own Nextcloud first: its mastercontainer has no occ.
      { label: 'In a Docker or Podman container', env: 'NEXTCLOUD_CONTAINER', prompt: 'Nextcloud’s container', detect: `c=$(${containerOf('aio-nextcloud')}); [ -n "$c" ] || c=$(${containerOf('nextcloud', 'all-in-one|aio-')}); echo "$c"` },
      { label: 'Installed on this machine (occ)', env: 'OCC', prompt: 'The occ command, as the web server’s user', detect: OCC_DETECT },
    ],
    args: '--with-css',
    root: true,
  },
  guide: (t) => ({
    title: 'Nextcloud',
    intro: `Nextcloud's Theming app takes a name, colours and images; the kit's script sets them all with \`occ\`, and adds a small stylesheet so that the accent stays visible in the dark themes. Every user sees the house's look, whatever theme they pick.`,
    changes: [
      'The name (*The Olympus*), the address, and the slogan (*theolympus.cloud*) on the sign-in page.',
      'The primary colour: charcoal; the background colour: obsidian.',
      'The sign-in logo (the emblem), the header logo (the seal) and the favicon.',
      'The sign-in background: black marble.',
      'With the Custom CSS app: in the dark themes, the accent in marble instead of charcoal.',
    ],
    limits: ['Error, warning, success and the favourite star keep their colours.', 'The desktop and phone apps draw their own interface.', 'Users can still choose their own background and colour unless you turn that off (*Administration → Theming → Disable user theming*).'],
    requires: ['Nextcloud 28 or later (older releases get the colour through its older setting).', 'A shell on the server: `docker exec` into the container, or `occ` as the web server’s user.', 'For `--with-css`: the server can reach the App Store, or the *Custom CSS* app is already installed.'],
    steps: [
      { text: 'Copy this folder to the server.' },
      { text: 'Run the script — in Docker or Podman naming the container (with All-in-One, `nextcloud-aio-nextcloud`; the official and linuxserver images are both understood), otherwise telling it how to call `occ`. Add `--with-css` for the dark themes’ accent.', code: 'NEXTCLOUD_CONTAINER=nextcloud sh apply.sh --with-css\n# All-in-One\nNEXTCLOUD_CONTAINER=nextcloud-aio-nextcloud sh apply.sh --with-css\n# installed on the machine, or as a snap\nOCC="sudo -u www-data php /var/www/nextcloud/occ" sh apply.sh --with-css\nOCC=nextcloud.occ sh apply.sh --with-css' },
      { text: 'Reload Nextcloud (Ctrl+Shift+R).' },
    ],
    check: ['Signed out, the sign-in page shows the emblem on black marble and *theolympus.cloud*.', 'Signed in, the header shows the seal; buttons are charcoal (light theme) or marble (dark theme).'],
    undo: [{ text: 'Reset every value the script set, and the stylesheet.', code: 'NEXTCLOUD_CONTAINER=nextcloud sh apply.sh --restore' }, { text: 'Or reset each value by hand in *Administration settings → Theming*.' }],
    updates: 'Nextcloud keeps theming settings and the Custom CSS app’s stylesheet across updates.',
    files: [
      ['apply.sh', 'Sets everything with `occ` (`--with-css`, `--restore`)'],
      ['custom.css', 'The dark themes’ accent, for the Custom CSS app'],
      ['logo.svg', 'The sign-in logo: the emblem in marble'],
      ['logoheader.svg', 'The header logo: the seal in marble'],
      ['favicon.png', 'The favicon'],
      ['background.png', 'The sign-in background: black marble, 2560 × 1440'],
    ],
    tested: 'Written for Nextcloud 28 to 31. The test suite runs the script with a stand-in for `occ` (in dash and bash): every setting, the fallback for older releases, the stylesheet only when the app is enabled, and the restore; it has not been applied to a live server here.',
  }),
  files: async (t) => [
    ['apply.sh', nextcloudScript({ name: 'The Olympus', url: t.url })],
    ['custom.css', nextcloudCss()],
    ['logo.svg', markSvg(t.marks.emblem, P.marble)],
    ['logoheader.svg', markSvg(t.marks.seal, P.marble)],
    ['favicon.png', await t.png(coinSvg(t.marks.seal, 'dark'), 256)],
    ['background.png', t.ground(LOGIN_BACKGROUND.width, LOGIN_BACKGROUND.height, 'marble-dark')],
  ],
};
