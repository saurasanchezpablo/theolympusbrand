#!/bin/sh
# The Olympus — one command for this machine: a menu of everything the house
# can install here, and the means to undo it.
#
#   curl -fsSL http://<site>/install.sh | OLYMPUS_SITE=http://<site> sh
#
# Options, for scripts and machines without a terminal:
#   --list            what this machine can take, and what is installed
#   --yes             install everything this machine can take, without asking
#   --only a,b,…      just these (ids from --list)
#   --restore         undo instead of install (with --yes or --only, or from the menu)
#   --as <id>         which identity the screens show: master, or a service's id
#   --site <address>  instead of OLYMPUS_SITE
#
# Every file is fetched from the site and checked against the SHA-256 written
# here (or in the installer it runs) before it is used. Serve the site over
# HTTPS: over plain HTTP, this script itself could be changed on its way.
set -eu

SITE=${OLYMPUS_SITE:-}
MODE=install
YES=0
LIST=0
ONLY=
AS=
while [ $# -gt 0 ]; do
  case "$1" in
    --site) SITE=${2:?--site needs an address}; shift ;;
    --yes) YES=1 ;;
    --list) LIST=1 ;;
    --only) ONLY=$(printf '%s' "${2:?--only needs ids}" | tr ',' ' '); shift ;;
    --restore) MODE=restore ;;
    --as) AS=${2:?--as needs an identity}; shift ;;
    -h|--help) sed -n '2,20p' "$0" 2>/dev/null || true; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
  shift
done
SITE=${SITE%/}

if [ "$(id -u)" = 0 ]; then SUDO=; else SUDO=sudo; fi
if command -v curl >/dev/null 2>&1; then get() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then get() { wget -qO "$2" "$1"; }
else echo "curl or wget is needed" >&2; exit 1; fi
if command -v sha256sum >/dev/null 2>&1; then sum() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then sum() { shasum -a 256 "$1" | cut -d' ' -f1; }
else echo "sha256sum (or shasum) is needed to check the files" >&2; exit 1; fi

