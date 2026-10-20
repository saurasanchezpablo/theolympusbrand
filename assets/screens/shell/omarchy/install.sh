#!/bin/sh
# The Olympus — the Omarchy theme. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  T="$CONFIG/omarchy/themes/the-olympus"
  PREV=$(cat "$CONFIG/the-olympus/omarchy-previous" 2>/dev/null || true)
  rm -rf "$T"
  rm -f "$CONFIG/the-olympus/omarchy-previous"
  if [ -n "$PREV" ] && [ "$PREV" != the-olympus ]; then omarchy-theme-set "$PREV"; echo "Back to $PREV."
  else echo "Removed: choose another theme (Omarchy menu → Style → Theme)."; fi
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
T="$CONFIG/omarchy/themes/the-olympus"
# The theme in use now, to go back to on --restore.
PREV=$(omarchy-theme-current 2>/dev/null || basename "$(readlink "$CONFIG/omarchy/current/theme" 2>/dev/null)" 2>/dev/null || true)
if [ -n "$PREV" ] && [ "$PREV" != the-olympus ] && [ "$PREV" != . ]; then mkdir -p "$CONFIG/the-olympus"; printf '%s
' "$PREV" > "$CONFIG/the-olympus/omarchy-previous"; fi
rm -rf "$T"
mkdir -p "$CONFIG/omarchy/themes"
cp -R "$DIR/the-olympus" "$T"
omarchy-theme-set the-olympus
echo "The Olympus is your Omarchy theme."
