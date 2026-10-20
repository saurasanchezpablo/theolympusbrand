#!/bin/sh
# The Olympus — the crest in the terminal. Run as root.
#
#   sh install.sh            message of the day, console login (/etc/issue) and SSH banner
#   sh install.sh --ascii    the same, drawn in ASCII instead of braille
#   sh install.sh --restore  remove them and put /etc/issue back
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
MOTD=/etc/update-motd.d/20-the-olympus
BANNER=/etc/ssh/the-olympus-banner
DROPIN=/etc/ssh/sshd_config.d/the-olympus.conf
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

reload_ssh() {
  if command -v sshd >/dev/null 2>&1 && ! sshd -t; then
    echo "sshd rejected the configuration; the banner was removed" >&2
    rm -f "$DROPIN"
    return 1
  fi
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
}

if [ "${1:-}" = "--restore" ]; then
  rm -f "$MOTD" "$BANNER" "$DROPIN" /etc/default/the-olympus
  [ -f /etc/issue.the-olympus.orig ] && mv /etc/issue.the-olympus.orig /etc/issue
  reload_ssh || true
  echo "Removed."
  exit 0
fi
art=braille
case "${1:-}" in
  "") ;;
  --ascii) art=ascii ;;
  *) echo "unknown option: $1" >&2; exit 2 ;;
esac

# Message of the day (Debian, Ubuntu, Proxmox VE: run by pam_motd at login).
if [ -d /etc/update-motd.d ]; then
  install -m 755 "$DIR/20-the-olympus" "$MOTD"
  echo "OLYMPUS_ART=$art" > /etc/default/the-olympus
else
  echo "no /etc/update-motd.d: copy motd-$art.txt to /etc/motd instead" >&2
fi

# Console login.
[ -f /etc/issue.the-olympus.orig ] || cp -p /etc/issue /etc/issue.the-olympus.orig
install -m 644 "$DIR/issue" /etc/issue

# SSH banner, shown before the password prompt — only where sshd reads drop-in files.
if [ -d /etc/ssh/sshd_config.d ] && grep -qi '^Include /etc/ssh/sshd_config.d/' /etc/ssh/sshd_config 2>/dev/null; then
  install -m 644 "$DIR/issue.net" "$BANNER"
  echo "Banner $BANNER" > "$DROPIN"
  reload_ssh
else
  echo "sshd does not read /etc/ssh/sshd_config.d: set 'Banner' to issue.net by hand" >&2
fi
echo "Done. Log in again to see it."