TMP=$(mktemp -d)
TTYSTATE=
cleanup() {
  if [ -n "$TTYSTATE" ]; then stty "$TTYSTATE" </dev/tty 2>/dev/null || true; printf '\033[?25h\033[?1049l' >/dev/tty 2>/dev/null || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ---------------------------------------------------------------- the items

ITEMS='sys:grub|The machine|GRUB background
sys:limine|The machine|Limine boot menu
sys:plymouth|The machine|Plymouth boot splash
sys:terminal|The machine|Terminal: message of the day, console login, SSH banner
sys:wallpapers|The machine|Wallpapers, in the desktop’s own picker
usr:bash|Your terminal|bash prompt
usr:fish|Your terminal|fish prompt and colours
usr:fastfetch|Your terminal|fastfetch with the seal
usr:tmux|Your terminal|tmux status bar
usr:gnome-terminal|Your terminal|GNOME Terminal profile
usr:ptyxis|Your terminal|Ptyxis palette
usr:kitty|Your terminal|kitty colours
usr:alacritty|Your terminal|Alacritty colours
usr:omarchy|Your terminal|Omarchy theme
usr:wezterm|Your terminal|WezTerm colour scheme
kit:home-assistant|Applications on this machine|Home Assistant — the theme, light and dark, and the dashboard images
kit:nextcloud|Applications on this machine|Nextcloud — name, colours, logos and background, through occ
kit:proxmox|Applications on this machine|Proxmox VE — the whole web interface in greys, the logo and the favicon
kit:vaultwarden|Applications on this machine|Vaultwarden — greys for the web vault, and the house’s logo
doc:grafana|Applications set up by hand|Grafana — save its files and guide to ./the-olympus-grafana/
doc:jellyfin|Applications set up by hand|Jellyfin — save its files and guide to ./the-olympus-jellyfin/
doc:navidrome|Applications set up by hand|Navidrome — save its files and guide to ./the-olympus-navidrome/
doc:uptime-kuma|Applications set up by hand|Uptime Kuma — save its files and guide to ./the-olympus-uptime-kuma/'
GROUPS='The machine
Your terminal
Applications on this machine
Applications set up by hand'

fits() {
  case "$1" in
    sys:grub) [ -f /etc/default/grub ] ;;
    sys:limine) ( for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do [ -f "$c" ] && exit 0; done; exit 1 ) ;;
    sys:plymouth) command -v plymouth-set-default-theme >/dev/null 2>&1 ;;
    sys:terminal) [ -f /etc/issue ] ;;
    sys:wallpapers) [ -d /usr/share/xsessions ] || [ -d /usr/share/wayland-sessions ] ;;
    usr:bash) command -v bash >/dev/null 2>&1 ;;
    usr:fish) command -v fish >/dev/null 2>&1 ;;
    usr:fastfetch) command -v fastfetch >/dev/null 2>&1 ;;
    usr:tmux) command -v tmux >/dev/null 2>&1 ;;
    usr:gnome-terminal) command -v gnome-terminal >/dev/null 2>&1 && command -v dconf >/dev/null 2>&1 ;;
    usr:ptyxis) command -v ptyxis >/dev/null 2>&1 || [ -d "$HOME/.var/app/app.devsuite.Ptyxis" ] ;;
    usr:kitty) command -v kitty >/dev/null 2>&1 ;;
    usr:alacritty) command -v alacritty >/dev/null 2>&1 ;;
    usr:omarchy) command -v omarchy-theme-set >/dev/null 2>&1 ;;
    usr:wezterm) command -v wezterm >/dev/null 2>&1 ;;
    kit:home-assistant) (c=$( (docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null || sudo -n docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null) | awk 'tolower($2) ~ /home-?assistant/ { print $1; exit }'); [ -n "$c" ] && echo "$c") >/dev/null 2>&1 ;;
    kit:nextcloud) (c=$( (docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null || sudo -n docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null) | awk 'tolower($2) ~ /nextcloud/ { print $1; exit }'); [ -n "$c" ] && echo "$c") >/dev/null 2>&1 ;;
    kit:proxmox) (command -v pveversion >/dev/null 2>&1) >/dev/null 2>&1 ;;
    kit:vaultwarden) (c=$( (docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null || sudo -n docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null) | awk 'tolower($2) ~ /vaultwarden/ { print $1; exit }'); [ -n "$c" ] && echo "$c") >/dev/null 2>&1 ;;
    doc:grafana) true ;;
    doc:jellyfin) true ;;
    doc:navidrome) true ;;
    doc:uptime-kuma) true ;;
    *) return 1 ;;
  esac
}

installed() {
  case "$1" in
    sys:grub) [ -f /etc/default/grub.the-olympus.orig ] ;;
    sys:limine) ( for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do grep -qsF "# The Olympus — begin" "$c" && exit 0; done; exit 1 ) ;;
    sys:plymouth) [ -d /usr/share/plymouth/themes/the-olympus ] ;;
    sys:terminal) [ -f /etc/update-motd.d/20-the-olympus ] || [ -f /etc/motd.d/the-olympus ] || [ -f /etc/issue.the-olympus.orig ] ;;
    sys:wallpapers) [ -d /usr/share/backgrounds/the-olympus ] ;;
    usr:bash) grep -qsF '# The Olympus prompt' "$HOME/.bashrc" ;;
    usr:fish) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/fish/conf.d/the-olympus.fish ] ;;
    usr:fastfetch) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/fastfetch/the-olympus.jsonc ] ;;
    usr:tmux) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/tmux/the-olympus.conf ] ;;
    usr:gnome-terminal) dconf read /org/gnome/terminal/legacy/profiles:/list 2>/dev/null | grep -q 7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11 ;;
    usr:ptyxis) [ -f "${XDG_DATA_HOME:-$HOME/.local/share}"/org.gnome.Ptyxis/palettes/the-olympus.palette ] || [ -f "$HOME/.var/app/app.devsuite.Ptyxis/data/org.gnome.Ptyxis/palettes/the-olympus.palette" ] ;;
    usr:kitty) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/kitty/the-olympus.conf ] ;;
    usr:alacritty) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/alacritty/the-olympus.toml ] ;;
    usr:omarchy) [ -d "${XDG_CONFIG_HOME:-$HOME/.config}"/omarchy/themes/the-olympus ] ;;
    usr:wezterm) [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/wezterm/colors/the-olympus.toml ] ;;
    kit:home-assistant) false ;;
    kit:nextcloud) false ;;
    kit:proxmox) false ;;
    kit:vaultwarden) false ;;
    doc:grafana) false ;;
    doc:jellyfin) false ;;
    doc:navidrome) false ;;
    doc:uptime-kuma) false ;;
    *) return 1 ;;
  esac
}

