#!/bin/sh
# The Olympus — the Alacritty colours. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  A="$CONFIG/alacritty"
  if [ -f "$A/alacritty.toml" ] && head -n 1 "$A/alacritty.toml" | grep -qF 'The Olympus'; then rm -f "$A/alacritty.toml"; fi
  rm -f "$A/the-olympus.toml"
  echo "Removed."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
A="$CONFIG/alacritty"
mkdir -p "$A"
cp "$DIR/the-olympus.toml" "$A/the-olympus.toml"
if [ ! -f "$A/alacritty.toml" ]; then
  # Alacritty 0.14 reads imports under [general]; 0.13 at the top.
  if alacritty --version 2>/dev/null | grep -qE ' 0\.(1[0-3]|[0-9])\.'; then printf '# The Olympus\nimport = ["%s"]\n' "$A/the-olympus.toml" > "$A/alacritty.toml"
  else printf '# The Olympus\n[general]\nimport = ["%s"]\n' "$A/the-olympus.toml" > "$A/alacritty.toml"; fi
  echo "Installed; Alacritty picks it up at once."
else
  echo "Installed. Add this file to the imports in your alacritty.toml:"
  echo "  import = [\"$A/the-olympus.toml\"]   (under [general] on Alacritty 0.14 or later)"
fi
