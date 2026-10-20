#!/bin/sh
# The Olympus — the Ptyxis palette. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  rm -f "${XDG_DATA_HOME:-$HOME/.local/share}"/org.gnome.Ptyxis/palettes/the-olympus.palette "$HOME/.var/app/app.devsuite.Ptyxis/data/org.gnome.Ptyxis/palettes/the-olympus.palette"
  echo "Removed."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
if [ -d "$HOME/.var/app/app.devsuite.Ptyxis" ] && ! command -v ptyxis >/dev/null 2>&1; then D="$HOME/.var/app/app.devsuite.Ptyxis/data/org.gnome.Ptyxis/palettes"; else D="${XDG_DATA_HOME:-$HOME/.local/share}"/org.gnome.Ptyxis/palettes; fi
mkdir -p "$D"
cp "$DIR/the-olympus.palette" "$D/the-olympus.palette"
echo "Installed: in Ptyxis, Preferences → Color palette → The Olympus (it has a light and a dark version)."