unfit() {
  case "$1" in
    sys:grub) echo 'this machine does not boot with GRUB' ;;
    sys:limine) echo 'this machine does not boot with Limine' ;;
    sys:plymouth) echo 'Plymouth is not installed (apt install plymouth, or pacman -S plymouth)' ;;
    sys:terminal) echo 'no /etc/issue: not a Linux system with a console login' ;;
    sys:wallpapers) echo 'no desktop installed' ;;
    usr:bash) echo 'bash is not installed' ;;
    usr:fish) echo 'fish is not installed' ;;
    usr:fastfetch) echo 'fastfetch is not installed' ;;
    usr:tmux) echo 'tmux is not installed' ;;
    usr:gnome-terminal) echo 'GNOME Terminal is not installed' ;;
    usr:ptyxis) echo 'Ptyxis is not installed' ;;
    usr:kitty) echo 'kitty is not installed' ;;
    usr:alacritty) echo 'Alacritty is not installed' ;;
    usr:omarchy) echo 'Omarchy is not installed' ;;
    usr:wezterm) echo 'WezTerm is not installed' ;;
    kit:home-assistant) echo 'Home Assistant is not on this machine' ;;
    kit:nextcloud) echo 'Nextcloud is not on this machine' ;;
    kit:proxmox) echo 'Proxmox VE is not on this machine' ;;
    kit:vaultwarden) echo 'Vaultwarden is not on this machine' ;;
    doc:grafana) echo '' ;;
    doc:jellyfin) echo '' ;;
    doc:navidrome) echo '' ;;
    doc:uptime-kuma) echo '' ;;
    *) echo ;;
  esac
}

# The value a kit's question starts from: what was found on this machine.
found() {
  case "$1" in
    kit:home-assistant) ( c=$( (docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null || sudo -n docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null) | awk 'tolower($2) ~ /home-?assistant/ { print $1; exit }'); [ -n "$c" ] && echo "$c" ) 2>/dev/null | head -n 1 ;;
    kit:nextcloud) ( c=$( (docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null || sudo -n docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null) | awk 'tolower($2) ~ /nextcloud/ { print $1; exit }'); [ -n "$c" ] && echo "$c" ) 2>/dev/null | head -n 1 ;;
    kit:proxmox) ( command -v pveversion >/dev/null 2>&1 ) 2>/dev/null | head -n 1 ;;
    kit:vaultwarden) ( c=$( (docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null || sudo -n docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null) | awk 'tolower($2) ~ /vaultwarden/ { print $1; exit }'); [ -n "$c" ] && echo "$c" ) 2>/dev/null | head -n 1 ;;
    *) true ;;
  esac
}
ask_env() {
  case "$1" in
    kit:home-assistant) echo HA_CONTAINER ;;
    kit:nextcloud) echo NEXTCLOUD_CONTAINER ;;
    kit:vaultwarden) echo VAULTWARDEN_CONTAINER ;;
    *) true ;;
  esac
}
ask_prompt() {
  case "$1" in
    kit:home-assistant) echo 'Home Assistant’s Docker container' ;;
    kit:nextcloud) echo 'Nextcloud’s Docker container' ;;
    kit:vaultwarden) echo 'Vaultwarden’s Docker container' ;;
    *) true ;;
  esac
}
kit_args() {
  case "$1" in
    kit:home-assistant) echo '' ;;
    kit:nextcloud) echo '--with-css' ;;
    kit:proxmox) echo '' ;;
    kit:vaultwarden) echo '' ;;
    *) true ;;
  esac
}

