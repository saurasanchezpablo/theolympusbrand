#!/bin/sh
# The Olympus — the GNOME Terminal profile. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  P=/org/gnome/terminal/legacy/profiles:/
  dconf reset -f "$P:7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11/"
  list=$(dconf read "${P}list" || true)
  [ -z "$list" ] || dconf write "${P}list" "$(printf '%s' "$list" | sed "s/, *'7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11'//; s/'7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11', *//")"
  echo "The profile is removed."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
P=/org/gnome/terminal/legacy/profiles:/
dconf load "$P:7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11/" < "$DIR/the-olympus.dconf"
list=$(dconf read "${P}list" || true)
case "$list" in
  *7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11*) ;;
  ""|"@as []") dconf write "${P}list" "['b1dcc9dd-5262-4d8d-a863-c897e6d979b9', '7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11']" ;;
  *) dconf write "${P}list" "$(printf '%s' "$list" | sed "s/]$/, '7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11']/")" ;;
esac
echo "Installed: in GNOME Terminal, open a new tab with the profile 'The Olympus' (Preferences → set it as default if you like)."
