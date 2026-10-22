// Proxmox VE: the whole web interface in the house's greys, with its logo and
// favicon. The theme is made on the server from the dark theme Proxmox ships
// with — its blues and blue-greys turned to greys of the same lightness —
// so it always matches the installed release; on top, the house's layer, which
// also gives the colours that report something (running, a warning, an error)
// the house's pigments. An APT hook makes it again after every update.
// Everything can be undone.

import { PALETTE } from '../../brand/palette.ts';
import { PIGMENTS, STATUS } from '../../brand/pigments.ts';
import { ico } from '../../export/ico.ts';
import { bannerMark, coinSvg, markSvg } from '../marks.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;

/** The banner in a wider box, left-aligned: Proxmox VE 8 stretches its logo to 172 × 30. */
const boxed = (svg: string, width: number, height: number) =>
  svg.replace(/^<svg([^>]*?) viewBox="0 0 ([\d.]+) ([\d.]+)" width="[^"]*" height="[^"]*"/, (_, a: string, _w: string, h: string) => `<svg${a} viewBox="0 0 ${Math.round((+h * width) / height)} ${h}" width="${width}" height="${height}"`);
const sized = (svg: string, width: number, height: number) => svg.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${width}" height="${height}"`);

/**
 * What the kit adds on top of the greyed dark theme, so that the interface is
 * the house's and not only Proxmox's without its blue: an obsidian ground,
 * marble for the main buttons and the open tab, a marble rule beside what is
 * selected, titles in marble. Proxmox's icons stay as they are (they are drawn
 * light, for a dark ground). What reports a state — running, a warning, an
 * error, a gauge filling up, the journal's priorities — takes the house's
 * pigments, in their tones for a dark ground.
 */
export function proxmoxLayer(): string {
  const lift = '#4A4A4A'; // the selected row: a step lighter than Proxmox's own grounds
  return `
/* The Olympus — on top of the dark theme */
.x-body, .x-border-layout-ct.x-body { background-color: ${P.obsidian}; }
img[src*="proxmox_logo"] { filter: none !important; } /* the dark theme inverts Proxmox's dark logo; the house's is drawn light */
#versioninfo, #versioninfo * { color: ${P.silver}; letter-spacing: 0.04em; }
.x-panel-header-title-default, .x-window-header-title-default, .x-panel-header-text-default { color: ${P.marble} !important; letter-spacing: 0.03em; }
.x-grid-item-selected .x-grid-cell, .x-grid-item-selected.x-grid-item-over .x-grid-cell { background-color: ${lift} !important; color: ${P.paper} !important; }
.x-grid-item-selected .x-grid-cell:first-child { box-shadow: inset 3px 0 0 ${P.marble}; }
.x-treelist-item-selected > .x-treelist-row, .x-treelist-item-selected.x-treelist-item-over > .x-treelist-row { background-color: ${lift} !important; box-shadow: inset 3px 0 0 ${P.marble}; }
.x-treelist-item-selected > .x-treelist-row .x-treelist-item-text, .x-treelist-item-selected > .x-treelist-row .x-treelist-item-icon { color: ${P.paper} !important; }
.x-treelist-item-selected .lxc::after, .x-treelist-item-selected .qemu::after { background-color: ${lift} !important; text-shadow: -1px 0 1px ${lift} !important; }
.x-tab-default.x-tab-active, .x-tab-default.x-tab-active.x-tab-over, .x-keyboard-mode .x-tab-default.x-tab-focus.x-tab-active { background-color: ${P.marble} !important; border-color: ${P.marble} !important; }
.x-tab-default.x-tab-active .x-tab-inner-default, .x-tab-default.x-tab-active .x-tab-icon-el-default { color: ${P.obsidian} !important; }
.x-tab-default.x-tab-over:not(.x-tab-active) { background-color: ${P.graphite} !important; border-color: ${P.graphite} !important; }
.x-btn-default-small:not(.x-btn-disabled) { background-color: ${P.marble} !important; border-color: ${P.marble} !important; }
.x-btn-default-small:not(.x-btn-disabled) .x-btn-inner-default-small, .x-btn-default-small:not(.x-btn-disabled) .x-btn-icon-el-default-small, .x-btn-default-small:not(.x-btn-disabled) .x-btn-arrow-right:after { color: ${P.obsidian} !important; }
.x-btn-default-small.x-btn-over:not(.x-btn-disabled), .x-keyboard-mode .x-btn-default-small.x-btn-focus:not(.x-btn-disabled) { background-color: ${P.paper} !important; border-color: ${P.paper} !important; }
.x-btn-default-small.x-btn-disabled { background-color: ${P.graphite} !important; border-color: ${P.graphite} !important; }
.x-btn-default-small.x-btn-pressed:not(.x-btn-disabled), .x-btn-default-toolbar-small.x-btn-pressed, .x-btn-default-toolbar-small.x-btn-menu-active { background-color: ${P.silver} !important; border-color: ${P.silver} !important; }
.x-menu-header { background-color: ${P.graphite} !important; }
.x-progress-default .x-progress-bar-default { background-color: ${P.silver} !important; }
/* States: verde antico for good, gold for a warning, rosso antico for an error, lapis for a notice. */
:root { --pwt-gauge-warn: ${STATUS.warn.dark}; --pwt-gauge-crit: ${STATUS.error.dark}; }
.good, .fa.good { color: ${STATUS.ok.darkBright} !important; }
.warning, .fa.warning { color: ${STATUS.warn.darkBright} !important; }
.critical, .fa.critical { color: ${STATUS.error.darkBright} !important; }
.info-blue { color: ${STATUS.info.darkBright} !important; }
.x-progress.warning .x-progress-bar { background-color: ${STATUS.warn.dark} !important; }
.x-progress.critical .x-progress-bar { background-color: ${STATUS.error.dark} !important; }
.pmx-journal-prio-0, .pmx-journal-prio-1, .pmx-journal-prio-2, .pmx-journal-prio-3 { color: ${PIGMENTS.rossoAntico.darkBright} !important; }
.pmx-journal-prio-4 { color: ${PIGMENTS.gold.darkBright} !important; }
`;
}

