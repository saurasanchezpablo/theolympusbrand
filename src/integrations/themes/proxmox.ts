// Proxmox VE: the whole web interface in the house's greys, with its logo and
// favicon. The theme is made on the server from the dark theme Proxmox ships
// with — its blues and blue-greys turned to greys of the same lightness, its
// status colours kept — so it always matches the installed release. An APT
// hook makes it again after every update. Everything can be undone.

import { PALETTE } from '../../brand/palette.ts';
import { ico } from '../../export/ico.ts';
import { bannerMark, coinSvg, markSvg } from '../marks.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;

export function proxmoxScript(): string {
  return `#!/bin/sh
# The Olympus — Proxmox VE: the web interface in the house's greys, the logo
# in the header and the favicon. Run as root on each node.
#
#   sh apply.sh              the theme, the logo and the favicon, kept after updates
#   sh apply.sh --logo-only  only the logo and the favicon (for Proxmox's light theme)
#   sh apply.sh --no-persist do not re-apply after updates (no APT hook)
#   sh apply.sh --restore    Proxmox's own look back, and the hook removed
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
IMG=/usr/share/pve-manager/images
CSS=/usr/share/pve-manager/css
TPL=/usr/share/pve-manager/index.html.tpl
DARK=/usr/share/javascript/proxmox-widget-toolkit/themes/theme-proxmox-dark.css
KEEP=/usr/local/share/the-olympus/proxmox
HOOK=/etc/apt/apt.conf.d/99-the-olympus-logo
LINK='<link rel="stylesheet" type="text/css" href="/pve2/css/the-olympus.css" />'
theme=1
logo=logo-dark-theme.png
persist=1
restore=0
reapply=0
for a in "$@"; do
  case "$a" in
    --logo-only) theme=0; logo=logo-light-theme.png ;;
    --dark) logo=logo-dark-theme.png ;;
    --persist) persist=1 ;;
    --no-persist) persist=0 ;;
    --restore) restore=1 ;;
    --reapply) reapply=1 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -d "$IMG" ] || { echo "$IMG not found: is this a Proxmox VE node?" >&2; exit 1; }

unlink_theme() {
  if [ -f "$TPL" ] && grep -qF '/pve2/css/the-olympus.css' "$TPL"; then
    grep -vF '/pve2/css/the-olympus.css' "$TPL" > "$TPL.the-olympus.tmp"
    cat "$TPL.the-olympus.tmp" > "$TPL"
    rm -f "$TPL.the-olympus.tmp"
  fi
  rm -f "$CSS/the-olympus.css"
}

if [ "$restore" = 1 ]; then
  for f in proxmox_logo.png favicon.ico; do
    if [ -f "$IMG/$f.orig" ]; then mv "$IMG/$f.orig" "$IMG/$f"; fi
  done
  unlink_theme
  rm -f "$HOOK"
  rm -rf "$KEEP"
  systemctl reload-or-restart pveproxy 2>/dev/null || true
  echo "Proxmox's own look is back. Reload the web interface (Ctrl+Shift+R)."
  exit 0
fi

# After an update the hook runs the kept copy: it uses what was kept, as it was chosen.
if [ "$reapply" = 1 ]; then
  [ -f "$KEEP/settings" ] || exit 0
  . "$KEEP/settings"
  DIR=$KEEP
else
  mkdir -p "$KEEP"
  for f in logo-light-theme.png logo-dark-theme.png favicon.ico; do install -m 644 "$DIR/$f" "$KEEP/$f"; done
  [ "$DIR/apply.sh" -ef "$KEEP/apply.sh" ] || install -m 755 "$DIR/apply.sh" "$KEEP/apply.sh"
  printf 'theme=%s\\nlogo=%s\\n' "$theme" "$logo" > "$KEEP/settings"
fi

# The logo and the favicon; Proxmox's own are kept beside them.
install -m 644 "$DIR/$logo" "$KEEP/proxmox_logo.png"
for f in proxmox_logo.png favicon.ico; do
  [ -f "$IMG/$f" ] || continue
  # Proxmox's file — the first time, or a newer one an update put back — is what --restore returns to.
  ours=0
  for k in logo-dark-theme.png logo-light-theme.png favicon.ico; do cmp -s "$IMG/$f" "$KEEP/$k" && ours=1; done
  [ "$ours" = 1 ] || cp -p "$IMG/$f" "$IMG/$f.orig"
  install -m 644 "$KEEP/$f" "$IMG/$f"
done

# The theme: Proxmox's dark theme, with every blue and blue-grey turned to the grey of the same lightness.
if [ "$theme" = 1 ]; then
  [ -f "$DARK" ] || { echo "$DARK not found: this Proxmox VE is older than 7.4 — use --logo-only" >&2; exit 1; }
  command -v perl >/dev/null 2>&1 || { echo "perl is needed (Proxmox VE always has it)" >&2; exit 1; }
  {
    echo '/* The Olympus — made by apply.sh from Proxmox VE'"'"'s dark theme. Remove with: sh apply.sh --restore */'
    perl -pe '
      sub tone {
        my ($R, $G, $B) = @_;
        my $hi = $R > $G ? ($R > $B ? $R : $B) : ($G > $B ? $G : $B);
        my $lo = $R < $G ? ($R < $B ? $R : $B) : ($G < $B ? $G : $B);
        my $sat = $hi == 0 ? 0 : ($hi - $lo) / $hi;
        my $hue = 0;
        if ($hi != $lo) {
          my $d = $hi - $lo;
          if ($hi == $R) { $hue = 60 * (($G - $B) / $d) }
          elsif ($hi == $G) { $hue = 60 * (($B - $R) / $d + 2) }
          else { $hue = 60 * (($R - $G) / $d + 4) }
          $hue += 360 if $hue < 0;
        }
        # Greys with a tint, and every blue: to grey. Reds, oranges, yellows and greens say something: kept.
        return ($R, $G, $B) unless $sat < 0.3 || ($hue >= 170 && $hue <= 265);
        my $y = int(0.2126 * $R + 0.7152 * $G + 0.0722 * $B + 0.5);
        return ($y, $y, $y);
      }
      s~#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?=\\s*(?:[;,)!}]|$))~
        my $h = length($1) == 3 ? join("", map { $_ x 2 } split(//, $1)) : $1;
        sprintf("#%02x%02x%02x", tone(map { hex } unpack("A2A2A2", $h)));
      ~ge;
      s{rgb(a?)\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)}{ "rgb$1(" . join(", ", tone($2, $3, $4)) }ge;
    ' "$DARK"
  } > "$CSS/the-olympus.css.tmp"
  mv "$CSS/the-olympus.css.tmp" "$CSS/the-olympus.css"
  chmod 644 "$CSS/the-olympus.css"
  if ! grep -qF '/pve2/css/the-olympus.css' "$TPL"; then
    grep -qi '</head>' "$TPL" || { echo "$TPL has no </head>: not changed" >&2; exit 1; }
    perl -0pi -e 's{</head>}{    '"$LINK"'\\n  </head>}i' "$TPL"
  fi
else
  unlink_theme
fi

if [ "$persist" = 1 ] && [ "$reapply" = 0 ]; then
  cat > "$HOOK" <<EOF
// The Olympus: make the Proxmox VE theme, logo and favicon again after package updates. Remove this file to stop.
DPkg::Post-Invoke { "if [ -x $KEEP/apply.sh ]; then sh $KEEP/apply.sh --reapply >/dev/null 2>&1 || true; fi"; };
EOF
elif [ "$persist" = 0 ]; then
  rm -f "$HOOK"
fi
[ "$reapply" = 1 ] || echo "The Olympus is applied. Reload the web interface (Ctrl+Shift+R)."
`;
}

