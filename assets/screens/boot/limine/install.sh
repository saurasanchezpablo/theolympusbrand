#!/bin/sh
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

CONF=
for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do
  if [ -f "$c" ]; then CONF=$c; break; fi
done
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

if [ "${1:-}" = "--restore" ]; then
  strip > "$TMP"
  write "$TMP"
  rm -f "$CDIR/the-olympus.png" "$CONF.the-olympus.orig"
  echo "Limine is back as it was ($CONF)."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }

[ -f "$CONF.the-olympus.orig" ] || cp -p "$CONF" "$CONF.the-olympus.orig"

# The wallpaper, beside limine.conf: boot() is the partition limine.conf is read from.
install -m 644 "$DIR/wallpaper.png" "$CDIR/the-olympus.png"
MNT=$(findmnt -n -o TARGET --target "$CDIR" 2>/dev/null || echo /)
REL=${CDIR#"$MNT"}
WALLPAPER="boot():${REL%/}/the-olympus.png"
# With its hash, it still loads when Secure Boot checks every file Limine reads.
if command -v b2sum >/dev/null 2>&1; then WALLPAPER="$WALLPAPER#$(b2sum "$CDIR/the-olympus.png" | cut -d' ' -f1)"; fi

# Limine 12 takes the menu's colours as RRGGBB; earlier releases, as an index of the palette.
VERSION=$(limine --version 2>/dev/null | grep -oE '[0-9]+' | head -n 1 || true)
if [ "${VERSION:-12}" -ge 12 ]; then
  BRANDING_COLOUR=fafafa; HELP_COLOUR=9a9a9a; HELP_BRIGHT="interface_help_colour_bright: fafafa"
else
  BRANDING_COLOUR=7; HELP_COLOUR=7; HELP_BRIGHT=
fi

{
  echo "$BEGIN"
  echo "wallpaper: $WALLPAPER"
  echo "wallpaper_style: stretched"
  echo "backdrop: 0e0e0e"
  printf '%s\n' 'interface_branding: The Olympus'
  echo "interface_branding_colour: $BRANDING_COLOUR"
  echo "interface_help_colour: $HELP_COLOUR"
  [ -z "$HELP_BRIGHT" ] || echo "$HELP_BRIGHT"
  echo "term_palette: 1c1c1c;8a8a8a;b4b4b4;d2d2d2;727272;9a9a9a;c2c2c2;dadada"
  echo "term_palette_bright: 6a6a6a;a6a6a6;c8c8c8;e6e6e6;8e8e8e;b0b0b0;d6d6d6;fafafa"
  # TTRRGGBB, the transparency inverted: 30 lets a little of the wallpaper through.
  echo "term_background: 300e0e0e"
  echo "term_foreground: c9c9c9"
  echo "term_background_bright: 3a3a3a"
  echo "term_foreground_bright: fafafa"
  echo "$END"
  strip | awk -v a="$ASIDE" '
    BEGIN { n = split("wallpaper wallpaper_style backdrop interface_branding interface_branding_colour interface_branding_color interface_help_colour interface_help_color interface_help_colour_bright interface_help_color_bright term_palette term_palette_bright term_background term_foreground term_background_bright term_foreground_bright term_margin term_margin_gradient", o, " "); for (i = 1; i <= n; i++) set[o[i]] = 1 }
    {
      line = $0; sub(/^[[:space:]]+/, "", line)
      key = tolower(line); sub(/[[:space:]]*:.*/, "", key)
      if (line ~ /^[A-Za-z_]+[[:space:]]*:/ && (key in set)) { print a $0; next }
      print
    }'
} > "$TMP"
write "$TMP"

echo "The Olympus is set in $CONF; it shows at the next boot."
if command -v omarchy-refresh-limine >/dev/null 2>&1; then
  echo "Omarchy: omarchy-refresh-limine replaces limine.conf with Omarchy's own — run this again after it."
fi
