# 09 — Screens

The crest on every screen the house has: the desktop and the phone, the boot
menu and the boot splash, and the terminal — the message after you log in,
the console login, and the banner an SSH client shows before the password.

```sh
npm run screens                  # the master's → assets/screens/
npm run screens -- jellyfin      # a service's → assets/screens/services/jellyfin/
```

The master's set is kept in the repository and is on the website under
**Downloads → Wallpapers, boot screens and terminal**. A service's set is
built on demand; in the Atelier, the export panel draws any wallpaper, and a
service's asset pack carries its terminal crest.

## One command

Every part has its own installer, and `install.sh` at the top of the set runs
them all: the boot screens, the terminal crest and the wallpapers — each on
the machines that can take it, skipping the rest with the reason.

```sh
sudo sh install.sh                    # every part this machine can take
sudo sh install.sh grub terminal      # only those
sudo sh install.sh terminal --ascii   # options go to the parts that take them
sudo sh install.sh --restore          # undo every part that is installed
sh install.sh --list                  # the parts, and what this machine can take
```

Without copying the folder first, straight from the house's site (the
Downloads page shows the command with the site's own address):

```sh
curl -fsSL http://<site>/files/assets/screens/install.sh | sudo OLYMPUS_FROM=http://<site>/files/assets/screens/ sh
```

It fetches only the files of the parts it installs, into a temporary folder,
and checks each against the SHA-256 written in the script before running
anything; one that does not match stops it. A service's set
(`assets/screens/services/<id>/`) has its own `install.sh`.

**Parts are modules.** Each is listed in `src/screens/parts.ts`: its folder,
the shell test for whether a machine can take it and whether it is
installed, and the options it accepts. The umbrella script is written from
that list, so a new part — generated into its folder by `screensKit`, with an
`install.sh` that also takes `--restore` — is one entry there.

## Your terminal

Per user, without sudo: a prompt for bash and fish, fastfetch with the seal, a
tmux status bar, and the house's sixteen greys for GNOME Terminal, Ptyxis,
kitty, Alacritty and WezTerm — with schemes for Windows Terminal, iTerm2 and
macOS Terminal. It is in `shell/`, with its own one-command installer:

```sh
curl -fsSL http://<site>/files/assets/screens/shell/install.sh | OLYMPUS_FROM=http://<site>/files/assets/screens/shell/ sh
```

The whole guide: [Your terminal](screens/terminal.md).

## Wallpapers

| Style | Look |
|---|---|
| **Black marble** | The crest in marble white on black stone, lifted by a soft shadow. |
| **White marble** | The crest in charcoal on white stone. |
| **Graphite** | Tone on tone: the crest pressed into a dark graphite ground, lit from above. Quiet enough to work over. |
| **Blueprint** | A drawing sheet: grid, centre lines, the crest in outline, and a title block with the name and domain. |

Each comes at 1920 × 1080, 2560 × 1440, 3840 × 2160 (4K), 3440 × 1440
(ultrawide) and 1179 × 2556 (phone, with the crest a little larger). The
files are 8-bit gray PNGs — everything in them is neutral.

The stone on screens is drawn for being seen whole: a few long veins that
taper and fade, finer veins across them, a soft vignette. Like all the
house's marble it is seeded, so it is the same on every build. It is a
picture of stone, made from noise — not a photograph.

`wallpapers/install.sh` adds them to the desktop's own choices, without
changing anyone's current background: GNOME, Cinnamon and MATE list them in
their background settings (the 4K file, zoomed to fit), and KDE Plasma gets
one wallpaper package per style with every size, choosing the one that fits
the screen. `--restore` removes them.

## Boot screens

### GRUB — `boot/grub/`

A background for the GRUB menu: dark marble with the crest faint beneath the
menu, so the menu stays legible.

```sh
sudo sh install.sh            # sets GRUB_BACKGROUND, regenerates the menu
sudo sh install.sh --restore  # puts /etc/default/grub back as it was
```

The image is copied to `/boot/grub/` (GRUB reads it before the system is up,
so it must live where GRUB can find it), and it is an RGBA PNG because GRUB
does not read gray ones. The script keeps the original `/etc/default/grub`,
sets the resolution to 1920 × 1080 when none is set, and on Proxmox VE also
refreshes the boot partitions. A Proxmox VE node on ZFS with UEFI boots with
systemd-boot, which has no background: there the script changes nothing.

