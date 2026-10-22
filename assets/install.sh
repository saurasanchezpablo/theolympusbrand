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
#   --set NAME=VALUE  where an application is, instead of what was found (the
#                     names are in --list: NEXTCLOUD_CONTAINER=…, OCC=…, HA_CONFIG=…)
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
SETS=
while [ $# -gt 0 ]; do
  case "$1" in
    --site) SITE=${2:?--site needs an address}; shift ;;
    --yes) YES=1 ;;
    --list) LIST=1 ;;
    --only) ONLY=$(printf '%s' "${2:?--only needs ids}" | tr ',' ' '); shift ;;
    --restore) MODE=restore ;;
    --as) AS=${2:?--as needs an identity}; shift ;;
    --set)
      case "${2:-}" in
        [A-Z]*=*) SETS="$SETS$2
" ;;
        *) echo "--set needs NAME=VALUE" >&2; exit 2 ;;
      esac
      shift ;;
    -h|--help) sed -n '2,24p' "$0" 2>/dev/null || true; exit 0 ;;
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
kit:home-assistant|Applications|Home Assistant — the theme, light and dark, and the dashboard images
kit:nextcloud|Applications|Nextcloud — name, colours, logos and background, through occ
kit:proxmox|Applications|Proxmox VE — the whole web interface in greys, the logo and the icon
kit:vaultwarden|Applications|Vaultwarden — greys for the web vault, and the house’s logo
doc:grafana|Applications set up by hand|Grafana — save its files and guide to ./the-olympus-grafana/
doc:jellyfin|Applications set up by hand|Jellyfin — save its files and guide to ./the-olympus-jellyfin/
doc:navidrome|Applications set up by hand|Navidrome — save its files and guide to ./the-olympus-navidrome/
doc:uptime-kuma|Applications set up by hand|Uptime Kuma — save its files and guide to ./the-olympus-uptime-kuma/'
GROUPS='The machine
Your terminal
Applications
Applications set up by hand'

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

