#!/bin/sh
# The Olympus — screens, every part in one command. Run as root.
#
#   sudo sh install.sh                     every part this machine can take
#   sudo sh install.sh grub limine          only the parts named
#   sudo sh install.sh terminal --ascii    options go to the parts that take them
#   sudo sh install.sh --restore           undo every part that is installed
#   sh install.sh --list                   the parts, and which this machine can take
#
# Straight from the house's site, without downloading the folder first:
#
#   curl -fsSL <your site>/files/assets/screens/install.sh | sudo OLYMPUS_FROM=<your site>/files/assets/screens/ sh
#   curl -fsSL <your site>/files/assets/screens/install.sh | sudo OLYMPUS_FROM=<your site>/files/assets/screens/ sh -s -- terminal
#
# Every file fetched is checked against the SHA-256 written below before
# anything runs. Parts: grub, limine, plymouth, terminal, wallpapers.
set -eu

FROM=${OLYMPUS_FROM:-}
ALL='grub limine plymouth terminal wallpapers'
OPTIONS=--ascii

fits() {
  case "$1" in
    grub) [ -f /etc/default/grub ] ;;
    limine) ( for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do [ -f "$c" ] && exit 0; done; [ -n "$(find /boot /efi /boot/efi -maxdepth 4 -name limine.conf -type f 2>/dev/null | head -n 1)" ] && exit 0; [ "$(id -u)" != 0 ] || exit 1; [ -f /var/lib/the-olympus/limine ] || command -v limine >/dev/null 2>&1 || [ -d /usr/share/limine ] || [ -f /etc/default/limine ] || command -v limine-entry-tool >/dev/null 2>&1 || command -v limine-update >/dev/null 2>&1 ) ;;
    plymouth) command -v plymouth-set-default-theme >/dev/null 2>&1 ;;
    terminal) [ -f /etc/issue ] ;;
    wallpapers) [ -d /usr/share/xsessions ] || [ -d /usr/share/wayland-sessions ] ;;
  esac
}
installed() {
  case "$1" in
    grub) [ -f /etc/default/grub.the-olympus.orig ] ;;
    limine) ( [ -f /var/lib/the-olympus/limine ] && exit 0; for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do grep -qsF "# The Olympus — begin" "$c" && exit 0; done; exit 1 ) ;;
    plymouth) [ -d /usr/share/plymouth/themes/the-olympus ] ;;
    terminal) [ -f /etc/update-motd.d/20-the-olympus ] || [ -f /etc/motd.d/the-olympus ] || [ -f /etc/issue.the-olympus.orig ] ;;
    wallpapers) [ -d /usr/share/backgrounds/the-olympus ] ;;
  esac
}
unfit() {
  case "$1" in
    grub) echo 'this machine does not boot with GRUB' ;;
    limine) echo 'this machine does not boot with Limine' ;;
    plymouth) echo 'Plymouth is not installed (apt install plymouth, or pacman -S plymouth)' ;;
    terminal) echo 'no /etc/issue: not a Linux system with a console login' ;;
    wallpapers) echo 'no desktop installed' ;;
  esac
}
label() {
  case "$1" in
    grub) echo 'GRUB background' ;;
    limine) echo 'Limine boot menu' ;;
    plymouth) echo 'Plymouth boot splash' ;;
    terminal) echo 'Terminal: message of the day, console login, SSH banner' ;;
    wallpapers) echo 'Wallpapers, in the desktop’s own picker' ;;
  esac
}
dir_of() {
  case "$1" in
    grub) echo boot/grub ;;
    limine) echo boot/limine ;;
    plymouth) echo boot/plymouth ;;
    terminal) echo terminal ;;
    wallpapers) echo wallpapers ;;
  esac
}
accepts() {
  case "$1 $2" in
    "terminal --ascii") return 0 ;;
    *) return 1 ;;
  esac
}

