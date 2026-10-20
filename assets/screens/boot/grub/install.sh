#!/bin/sh
# The Olympus — GRUB background. Run as root.
#
#   sh install.sh            install the background and regenerate GRUB's menu
#   sh install.sh --restore  put /etc/default/grub back as it was
#
# For machines that boot with GRUB (most Debian, Ubuntu and Proxmox VE BIOS
# installs). A Proxmox VE node on ZFS with UEFI boots with systemd-boot: this
# changes nothing there.
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONF=/etc/default/grub
IMAGE=/boot/grub/the-olympus.png
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -f "$CONF" ] || { echo "$CONF not found: this machine does not boot with GRUB" >&2; exit 1; }

regenerate() {
  if command -v update-grub >/dev/null 2>&1; then update-grub
  elif command -v grub-mkconfig >/dev/null 2>&1; then grub-mkconfig -o /boot/grub/grub.cfg
  else echo "neither update-grub nor grub-mkconfig found: regenerate GRUB's configuration by hand" >&2; fi
  if command -v proxmox-boot-tool >/dev/null 2>&1; then proxmox-boot-tool refresh || true; fi
}

if [ "${1:-}" = "--restore" ]; then
  [ -f "$CONF.the-olympus.orig" ] && mv "$CONF.the-olympus.orig" "$CONF"
  rm -f "$IMAGE"
  regenerate
  echo "GRUB is back as it was."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }

install -D -m 644 "$DIR/background.png" "$IMAGE"
[ -f "$CONF.the-olympus.orig" ] || cp -p "$CONF" "$CONF.the-olympus.orig"
sed -i '/^#\{0,1\}GRUB_BACKGROUND=/d' "$CONF"
echo "GRUB_BACKGROUND=\"$IMAGE\"" >> "$CONF"
grep -q '^GRUB_GFXMODE=' "$CONF" || echo 'GRUB_GFXMODE="1920x1080,auto"' >> "$CONF"
regenerate
echo "The Olympus background is set; it shows at the next boot."