# How to look at the machine (see look below).
PROBE_SYS='containers() {
  { docker ps --format '\''{{.Names}} {{.Image}}'\''; podman ps --format '\''{{.Names}} {{.Image}}'\''; } 2>/dev/null | grep . || sudo -n docker ps --format '\''{{.Names}} {{.Image}}'\'' 2>/dev/null
}
if ( [ -f /etc/default/grub ] ) >/dev/null 2>&1; then echo '\''fit sys:grub'\''; fi
if ( [ -f /etc/default/grub.the-olympus.orig ] ) >/dev/null 2>&1; then echo '\''inst sys:grub'\''; fi
if ( ( for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do [ -f "$c" ] && exit 0; done; [ -n "$(find /boot /efi /boot/efi -maxdepth 4 -name limine.conf -type f 2>/dev/null | head -n 1)" ] && exit 0; [ "$(id -u)" != 0 ] || exit 1; [ -f /var/lib/the-olympus/limine ] || command -v limine >/dev/null 2>&1 || [ -d /usr/share/limine ] || [ -f /etc/default/limine ] || command -v limine-entry-tool >/dev/null 2>&1 || command -v limine-update >/dev/null 2>&1 ) ) >/dev/null 2>&1; then echo '\''fit sys:limine'\''; fi
if ( ( [ -f /var/lib/the-olympus/limine ] && exit 0; for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do grep -qsF "# The Olympus — begin" "$c" && exit 0; done; exit 1 ) ) >/dev/null 2>&1; then echo '\''inst sys:limine'\''; fi
if ( command -v plymouth-set-default-theme >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit sys:plymouth'\''; fi
if ( [ -d /usr/share/plymouth/themes/the-olympus ] ) >/dev/null 2>&1; then echo '\''inst sys:plymouth'\''; fi
if ( [ -f /etc/issue ] ) >/dev/null 2>&1; then echo '\''fit sys:terminal'\''; fi
if ( [ -f /etc/update-motd.d/20-the-olympus ] || [ -f /etc/motd.d/the-olympus ] || [ -f /etc/issue.the-olympus.orig ] ) >/dev/null 2>&1; then echo '\''inst sys:terminal'\''; fi
if ( [ -d /usr/share/xsessions ] || [ -d /usr/share/wayland-sessions ] ) >/dev/null 2>&1; then echo '\''fit sys:wallpapers'\''; fi
if ( [ -d /usr/share/backgrounds/the-olympus ] ) >/dev/null 2>&1; then echo '\''inst sys:wallpapers'\''; fi
if ( true ) >/dev/null 2>&1; then echo '\''fit kit:home-assistant'\''; fi
if ( false ) >/dev/null 2>&1; then echo '\''inst kit:home-assistant'\''; fi
if ( true ) >/dev/null 2>&1; then echo '\''fit kit:nextcloud'\''; fi
if ( false ) >/dev/null 2>&1; then echo '\''inst kit:nextcloud'\''; fi
if ( command -v pveversion >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit kit:proxmox'\''; fi
if ( grep -qsF /pve2/css/the-olympus.css /usr/share/pve-manager/index.html.tpl || [ -f /usr/local/share/the-olympus/proxmox/settings ] ) >/dev/null 2>&1; then echo '\''inst kit:proxmox'\''; fi
if ( true ) >/dev/null 2>&1; then echo '\''fit kit:vaultwarden'\''; fi
if ( false ) >/dev/null 2>&1; then echo '\''inst kit:vaultwarden'\''; fi
if ( true ) >/dev/null 2>&1; then echo '\''fit doc:grafana'\''; fi
if ( false ) >/dev/null 2>&1; then echo '\''inst doc:grafana'\''; fi
if ( true ) >/dev/null 2>&1; then echo '\''fit doc:jellyfin'\''; fi
if ( false ) >/dev/null 2>&1; then echo '\''inst doc:jellyfin'\''; fi
if ( true ) >/dev/null 2>&1; then echo '\''fit doc:navidrome'\''; fi
if ( false ) >/dev/null 2>&1; then echo '\''inst doc:navidrome'\''; fi
if ( true ) >/dev/null 2>&1; then echo '\''fit doc:uptime-kuma'\''; fi
if ( false ) >/dev/null 2>&1; then echo '\''inst doc:uptime-kuma'\''; fi
v=$( ( containers | awk '\''tolower($2) ~ /home-?assistant/ && tolower($2) !~ /addon|supervisor|observer|-dns|-audio|-cli|-multicast/ { print $1; exit }'\'' ) 2>/dev/null | head -n 1 ); [ -z "$v" ] || printf '\''at %s %s %s\n'\'' '\''kit:home-assistant'\'' '\''HA_CONTAINER'\'' "$v"
v=$( ( for d in /config /homeassistant /var/lib/hass /home/homeassistant/.homeassistant /srv/homeassistant /srv/homeassistant/config /opt/homeassistant/config /usr/share/hassio/homeassistant; do if [ -f "$d/configuration.yaml" ]; then echo "$d"; exit 0; fi; done ) 2>/dev/null | head -n 1 ); [ -z "$v" ] || printf '\''at %s %s %s\n'\'' '\''kit:home-assistant'\'' '\''HA_CONFIG'\'' "$v"
v=$( ( c=$(containers | awk '\''tolower($2) ~ /aio-nextcloud/ { print $1; exit }'\''); [ -n "$c" ] || c=$(containers | awk '\''tolower($2) ~ /nextcloud/ && tolower($2) !~ /all-in-one|aio-/ { print $1; exit }'\''); echo "$c" ) 2>/dev/null | head -n 1 ); [ -z "$v" ] || printf '\''at %s %s %s\n'\'' '\''kit:nextcloud'\'' '\''NEXTCLOUD_CONTAINER'\'' "$v"
v=$( ( if command -v nextcloud.occ >/dev/null 2>&1; then echo nextcloud.occ; exit 0; fi
if [ -f /usr/share/webapps/nextcloud/occ ] && command -v occ >/dev/null 2>&1; then echo occ; exit 0; fi
for f in /var/www/nextcloud/occ /var/www/html/nextcloud/occ /var/www/html/occ /srv/www/nextcloud/occ /srv/http/nextcloud/occ /usr/local/www/nextcloud/occ; do
  [ -f "$f" ] || continue
  u=$(stat -c %U "${f%/occ}/config/config.php" 2>/dev/null || stat -c %U "$f" 2>/dev/null || echo www-data)
  if command -v sudo >/dev/null 2>&1; then echo "sudo -u $u php $f"; else echo "runuser -u $u -- php $f"; fi; exit 0
done ) 2>/dev/null | head -n 1 ); [ -z "$v" ] || printf '\''at %s %s %s\n'\'' '\''kit:nextcloud'\'' '\''OCC'\'' "$v"
v=$( ( containers | awk '\''tolower($2) ~ /vaultwarden/ { print $1; exit }'\'' ) 2>/dev/null | head -n 1 ); [ -z "$v" ] || printf '\''at %s %s %s\n'\'' '\''kit:vaultwarden'\'' '\''VAULTWARDEN_CONTAINER'\'' "$v"
v=$( ( for d in /var/lib/vaultwarden /opt/vaultwarden/data /srv/vaultwarden/data /vw-data /opt/vaultwarden /srv/vaultwarden; do if [ -f "$d/db.sqlite3" ] || [ -f "$d/rsa_key.pem" ] || [ -f "$d/config.json" ]; then echo "$d"; exit 0; fi; done ) 2>/dev/null | head -n 1 ); [ -z "$v" ] || printf '\''at %s %s %s\n'\'' '\''kit:vaultwarden'\'' '\''VAULTWARDEN_DATA'\'' "$v"'
PROBE_USR='if ( command -v bash >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:bash'\''; fi
if ( grep -qsF '\''# The Olympus prompt'\'' "$HOME/.bashrc" ) >/dev/null 2>&1; then echo '\''inst usr:bash'\''; fi
if ( command -v fish >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:fish'\''; fi
if ( [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/fish/conf.d/the-olympus.fish ] ) >/dev/null 2>&1; then echo '\''inst usr:fish'\''; fi
if ( command -v fastfetch >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:fastfetch'\''; fi
if ( [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/fastfetch/the-olympus.jsonc ] ) >/dev/null 2>&1; then echo '\''inst usr:fastfetch'\''; fi
if ( command -v tmux >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:tmux'\''; fi
if ( [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/tmux/the-olympus.conf ] ) >/dev/null 2>&1; then echo '\''inst usr:tmux'\''; fi
if ( command -v gnome-terminal >/dev/null 2>&1 && command -v dconf >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:gnome-terminal'\''; fi
if ( dconf read /org/gnome/terminal/legacy/profiles:/list 2>/dev/null | grep -q 7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11 ) >/dev/null 2>&1; then echo '\''inst usr:gnome-terminal'\''; fi
if ( command -v ptyxis >/dev/null 2>&1 || [ -d "$HOME/.var/app/app.devsuite.Ptyxis" ] ) >/dev/null 2>&1; then echo '\''fit usr:ptyxis'\''; fi
if ( [ -f "${XDG_DATA_HOME:-$HOME/.local/share}"/org.gnome.Ptyxis/palettes/the-olympus.palette ] || [ -f "$HOME/.var/app/app.devsuite.Ptyxis/data/org.gnome.Ptyxis/palettes/the-olympus.palette" ] ) >/dev/null 2>&1; then echo '\''inst usr:ptyxis'\''; fi
if ( command -v kitty >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:kitty'\''; fi
if ( [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/kitty/the-olympus.conf ] ) >/dev/null 2>&1; then echo '\''inst usr:kitty'\''; fi
if ( command -v alacritty >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:alacritty'\''; fi
if ( [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/alacritty/the-olympus.toml ] ) >/dev/null 2>&1; then echo '\''inst usr:alacritty'\''; fi
if ( command -v omarchy-theme-set >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:omarchy'\''; fi
if ( [ -d "${XDG_CONFIG_HOME:-$HOME/.config}"/omarchy/themes/the-olympus ] ) >/dev/null 2>&1; then echo '\''inst usr:omarchy'\''; fi
if ( command -v wezterm >/dev/null 2>&1 ) >/dev/null 2>&1; then echo '\''fit usr:wezterm'\''; fi
if ( [ -f "${XDG_CONFIG_HOME:-$HOME/.config}"/wezterm/colors/the-olympus.toml ] ) >/dev/null 2>&1; then echo '\''inst usr:wezterm'\''; fi'

# Where an application can be: <VARIABLE>|<how the menu says it>|<the question>, a line each.
places() {
  case "$1" in
    kit:home-assistant) printf '%s\n' 'HA_CONTAINER|In a Docker or Podman container|Home Assistant’s container
HA_CONFIG|In a folder on this machine|Home Assistant’s config folder (where configuration.yaml is)' ;;
    kit:nextcloud) printf '%s\n' 'NEXTCLOUD_CONTAINER|In a Docker or Podman container|Nextcloud’s container
OCC|Installed on this machine (occ)|The occ command, as the web server’s user' ;;
    kit:vaultwarden) printf '%s\n' 'VAULTWARDEN_CONTAINER|In a Docker or Podman container|Vaultwarden’s container
VAULTWARDEN_DATA|In a folder on this machine|Vaultwarden’s data folder (where db.sqlite3 is)' ;;
    *) true ;;
  esac
}
kit_name() {
  case "$1" in
    kit:home-assistant) echo 'Home Assistant' ;;
    kit:nextcloud) echo 'Nextcloud' ;;
    kit:proxmox) echo 'Proxmox VE' ;;
    kit:vaultwarden) echo 'Vaultwarden' ;;
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
kit_root() {
  case "$1" in
    kit:home-assistant) return 0 ;;
    kit:nextcloud) return 0 ;;
    kit:proxmox) return 0 ;;
    kit:vaultwarden) return 0 ;;
    *) return 1 ;;
  esac
}