MANIFEST='grub boot/grub/background.png 070b5b2c7cd66b08e9e5d201c9da4ac340da738d6f0eb009681b6bf8f7a725cf
grub boot/grub/install.sh 65604bbd0f8e94b25511d99cfc1c07a0b5ac300e1b0529e940a4a39cd1358d61
limine boot/limine/install.sh 9c58510db1b14099bebdd38e2b29f39a4a3cde028421a94974cfcb698765485e
limine boot/limine/wallpaper.png 070b5b2c7cd66b08e9e5d201c9da4ac340da738d6f0eb009681b6bf8f7a725cf
plymouth boot/plymouth/install.sh 438862aee04027ce1dd3e6b04cd7a6ebec85f5ba946f76cc463ace9bc4b41414
plymouth boot/plymouth/the-olympus/background.png 5bcc9c08ed6f171c52b883f712f8c39ccbca86643f58a1f6b0865351c1343ebe
plymouth boot/plymouth/the-olympus/crest.png fcf9d5debedba637da40bb35178ca3a7245fd5916a85e901f303493d17b932aa
plymouth boot/plymouth/the-olympus/fill.png 75224f4c181e906bbe244f22e788fce6c5d42d01fd0347fd64e709b38eb2810f
plymouth boot/plymouth/the-olympus/the-olympus.plymouth e7d8995c45a53eeb1f8348d382c8d280f9d75d2f9069af1b20ae09fcae1fff22
plymouth boot/plymouth/the-olympus/the-olympus.script 932306a73b4ba9f9fa5ee179b6f27bcb4f297fa88a1ee77da8a56283d7877896
plymouth boot/plymouth/the-olympus/track.png 1f349e1b4f25f5a12883851fad81c46bdbd5a19bed74ec687ab5040e49c65b11
terminal terminal/20-the-olympus 51d7b8a037e1a8942e8a5857dc7ba7425bff9dd6e916926f771ea54c0d47359d
terminal terminal/install.sh 839492d659c6dea7b6b2d828068d5dd7882e396567fe542ec54d696c93e67c81
terminal terminal/issue 7d2f6e9df37721e89780c6cea9d2e45b813f2a2a7b8d47e2d61cad29cded0468
terminal terminal/issue.net e21452397fbc8992458bfd7bf696a45039faac305091d16882d686cf024c3daf
terminal terminal/motd-ascii.txt 4a36e8020e322ef427861d85bab023762c9e3ff5e624a352fdc41603e0140c23
terminal terminal/motd-braille.txt dd173672768206bd38b78287d76c3e85a3b086c506ed7ff00dd4b49aabc87336
wallpapers wallpapers/install.sh e5619d5db758477b9dcdf03fa54d45d1b86f083659d68763b973ed5aa9472d99
wallpapers wallpapers/the-olympus-master-wallpaper-blueprint-1080p.png 9fd5537e96071408444ee648bfe9253d332382cf82cb88a0dff939cb6fe81380
wallpapers wallpapers/the-olympus-master-wallpaper-blueprint-1440p.png bd69b028cd3530ff6c83705cd86a7664dec3bf4d6fa9eeca43d0fb15f17a59f4
wallpapers wallpapers/the-olympus-master-wallpaper-blueprint-4k.png 3ae89f84b3190e8cb767195d319d284c83c69e368a0d1766ce173b2d4121bd04
wallpapers wallpapers/the-olympus-master-wallpaper-blueprint-phone.png 05edd49e82e87c5915b795ad711b94b533e22576584c42604913135937e106d3
wallpapers wallpapers/the-olympus-master-wallpaper-blueprint-ultrawide.png 217d1bd8d2d8c345dc3614dc55a6edea4ff6f7df9a7fa3690ec718e16cd7587e
wallpapers wallpapers/the-olympus-master-wallpaper-graphite-1080p.png ed5ab1d42293bf45920e70f2a37bca467af0df8a33c84bdc47bd4675c60607eb
wallpapers wallpapers/the-olympus-master-wallpaper-graphite-1440p.png 57eff700f81846ed05323fea5bea8fe65b2f61ea155872abd4d3af99691471da
wallpapers wallpapers/the-olympus-master-wallpaper-graphite-4k.png 135480c5e338ddd4d0a622353e98aa80968241b9baa7079e329240ef6b275be6
wallpapers wallpapers/the-olympus-master-wallpaper-graphite-phone.png bf1ca73813bc18f9fe8604f8dbb2a59710c64f61b5b81dbac0ba201cc74a16e7
wallpapers wallpapers/the-olympus-master-wallpaper-graphite-ultrawide.png 5205378c637e46bdd6f9be5d316a095f49f7a3aa2c34374e73e5d57ccee1f33f
wallpapers wallpapers/the-olympus-master-wallpaper-marble-1080p.png 7b9235ca1a90ca60536c1cbcc5f2684aca989dc01425c027e334cb7e383de9a3
wallpapers wallpapers/the-olympus-master-wallpaper-marble-1440p.png c5e7e984e01f30c049a6ce01622d863a6753149c912000a9026e7513e0467e62
wallpapers wallpapers/the-olympus-master-wallpaper-marble-4k.png df6690a58683b35b37b1261049b11a08e09c653eff8a792309ac9ce0d943003c
wallpapers wallpapers/the-olympus-master-wallpaper-marble-light-1080p.png d5eca811aab1d050d68a41ca870db3ee3889adef951086dc2d9ba9c81c9b5317
wallpapers wallpapers/the-olympus-master-wallpaper-marble-light-1440p.png a1f815505d7062e716d4e73efee5caf61e5952f2df8408efb6046b36850e4654
wallpapers wallpapers/the-olympus-master-wallpaper-marble-light-4k.png 028221ac03fd77f672b85becd5ca943f7dda6a6a8109a22c30c5e81878ad3a61
wallpapers wallpapers/the-olympus-master-wallpaper-marble-light-phone.png d79f48bd80f27adda3897942be95228427f26dc3e2d53b49caf52c8687a81a72
wallpapers wallpapers/the-olympus-master-wallpaper-marble-light-ultrawide.png c0fdc1af859d0e9aa82f31bac6fb2ffc0a807f4540dfa04af106c92976ed09e9
wallpapers wallpapers/the-olympus-master-wallpaper-marble-phone.png 74078dd2f7b710fb9cab44473beac81eb167e942ff8d3199846dc79c60eca4f6
wallpapers wallpapers/the-olympus-master-wallpaper-marble-ultrawide.png b70803e0a1c46289defa140eb66e705db7fcdb09b24112e6cdfffcd3125b0aa0
wallpapers wallpapers/the-olympus-wallpapers.xml 20ce7f6c54669234828fd68c288b9bd8eb1a10dbf0592d295da8029fcbdc14f1'

