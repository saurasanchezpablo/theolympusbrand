#!/bin/sh
# The Olympus — the bash prompt. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "${1:-}" = "--restore" ]; then
  unmark "$HOME/.bashrc" '# The Olympus prompt'
  rm -f "$CONFIG/the-olympus/prompt.bash"
  echo "The prompt is removed; it is gone from new terminals."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
mkdir -p "$CONFIG/the-olympus"
cp "$DIR/prompt.bash" "$CONFIG/the-olympus/prompt.bash"
touch "$HOME/.bashrc"
grep -qF '# The Olympus prompt' "$HOME/.bashrc" || printf '[ -f "%s" ] && . "%s"  # The Olympus prompt\n' "$CONFIG/the-olympus/prompt.bash" "$CONFIG/the-olympus/prompt.bash" >> "$HOME/.bashrc"
echo "The prompt is installed; open a new terminal to see it."
