// Limine — the boot menu of CachyOS and Omarchy: the house's wallpaper, its
// name as the menu's title, and its greys for the menu and the terminal. The
// options go in a marked block at the top of limine.conf; any of the same
// options already there are commented out, and given back on --restore. The
// kernel entries are never touched, so CachyOS's limine-entry-tool and
// Omarchy's snapper sync carry on as before.
//
// Written for Limine 12 (colours as RRGGBB; earlier releases take a palette
// index for the menu's colours, which the script detects).

import { SCHEMES, STONE_ANSI } from './palette16.ts';
import { oneLine } from '../catalog/text.ts';
import type { ScreenSubject } from './screens.ts';

const hex = (h: string) => h.slice(1).toLowerCase();
const D = SCHEMES.dark;

/** The options the block sets; the same ones elsewhere in the file are set aside. */
const OPTIONS = ['wallpaper', 'wallpaper_style', 'backdrop', 'interface_branding', 'interface_branding_colour', 'interface_branding_color', 'interface_help_colour', 'interface_help_color', 'interface_help_colour_bright', 'interface_help_color_bright', 'term_palette', 'term_palette_bright', 'term_background', 'term_foreground', 'term_background_bright', 'term_foreground_bright', 'term_margin', 'term_margin_gradient'];

/** The menu's title: one line, and nothing Limine would read as a macro or a comment. */
/** Where limine.conf usually is, in the order it is looked for (the ESP mounted at /boot, /efi or /boot/efi). */
export const LIMINE_PLACES = '/boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf';
/** Elsewhere on those partitions: Arch puts it beside its own EFI file (EFI/arch-limine/), other systems elsewhere still. */
export const LIMINE_SEARCH = 'find /boot /efi /boot/efi -maxdepth 4 -name limine.conf -type f 2>/dev/null | head -n 1';
/** Written when the theme is in place, readable by everyone: a person without root cannot look into the boot partition. */
export const LIMINE_MARK = '/var/lib/the-olympus/limine';

