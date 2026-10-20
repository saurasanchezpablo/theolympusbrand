// Theme kits: the house's look in the applications it runs — Nextcloud,
// Jellyfin, Proxmox VE, Grafana and Uptime Kuma — through the means each one
// offers (a theming command, custom CSS, files it serves). Pure text; the
// images are listed in kit.ts.
//
// Only the chrome is re-inked. Status colours (up / down, alerts) keep their
// meaning and are left alone.

import { PALETTE } from '../brand/palette.ts';
import { DOMAIN } from '../brand/identity.ts';

const P = PALETTE;

/** An SVG as a CSS url(): only the characters CSS and URLs require are escaped. */
export const cssSvg = (svg: string) =>
  `url("data:image/svg+xml,${svg.replace(/\n\s*/g, ' ').replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}")`;

/* ---------------------------------------------------------------- */
/* Nextcloud                                                          */
/* ---------------------------------------------------------------- */

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

/** A single-quoted shell word. */
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/* ---------------------------------------------------------------- */
/* Jellyfin                                                           */
/* ---------------------------------------------------------------- */

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

/* ---------------------------------------------------------------- */
/* Grafana                                                            */
/* ---------------------------------------------------------------- */

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

/* ---------------------------------------------------------------- */
/* Uptime Kuma                                                        */
/* ---------------------------------------------------------------- */

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

/* ---------------------------------------------------------------- */
/* Proxmox VE                                                         */
/* ---------------------------------------------------------------- */

export function proxmoxScript(): string {
  return `#!/bin/sh
# The Olympus — Proxmox VE web interface: the logo in the header and the
# favicon. Run as root on each node.
#
#   sh apply.sh            for the light theme ("Crisp", the default)
#   sh apply.sh --dark     for the dark theme
#   sh apply.sh --persist  also restore them after Proxmox updates (an APT hook)
#   sh apply.sh --restore  put Proxmox's own files back and remove the hook
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
IMG=/usr/share/pve-manager/images
KEEP=/usr/local/share/the-olympus/proxmox
HOOK=/etc/apt/apt.conf.d/99-the-olympus-logo
logo=logo-light-theme.png
persist=0
restore=0
for a in "$@"; do
  case "$a" in
    --dark) logo=logo-dark-theme.png ;;
    --persist) persist=1 ;;
    --restore) restore=1 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -d "$IMG" ] || { echo "$IMG not found: is this a Proxmox VE node?" >&2; exit 1; }

if [ "$restore" = 1 ]; then
  for f in proxmox_logo.png favicon.ico; do
    if [ -f "$IMG/$f.orig" ]; then mv "$IMG/$f.orig" "$IMG/$f"; fi
  done
  rm -f "$HOOK"
  rm -rf "$KEEP"
  echo "Proxmox's own logo is back. Reload the web interface (Ctrl+Shift+R)."
  exit 0
fi

mkdir -p "$KEEP"
install -m 644 "$DIR/$logo" "$KEEP/proxmox_logo.png"
install -m 644 "$DIR/favicon.ico" "$KEEP/favicon.ico"
for f in proxmox_logo.png favicon.ico; do
  [ -f "$IMG/$f" ] || continue
  [ -f "$IMG/$f.orig" ] || cp -p "$IMG/$f" "$IMG/$f.orig"
  install -m 644 "$KEEP/$f" "$IMG/$f"
done

if [ "$persist" = 1 ]; then
  cat > "$HOOK" <<EOF
// The Olympus: put the logo back after pve-manager updates. Remove this file to stop.
DPkg::Post-Invoke { "if [ -f $KEEP/proxmox_logo.png ]; then install -m 644 $KEEP/proxmox_logo.png $IMG/proxmox_logo.png; install -m 644 $KEEP/favicon.ico $IMG/favicon.ico; fi"; };
EOF
fi
echo "The Olympus logo installed. Reload the web interface (Ctrl+Shift+R)."
`;
}
