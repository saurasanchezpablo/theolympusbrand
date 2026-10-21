#!/bin/sh
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

if ! command -v docker >/dev/null 2>&1 && command -v podman >/dev/null 2>&1; then docker() { podman "$@"; }; fi
if [ -n "${NEXTCLOUD_CONTAINER:-}" ]; then
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
  occ() { ${OCC:-php occ} "$@"; }
fi

if [ "$restore" = 1 ]; then
  for k in name url slogan primary_color color background_color logo logoheader favicon background; do occ theming:config "$k" --reset >/dev/null 2>&1 || true; done
  occ config:app:delete theming_customcss customcss >/dev/null 2>&1 || true
  echo "Nextcloud's own look is back. Reload Nextcloud (Ctrl+Shift+R)."
  exit 0
fi

if [ -n "${NEXTCLOUD_CONTAINER:-}" ]; then
  # A fresh folder of its own in the container, not a name another process could have prepared.
  SRC=$(docker exec "$NEXTCLOUD_CONTAINER" mktemp -d)
  for f in $FILES; do docker cp "$DIR/$f" "$NEXTCLOUD_CONTAINER:$SRC/$f"; done
  docker exec "$NEXTCLOUD_CONTAINER" chmod -R a+rX "$SRC"
fi

occ theming:config name 'The Olympus'
occ theming:config url 'https://nextcloud.theolympus.cloud'
occ theming:config slogan 'theolympus.cloud'
# Nextcloud 28+ calls it primary_color; older releases, color.
occ theming:config primary_color '#1C1C1C' 2>/dev/null || occ theming:config color '#1C1C1C'
occ theming:config background_color '#0E0E0E' 2>/dev/null || true
occ theming:config logo "$SRC/logo.svg"
occ theming:config logoheader "$SRC/logoheader.svg"
occ theming:config favicon "$SRC/favicon.png"
occ theming:config background "$SRC/background.png"

if [ -n "${NEXTCLOUD_CONTAINER:-}" ] && [ -n "$SRC" ]; then docker exec "$NEXTCLOUD_CONTAINER" rm -rf "$SRC"; fi

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
