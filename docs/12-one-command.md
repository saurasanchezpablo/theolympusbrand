# 12 — One command for a machine

Everything the house can install on a machine, from one command:

```sh
curl -fsSL http://<site>/install.sh | OLYMPUS_SITE=http://<site> sh
```

It runs on any Linux machine, on a Mac, and in WSL — anywhere with a POSIX
shell, `curl` or `wget`, and `sha256sum` or `shasum`. Nothing else is
installed first.

## The menu

The command opens a menu in the terminal (it reads the keys from the
terminal, so it works through the pipe from `curl`):

1. **Install** or **Undo**.
2. **What**, in three groups — each item ticked to begin with when this
   machine can take it, dimmed with the reason when it cannot:
   - *The machine* — the GRUB background, the Limine boot menu, the Plymouth
     boot splash, the crest at login and on the console, the wallpapers in the
     desktop's own picker (as root: the command asks for `sudo` only for these);
   - *Your terminal* — the prompt for bash or fish, fastfetch, tmux, the
     colours of GNOME Terminal, Ptyxis, kitty, Alacritty or WezTerm, and the
     Omarchy theme (as you, in your home folder);
   - *Applications* — the theme of Proxmox VE, Nextcloud, Home Assistant or
     Vaultwarden. Proxmox VE is found by its tools. The others can be
     anywhere, so each says where it was found — a Docker or Podman
     container, or a folder or `occ` on this machine — and can be chosen even
     when it was not: the command then asks where it is (see below).
     *Applications set up by hand* (Jellyfin, Grafana, Uptime Kuma,
     Navidrome) have their files and guide saved in a folder beside you.
3. **Whose seal** the screens show — the house's, or a service's (for a
   machine that runs one service).

For each application chosen, it asks **where** it is: one line per way it can
be — *In a Docker or Podman container — found: nextcloud-aio-nextcloud*,
*Installed on this machine (occ)*, … — then the name or path, starting from
what it found. Type another to use another; *Skip* leaves the application out.

↑ and ↓ move, space ticks, *a* ticks everything, *n* nothing, Enter goes on,
*q* leaves without changing anything. The menu uses no colour: bold, dim and
reverse, like the rest of the house.

## Without the menu

For scripts, and machines without a terminal:

```sh
sh install.sh --list                      # every item, and what this machine can take
sh install.sh --yes                       # everything this machine can take
sh install.sh --only usr:fish,sys:limine  # just these (the ids from --list)
sh install.sh --restore --only usr:fish   # undo
sh install.sh --as jellyfin --only sys:terminal   # with a service's seal
sh install.sh --only kit:nextcloud --set NEXTCLOUD_CONTAINER=nextcloud-aio-nextcloud
sh install.sh --only kit:nextcloud --set OCC="sudo -u www-data php /var/www/nextcloud/occ"
sh install.sh --only kit:home-assistant --set HA_CONFIG=/srv/homeassistant/config
```

`--set` says where an application is, instead of what was found; `--list`
names the settings each application takes (`NEXTCLOUD_CONTAINER` or `OCC`;
`HA_CONTAINER` or `HA_CONFIG`; `VAULTWARDEN_CONTAINER` or
`VAULTWARDEN_DATA`). The same names work as environment variables. Without
`--set`, an application that was not found stops the command with the names
to use.

(Through the pipe: `… | OLYMPUS_SITE=… sh -s -- --list`.)

## What it can see

Some of what it looks at is root's alone: the boot partition (where
`limine.conf` is) and, often, Docker. So it looks as root when `sudo` needs no
password — and, in the menu, asks for the password once before anything is
installed, then looks for the applications again. Without root, it goes by
what anyone can see: Limine's own command and settings, and a mark the
installers leave in `/var/lib/the-olympus/` once something is in place.
`--list` says when it looked as you only.

## The files by hand

Each application's chapter of the guide (*Dashboards and themes*) ends with
its kit's files: show one, copy its text, download it, or download the whole
folder — and the command for that application alone.

## How it is built

The command installs nothing by itself: it runs the installers the rest of
the house already has — the screens', your terminal's, each application kit's
`apply.sh` — so there is one way to do each thing, and `--restore` undoes it
the same way.

It is written by `npm run installer` (part of `npm run build`, and of the
automatic rebuild when a service is added, changed or removed) from the same
lists those installers come from: the screens' parts, the terminal's parts,
and every theme kit. A kit appears among *Applications* when
its module says how to apply it (`installer` in
`src/integrations/themes/<app>.ts`: the places its application can be — each
with its setting, its question and how to find it — or the test a machine
must pass, and whether it needs root); a kit without one is offered as files
to set up by hand. Adding
a kit, a part or a service changes the menu with no other change.

## What it checks

Every file it fetches is checked against its SHA-256 before it is used — the
application kits' files and the two installers for the house's own seal
against checksums written into the command itself, the rest by the installers
that fetch them. A file that does not match stops it.

Over plain HTTP that protects against damaged files, not against someone who
can change the command itself on its way: serve the site over HTTPS, or check
the command first — the Downloads page gives its SHA-256 and a command that
saves it, checks it and only then runs it. See [Security](11-security.md).