# Every file of every kit, and its SHA-256: <folder> <path> <sum>.
KITS='grafana README.md aecb7d42b81b6e44810bfe122838d45e8a02c0e70d9bf9d0b769ee17ce2e07ab
grafana apple-touch-icon.png d2e76ebee81c5a44139e0f392183b7b88e179fb183973592fd07eeb0520ed64d
grafana docker-compose.override.yml b527ed6e165540fb4b9183660379a6e356232ffd01d292515cb539140429f4be
grafana fav32.png 90012fce4405b9c0d0cca7a7fa7b38f28f2820397a5f781a7c10edbc65cf9906
grafana grafana_icon.svg 9b349ca9cf892a17c88c393a79f931af70d9121b50ee309c9954204ec2beaeef
home-assistant README.md ba910bb3d2d055812600ab9802ef0be43ed1d133b5e743105f823c3f19e0604c
home-assistant apply.sh 7c8ac991ea9d2808eb8fabd26ee54b07f7a4fa9440e262fa6ef0ec672ac0b429
home-assistant picture-card.yaml 611df18fc5bca5eeecec36533b734b5d12cd5e9a96f8a006f0d8c2415bf984b5
home-assistant the-olympus.yaml 71979f56a5fcfc2f2a0790d4517a1f995b0b977e5255f46e7b88cd0128f383d1
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
nextcloud README.md 5192d33d31161db3c98267ba67970e4a538a677b881f5244cc456c446245ef66
nextcloud apply.sh 5e1f9d87bc3f1d3b6c34dde0bb66728ba8613148e1aabb71c4fa473fbc12ca83
nextcloud background.png 19be095e307a0cfff99ee0f9d0182a481f0600f48dd0e77184a827ca5b1f8e15
nextcloud custom.css e9637abd48717e8b8f15856f9d39837aea7e7bf361eae6db3632d88462bab475
nextcloud favicon.png e4c5469c3d0da20ae3df859e29f05143e79be4e15c632c0548ee35c87a6a32f5
nextcloud logo.svg 5bc6f0060adcb6d850981d2bcbfa6a2cd182d0f6a4cd7db4a2b73af92ca07783
nextcloud logoheader.svg 3d7840c1b2eb718036fd5fea4f9d7890a3ffc2523a879a6f84e21851490927b3
proxmox README.md 307ed5ef3e7ea87d594bcda9c154397964644262b15fc61dc37ee9f5e2ee9af2
proxmox apply.sh e1abffc3bd379b5ade9ffc8035202ef51776f3aa4aafda7719b71bb394b31298
proxmox favicon.ico d9804011a89a75292ca3c114a730ac06b8aa3ac4a98e53b2d5650be571f7f2c8
proxmox layer.css ec4d10635a5d12319cdc4108d613692f59f23f2b16a4a9103127242913175da8
proxmox logo-128.png 38a9823c702dc6f563b001df87e7ad155b28dc990eb1a0cfefb7dff6243b06db
proxmox logo-dark-theme.png bf0101cb2ae77cce759b877e89c321d79e80c128f4238f0c05b3087b14c7572b
proxmox logo-dark-theme.svg bd0dff1b4ef03c89771495068775b1718ef5da464650f78f9eb9db82b3ef0556
proxmox logo-light-theme.png 054de4ebf75990024a2e33dbc84f41c207c9fffb5e080402a1a56f6032845e32
proxmox logo-light-theme.svg 617d195bb13c31dff16b6f74bc476978d48b36c3255795098d864eedeb750f97
uptime-kuma README.md 6cd31192b0dc7b8f89f331d1c5055944656176a62058fb6e6fab2a5d3460c759
uptime-kuma logo.png 460aab318e6a5b1f2eaaef77166d375335e9ef23f6622d43671ab8de6f9c2969
uptime-kuma status-page.css 9f0f0a788acf891d9aef0159b6b300f3fba022d6ddd679e3a287fff79158d155
vaultwarden README.md 3f217f38c46102e02104012366b65a3273fd60ddb9821123d1c7ac213bd2820b
vaultwarden apply.sh 17f23e0ccecddb0edd5fda14222958cb9e4867624ae22381b69377305d1b16f7
vaultwarden user.vaultwarden.scss.hbs 8a12ee15f660c26029a79baa21b720c8385ccdcf392dfaec11506a33d2d1e933'
SYS_SUM=a3c8dd480b8319df778bbecfffdcc5555359f4ae4579ff3daa6fd07df736c5e6
USR_SUM=710272641366d22f7539e6c10daadda8197337e781a9ca23238483ae31d7c4ce
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
        if has "$INST" "$id"; then text="$text $D(installed)$O"
        elif [ -n "$(places "$id")" ] && [ "$MODE" = install ]; then
          if w=$(where "$id"); then text="$text $D— found: ${w#* }$O"; else text="$text $D— not found here: you will say where$O"; fi
        fi
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

