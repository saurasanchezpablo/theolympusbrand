#!/bin/sh
# The Olympus — Vaultwarden: installs the stylesheet in the data folder.
#
#   Docker:     VAULTWARDEN_CONTAINER=vaultwarden sh apply.sh
#   A folder:   sh apply.sh /path/to/vaultwarden/data
#   Undo:       add --restore to either
#
# Vaultwarden reads it when it starts: the Docker form restarts the container.
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
FILE=templates/scss/user.vaultwarden.scss.hbs
restore=0
data=
for a in "$@"; do
  case "$a" in
    --restore) restore=1 ;;
    -*) echo "unknown option: $a" >&2; exit 2 ;;
    *) data=$a ;;
  esac
done

if [ -n "${VAULTWARDEN_CONTAINER:-}" ]; then
  if [ "$restore" = 1 ]; then docker exec "$VAULTWARDEN_CONTAINER" rm -f "/data/$FILE"
  else
    docker exec "$VAULTWARDEN_CONTAINER" mkdir -p /data/templates/scss
    docker cp "$DIR/user.vaultwarden.scss.hbs" "$VAULTWARDEN_CONTAINER:/data/$FILE"
  fi
  docker restart "$VAULTWARDEN_CONTAINER" >/dev/null
else
  [ -n "$data" ] || { echo "give Vaultwarden's data folder, or set VAULTWARDEN_CONTAINER" >&2; exit 2; }
  [ -d "$data" ] || { echo "$data is not a folder" >&2; exit 1; }
  if [ "$restore" = 1 ]; then rm -f "$data/$FILE"
  else
    mkdir -p "$data/templates/scss"
    cp "$DIR/user.vaultwarden.scss.hbs" "$data/$FILE"
  fi
  echo "Restart Vaultwarden to apply."
fi
if [ "$restore" = 1 ]; then echo "Vaultwarden's own look is back."; else echo "The Olympus stylesheet installed. Reload the web vault (Ctrl+Shift+R)."; fi
