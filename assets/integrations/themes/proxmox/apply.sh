#!/bin/sh
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
  printf 'theme=%s\ntone=%s\n' "$theme" "$tone" > "$KEEP/settings"
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
      s~#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?=\s*(?:[;,)!}]|$))~
        my $h = length($1) == 3 ? join("", map { $_ x 2 } split(//, $1)) : $1;
        sprintf("#%02x%02x%02x", tone(map { hex } unpack("A2A2A2", $h)));
      ~ge;
      s{rgb(a?)\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)}{ "rgb$1(" . join(", ", tone($2, $3, $4)) }ge;
    ' "$DARK"
    cat "$KEEP/layer.css"
  } > "$CSS/the-olympus.css.tmp"
  mv "$CSS/the-olympus.css.tmp" "$CSS/the-olympus.css"
  chmod 644 "$CSS/the-olympus.css"
  # Linked after Proxmox's own stylesheets, with its size and time in the address: a browser never keeps an old one.
  grep -qi '</head>' "$TPL" || { echo "$TPL has no </head>: not changed" >&2; exit 1; }
  v=$(cksum < "$CSS/the-olympus.css" | cut -d' ' -f1)
  link="<link rel=\"stylesheet\" type=\"text/css\" href=\"$HREF?v=$v\" />"
  if ! grep -qF "$HREF?v=$v\"" "$TPL"; then
    if grep -qF "$HREF" "$TPL"; then grep -vF "$HREF" "$TPL" > "$TPL.the-olympus.tmp"; cat "$TPL.the-olympus.tmp" > "$TPL"; rm -f "$TPL.the-olympus.tmp"; fi
    LINK=$link perl -0pi -e 's{([ \t]*)</head>}{$1  $ENV{LINK}\n$1</head>}i' "$TPL"
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