# Every file of every kit, and its SHA-256: <folder> <path> <sum>.
KITS='grafana README.md aecb7d42b81b6e44810bfe122838d45e8a02c0e70d9bf9d0b769ee17ce2e07ab
grafana apple-touch-icon.png d2e76ebee81c5a44139e0f392183b7b88e179fb183973592fd07eeb0520ed64d
grafana docker-compose.override.yml b527ed6e165540fb4b9183660379a6e356232ffd01d292515cb539140429f4be
grafana fav32.png 90012fce4405b9c0d0cca7a7fa7b38f28f2820397a5f781a7c10edbc65cf9906
grafana grafana_icon.svg 9b349ca9cf892a17c88c393a79f931af70d9121b50ee309c9954204ec2beaeef
home-assistant README.md 0e3791a48b4c189c557ceabbdf6bd13a8b0fd8aca809aeca23dcbd74d537cde4
home-assistant apply.sh c0626a2ffdf2b3f3e7c06fbc568a4ac3bb3a571bd4a66e337a75ad7bff58ed01
home-assistant picture-card.yaml 611df18fc5bca5eeecec36533b734b5d12cd5e9a96f8a006f0d8c2415bf984b5
home-assistant the-olympus.yaml d200a64a898e14225e5291638b5542eed493d5829a961deeab8bf69b1751b36b
home-assistant www/banner.svg bc484c6ba301a297a578a5f6bb0c4089af14228627fb466fe44e27e758d073ff
home-assistant www/seal.svg e2fbb768d095e11363be844243a91b47c9033372b73df1ccfcaf40c243fc480f
jellyfin README.md 9b8521e1fa5d5d7fd96101b0436315aed3ce67d4ba914bbcdea0a888179ab8f6
jellyfin custom.css 6076eb87f11e2f7501cead3f1b5971af9b5c160fc771e49158c7d8e24231a0b8
jellyfin login-disclaimer.html 874f9b45c085a9668b4f86eeb133d8aa6b0a325d01767f2c321bbb666075b63e
jellyfin splashscreen.png 7e12e0d492fdc71004411f9bf2f0b14a1a8f6ad5548282ab0a9bc00c61bdabf1
navidrome README.md 9a30acc80160994cf5f8bf7b5b3b249a5b432580f7f11b8c41c45f09a25b3b1d
navidrome docker-compose.override.yml ef24d5832c463814c5b481a28a318e261591e2def077004f4879347df8f2b025
navidrome navidrome.css 1f14e78838b4851badb149d675d2b561e2fdb488e52e54e546ea429c2390ccc7
navidrome navidrome.toml 485062527b370a05277971940d89e67ad436ce4fcef0462880a1ed00520de3c3
navidrome nginx.conf 090182ce5bfd2eb8156675d942e7db38221ad1b8bd2edf0251193eb769aef58c
nextcloud README.md ab8c843e26cf3d1b1eafb5a4756e3566a38c691682c948aff0d81abc46773ba5
nextcloud apply.sh 23a9f8d98c6fd167734644178d3e4e53642943c361cb296138481761ca59ed61
nextcloud background.png 19be095e307a0cfff99ee0f9d0182a481f0600f48dd0e77184a827ca5b1f8e15
nextcloud custom.css 1efcec837cfc1ee1630104949e3659bf6b70f341a3cfd20187ece44c08f5debc
nextcloud favicon.png e4c5469c3d0da20ae3df859e29f05143e79be4e15c632c0548ee35c87a6a32f5
nextcloud logo.svg 5bc6f0060adcb6d850981d2bcbfa6a2cd182d0f6a4cd7db4a2b73af92ca07783
nextcloud logoheader.svg 3d7840c1b2eb718036fd5fea4f9d7890a3ffc2523a879a6f84e21851490927b3
proxmox README.md 1976f688c7873eeb44c20a3dba2ae6542dc3270209a22145513ff994657cc130
proxmox apply.sh 660a608abbf6edd89061eb84ed24c91599c25b923b2e51f6e1e0a2683c1037ae
proxmox favicon.ico d9804011a89a75292ca3c114a730ac06b8aa3ac4a98e53b2d5650be571f7f2c8
proxmox logo-dark-theme.png 4171af235b1223c974d22b88d2b03ded748683a332ed9b6355a9188eaed8bdbd
proxmox logo-light-theme.png fd1ba7c28f144d15c2980906c5ca5979b37dfb4f78fc5492a2d479d793923e95
uptime-kuma README.md 6cd31192b0dc7b8f89f331d1c5055944656176a62058fb6e6fab2a5d3460c759
uptime-kuma logo.png 460aab318e6a5b1f2eaaef77166d375335e9ef23f6622d43671ab8de6f9c2969
uptime-kuma status-page.css 9f0f0a788acf891d9aef0159b6b300f3fba022d6ddd679e3a287fff79158d155
vaultwarden README.md 3f217f38c46102e02104012366b65a3273fd60ddb9821123d1c7ac213bd2820b
vaultwarden apply.sh 12b7c44a5bca742c77b6669d64d0ac51bc791720d1cf42a0694260632714825c
vaultwarden user.vaultwarden.scss.hbs 8a12ee15f660c26029a79baa21b720c8385ccdcf392dfaec11506a33d2d1e933'
SYS_SUM=2589bf1a4f65a83ec9ce00e90c97493542fcf4ca7ad25f4cbde26d324c58652e
USR_SUM=be9d75794313f979ee8fb8410006c8c864141463ff28685ef04917ee29bb732b
IDENTITIES='master|The Olympus
backup|Backup
community|Community
containers|Containers
game-server|Game Server
home-assistant|Home Assistant
jellyfin|Jellyfin
minecraft|Minecraft
monitoring|Monitoring
multiplayer|Multiplayer
network|Network
nextcloud|Nextcloud
proxmox|Proxmox
reverse-proxy|Reverse Proxy
storage|Storage
vpn|VPN
web|Web'

