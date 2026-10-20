#!/bin/sh
# The Olympus — wallpapers, offered in the desktop's own picker. Run as root.
#
#   sh install.sh            GNOME, Cinnamon and MATE (Settings → Background) and KDE Plasma
#   sh install.sh --restore  remove them
#
# They are added to the choices; nobody's current wallpaper is changed.
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
DEST=/usr/share/backgrounds/the-olympus
GNOME=/usr/share/gnome-background-properties/the-olympus.xml
KDE=/usr/share/wallpapers
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

if [ "${1:-}" = "--restore" ]; then
  rm -rf "$DEST" "$GNOME" "$KDE/TheOlympus-Marble" "$KDE/TheOlympus-MarbleLight" "$KDE/TheOlympus-Graphite" "$KDE/TheOlympus-Blueprint"
  echo "The wallpapers are removed. Anyone using one keeps a blank background until they choose another."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }

mkdir -p "$DEST"
for f in "$DIR"/*.png; do install -m 644 "$f" "$DEST/"; done
mkdir -p "$(dirname "$GNOME")"
install -m 644 "$DIR/the-olympus-wallpapers.xml" "$GNOME"
mkdir -p "$KDE/TheOlympus-Marble"/contents/images
ln -sf "$DEST/the-olympus-master-wallpaper-marble-1080p.png" "$KDE/TheOlympus-Marble"/contents/images/1920x1080.png
ln -sf "$DEST/the-olympus-master-wallpaper-marble-1440p.png" "$KDE/TheOlympus-Marble"/contents/images/2560x1440.png
ln -sf "$DEST/the-olympus-master-wallpaper-marble-4k.png" "$KDE/TheOlympus-Marble"/contents/images/3840x2160.png
ln -sf "$DEST/the-olympus-master-wallpaper-marble-ultrawide.png" "$KDE/TheOlympus-Marble"/contents/images/3440x1440.png
ln -sf "$DEST/the-olympus-master-wallpaper-marble-phone.png" "$KDE/TheOlympus-Marble"/contents/images/1179x2556.png
printf '%s\n' '{"KPlugin":{"Id":"TheOlympus-Marble","Name":"The Olympus — Black marble","Authors":[{"Name":"The Olympus"}],"License":"All rights reserved"}}' > "$KDE/TheOlympus-Marble"/metadata.json
mkdir -p "$KDE/TheOlympus-MarbleLight"/contents/images
ln -sf "$DEST/the-olympus-master-wallpaper-marble-light-1080p.png" "$KDE/TheOlympus-MarbleLight"/contents/images/1920x1080.png
ln -sf "$DEST/the-olympus-master-wallpaper-marble-light-1440p.png" "$KDE/TheOlympus-MarbleLight"/contents/images/2560x1440.png
ln -sf "$DEST/the-olympus-master-wallpaper-marble-light-4k.png" "$KDE/TheOlympus-MarbleLight"/contents/images/3840x2160.png
ln -sf "$DEST/the-olympus-master-wallpaper-marble-light-ultrawide.png" "$KDE/TheOlympus-MarbleLight"/contents/images/3440x1440.png
ln -sf "$DEST/the-olympus-master-wallpaper-marble-light-phone.png" "$KDE/TheOlympus-MarbleLight"/contents/images/1179x2556.png
printf '%s\n' '{"KPlugin":{"Id":"TheOlympus-MarbleLight","Name":"The Olympus — White marble","Authors":[{"Name":"The Olympus"}],"License":"All rights reserved"}}' > "$KDE/TheOlympus-MarbleLight"/metadata.json
mkdir -p "$KDE/TheOlympus-Graphite"/contents/images
ln -sf "$DEST/the-olympus-master-wallpaper-graphite-1080p.png" "$KDE/TheOlympus-Graphite"/contents/images/1920x1080.png
ln -sf "$DEST/the-olympus-master-wallpaper-graphite-1440p.png" "$KDE/TheOlympus-Graphite"/contents/images/2560x1440.png
ln -sf "$DEST/the-olympus-master-wallpaper-graphite-4k.png" "$KDE/TheOlympus-Graphite"/contents/images/3840x2160.png
ln -sf "$DEST/the-olympus-master-wallpaper-graphite-ultrawide.png" "$KDE/TheOlympus-Graphite"/contents/images/3440x1440.png
ln -sf "$DEST/the-olympus-master-wallpaper-graphite-phone.png" "$KDE/TheOlympus-Graphite"/contents/images/1179x2556.png
printf '%s\n' '{"KPlugin":{"Id":"TheOlympus-Graphite","Name":"The Olympus — Graphite","Authors":[{"Name":"The Olympus"}],"License":"All rights reserved"}}' > "$KDE/TheOlympus-Graphite"/metadata.json
mkdir -p "$KDE/TheOlympus-Blueprint"/contents/images
ln -sf "$DEST/the-olympus-master-wallpaper-blueprint-1080p.png" "$KDE/TheOlympus-Blueprint"/contents/images/1920x1080.png
ln -sf "$DEST/the-olympus-master-wallpaper-blueprint-1440p.png" "$KDE/TheOlympus-Blueprint"/contents/images/2560x1440.png
ln -sf "$DEST/the-olympus-master-wallpaper-blueprint-4k.png" "$KDE/TheOlympus-Blueprint"/contents/images/3840x2160.png
ln -sf "$DEST/the-olympus-master-wallpaper-blueprint-ultrawide.png" "$KDE/TheOlympus-Blueprint"/contents/images/3440x1440.png
ln -sf "$DEST/the-olympus-master-wallpaper-blueprint-phone.png" "$KDE/TheOlympus-Blueprint"/contents/images/1179x2556.png
printf '%s\n' '{"KPlugin":{"Id":"TheOlympus-Blueprint","Name":"The Olympus — Blueprint","Authors":[{"Name":"The Olympus"}],"License":"All rights reserved"}}' > "$KDE/TheOlympus-Blueprint"/metadata.json
echo "The wallpapers are in the desktop's background settings."
