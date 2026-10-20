#!/bin/sh
# The Olympus — Home Assistant: installs the theme and the dashboard images.
#
#   Docker:      HA_CONTAINER=homeassistant sh apply.sh
#   A folder:    sh apply.sh /path/to/homeassistant/config
#   Undo:        add --restore to either
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
restore=0
config=
for a in "$@"; do
  case "$a" in
    --restore) restore=1 ;;
    -*) echo "unknown option: $a" >&2; exit 2 ;;
    *) config=$a ;;
  esac
done

if [ -n "${HA_CONTAINER:-}" ]; then
  run() { docker exec "$HA_CONTAINER" sh -c "$1"; }
  put() { docker cp "$1" "$HA_CONTAINER:$2"; }
  config=/config
else
  [ -n "$config" ] || { echo "give the Home Assistant config folder, or set HA_CONTAINER" >&2; exit 2; }
  [ -f "$config/configuration.yaml" ] || { echo "$config/configuration.yaml not found: is this Home Assistant's config folder?" >&2; exit 1; }
  run() { sh -c "$1"; }
  put() { cp "$1" "$2"; }
fi

if [ "$restore" = 1 ]; then
  run "rm -f '$config/themes/the-olympus.yaml' && rm -rf '$config/www/the-olympus'"
  echo "Removed. Choose another theme on your profile page, and reload themes."
  exit 0
fi

run "mkdir -p '$config/themes' '$config/www/the-olympus'"
put "$DIR/the-olympus.yaml" "$config/themes/the-olympus.yaml"
for f in banner.svg seal.svg; do put "$DIR/www/$f" "$config/www/the-olympus/$f"; done

if ! run "grep -q 'include_dir_merge_named themes' '$config/configuration.yaml'"; then
  cat <<'EOF'
One more step: Home Assistant does not read the themes folder yet. Add this to
configuration.yaml, then restart Home Assistant once:

frontend:
  themes: !include_dir_merge_named themes
EOF
fi
echo "Installed. Reload themes (Developer tools → Actions → Frontend: Reload themes),"
echo "then choose 'The Olympus' on your profile page."