nth() { printf '%s\n' "$1" | sed -n "$2p"; }
count() { printf '%s\n' "$1" | grep -c . || true; }
has() { case " $1 " in *" $2 "*) return 0 ;; *) return 1 ;; esac; }

# ---------------------------------------------------------------- the menu

# Keys from the terminal, even when this script arrives through a pipe.
key() {
  k=$(dd bs=1 count=1 2>/dev/null </dev/tty)
  case "$k" in
    "$(printf '\033')")
      k=$(dd bs=1 count=2 2>/dev/null </dev/tty)
      case "$k" in '[A'|'OA') echo up ;; '[B'|'OB') echo down ;; *) echo esc ;; esac ;;
    '') echo enter ;;
    ' ') echo space ;;
    k|K) echo up ;;
    j|J) echo down ;;
    q|Q) echo quit ;;
    a|A) echo all ;;
    n|N) echo none ;;
    *) echo other ;;
  esac
}

tui_open() {
  TTYSTATE=$(stty -g </dev/tty)
  stty -icanon -echo min 1 time 0 </dev/tty
  printf '\033[?1049h\033[?25l' >/dev/tty
}
tui_close() {
  stty "$TTYSTATE" </dev/tty
  TTYSTATE=
  printf '\033[?25h\033[?1049l' >/dev/tty
}

B=$(printf '\033[1m'); D=$(printf '\033[2m'); R=$(printf '\033[7m'); O=$(printf '\033[0m')

