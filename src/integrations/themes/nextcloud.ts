// Nextcloud: the Theming app, set with occ — name, address, colours, logo,
// header logo, favicon and login background. Nextcloud 28 or later.

import { PALETTE } from '../../brand/palette.ts';
import { DOMAIN } from '../../brand/identity.ts';
import { coinSvg, markSvg } from '../marks.ts';
import { sq } from './shared.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;
export const LOGIN_BACKGROUND = { width: 2560, height: 1440 } as const;

export function nextcloudScript({ name, url }: { name: string; url: string }): string {
  return `#!/bin/sh
# The Olympus — Nextcloud theming (the Theming app; Nextcloud 28 or later).
#
#   Docker:     NEXTCLOUD_CONTAINER=nextcloud sh apply.sh
#   Bare metal: OCC="sudo -u www-data php /var/www/nextcloud/occ" sh apply.sh
#
# Undo any time in Administration settings → Theming (each value has a reset).
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
FILES="logo.svg logoheader.svg favicon.png background.png"

if [ -n "\${NEXTCLOUD_CONTAINER:-}" ]; then
  SRC=/tmp/the-olympus-theme
  docker exec "$NEXTCLOUD_CONTAINER" mkdir -p "$SRC"
  for f in $FILES; do docker cp "$DIR/$f" "$NEXTCLOUD_CONTAINER:$SRC/$f"; done
  docker exec "$NEXTCLOUD_CONTAINER" chmod -R a+rX "$SRC"
  occ() { docker exec -u www-data "$NEXTCLOUD_CONTAINER" php occ "$@"; }
else
  SRC=$DIR
  occ() { \${OCC:-php occ} "$@"; }
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

if [ -n "\${NEXTCLOUD_CONTAINER:-}" ]; then docker exec "$NEXTCLOUD_CONTAINER" rm -rf "$SRC"; fi
echo "The Olympus theme applied. Reload Nextcloud (Ctrl+Shift+R)."
`;
}

export const nextcloud: ThemeKit = {
  id: 'nextcloud',
  label: 'Nextcloud',
  match: { ids: ['nextcloud'], category: 'cloud' },
  how: '`apply.sh` sets the Theming app with `occ`',
  files: async (t) => [
    ['apply.sh', nextcloudScript({ name: 'The Olympus', url: t.url })],
    ['logo.svg', markSvg(t.marks.emblem, P.marble)],
    ['logoheader.svg', markSvg(t.marks.seal, P.marble)],
    ['favicon.png', await t.png(coinSvg(t.marks.seal, 'dark'), 256)],
    ['background.png', t.ground(LOGIN_BACKGROUND.width, LOGIN_BACKGROUND.height, 'marble-dark')],
  ],
};