export function proxmoxScript(): string {
  return `#!/bin/sh
# The Olympus — Proxmox VE: the web interface in the house's greys, the logo
# in the header and the icon of the browser tab. Run as root on each node.
#
#   sh apply.sh              the theme, the logo and the icon, kept after updates
#   sh apply.sh --logo-only  only the logo and the icon (for Proxmox's light theme)
#   sh apply.sh --no-persist do not re-apply after updates (no APT hook)
#   sh apply.sh --check      what is in place, and what the node serves
#   sh apply.sh --restore    Proxmox's own look back, and the hook removed
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
IMG=/usr/share/pve-manager/images
CSS=/usr/share/pve-manager/css
TPL=/usr/share/pve-manager/index.html.tpl
PWT=/usr/share/javascript/proxmox-widget-toolkit
DARK=$PWT/themes/theme-proxmox-dark.css
KEEP=/usr/local/share/the-olympus/proxmox
HOOK=/etc/apt/apt.conf.d/99-the-olympus-logo
HREF=/pve2/css/the-olympus.css
theme=1
tone=dark
persist=1
restore=0
reapply=0
check=0
for a in "$@"; do
  case "$a" in
    --logo-only) theme=0; tone=light ;;
    --dark) tone=dark ;;
    --persist) persist=1 ;;
    --no-persist) persist=0 ;;
    --restore) restore=1 ;;
    --reapply) reapply=1 ;;
    --check) check=1 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

# Where each image goes, and from which of the kit's files: Proxmox VE 8 shows the PNG logo,
# 9 the SVG one (from the widget toolkit); the browser tab shows logo-128.png.
targets() {
  echo "$IMG/proxmox_logo.png logo-$tone-theme.png"
  echo "$PWT/images/proxmox_logo.svg logo-$tone-theme.svg"
  echo "$IMG/logo-128.png logo-128.png"
  echo "$IMG/favicon.ico favicon.ico"
}
KIT_FILES="logo-dark-theme.png logo-light-theme.png logo-dark-theme.svg logo-light-theme.svg logo-128.png favicon.ico layer.css"

if [ "$check" = 1 ]; then
  echo "Proxmox VE: $(pveversion 2>/dev/null || echo 'pveversion not found — is this a node?')"
  if grep -qF "$HREF" "$TPL" 2>/dev/null; then echo "✓ the page template links the theme: $(grep -oF "$HREF" "$TPL" | head -n 1)…"; else echo "✕ the page template does not link the theme ($TPL)"; fi
  if [ -s "$CSS/the-olympus.css" ]; then echo "✓ the theme is made: $CSS/the-olympus.css ($(wc -c < "$CSS/the-olympus.css") bytes)"; else echo "✕ no theme file at $CSS/the-olympus.css"; fi
  targets | while read -r target file; do
    if [ -f "$KEEP/$file" ] && cmp -s "$target" "$KEEP/$file"; then echo "✓ $target is the house's"
    elif [ -f "$target" ]; then echo "✕ $target is still Proxmox's"
    else echo "· $target does not exist in this release"; fi
  done
  if [ -f "$HOOK" ]; then echo "✓ re-applied after updates ($HOOK)"; else echo "· not re-applied after updates (no $HOOK)"; fi
  if command -v curl >/dev/null 2>&1; then
    code=$(curl -ks -o /dev/null -w '%{http_code}' "https://127.0.0.1:8006$HREF" || true)
    if [ "$code" = 200 ]; then echo "✓ the node serves the theme (https://127.0.0.1:8006$HREF)"; else echo "✕ the node answers $code for $HREF — is pveproxy running? (systemctl status pveproxy)"; fi
  fi
  echo "In the browser: reload with Ctrl+Shift+R."
  exit 0
fi

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -d "$IMG" ] || { echo "$IMG not found: is this a Proxmox VE node?" >&2; exit 1; }

unlink_theme() {
  if [ -f "$TPL" ] && grep -qF "$HREF" "$TPL"; then
    grep -vF "$HREF" "$TPL" > "$TPL.the-olympus.tmp"
    cat "$TPL.the-olympus.tmp" > "$TPL"
    rm -f "$TPL.the-olympus.tmp"
  fi
  rm -f "$CSS/the-olympus.css"
}

if [ "$restore" = 1 ]; then
  for f in "$IMG/proxmox_logo.png" "$PWT/images/proxmox_logo.svg" "$IMG/logo-128.png" "$IMG/favicon.ico"; do
    if [ -f "$f.orig" ]; then mv "$f.orig" "$f"; fi
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
  for f in $KIT_FILES; do install -m 644 "$DIR/$f" "$KEEP/$f"; done
  [ "$DIR/apply.sh" -ef "$KEEP/apply.sh" ] || install -m 755 "$DIR/apply.sh" "$KEEP/apply.sh"
  printf 'theme=%s\\ntone=%s\\n' "$theme" "$tone" > "$KEEP/settings"
fi

# The logo and the icon; Proxmox's own are kept beside them (.orig).
targets | while read -r target file; do
  [ -f "$target" ] || continue
  # Proxmox's file — the first time, or a newer one an update put back — is what --restore returns to.
  ours=0
  for k in $KIT_FILES; do cmp -s "$target" "$KEEP/$k" && ours=1; done
  [ "$ours" = 1 ] || cp -p "$target" "$target.orig"
  install -m 644 "$KEEP/$file" "$target"
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
    cat "$KEEP/layer.css"
  } > "$CSS/the-olympus.css.tmp"
  mv "$CSS/the-olympus.css.tmp" "$CSS/the-olympus.css"
  chmod 644 "$CSS/the-olympus.css"
  # Linked after Proxmox's own stylesheets, with its size and time in the address: a browser never keeps an old one.
  grep -qi '</head>' "$TPL" || { echo "$TPL has no </head>: not changed" >&2; exit 1; }
  v=$(cksum < "$CSS/the-olympus.css" | cut -d' ' -f1)
  link="<link rel=\\"stylesheet\\" type=\\"text/css\\" href=\\"$HREF?v=$v\\" />"
  if ! grep -qF "$HREF?v=$v\\"" "$TPL"; then
    if grep -qF "$HREF" "$TPL"; then grep -vF "$HREF" "$TPL" > "$TPL.the-olympus.tmp"; cat "$TPL.the-olympus.tmp" > "$TPL"; rm -f "$TPL.the-olympus.tmp"; fi
    LINK=$link perl -0pi -e 's{([ \\t]*)</head>}{$1  $ENV{LINK}\\n$1</head>}i' "$TPL"
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
[ "$reapply" = 1 ] || echo "The Olympus is applied. Reload the web interface (Ctrl+Shift+R); sh apply.sh --check says what is in place."
`;
}