# pick <title> <options, one per line> — one of them; prints its number.
pick() {
  n=$(count "$2"); c=1
  while :; do
    {
      printf '\033[H\033[2J\n  %s▲ THE OLYMPUS%s\n\n  %s\n\n' "$B" "$O" "$1"
      i=1
      while [ "$i" -le "$n" ]; do
        if [ "$i" = "$c" ]; then printf '  %s ❯ %s %s\n' "$R" "$(nth "$2" "$i")" "$O"; else printf '     %s\n' "$(nth "$2" "$i")"; fi
        i=$((i + 1))
      done
      printf '\n  %s↑ ↓ choose · enter confirm · q quit%s\n' "$D" "$O"
    } >/dev/tty
    case $(key) in
      up) [ "$c" -gt 1 ] && c=$((c - 1)) ;;
      down) [ "$c" -lt "$n" ] && c=$((c + 1)) ;;
      enter) echo "$c"; return 0 ;;
      quit|esc) return 1 ;;
    esac
  done
}

# choose <title> <ids, one per line> <ids chosen to begin with> — prints the ids chosen.
choose() {
  n=$(count "$2"); c=1; on=" $3 "; top=1
  rows=$(stty size </dev/tty 2>/dev/null | cut -d' ' -f1); rows=${rows:-24}
  room=$((rows - 12)); [ "$room" -ge 4 ] || room=4
  while :; do
    [ "$c" -lt "$top" ] && top=$c
    [ "$c" -ge $((top + room)) ] && top=$((c - room + 1))
    {
      printf '\033[H\033[2J\n  %s▲ THE OLYMPUS%s\n\n  %s\n' "$B" "$O" "$1"
      i=$top; last=
      while [ "$i" -le "$n" ] && [ "$i" -lt $((top + room)) ]; do
        id=$(nth "$2" "$i"); line=$(printf '%s\n' "$ITEMS" | grep "^$id|")
        group=$(printf '%s' "$line" | cut -d'|' -f2); label=$(printf '%s' "$line" | cut -d'|' -f3-)
        [ "$group" = "$last" ] || printf '\n  %s%s%s\n' "$B" "$group" "$O"
        last=$group
        if ! has "$FIT" "$id" && [ "$MODE" = install ]; then mark='   '; text="$D$label — $(unfit "$id")$O"
        elif has "$on" "$id"; then mark='[x]'; text=$label
        else mark='[ ]'; text=$label; fi
        if has "$INST" "$id"; then text="$text $D(installed)$O"; fi
        if [ "$i" = "$c" ]; then printf '  %s❯ %s%s %s\n' "$R" "$mark" "$O" "$text"; else printf '    %s %s\n' "$mark" "$text"; fi
        i=$((i + 1))
      done
      [ "$n" -gt "$room" ] && printf '\n  %s%s of %s%s\n' "$D" "$c" "$n" "$O"
      printf '\n  %s↑ ↓ move · space choose · a all · n none · enter continue · q quit%s\n' "$D" "$O"
    } >/dev/tty
    id=$(nth "$2" "$c")
    case $(key) in
      up) [ "$c" -gt 1 ] && c=$((c - 1)) ;;
      down) [ "$c" -lt "$n" ] && c=$((c + 1)) ;;
      space)
        if has "$on" "$id"; then on=$(printf '%s' "$on" | sed "s/ $id / /")
        elif [ "$MODE" = restore ] || has "$FIT" "$id"; then on="$on$id "; fi ;;
      all) on=" "; for x in $2; do if [ "$MODE" = restore ] || has "$FIT" "$x"; then on="$on$x "; fi; done ;;
      none) on=" " ;;
      enter) echo $on; return 0 ;;
      quit|esc) return 1 ;;
    esac
  done
}

# ask <question> <default> — a line of text.
ask() {
  tui_close
  printf '\n  %s [%s]: ' "$1" "$2" >/dev/tty
  read -r answer </dev/tty || answer=
  tui_open
  printf '%s' "${answer:-$2}"
}

# ---------------------------------------------------------------- doing it

ALL=$(printf '%s\n' "$ITEMS" | cut -d'|' -f1)

# What this machine can take, and what is installed: looked at once (some looks ask Docker).
FIT=' '
INST=' '
for id in $ALL; do
  if fits "$id" >/dev/null 2>&1; then FIT="$FIT$id "; fi
  if installed "$id" >/dev/null 2>&1; then INST="$INST$id "; fi
