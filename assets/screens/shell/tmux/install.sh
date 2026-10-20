#!/bin/sh
# The Olympus — the tmux status bar. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  unmark "$HOME/.tmux.conf" '# The Olympus'
  unmark "$CONFIG/tmux/tmux.conf" '# The Olympus'
  rm -f "$CONFIG/tmux/the-olympus.conf"
  echo "Removed; restart tmux (or tmux source-file your configuration)."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
mkdir -p "$CONFIG/tmux"
cp "$DIR/the-olympus.conf" "$CONFIG/tmux/the-olympus.conf"
if [ -f "$CONFIG/tmux/tmux.conf" ]; then RC="$CONFIG/tmux/tmux.conf"; else RC="$HOME/.tmux.conf"; fi
touch "$RC"
grep -qF '# The Olympus' "$RC" || printf 'source-file "%s"  # The Olympus\n' "$CONFIG/tmux/the-olympus.conf" >> "$RC"
echo "Installed; restart tmux, or run: tmux source-file $RC"