# What this machine can take, what is in place, and where its applications are: looked at
# once, as root when that needs no password (the boot partition and Docker are root's),
# your terminal's parts as you.
look() {
  if [ -z "$SUDO" ]; then sh -c "$PROBE_SYS"
  elif sudo -n true 2>/dev/null; then sudo -n sh -c "$PROBE_SYS"
  else sh -c "$PROBE_SYS"; fi
  sh -c "$PROBE_USR"
}
seen() {
  SEEN=$(look)
  FIT=" $(printf '%s\n' "$SEEN" | awk '$1 == "fit" { printf "%s ", $2 }')"
  INST=" $(printf '%s\n' "$SEEN" | awk '$1 == "inst" { printf "%s ", $2 }')"
}
seen
# where <id> [<VARIABLE>] — "<VARIABLE> <where>" of what was found for a kit (the first of its places, or that one).
where() { printf '%s\n' "$SEEN" | awk -v id="$1" -v v="${2:-}" '$1 == "at" && $2 == id && (v == "" || $3 == v) { sub(/^at [^ ]+ /, ""); print; f = 1; exit } END { exit !f }'; }
# given <VARIABLE> — what --set or the environment says.
given() {
  g=$(printf '%s' "$SETS" | grep "^$1=" | tail -n 1 | cut -d= -f2-)
  [ -n "$g" ] || eval "g=\${$1:-}"
  printf '%s' "$g"
}

