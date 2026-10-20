#!/bin/sh
# The Olympus — Plymouth boot theme. Run as root on a machine with Plymouth
# (apt install plymouth); the kernel command line needs "quiet splash".
#
#   sh install.sh            install the theme, make it the default, rebuild the initramfs
#   sh install.sh --restore  go back to the distribution's theme
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
DEST=/usr/share/plymouth/themes/the-olympus
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
command -v plymouth-set-default-theme >/dev/null 2>&1 || { echo "Plymouth is not installed (apt install plymouth)" >&2; exit 1; }

if [ "${1:-}" = "--restore" ]; then
  if [ -f "$DEST/previous" ]; then plymouth-set-default-theme -R "$(cat "$DEST/previous")"; else plymouth-set-default-theme -r; plymouth-set-default-theme -R "$(plymouth-set-default-theme)"; fi
  rm -rf "$DEST"
  echo "Plymouth is back to its previous theme."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }

current=$(plymouth-set-default-theme)
mkdir -p "$DEST"
[ "$current" = "the-olympus" ] || echo "$current" > "$DEST/previous"
for f in the-olympus.plymouth the-olympus.script background.png crest.png track.png fill.png; do install -m 644 "$DIR/the-olympus/$f" "$DEST/$f"; done
plymouth-set-default-theme -R the-olympus
echo "The Olympus boot theme is installed; it shows at the next boot."