export const limineBranding = (subject: ScreenSubject) => (subject.id === 'master' ? 'The Olympus' : `${oneLine(subject.name)} · The Olympus`).replace(/[$#]/g, '').slice(0, 60);

export function limineInstall(subject: ScreenSubject): string {
  return `#!/bin/sh
# The Olympus — the Limine boot menu: the house's wallpaper, its name and its
# greys. Run as root on a machine that boots with Limine (CachyOS, Omarchy,
# or any other).
#
#   sh install.sh            set the theme in limine.conf
#   sh install.sh --restore  take it out, and give back the options it set aside
#
# It finds limine.conf by itself; set LIMINE_CONF=/path/to/limine.conf to choose.
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
DEFAULTS=/etc/default/limine
BEGIN='# The Olympus — begin (sh install.sh --restore takes this block out)'
END='# The Olympus — end'
ASIDE='#the-olympus# '
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

MARK=\${OLYMPUS_STATE:-${LIMINE_MARK.replace(/\/limine$/, '')}}/limine

CONF=
for c in \${LIMINE_CONF:-} $(cat "$MARK" 2>/dev/null || true) ${LIMINE_PLACES}; do
  if [ -f "$c" ]; then CONF=$c; break; fi
done
[ -n "$CONF" ] || CONF=$(${LIMINE_SEARCH})
[ -n "$CONF" ] || { echo "no limine.conf found: this machine does not boot with Limine (or set LIMINE_CONF)" >&2; exit 1; }
CDIR=$(dirname "$CONF")

# CachyOS can enrol limine.conf's checksum into Limine (Secure Boot): edited without enrolling again, it would not boot.
ENROL=0
if [ -f "$DEFAULTS" ] && grep -Eq '^[[:space:]]*ENABLE_ENROLL_LIMINE_CONFIG=["'"'"']?yes' "$DEFAULTS"; then
  command -v limine-enroll-config >/dev/null 2>&1 || { echo "limine.conf is enrolled (ENABLE_ENROLL_LIMINE_CONFIG=yes) but limine-enroll-config is missing: not changing it" >&2; exit 1; }
  ENROL=1
fi

# Back to the file as it would be without the house: the block out, set-aside options back.
strip() {
  awk -v b="$BEGIN" -v e="$END" -v a="$ASIDE" '
    $0 == b { skip = 1; next }
    $0 == e { skip = 0; next }
    skip { next }
    index($0, a) == 1 { print substr($0, length(a) + 1); next }
    { print }
  ' "$CONF"
}

write() { # write <new contents file>: in one step (a half-written limine.conf would not boot), keeping its mode
  cp -p "$CONF" "$CONF.the-olympus.tmp"
  cat "$1" > "$CONF.the-olympus.tmp"
  mv "$CONF.the-olympus.tmp" "$CONF"
  rm -f "$1"
  if [ "$ENROL" = 1 ]; then limine-enroll-config; fi
}

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT INT TERM

if [ "\${1:-}" = "--restore" ]; then
  strip > "$TMP"
  write "$TMP"
  rm -f "$CDIR/the-olympus.png" "$CONF.the-olympus.orig" "$MARK"
  echo "Limine is back as it was ($CONF)."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }

[ -f "$CONF.the-olympus.orig" ] || cp -p "$CONF" "$CONF.the-olympus.orig"

# The wallpaper, beside limine.conf: boot() is the partition limine.conf is read from.
install -m 644 "$DIR/wallpaper.png" "$CDIR/the-olympus.png"
MNT=$(findmnt -n -o TARGET --target "$CDIR" 2>/dev/null || echo /)
REL=\${CDIR#"$MNT"}
WALLPAPER="boot():\${REL%/}/the-olympus.png"
# With its hash, it still loads when Secure Boot checks every file Limine reads.
if command -v b2sum >/dev/null 2>&1; then WALLPAPER="$WALLPAPER#$(b2sum "$CDIR/the-olympus.png" | cut -d' ' -f1)"; fi

# Limine 12 takes the menu's colours as RRGGBB; earlier releases, as an index of the palette.
VERSION=$(limine --version 2>/dev/null | grep -oE '[0-9]+' | head -n 1 || true)
if [ "\${VERSION:-12}" -ge 12 ]; then
  BRANDING_COLOUR=${hex(D.bold)}; HELP_COLOUR=${hex(STONE_ANSI[5])}; HELP_BRIGHT="interface_help_colour_bright: ${hex(D.bold)}"
else
  BRANDING_COLOUR=7; HELP_COLOUR=7; HELP_BRIGHT=
fi

{
  echo "$BEGIN"
  echo "wallpaper: $WALLPAPER"
  echo "wallpaper_style: stretched"
  echo "backdrop: ${hex(D.background)}"
  printf '%s\\n' ${shWords(`interface_branding: ${limineBranding(subject)}`)}
  echo "interface_branding_colour: $BRANDING_COLOUR"
  echo "interface_help_colour: $HELP_COLOUR"
  [ -z "$HELP_BRIGHT" ] || echo "$HELP_BRIGHT"
  echo "term_palette: ${STONE_ANSI.slice(0, 8).map(hex).join(';')}"
  echo "term_palette_bright: ${STONE_ANSI.slice(8).map(hex).join(';')}"
  # TTRRGGBB, the transparency inverted: 30 lets a little of the wallpaper through.
  echo "term_background: 30${hex(D.background)}"
  echo "term_foreground: ${hex(D.foreground)}"
  echo "term_background_bright: ${hex(D.selection)}"
  echo "term_foreground_bright: ${hex(D.bold)}"
  echo "$END"
  strip | awk -v a="$ASIDE" '
    BEGIN { n = split("${OPTIONS.join(' ')}", o, " "); for (i = 1; i <= n; i++) set[o[i]] = 1 }
    {
      line = $0; sub(/^[[:space:]]+/, "", line)
      key = tolower(line); sub(/[[:space:]]*:.*/, "", key)
      if (line ~ /^[A-Za-z_]+[[:space:]]*:/ && (key in set)) { print a $0; next }
      print
    }'
} > "$TMP"
write "$TMP"

# For anyone to see that it is in place (the launcher's list, run as yourself): where it went.
{ mkdir -p "$(dirname "$MARK")" && printf '%s\\n' "$CONF" > "$MARK" && chmod 644 "$MARK"; } 2>/dev/null || true
echo "The Olympus is set in $CONF; it shows at the next boot."
if command -v omarchy-refresh-limine >/dev/null 2>&1; then
  echo "Omarchy: omarchy-refresh-limine replaces limine.conf with Omarchy's own — run this again after it."
fi
`;
}

/** A word for the shell's printf: single-quoted. */
function shWords(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