restore=0
list=0
chosen=
opts=
while [ $# -gt 0 ]; do
  case "$1" in
    --restore) restore=1 ;;
    --list) list=1 ;;
    --from) FROM=${2:?--from needs an address}; shift ;;
    -*)
      case " $OPTIONS " in *" $1 "*) opts="$opts $1" ;; *) echo "unknown option: $1" >&2; exit 2 ;; esac ;;
    *)
      case " $ALL " in *" $1 "*) chosen="$chosen $1" ;; *) echo "unknown part: $1 (parts: $ALL)" >&2; exit 2 ;; esac ;;
  esac
  shift
done

if [ "$list" = 1 ]; then
  for p in $ALL; do
    if installed "$p"; then state="installed"; elif fits "$p"; then state="can be installed"; else state="skipped: $(unfit "$p")"; fi
    printf '%-12s %s — %s\n' "$p" "$(label "$p")" "$state"
  done
  exit 0
fi
[ "$(id -u)" = 0 ] || { echo "run as root (sudo)" >&2; exit 1; }

# Where the parts come from: this folder, or the site.
if [ -n "$FROM" ]; then
  SRC=$(mktemp -d)
  trap 'rm -rf "$SRC"' EXIT INT TERM
  if command -v curl >/dev/null 2>&1; then get() { curl -fsSL "$1" -o "$2"; }
  elif command -v wget >/dev/null 2>&1; then get() { wget -qO "$2" "$1"; }
  else echo "neither curl nor wget is installed" >&2; exit 1; fi
  # sha256sum on Linux, shasum on macOS.
  if command -v sha256sum >/dev/null 2>&1; then digest() { sha256sum "$1" | cut -d' ' -f1; }
  elif command -v shasum >/dev/null 2>&1; then digest() { shasum -a 256 "$1" | cut -d' ' -f1; }
  else echo "sha256sum (or shasum) is needed to check the files" >&2; exit 1; fi
  fetch() { # fetch <part> [scripts-only]
    echo "$MANIFEST" | while read -r part path sum; do
      [ "$part" = "$1" ] || continue
      [ -z "${2:-}" ] || [ "${path##*/}" = install.sh ] || continue
      mkdir -p "$SRC/$(dirname "$path")"
      get "${FROM%/}/$path" "$SRC/$path" || { echo "could not fetch ${FROM%/}/$path" >&2; exit 1; }
      [ "$(digest "$SRC/$path")" = "$sum" ] || { echo "$path does not match its checksum: not installing" >&2; exit 1; }
    done
  }
else
  SRC=$(cd "$(dirname "$0")" && pwd)
  [ -f "$SRC/$(dir_of "${ALL%% *}")/install.sh" ] || { echo "run this from the screens folder, or set OLYMPUS_FROM to the site's screens address" >&2; exit 1; }
  fetch() { :; }
fi

done_parts=
skipped=
failed=
for p in ${chosen:-$ALL}; do
  if [ "$restore" = 1 ]; then
    if [ -n "$chosen" ] || installed "$p"; then
      fetch "$p" scripts
      if sh "$SRC/$(dir_of "$p")/install.sh" --restore; then done_parts="$done_parts $p"; else failed="$failed $p"; fi
    fi
    continue
  fi
  if ! fits "$p"; then
    skipped="$skipped $p"
    echo "· $p skipped: $(unfit "$p")"
    continue
  fi
  echo "· $(label "$p")"
  fetch "$p"
  args=
  for o in $opts; do if accepts "$p" "$o"; then args="$args $o"; fi; done
  # shellcheck disable=SC2086
  if sh "$SRC/$(dir_of "$p")/install.sh" $args; then done_parts="$done_parts $p"; else failed="$failed $p"; fi
done

echo
[ -z "$done_parts" ] || echo "$( [ "$restore" = 1 ] && echo Restored || echo Installed ):$done_parts"
[ -z "$skipped" ] || echo "Skipped:$skipped"
if [ -n "$failed" ]; then echo "Failed:$failed" >&2; exit 1; fi
