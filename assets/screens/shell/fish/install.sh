#!/bin/sh
# The Olympus — the fish prompt and colours. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  rm -f "$CONFIG/fish/conf.d/the-olympus.fish"
  echo "Removed; open a new terminal. (fish's own prompt returns; colours you had set with set -U are untouched.)"
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
mkdir -p "$CONFIG/fish/conf.d"
cp "$DIR/the-olympus.fish" "$CONFIG/fish/conf.d/the-olympus.fish"
echo "Installed; open a new terminal to see it."
