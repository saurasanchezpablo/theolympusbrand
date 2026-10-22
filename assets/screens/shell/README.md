# Your terminal

The house in your own terminal: a prompt for bash and fish, fastfetch with the
seal, a tmux status bar, and the house's colours for the terminal itself. All
of it goes into your home folder — no sudo — and every part can be removed
again. (The crest at login, the console screen and the SSH banner are for the
whole machine: they are in *terminal/* of the screens, installed as root.)

## One command

On Linux or macOS, as yourself:

```sh
curl -fsSL http://<site>/files/assets/screens/shell/install.sh | OLYMPUS_FROM=http://<site>/files/assets/screens/shell/ sh
```

It installs every part this machine has a program for, and skips the rest:

| Part | What it does |
|---|---|
| `bash` | bash prompt |
| `fish` | fish prompt and colours |
| `fastfetch` | fastfetch with the seal |
| `tmux` | tmux status bar |
| `gnome-terminal` | GNOME Terminal profile |
| `ptyxis` | Ptyxis palette |
| `kitty` | kitty colours |
| `alacritty` | Alacritty colours |
| `omarchy` | Omarchy theme |
| `wezterm` | WezTerm colour scheme |

Name parts to install only those (`… sh -s -- bash tmux`); `--list` shows
what the machine can take, and `--restore` removes everything that is
installed. From a downloaded copy of this folder: `sh install.sh`.

## The colours

Grey grounds and text, and for the six colours a program uses to tell
things apart, the house's pigments — the colours of ancient stone and metal,
muted to sit beside marble:

| Terminal colour | Pigment | Used for, often |
|---|---|---|
| red | rosso antico | errors, deletions, failed services |
| green | verde antico | successes, additions, running services |
| yellow | gold | warnings, the prompt's git branch |
| blue | lapis | folders, notices |
| magenta | porphyry | images and media, special files |
| cyan | aquamarine | links |

Black and white stay grey. The prompt shows the git branch in gold and a
failed command as **✕ and its exit code** in rosso antico — a sign as well as
a colour. There is a dark scheme (*The Olympus*, installed by default) and a
light one (*The Olympus Light*, in `schemes/`), each with the pigments in the
tones that read on its ground.

## The prompt

```
▲ host ~/where/you/are · main ✕ 1
❯
```

The mountain, the machine, the folder, the git branch, and the last command's
exit code when it failed. As root the `❯` becomes `#`.

- **bash** — `bash/install.sh` puts `prompt.bash` in `~/.config/the-olympus/`
  and adds one line to `~/.bashrc` that loads it (marked *The Olympus prompt*).
- **fish** — `fish/install.sh` puts `the-olympus.fish` in
  `~/.config/fish/conf.d/`: the prompt and greys for fish's syntax colours.
  Errors are underlined rather than red. On CachyOS, whose own configuration
  sets its prompt after this file is read, the house's takes its place again
  just before the first prompt.
- **Starship** users: `schemes/starship.toml` is the same prompt; point
  `STARSHIP_CONFIG` at it.

## fastfetch

`fastfetch/install.sh` installs the seal in braille beside the machine's
facts. If you have no fastfetch configuration of your own it becomes yours —
just run `fastfetch`; if you do, it is left alone and the house's is
`fastfetch -c the-olympus`.

## tmux

`tmux/install.sh` adds a grey status bar — the session after the mountain,
the windows, the host and the time — through one `source-file` line in your
tmux configuration. Restart tmux or run `tmux source-file ~/.tmux.conf`.

## Terminals set up by the script

- **GNOME Terminal** — adds a profile called *The Olympus*; open a tab with it,
  or make it the default in *Preferences*.
- **Ptyxis** — adds the palette; choose it in *Preferences → Color palette*
  (light and dark follow the system).
- **kitty** — `the-olympus.conf`, included from `kitty.conf`; reload with
  ctrl+shift+F5.
- **Alacritty** — `the-olympus.toml`; when you already have an
  `alacritty.toml`, the script prints the `import` line to add.
- **WezTerm** — the colour scheme *The Olympus*; when you already have a
  `wezterm.lua`, set `config.color_scheme = 'The Olympus'` in it.

## Omarchy

`omarchy/install.sh` adds *The Olympus* to Omarchy's themes
(`~/.config/omarchy/themes/the-olympus/`) and switches to it: Omarchy then
makes every application's colours from the theme's `colors.toml` — the
terminal, the bar, the launcher, the lock screen — with the marble, graphite
and blueprint wallpapers as its backgrounds. The file carries the keys of
Omarchy 3 and of Omarchy 4; each reads the ones it knows. `--restore`
removes the theme and switches back to the one you had (*Menu → Style →
Theme* switches by hand).

Omarchy's boot menu (Limine) and boot splash are the machine's: the screens'
*limine* and *plymouth* parts theme them (`sudo sh install.sh` one level
up). Omarchy's `omarchy-refresh-limine` puts its own boot menu back; run the
*limine* part again after it.

## Terminals set up by hand

- **Windows Terminal** — open *Settings → Open JSON file*, paste the two
  entries of `schemes/windows-terminal.json` into `"schemes"`, save, then
  choose *The Olympus* under your profile's *Appearance → Color scheme*.
- **iTerm2** — *Settings → Profiles → Colors → Color Presets… → Import*, choose
  `schemes/The Olympus.itermcolors`, then pick it from the same menu.
- **macOS Terminal** — double-click `schemes/The Olympus.terminal`; then in
  *Settings → Profiles* select it and click *Default*.

The light versions are beside them.

## Undo

`sh install.sh --restore` (or the one command with `-s -- --restore`)
removes every installed part: the files it added and the lines it put in your
configuration, nothing else. A single part: `sh <part>/install.sh --restore`.
For the hand-made ones, choose another scheme and delete *The Olympus*.

---

On Arch, CachyOS and Omarchy the whole kit is also a package (see *Screens*):
then the command is `the-olympus-terminal`.

The scripts are tested against a stand-in home folder, and the colour files
are parsed; the Windows, iTerm2 and macOS Terminal files are made to their
documented formats but were not opened on those systems here, and fish, the
Omarchy theme and fastfetch were not run here.