export const proxmox: ThemeKit = {
  id: 'proxmox',
  label: 'Proxmox VE',
  match: { ids: ['proxmox', 'pve'], category: 'virtualization' },
  how: '`apply.sh` turns the web interface grey, installs the logo and favicon, and keeps them after updates (`--restore` undoes)',
  installer: {
    summary: 'the whole web interface in greys, the logo and the icon',
    requires: 'command -v pveversion >/dev/null 2>&1',
    installed: 'grep -qsF /pve2/css/the-olympus.css /usr/share/pve-manager/index.html.tpl || [ -f /usr/local/share/the-olympus/proxmox/settings ]',
    root: true,
  },
  guide: (t) => ({
    title: 'Proxmox VE',
    intro: `The whole Proxmox VE web interface in the house's greys, with ${t.name}'s seal and name in the header and on the browser tab. The theme is made on the node itself from the dark theme Proxmox ships — every blue and blue-grey becomes the grey of the same lightness — and the house's own layer goes on top: an obsidian ground, marble buttons and tabs, a marble rule beside what is selected, and the house's pigments for what reports a state (verde antico for good, gold for a warning, rosso antico for an error). Because it is made from the installed release, it matches whatever version the node runs, and it is made again after every update.`,
    changes: [
      'Every panel, tree, grid, toolbar, menu and window: Proxmox’s dark theme, in greys, on an obsidian ground.',
      'The main buttons and the open tab: marble, with dark lettering; what is selected in the trees and lists: a lighter stone with a marble rule.',
      'The sign-in window, in the same greys.',
      `The header logo: ${t.name}'s seal and name (Proxmox VE 8 and 9 each have their own file; both are replaced).`,
      'The icon of the browser tab: the seal on its own disc.',
      'States in the house’s pigments: good in verde antico, warnings and the gauges’ warning band in gold, errors and critical gauges in rosso antico, notices in lapis; the journal’s errors and warnings likewise.',
    ],
    limits: [
      'The console (noVNC, xterm.js) has no theme setting; its colours stay. The crest *at login* in a shell is the screens kit’s *terminal* part.',
      'A few states Proxmox paints in places the kit does not know keep Proxmox’s own colour (still green, orange or red: their meaning is kept).',
      'The charts’ series colours (CPU usage in olive, IO delay in blue…) are set in Proxmox’s code, not its stylesheets: no theme can change them.',
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
    check: ['`sh /usr/local/share/the-olympus/proxmox/apply.sh --check` lists what is in place and whether the node serves the theme.', 'The interface is grey from the sign-in window on, the main buttons marble; the header shows the seal and the name.', 'If nothing changed, reload with Ctrl+Shift+R: the browser may still hold the page from before.', 'A running guest’s icon is still green; a stopped one grey.', '`ls /etc/apt/apt.conf.d/99-the-olympus-logo` shows the hook is in place.'],
    undo: [{ text: 'Put Proxmox’s look back and remove the hook.', code: 'sh /usr/local/share/the-olympus/proxmox/apply.sh --restore' }],
    updates: 'An update of `pve-manager` puts Proxmox’s page template and logo back; the APT hook runs right after and makes the theme again from the new release’s dark theme. Install with `--no-persist` if you would rather re-run the script yourself. Only the logo and favicon, on Proxmox’s light theme: `sh apply.sh --logo-only`.',
    files: [
      ['apply.sh', 'Makes and installs the theme, the logo and the icon; `--check` says what is in place; `--restore` undoes'],
      ['layer.css', 'What the house adds on top of the greyed dark theme: grounds, marble buttons, tabs and selection'],
      ['logo-dark-theme.png', 'The header logo for the grey (dark) interface — Proxmox VE 8'],
      ['logo-dark-theme.svg', 'The same, for Proxmox VE 9'],
      ['logo-light-theme.png', 'The header logo for Proxmox’s light theme (`--logo-only`) — Proxmox VE 8'],
      ['logo-light-theme.svg', 'The same, for Proxmox VE 9'],
      ['logo-128.png', 'The icon of the browser tab'],
      ['favicon.ico', 'The favicon: 16, 32 and 48 px'],
    ],
    tested: 'Written for Proxmox VE 8 and 9. The test suite runs the script against a stand-in node — the theme made from a sample of the dark theme (blues to grey, status colours kept), the template linked once however often it runs, the hook re-applying, and `--restore` putting everything back. The result was looked at in Proxmox VE 9.2’s own web interface, served from its packages with a stand-in for the API; it has not been run on a live node here.',
  }),
  files: async (t) => {
    const banner = bannerMark(t.marks.seal, t.name);
    const height = 30;
    const width = Math.round((banner.width! * height) / banner.height!);
    const coin = coinSvg(t.marks.seal, 'dark');
    return [
      ['apply.sh', proxmoxScript()],
      ['layer.css', proxmoxLayer()],
      ['logo-light-theme.png', await t.png(boxed(markSvg(banner, P.charcoal), 172, height), 172)],
      ['logo-dark-theme.png', await t.png(boxed(markSvg(banner, P.marble), 172, height), 172)],
      // Proxmox VE 9 shows the SVG at the size it states: the header's.
      ['logo-light-theme.svg', sized(markSvg(banner, P.charcoal), width, height)],
      ['logo-dark-theme.svg', sized(markSvg(banner, P.marble), width, height)],
      ['logo-128.png', await t.png(coin, 128)],
      ['favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await t.png(coin, size) }))))],
    ];
  },
};
