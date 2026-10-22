#!/bin/sh
# The Olympus — your terminal, every part in one command. Run as yourself
# (not with sudo): everything goes into your home folder.
#
#   sh install.sh                          every part this machine has a program for
#   sh install.sh bash fish             only the parts named
#   sh install.sh --restore                undo every part that is installed
#   sh install.sh --list                   the parts, and which this machine can take
#
# Straight from the house's site, without downloading the folder first:
#
#   curl -fsSL <your site>/files/assets/screens/shell/install.sh | OLYMPUS_FROM=<your site>/files/assets/screens/shell/ sh
#   curl -fsSL <your site>/files/assets/screens/shell/install.sh | OLYMPUS_FROM=<your site>/files/assets/screens/shell/ sh -s -- bash
#
# Every file fetched is checked against the SHA-256 written below before
# anything runs. Parts: bash, fish, fastfetch, tmux, gnome-terminal, ptyxis, kitty, alacritty, omarchy, wezterm.
set -eu

FROM=${OLYMPUS_FROM:-}
ALL='bash fish fastfetch tmux gnome-terminal ptyxis kitty alacritty omarchy wezterm'
OPTIONS=''

fits() {
  case "$1" in
    bash) command -v bash >/dev/null 2>&1 ;;
    fish) command -v fish >/dev/null 2>&1 ;;
    fastfetch) command -v fastfetch >/dev/null 2>&1 ;;
    tmux) command -v tmux >/dev/null 2>&1 ;;
    gnome-terminal) command -v gnome-terminal >/dev/null 2>&1 && command -v dconf >/dev/null 2>&1 ;;
    ptyxis) command -v ptyxis >/dev/null 2>&1 || [ -d "$HOME/.var/app/app.devsuite.Ptyxis" ] ;;
    kitty) command -v kitty >/dev/null 2>&1 ;;
    alacritty) command -v alacritty >/dev/null 2>&1 ;;
    omarchy) command -v omarchy-theme-set >/dev/null 2>&1 ;;
    wezterm) command -v wezterm >/dev/null 2>&1 ;;
  esac
}
installed() {
  case "$1" in
    bash) grep -qsF '# The Olympus prompt' "$HOME/.bashrc" ;;
    fish) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/fish/conf.d/the-olympus.fish ] ;;
    fastfetch) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/fastfetch/the-olympus.jsonc ] ;;
    tmux) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/tmux/the-olympus.conf ] ;;
    gnome-terminal) dconf read /org/gnome/terminal/legacy/profiles:/list 2>/dev/null | grep -q 7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11 ;;
    ptyxis) [ -f "${XDG_DATA_HOME:-$HOME/.local/share}"/org.gnome.Ptyxis/palettes/the-olympus.palette ] || [ -f "$HOME/.var/app/app.devsuite.Ptyxis/data/org.gnome.Ptyxis/palettes/the-olympus.palette" ] ;;
    kitty) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/kitty/the-olympus.conf ] ;;
    alacritty) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/alacritty/the-olympus.toml ] ;;
    omarchy) [ -d "${XDG_CONFIG_HOME:-$HOME/.config}"/omarchy/themes/the-olympus ] ;;
    wezterm) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/wezterm/colors/the-olympus.toml ] ;;
  esac
}
unfit() {
  case "$1" in
    bash) echo 'bash is not installed' ;;
    fish) echo 'fish is not installed' ;;
    fastfetch) echo 'fastfetch is not installed' ;;
    tmux) echo 'tmux is not installed' ;;
    gnome-terminal) echo 'GNOME Terminal is not installed' ;;
    ptyxis) echo 'Ptyxis is not installed' ;;
    kitty) echo 'kitty is not installed' ;;
    alacritty) echo 'Alacritty is not installed' ;;
    omarchy) echo 'Omarchy is not installed' ;;
    wezterm) echo 'WezTerm is not installed' ;;
  esac
}
label() {
  case "$1" in
    bash) echo 'bash prompt' ;;
    fish) echo 'fish prompt and colours' ;;
    fastfetch) echo 'fastfetch with the seal' ;;
    tmux) echo 'tmux status bar' ;;
    gnome-terminal) echo 'GNOME Terminal profile' ;;
    ptyxis) echo 'Ptyxis palette' ;;
    kitty) echo 'kitty colours' ;;
    alacritty) echo 'Alacritty colours' ;;
    omarchy) echo 'Omarchy theme' ;;
    wezterm) echo 'WezTerm colour scheme' ;;
  esac
}
dir_of() {
  case "$1" in
    bash) echo bash ;;
    fish) echo fish ;;
    fastfetch) echo fastfetch ;;
    tmux) echo tmux ;;
    gnome-terminal) echo gnome-terminal ;;
    ptyxis) echo ptyxis ;;
    kitty) echo kitty ;;
    alacritty) echo alacritty ;;
    omarchy) echo omarchy ;;
    wezterm) echo wezterm ;;
  esac
}
accepts() {
  case "$1 $2" in

    *) return 1 ;;
  esac
}