### Limine — `boot/limine/`

The boot menu of CachyOS and Omarchy (and of any machine that boots with
Limine): the same picture as GRUB's — the crest faint on black marble — the
house's name as the menu's title, and the house's greys for the menu and its
terminal.

```sh
sudo sh install.sh            # sets the theme in limine.conf
sudo sh install.sh --restore  # takes it out again
```

The script finds `limine.conf` (or takes `LIMINE_CONF=…`) and puts the
options in a marked block at its top. If the file already sets one of them —
a wallpaper, a palette — that line is set aside as a comment and given back on
`--restore`; the kernel entries are never touched, so CachyOS's
`limine-entry-tool` and Omarchy's snapshot entries carry on as before. The
wallpaper is copied beside `limine.conf`, with its BLAKE2 hash, so it still
loads when Secure Boot checks every file. Limine 12 and later take the menu's
colours as RRGGBB; earlier releases get palette indexes.

- **CachyOS with an enrolled configuration** (`ENABLE_ENROLL_LIMINE_CONFIG=yes`
  in `/etc/default/limine`): an edited `limine.conf` would not boot until it is
  enrolled again, so the script runs `limine-enroll-config` after each change —
  and refuses to change anything if that tool is missing.
- **Omarchy**: `omarchy-refresh-limine` replaces `limine.conf` with Omarchy's
  own; run this part again after it.

### Plymouth — `boot/plymouth/`

A boot splash theme for machines that show one (desktops, laptops — servers
usually boot to text): the crest on black marble above a thin progress line.
It handles the passphrase prompt of an encrypted disk and boot messages,
beneath the crest.

```sh
sudo sh install.sh            # installs it, makes it the default, rebuilds the initramfs
sudo sh install.sh --restore  # back to the previous theme
```

Plymouth must be installed (`apt install plymouth`, `pacman -S plymouth`) and
the kernel command line must include `quiet splash`. On Arch, CachyOS and
Omarchy the initramfs needs Plymouth's hook: the script says so if `plymouth`
is missing from `HOOKS` in `/etc/mkinitcpio.conf`. The theme then replaces
CachyOS's or Omarchy's own splash; `--restore` gives it back.

## Arch, CachyOS and Omarchy

The same kit works there — the *terminal* part writes the crest to
`/etc/motd.d/the-olympus` (Arch's login reads that folder; it has no
`update-motd.d`), *grub*, *limine* and *plymouth* as above — and it is also a
pacman package, so the system owns its files and removing the package undoes
it:

```sh
mkdir the-olympus && cd the-olympus
curl -fsSLO http://<site>/files/assets/screens/arch/{PKGBUILD,the-olympus,the-olympus-terminal,the-olympus.install}
OLYMPUS_SITE=http://<site> makepkg -si
sudo the-olympus            # every part this machine can take (--list, --restore)
the-olympus-terminal        # your own terminal, as yourself
```

`makepkg` fetches every file of the kit from the site and checks each against
the SHA-256 written in the `PKGBUILD`. Its version is the time it was built,
so building again after a change on the site is an upgrade. `pacman -R
the-olympus-screens` first undoes what `the-olympus` set (each user undoes
their terminal with `the-olympus-terminal --restore`). A service's set has its
own package, `the-olympus-<id>-screens`, in place of the master's.

## The terminal — `terminal/`

The seal drawn in text, the name and caption beside it:

