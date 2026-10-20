#!/bin/sh
# The Olympus — fastfetch with the seal. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  F="$CONFIG/fastfetch"
  if [ -f "$F/config.jsonc" ] && head -n 1 "$F/config.jsonc" | grep -qF 'The Olympus'; then rm -f "$F/config.jsonc"; fi
  rm -f "$F/the-olympus.jsonc" "$F/the-olympus-logo.txt"
  echo "Removed."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
F="$CONFIG/fastfetch"
mkdir -p "$F"
cp "$DIR/the-olympus-logo.txt" "$F/the-olympus-logo.txt"
cp "$DIR/the-olympus.jsonc" "$F/the-olympus.jsonc"
if [ ! -f "$F/config.jsonc" ] || head -n 1 "$F/config.jsonc" | grep -qF 'The Olympus'; then
  cp "$DIR/the-olympus.jsonc" "$F/config.jsonc"
  echo "Installed: run fastfetch."
else
  echo "Installed beside your own config.jsonc (left as it is): run fastfetch -c the-olympus."
fi