MANIFEST='alacritty alacritty/install.sh 45032bcdf26070f2b31e676f386f105981b51746f1239d74de1244116d04add2
alacritty alacritty/the-olympus.toml edc0e9193f274e1fa010812535fe6b5616391ab4993aa576b0df0509ff660411
bash bash/install.sh 6e0ad094c0fcbf938add5dc2f020eaf6037203d3f200a22834bebba2537c3bd5
bash bash/prompt.bash ccd78d70d2c184036c84a23a53067a5c598a55be144c8b2eb9a7176a30a6ee57
fastfetch fastfetch/install.sh 4a0c7a862b4cffe10aedd83a421f61fff7c79dd99a380c8bfc244b1037f5b2ed
fastfetch fastfetch/the-olympus-logo.txt e1b7fd0dfacc8b87ea85e538f5b6878aa21d3143108d49d30e68b4ab34f56be0
fastfetch fastfetch/the-olympus.jsonc 7c451a6f9ed38b9c99409c5a8db6159082e1ab28d1d5eb7cbef84a71bef1caa4
fish fish/install.sh 63d606c97cfd49e2fd91e02debe86227f6311cb56fc2aa95fdd0c13b0c74ed52
fish fish/the-olympus.fish cd009f77518395e28d25caf83669eb3a5550ef3ace32a6a3be26a225a5ec2173
gnome-terminal gnome-terminal/install.sh 83c5c130c908d150f503c59598a262b4f6371b6347ffa8104f26fde5d765ff92
gnome-terminal gnome-terminal/the-olympus.dconf 2c53cf86b29f24cf754e71036dfe6c976db875e037beb975b6518728089c4c02
kitty kitty/install.sh 20d08d40c551cec4322e14e77d3a355c5224ab9fc512e4244ddb6c60a6fd8456
kitty kitty/the-olympus.conf 73662449e97f9db18c8cd7b60d6b0194283778eea0ed4fcc51c73de969f1b5b9
omarchy omarchy/install.sh c498f9d831ed5e8b6a8d78d37c14e68d4b4c7f635e1562a856fa94d72d5ae9b4
omarchy omarchy/the-olympus/backgrounds/blueprint.png bd69b028cd3530ff6c83705cd86a7664dec3bf4d6fa9eeca43d0fb15f17a59f4
omarchy omarchy/the-olympus/backgrounds/graphite.png 57eff700f81846ed05323fea5bea8fe65b2f61ea155872abd4d3af99691471da
omarchy omarchy/the-olympus/backgrounds/marble.png c5e7e984e01f30c049a6ce01622d863a6753149c912000a9026e7513e0467e62
omarchy omarchy/the-olympus/colors.toml 2e5fb077f6325b10652e1d7978c75e0da76e02bc21ccee1e7d28ec735b2bc110
ptyxis ptyxis/install.sh 0f412066c22a3b6452d2147c5f77f7e953bf93575ca9a4d7f1226fa6dfc81212
ptyxis ptyxis/the-olympus.palette 755b66cce2f9da9fe9918adb68e82503587a810bd130264c34ea68c0667b772c
tmux tmux/install.sh ef20928621934e472d769f8693c2ae6d9d767129b978cf91b3695b446e1f0983
tmux tmux/the-olympus.conf de00ff90c907ce3e562f28a43261b2b5ea25b99ff829f52cd21927e1e875b837
wezterm wezterm/install.sh cc811e14261b59ed9e9a5b31d261c9039a341bfc94c211aafdf8ec75ff17ce8c
wezterm wezterm/the-olympus.toml a54c16c5b9a9f39f20a4941c2dff5f38d79e26e12a9d920bc42a5e0bb6a22d3a'

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
[ "$(id -u)" != 0 ] || echo "note: running as root, so this themes root's own terminal" >&2

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
