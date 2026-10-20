#!/bin/sh
# The Olympus — the kitty colours. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  unmark "$CONFIG/kitty/kitty.conf" 'the-olympus.conf'
  rm -f "$CONFIG/kitty/the-olympus.conf"
  echo "Removed; reload kitty's configuration (ctrl+shift+F5)."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
mkdir -p "$CONFIG/kitty"
cp "$DIR/the-olympus.conf" "$CONFIG/kitty/the-olympus.conf"
touch "$CONFIG/kitty/kitty.conf"
grep -qF 'include the-olympus.conf' "$CONFIG/kitty/kitty.conf" || printf 'include the-olympus.conf\n' >> "$CONFIG/kitty/kitty.conf"
echo "Installed; reload kitty's configuration (ctrl+shift+F5)."
