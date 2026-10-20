#!/bin/sh
# The Olympus — Nextcloud theming (the Theming app; Nextcloud 28 or later).
#
#   Docker:     NEXTCLOUD_CONTAINER=nextcloud sh apply.sh
#   Bare metal: OCC="sudo -u www-data php /var/www/nextcloud/occ" sh apply.sh
#
# Undo any time in Administration settings → Theming (each value has a reset).
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
FILES="logo.svg logoheader.svg favicon.png background.png"

if [ -n "${NEXTCLOUD_CONTAINER:-}" ]; then
  SRC=/tmp/the-olympus-theme
  docker exec "$NEXTCLOUD_CONTAINER" mkdir -p "$SRC"
  for f in $FILES; do docker cp "$DIR/$f" "$NEXTCLOUD_CONTAINER:$SRC/$f"; done
  docker exec "$NEXTCLOUD_CONTAINER" chmod -R a+rX "$SRC"
  occ() { docker exec -u www-data "$NEXTCLOUD_CONTAINER" php occ "$@"; }
else
  SRC=$DIR
  occ() { ${OCC:-php occ} "$@"; }
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

if [ -n "${NEXTCLOUD_CONTAINER:-}" ]; then docker exec "$NEXTCLOUD_CONTAINER" rm -rf "$SRC"; fi
echo "The Olympus theme applied. Reload Nextcloud (Ctrl+Shift+R)."