if [ "$LIST" = 1 ]; then
  for id in $ALL; do
    if has "$INST" "$id"; then s=installed; elif ! has "$FIT" "$id"; then s="skipped: $(unfit "$id")"
    elif [ -n "$(places "$id")" ]; then
      if w=$(where "$id"); then s="can be installed — found: ${w#* } (${w%% *})"
      else s="can be installed — not found here: say where with $(places "$id" | cut -d'|' -f1 | sed 's/^/--set /; s/$/=…/' | paste -sd' ' - | sed 's/ --set/ or --set/g')"; fi
    else s='can be installed'; fi
    printf '%-24s %s — %s\n' "$id" "$(printf '%s\n' "$ITEMS" | grep "^$id|" | cut -d'|' -f3-)" "$s"
  done
  [ -z "$SUDO" ] || sudo -n true 2>/dev/null || echo "(looked as you: with sudo it can also look into the boot partition and Docker)"
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
    begin=; for id in $ALL; do case "$id" in doc:*) ;; *) if has "$FIT" "$id" && ! has "$INST" "$id" && { [ -z "$(places "$id")" ] || where "$id" >/dev/null; }; then begin="$begin $id"; fi ;; esac; done
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
    elif has "$FIT" "$id" && { [ -z "$(places "$id")" ] || where "$id" >/dev/null; }; then CHOSEN="$CHOSEN $id"; fi
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

