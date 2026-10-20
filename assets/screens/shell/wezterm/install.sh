#!/bin/sh
# The Olympus — the WezTerm colour scheme. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  W="$CONFIG/wezterm"
  if [ -f "$W/wezterm.lua" ] && head -n 1 "$W/wezterm.lua" | grep -qF 'The Olympus'; then rm -f "$W/wezterm.lua"; fi
  rm -f "$W/colors/the-olympus.toml"
  echo "Removed."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
W="$CONFIG/wezterm"
mkdir -p "$W/colors"
cp "$DIR/the-olympus.toml" "$W/colors/the-olympus.toml"
if [ ! -f "$W/wezterm.lua" ] && [ ! -f "$HOME/.wezterm.lua" ]; then
  printf -- "-- The Olympus\nlocal wezterm = require 'wezterm'\nlocal config = wezterm.config_builder()\nconfig.color_scheme = 'The Olympus'\nreturn config\n" > "$W/wezterm.lua"
  echo "Installed; WezTerm picks it up at once."
else
  echo "Installed. In your wezterm.lua, set: config.color_scheme = 'The Olympus'"
fi