```
⠀⠀⠀⠀⠀⠀⣀⣤⣴⣶⣾⣿⣿⣷⣶⣦⣤⣀
⠀⠀⠀⢀⣴⣾⡿⠛⠉⠉⠀⠀⠀⠀⠉⠉⠛⢿⣷⣦⡀
⠀⠀⣰⣿⠟⠁⠀⠀⠰⣆⠀⠀⠀⠀⣰⠆⠀⠀⠈⠻⣿⣆
⠀⣼⣿⠋⠀⠀⠀⠀⠀⢽⡶⡶⢶⢶⡯⠀⠀⠀⠀⠀⠙⣿⣧
⢰⣿⡇⠀⠀⠀⠀⠀⠀⣼⠃⡇⢸⠘⣧⠀⠀⠀⠀⠀⠀⢸⣿⡆    J E L L Y F I N
⣾⣿⠀⠀⠀⠀⠀⠀⠀⣿⠀⡇⢸⠀⣿⠀⠀⠀⠀⠀⠀⠀⣿⣷
⢿⣿⠀⠀⠀⠀⠀⠀⠀⣿⠀⡇⢸⠀⣿⠀⠀⠀⠀⠀⠀⠀⣿⡿    The Olympus · APOLLO
⠸⣿⡇⠀⠀⠀⠀⠀⠀⣿⠀⡇⢸⠀⣿⠀⠀⠀⠀⠀⠀⢸⣿⠇    https://jellyfin.theolympus.cloud
⠀⢻⣿⣄⠀⠀⠀⠀⠀⠸⣷⣷⣾⣾⠇⠀⠀⠀⠀⠀⣠⣿⡟
⠀⠀⠹⣿⣦⡀⠀⠀⠀⠀⠙⠿⠿⠋⠀⠀⠀⠀⢀⣴⣿⠏
⠀⠀⠀⠈⠻⢿⣷⣤⣀⣀⠀⠀⠀⠀⣀⣀⣤⣾⡿⠟⠁
⠀⠀⠀⠀⠀⠀⠉⠛⠻⠿⢿⣿⣿⡿⠿⠟⠛⠉
```

| File | Contents |
|---|---|
| `20-the-olympus` | The message of the day, for `/etc/update-motd.d/`: the seal in braille (or ASCII), then the host's name and how long it has been up. |
| `issue` | The console login screen (`/etc/issue`), in ASCII; the login prompt fills in the host and terminal. |
| `issue.net` | The SSH banner, shown before the password prompt. Plain ASCII, and it names nothing but the house: a banner is seen by anyone who connects. |
| `motd-braille.txt`, `motd-ascii.txt` | The same drawings as plain files, for `/etc/motd` on systems without `update-motd.d`. |
| `install.sh` | Installs all three. |

```sh
sudo sh install.sh            # braille drawing
sudo sh install.sh --ascii    # ASCII drawing, for terminals or fonts without braille
sudo sh install.sh --restore  # removes them and puts /etc/issue back
```

Braille draws the seal with eight dots per character; most terminal fonts
have it, some Windows consoles do not — that is what `--ascii` is for. No
colour codes are used: the terminal's own ink draws the seal.

The SSH banner goes into a drop-in file
(`/etc/ssh/sshd_config.d/the-olympus.conf`). The script checks the result
with `sshd -t` before reloading, and takes the drop-in back out if sshd
rejects it, so a mistake never locks you out.

## How they are checked

The Limine script is run against a stand-in `limine.conf` with entries and
options of its own: the block is written once however often it runs, the
options it replaces are set aside and given back, the entries are untouched,
`--restore` leaves the file exactly as it was, Limine 11 gets palette indexes,
and an enrolled configuration without `limine-enroll-config` is left alone.
The `PKGBUILD` is read by bash, as makepkg reads it, and every file it names is
checked against the checksum it pins.

The test suite reads every committed wallpaper's size and colour type, and
checks that GRUB's background is RGBA. It runs each install script against a
stand-in system — with stand-ins for `update-grub`, `sshd` and `systemctl` —
and checks what it writes, that running it twice changes nothing more, that
`--restore` puts every file back, and that a configuration sshd rejects is
removed. It runs the message-of-the-day script in `dash` and `bash`, checks
that the SSH banner is ASCII and the console text has only the escapes
`getty` expects, and that every function the Plymouth script registers is
defined and it loads only the images it ships with.

The one-command installer is run against stand-in parts: it installs only
what the stand-in machine can take, passes `--ascii` to the terminal alone,
restores only what is installed, rejects unknown parts and options, fetches
the files from a stand-in site, and refuses a file whose checksum does not
match. The wallpaper installer is run against a stand-in system: the GNOME
list is valid XML naming files that exist, every KDE package has its
metadata and an image per size, and `--restore` leaves nothing behind.

The scripts are written for Debian, Ubuntu and Proxmox VE and keep a copy of
everything they replace. They have not been run on a live machine here, and
the Plymouth theme has not been seen booting: try it on one machine first.