done

if [ "$LIST" = 1 ]; then
  for id in $ALL; do
    if has "$INST" "$id"; then s=installed; elif has "$FIT" "$id"; then s='can be installed'; else s="skipped: $(unfit "$id")"; fi
    printf '%-24s %s — %s\n' "$id" "$(printf '%s\n' "$ITEMS" | grep "^$id|" | cut -d'|' -f3-)" "$s"
  done
  exit 0
fi

[ -n "$SITE" ] || { echo "set OLYMPUS_SITE to the address of the house's site (e.g. OLYMPUS_SITE=http://olympus.lan:8080)" >&2; exit 1; }

INTERACTIVE=0
if [ "$YES" = 0 ] && [ -z "$ONLY" ]; then
  stty -g </dev/tty >/dev/null 2>&1 || { echo "no terminal to show the menu on: use --yes, --only or --list" >&2; exit 2; }
  INTERACTIVE=1
fi

CHOSEN=
if [ "$INTERACTIVE" = 1 ]; then
  tui_open
  m=$(pick 'What would you like to do?' "$(printf 'Install the house on this machine\nUndo what the house installed\nQuit')") || exit 0
  case "$m" in 1) MODE=install ;; 2) MODE=restore ;; *) exit 0 ;; esac
  if [ "$MODE" = install ]; then
    begin=; for id in $ALL; do case "$id" in doc:*) ;; *) if has "$FIT" "$id" && ! has "$INST" "$id"; then begin="$begin $id"; fi ;; esac; done
    CHOSEN=$(choose 'Choose what to install — the parts this machine cannot take are dimmed.' "$ALL" "$begin") || exit 0
  else
    begin=; for id in $ALL; do if has "$INST" "$id"; then begin="$begin $id"; fi; done
    CHOSEN=$(choose 'Choose what to undo.' "$(for id in $ALL; do case "$id" in doc:*) ;; *) echo "$id" ;; esac; done)" "$begin") || exit 0
  fi
elif [ -n "$ONLY" ]; then
  for id in $ONLY; do printf '%s\n' "$ALL" | grep -qx "$id" || { echo "unknown item: $id (see --list)" >&2; exit 2; }; done
  CHOSEN=$ONLY
else
  for id in $ALL; do
    case "$id" in doc:*) continue ;; esac
    if [ "$MODE" = restore ]; then if has "$INST" "$id"; then CHOSEN="$CHOSEN $id"; fi
    elif has "$FIT" "$id"; then CHOSEN="$CHOSEN $id"; fi
  done
fi
[ -n "$(echo $CHOSEN)" ] || { [ "$INTERACTIVE" = 1 ] && tui_close; echo "Nothing chosen."; exit 0; }

# Which identity the screens show: the master, or a service.
if [ -z "$AS" ]; then
  AS=master
  case " $CHOSEN " in *" sys:"*|*" usr:"*) screens=1 ;; *) screens=0 ;; esac
  if [ "$INTERACTIVE" = 1 ] && [ "$(count "$IDENTITIES")" -gt 1 ] && [ "$screens" = 1 ]; then
    names=$(printf '%s\n' "$IDENTITIES" | cut -d'|' -f2-)
    i=$(pick 'Whose seal should this machine show?' "$names") || exit 0
    AS=$(nth "$IDENTITIES" "$i" | cut -d'|' -f1)
  fi
fi
printf '%s\n' "$IDENTITIES" | cut -d'|' -f1 | grep -qx "$AS" || { echo "unknown identity: $AS" >&2; exit 2; }
if [ "$AS" = master ]; then BASE="$SITE/files/assets/screens/"; else BASE="$SITE/files/assets/screens/services/$AS/"; fi

# The answers each chosen kit needs.
ANSWERS=
for id in $CHOSEN; do
  env=$(ask_env "$id")
  [ -n "$env" ] || continue
  default=$(found "$id")
  if [ "$INTERACTIVE" = 1 ]; then value=$(ask "$(ask_prompt "$id")" "$default"); else value=$default; fi
  [ -n "$value" ] || { echo "$id: no answer for $(ask_prompt "$id")" >&2; exit 2; }
  ANSWERS="$ANSWERS$id=$value