export const proxmox: ThemeKit = {
  id: 'proxmox',
  label: 'Proxmox VE',
  match: { ids: ['proxmox', 'pve'], category: 'virtualization' },
  how: '`apply.sh` turns the web interface grey, installs the logo and favicon, and keeps them after updates (`--restore` undoes)',
  installer: { summary: 'the whole web interface in greys, the logo and the favicon', detect: 'command -v pveversion >/dev/null 2>&1', root: true },
  guide: (t) => ({
    title: 'Proxmox VE',
    intro: `The whole Proxmox VE web interface in the house's greys, with ${t.name}'s seal and name in the header and as the favicon. The theme is made on the node itself from the dark theme Proxmox ships: every blue and blue-grey becomes the grey of the same lightness, while the colours that report something — a running guest, a warning, an error — keep their meaning. Because it is made from the installed release, it matches whatever version the node runs, and it is made again after every update.`,
    changes: [
      'Every panel, tree, grid, toolbar, menu and window: Proxmox’s dark theme, in greys.',
      'The sign-in window, in the same greys.',
      `The header logo: ${t.name}'s seal and name, 30 px tall.`,
      'The favicon: the seal on its own disc.',
    ],
    limits: [
      'The console (noVNC, xterm.js) has no theme setting; its colours stay. The crest *at login* in a shell is the screens kit’s *terminal* part.',
      'Status colours — green for running, orange for a warning, red for an error — are kept on purpose.',
      'Proxmox Backup Server is not covered by this kit.',
      'It changes Proxmox’s own page template (one line) and adds files to its folders: `debsums` or `dpkg --verify` list the template as modified until the next update puts Proxmox’s back — and the hook makes it again.',
    ],
    requires: ['Proxmox VE 8 or 9 (7.4 and later have the dark theme it is made from).', 'A root shell on each node: the web interface’s *Shell*, or SSH.'],
    steps: [
      { text: 'Copy this folder to the node, for instance with `scp -r proxmox root@<node>:/root/the-olympus-proxmox`.' },
      { text: 'Run the script as root.', code: 'cd /root/the-olympus-proxmox\nsh apply.sh' },
      { text: 'Reload the web interface with Ctrl+Shift+R (the browser keeps the old stylesheet otherwise).' },
      { text: 'Repeat on every node of a cluster: each serves its own interface.' },
    ],
    check: ['The interface is grey from the sign-in window on; the header shows the seal and the name.', 'A running guest’s icon is still green; a stopped one grey.', '`ls /etc/apt/apt.conf.d/99-the-olympus-logo` shows the hook is in place.'],
    undo: [{ text: 'Put Proxmox’s look back and remove the hook.', code: 'sh /usr/local/share/the-olympus/proxmox/apply.sh --restore' }],
    updates: 'An update of `pve-manager` puts Proxmox’s page template and logo back; the APT hook runs right after and makes the theme again from the new release’s dark theme. Install with `--no-persist` if you would rather re-run the script yourself. Only the logo and favicon, on Proxmox’s light theme: `sh apply.sh --logo-only`.',
    files: [
      ['apply.sh', 'Makes and installs the theme, the logo and the favicon; `--restore` undoes'],
      ['logo-dark-theme.png', 'The header logo for the grey (dark) interface'],
      ['logo-light-theme.png', 'The header logo for Proxmox’s light theme (`--logo-only`)'],
      ['favicon.ico', 'The favicon: 16, 32 and 48 px'],
    ],
    tested: 'Written for Proxmox VE 8 and 9. The test suite runs the script against a stand-in node — the theme made from a sample of the dark theme (blues to grey, status colours kept), the template linked once however often it runs, the hook re-applying, and `--restore` putting everything back; it has not been run on a live node here.',
  }),
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