# Root, once, before anything is asked: with it the applications are looked for again
# (Docker and their folders are often root's alone), so what is asked starts from what is there.
needs_root=0
for id in $CHOSEN; do case "$id" in sys:*) needs_root=1 ;; kit:*) if kit_root "$id"; then needs_root=1; fi ;; esac; done
if [ -n "$SUDO" ] && [ "$needs_root" = 1 ] && ! sudo -n true 2>/dev/null && [ "$INTERACTIVE" = 1 ]; then
  tui_close
  printf '\n  Some of this is done as root: sudo asks for your password once.\n\n'
  sudo -v || exit 1
  tui_open
fi
case " $CHOSEN " in *" kit:"*) if [ -n "$SUDO" ] && sudo -n true 2>/dev/null; then seen; fi ;; esac

# Where each chosen application is: what --set or the environment says, else what was found
# (asked to confirm, in the menu), else asked.
ANSWERS=
SKIP=' '
for id in $CHOSEN; do
  pl=$(places "$id")
  [ -n "$pl" ] || continue
  var=; value=
  for v in $(printf '%s\n' "$pl" | cut -d'|' -f1); do
    g=$(given "$v"); if [ -n "$g" ]; then var=$v; value=$g; break; fi
  done
  if [ -z "$var" ] && [ "$INTERACTIVE" = 1 ]; then
    name=$(kit_name "$id")
    opts=$(printf '%s\n' "$pl" | while IFS='|' read -r v label prompt; do
      if w=$(where "$id" "$v"); then printf '%s — found: %s\n' "$label" "${w#* }"; else printf '%s\n' "$label"; fi
    done; printf 'Skip %s\n' "$name")
    i=$(pick "Where is $name?" "$opts") || exit 0
    if [ "$i" -gt "$(count "$pl")" ]; then SKIP="$SKIP$id "; continue; fi
    line=$(nth "$pl" "$i"); var=${line%%|*}; prompt=${line##*|}
    w=$(where "$id" "$var") || w=
    value=$(ask "$prompt" "${w#* }")
  elif [ -z "$var" ]; then
    if w=$(where "$id"); then var=${w%% *}; value=${w#* }; fi
  fi
  if [ -z "$value" ]; then
    echo "$id: $(kit_name "$id") was not found here — say where with $(printf '%s\n' "$pl" | cut -d'|' -f1 | sed 's/^/--set /; s/$/=…/' | paste -sd' ' - | sed 's/ --set/ or --set/g')" >&2
    [ "$INTERACTIVE" = 0 ] || tui_close
    exit 2
  fi
  ANSWERS="$ANSWERS$id $var=$value
"
done
[ "$INTERACTIVE" = 0 ] || tui_close

answer() { printf '%s' "$ANSWERS" | grep "^$1 " | head -n 1 | cut -d' ' -f2-; }
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
      has "$SKIP" "$id" && continue
      dir=${id#kit:}; into="$TMP/kit-$dir"
      kit_files "$dir" "$into"
      set --
      a=$(answer "$id"); [ -z "$a" ] || set -- "$a"
      if [ "$MODE" = restore ]; then args=--restore; else args=$(kit_args "$id"); fi
      if kit_root "$id"; then as=$SUDO; else as=; fi
      echo "· $dir${a:+ ($a)}"
      # shellcheck disable=SC2086
      if $as env "$@" sh "$into/apply.sh" $args; then DONE="$DONE $dir"; else FAILED="$FAILED $dir"; fi ;;
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