"
done
[ "$INTERACTIVE" = 0 ] || tui_close

answer() { printf '%s' "$ANSWERS" | grep "^$1=" | head -n 1 | cut -d= -f2-; }
fetch() { # fetch <url> <file> [<sha256>]
  get "$1" "$2" || { echo "could not fetch $1" >&2; exit 1; }
  if [ -n "${3:-}" ] && [ "$(sum "$2")" != "$3" ]; then echo "$1 does not match its checksum: not using it" >&2; exit 1; fi
}

echo
FAILED=
DONE=

# The machine's parts, through the screens' own installer (as root).
SYS=; for id in $CHOSEN; do case "$id" in sys:*) SYS="$SYS ${id#sys:}" ;; esac; done
if [ -n "$SYS" ]; then
  if [ "$AS" = master ]; then fetch "${BASE}install.sh" "$TMP/system.sh" "$SYS_SUM"; else fetch "${BASE}install.sh" "$TMP/system.sh"; fi
  flag=; [ "$MODE" = restore ] && flag=--restore
  # shellcheck disable=SC2086
  if $SUDO env OLYMPUS_FROM="$BASE" sh "$TMP/system.sh" $flag $SYS; then DONE="$DONE$SYS"; else FAILED="$FAILED$SYS"; fi
fi

# Your terminal's parts, as you.
USR=; for id in $CHOSEN; do case "$id" in usr:*) USR="$USR ${id#usr:}" ;; esac; done
if [ -n "$USR" ]; then
  if [ "$AS" = master ]; then fetch "${BASE}shell/install.sh" "$TMP/user.sh" "$USR_SUM"; else fetch "${BASE}shell/install.sh" "$TMP/user.sh"; fi
  [ "$(id -u)" != 0 ] || echo "note: running as root, so the terminal parts go to root's own terminal" >&2
  flag=; [ "$MODE" = restore ] && flag=--restore
  # shellcheck disable=SC2086
  if OLYMPUS_FROM="${BASE}shell/" sh "$TMP/user.sh" $flag $USR; then DONE="$DONE$USR"; else FAILED="$FAILED$USR"; fi
fi

# A kit's files, each checked: <folder> <into>.
kit_files() {
  printf '%s\n' "$KITS" | while read -r dir path s; do
    [ "$dir" = "$1" ] || continue
    mkdir -p "$2/$(dirname "$path")"
    fetch "$SITE/files/assets/integrations/themes/$dir/$path" "$2/$path" "$s"
  done
}

# Applications: each kit's own apply.sh, with what was asked.
for id in $CHOSEN; do
  case "$id" in
    kit:*)
      dir=${id#kit:}; into="$TMP/kit-$dir"
      kit_files "$dir" "$into"
      env=$(ask_env "$id"); set --
      [ -z "$env" ] || set -- "$env=$(answer "$id")"
      if [ "$MODE" = restore ]; then args=--restore; else args=$(kit_args "$id"); fi
      echo "· $dir"
      # shellcheck disable=SC2086
      if $SUDO env "$@" sh "$into/apply.sh" $args; then DONE="$DONE $dir"; else FAILED="$FAILED $dir"; fi ;;
    doc:*)
      dir=${id#doc:}; into="./the-olympus-$dir"
      [ ! -e "$into" ] || { echo "$into already exists: not overwriting it" >&2; FAILED="$FAILED $dir"; continue; }
      kit_files "$dir" "$TMP/doc-$dir"
      cp -R "$TMP/doc-$dir" "$into"
      echo "· $dir: files and guide (README.md) saved in $into"
      DONE="$DONE $dir" ;;
  esac
done

echo
if [ "$MODE" = restore ]; then word=Undone; else word=Done; fi
[ -z "$DONE" ] || echo "$word:$DONE"
if [ -n "$FAILED" ]; then echo "Failed:$FAILED" >&2; exit 1; fi
