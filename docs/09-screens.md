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

## Wallpapers

| Style | |
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

### Plymouth — `boot/plymouth/`

A boot splash theme for machines that show one (desktops, laptops — servers
usually boot to text): the crest on black marble above a thin progress line.
It handles the passphrase prompt of an encrypted disk and boot messages,
beneath the crest.

```sh
sudo sh install.sh            # installs it, makes it the default, rebuilds the initramfs
sudo sh install.sh --restore  # back to the previous theme
```

Plymouth must be installed (`apt install plymouth`) and the kernel command
line must include `quiet splash`.

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

| File | |
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

The test suite reads every committed wallpaper's size and colour type, and
checks that GRUB's background is RGBA. It runs each install script against a
stand-in system — with stand-ins for `update-grub`, `sshd` and `systemctl` —
and checks what it writes, that running it twice changes nothing more, that
`--restore` puts every file back, and that a configuration sshd rejects is
removed. It runs the message-of-the-day script in `dash` and `bash`, checks
that the SSH banner is ASCII and the console text has only the escapes
`getty` expects, and that every function the Plymouth script registers is
defined and it loads only the images it ships with.

The scripts are written for Debian, Ubuntu and Proxmox VE and keep a copy of
everything they replace. They have not been run on a live machine here, and
the Plymouth theme has not been seen booting: try it on one machine first.
