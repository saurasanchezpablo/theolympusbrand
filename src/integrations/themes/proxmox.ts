// Proxmox VE: the header logo and favicon, installed by a script that keeps
// the originals, can survive updates (an APT hook) and can undo itself.

import { PALETTE } from '../../brand/palette.ts';
import { ico } from '../../export/ico.ts';
import { bannerMark, coinSvg, markSvg } from '../marks.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;

export function proxmoxScript(): string {
  return `#!/bin/sh
# The Olympus — Proxmox VE web interface: the logo in the header and the
# favicon. Run as root on each node.
#
#   sh apply.sh            for the light theme ("Crisp", the default)
#   sh apply.sh --dark     for the dark theme
#   sh apply.sh --persist  also restore them after Proxmox updates (an APT hook)
#   sh apply.sh --restore  put Proxmox's own files back and remove the hook
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
IMG=/usr/share/pve-manager/images
KEEP=/usr/local/share/the-olympus/proxmox
HOOK=/etc/apt/apt.conf.d/99-the-olympus-logo
logo=logo-light-theme.png
persist=0
restore=0
for a in "$@"; do
  case "$a" in
    --dark) logo=logo-dark-theme.png ;;
    --persist) persist=1 ;;
    --restore) restore=1 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -d "$IMG" ] || { echo "$IMG not found: is this a Proxmox VE node?" >&2; exit 1; }

if [ "$restore" = 1 ]; then
  for f in proxmox_logo.png favicon.ico; do
    if [ -f "$IMG/$f.orig" ]; then mv "$IMG/$f.orig" "$IMG/$f"; fi
  done
  rm -f "$HOOK"
  rm -rf "$KEEP"
  echo "Proxmox's own logo is back. Reload the web interface (Ctrl+Shift+R)."
  exit 0
fi

mkdir -p "$KEEP"
install -m 644 "$DIR/$logo" "$KEEP/proxmox_logo.png"
install -m 644 "$DIR/favicon.ico" "$KEEP/favicon.ico"
for f in proxmox_logo.png favicon.ico; do
  [ -f "$IMG/$f" ] || continue
  [ -f "$IMG/$f.orig" ] || cp -p "$IMG/$f" "$IMG/$f.orig"
  install -m 644 "$KEEP/$f" "$IMG/$f"
done

if [ "$persist" = 1 ]; then
  cat > "$HOOK" <<EOF
// The Olympus: put the logo back after pve-manager updates. Remove this file to stop.
DPkg::Post-Invoke { "if [ -f $KEEP/proxmox_logo.png ]; then install -m 644 $KEEP/proxmox_logo.png $IMG/proxmox_logo.png; install -m 644 $KEEP/favicon.ico $IMG/favicon.ico; fi"; };
EOF
fi
echo "The Olympus logo installed. Reload the web interface (Ctrl+Shift+R)."
`;
}

export const proxmox: ThemeKit = {
  id: 'proxmox',
  label: 'Proxmox VE',
  match: { ids: ['proxmox', 'pve'], category: 'virtualization' },
  how: '`apply.sh` installs the header logo and favicon (`--restore` undoes)',
  files: async (t) => {
    const banner = bannerMark(t.marks.seal, t.name);
    const height = 30;
    const width = Math.round((banner.width! * height) / banner.height!);
    const coin = coinSvg(t.marks.seal, 'dark');
    return [
      ['apply.sh', proxmoxScript()],
      ['logo-light-theme.png', await t.png(markSvg(banner, P.charcoal), width)],
      ['logo-dark-theme.png', await t.png(markSvg(banner, P.marble), width)],
      ['favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await t.png(coin, size) }))))],
    ];
  },
};
