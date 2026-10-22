// The house in your own terminal: a prompt for bash and fish, fastfetch with
// the seal, tmux, and the house's colours for the terminals themselves. These
// are per user — installed into your home, without sudo — so they have their
// own parts list and their own one-command installer (the same one the screens
// use, in user mode). Each part's install.sh also takes --restore.

import type { ScreenPart } from './parts.ts';
import type { ScreenSubject } from './screens.ts';
import { braille } from './terminal.ts';
import { ARTBOARD } from '../geometry/math.ts';
import { DOMAIN } from '../brand/identity.ts';
import { SCHEMES, alacritty, gnomeTerminalProfile, itermColors, kitty, ptyxis, terminalApp, windowsTerminal, wezterm } from './palette16.ts';
import { oneLine } from '../catalog/text.ts';
import { PIGMENTS } from '../brand/pigments.ts';

const S = ARTBOARD;
const D = SCHEMES.dark;

/** Truecolour escapes for the prompt's tones — quiet, text, emphasis — and its two pigments: the branch in gold, a failure in rosso antico. */
const tone = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(';');
const QUIET = '#7A7A7A';
const TEXT = D.foreground;
const STRONG = D.bold;
const BRANCH = PIGMENTS.gold.dark;
const FAILED = PIGMENTS.rossoAntico.darkBright;

/* ---------------------------------------------------------------- */
/* Prompts                                                            */
/* ---------------------------------------------------------------- */

export function bashPrompt(): string {
  return `# The Olympus — a bash prompt in the house's greys, with gold and rosso antico.
#
#   ▲ host ~/where/you/are · branch ✕ 1
#   ❯
#
# The mountain, the host, the folder and the git branch (in gold); a failed
# command's exit code after a ✕ (in red, and a sign as well, for any eyes);
# # instead of ❯ as root.

__olympus_git() {
  local b
  b=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null) || return 0
  printf ' · %s' "$b"
}

__olympus_prompt() {
  local status=$?
  local quiet='\\[\\e[38;2;${tone(QUIET)}m\\]' text='\\[\\e[38;2;${tone(TEXT)}m\\]' strong='\\[\\e[38;2;${tone(STRONG)}m\\]' branch='\\[\\e[38;2;${tone(BRANCH)}m\\]' failure='\\[\\e[38;2;${tone(FAILED)}m\\]' off='\\[\\e[0m\\]'
  local mark='❯' failed=''
  [ "\${EUID:-$(id -u)}" -eq 0 ] && mark='#'
  [ "$status" -ne 0 ] && failed=" \${failure}✕ \${status}\${off}"
  # The branch is printed when the prompt is shown, never expanded again: a branch name cannot run code.
  PS1="\\n\${quiet}▲\${off} \${strong}\\h\${off} \${text}\\w\${off}\${branch}"'$(__olympus_git)'"\${off}\${failed}\\n\${strong}\${mark}\${off} "
  return "$status"
}

case ";\${PROMPT_COMMAND:-};" in
  *";__olympus_prompt;"*) ;;
  *) PROMPT_COMMAND="__olympus_prompt\${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
esac
`;
}

export function fishConfig(): string {
  const hex = (h: string) => h.slice(1).toLowerCase();
  return `# The Olympus — the fish prompt and colours, in the house's greys, with gold and rosso antico.
#
#   ▲ host ~/where/you/are · branch ✕ 1
#   ❯

function __olympus_prompt
    set -l last $argv[1]
    set -l mark '❯'
    fish_is_root_user; and set mark '#'
    echo
    set_color ${hex(QUIET)}; echo -n '▲ '
    set_color ${hex(STRONG)}; echo -n (prompt_hostname)' '
    set_color ${hex(TEXT)}; echo -n (prompt_pwd)
    set -l branch (git symbolic-ref --short HEAD 2>/dev/null; or git rev-parse --short HEAD 2>/dev/null)
    if test -n "$branch"
        set_color ${hex(BRANCH)}; echo -n " · $branch"
    end
    if test $last -ne 0
        set_color ${hex(FAILED)}; echo -n " ✕ $last"
    end
    echo
    set_color ${hex(STRONG)}; echo -n "$mark "
    set_color normal
end

function fish_prompt
    __olympus_prompt $status
end

# CachyOS and other setups set their own prompt after this file is read: take it back before the first prompt is drawn.
function __olympus_take_prompt --on-event fish_prompt
    functions -e __olympus_take_prompt
    function fish_prompt
        __olympus_prompt $status
    end
end

# Syntax highlighting: commands bright, arguments quieter, a mistake in rosso antico and underlined.
set -g fish_color_command ${hex(STRONG)}
set -g fish_color_param ${hex(TEXT)}
set -g fish_color_keyword ${hex(STRONG)} --bold
set -g fish_color_quote 9a9a9a
set -g fish_color_redirection 9a9a9a
set -g fish_color_end 9a9a9a
set -g fish_color_comment 6a6a6a
set -g fish_color_operator c9c9c9
set -g fish_color_escape b4b4b4
set -g fish_color_autosuggestion 5e5e5e
set -g fish_color_error ${hex(FAILED)} --underline
set -g fish_color_valid_path --underline
set -g fish_color_search_match --background=3a3a3a
set -g fish_color_selection --background=3a3a3a
set -g fish_pager_color_prefix ${hex(STRONG)} --bold
set -g fish_pager_color_completion ${hex(TEXT)}
set -g fish_pager_color_description 7a7a7a
`;
}

/** For people who use Starship instead: the same prompt as a Starship palette. */
export function starshipToml(): string {
  return `# The Olympus — Starship, in the house's greys, with gold and rosso antico.
# Use it with: export STARSHIP_CONFIG=~/.config/the-olympus/starship.toml
format = """
$fill
[▲](quiet) $hostname$directory$git_branch$status
$character"""
palette = "olympus"

[palettes.olympus]
quiet = "${QUIET.toLowerCase()}"
text = "${TEXT.toLowerCase()}"
strong = "${STRONG.toLowerCase()}"
branch = "${BRANCH.toLowerCase()}"
failed = "${FAILED.toLowerCase()}"

[fill]
symbol = " "

[hostname]
ssh_only = false
format = "[$hostname](strong) "

[directory]
style = "text"
truncation_length = 4

[git_branch]
format = "[· $branch](branch) "

[status]
disabled = false
format = "[✕ $status](failed) "

[character]
success_symbol = "[❯](strong)"
error_symbol = "[❯](strong)"
`;
}

export function tmuxConf(): string {
  const c = (h: string) => h.toLowerCase();
  return `# The Olympus — tmux in the house's greys.
set -g status-style "fg=${c(D.foreground)},bg=#1c1c1c"
set -g status-left " ▲ #S "
set -g status-left-style "fg=${c(D.bold)},bg=#3a3a3a"
set -g status-left-length 30
set -g status-right " #H · %H:%M "
set -g status-right-style "fg=${c(D.foreground)},bg=#1c1c1c"
set -g window-status-format " #I #W "
set -g window-status-current-format " #I #W "
set -g window-status-current-style "fg=#0e0e0e,bg=${c(D.foreground)}"
set -g pane-border-style "fg=#3a3a3a"
set -g pane-active-border-style "fg=#9a9a9a"
set -g message-style "fg=${c(D.bold)},bg=#3a3a3a"
set -g mode-style "fg=${c(D.bold)},bg=#5e5e5e"
`;
}

/* ---------------------------------------------------------------- */
/* fastfetch                                                          */
/* ---------------------------------------------------------------- */

/** The seal in braille, for fastfetch's logo ($1 is its colour). */
export function fastfetchLogo(subject: ScreenSubject): string {
  return '$1' + braille(subject.marks.seal.d, S, S, 20).join('\n') + '\n';
}

export function fastfetchConfig(subject: ScreenSubject): string {
  const sgr = (hex: string) => `38;2;${tone(hex)}`;
  return `// The Olympus — fastfetch, with the seal beside the facts.
// Shown by \`fastfetch\` when it is your config.jsonc; otherwise \`fastfetch -c the-olympus\`.
{
  "$schema": "https://github.com/fastfetch-cli/fastfetch/raw/dev/doc/json_schema.json",
  "logo": {
    "type": "file",
    "source": "~/.config/fastfetch/the-olympus-logo.txt",
    "color": { "1": "${sgr(D.bold)}" },
    "padding": { "top": 1, "left": 1, "right": 3 }
  },
  "display": {
    "separator": "  ",
    "color": { "keys": "${sgr(QUIET)}", "title": "${sgr(D.bold)}", "output": "${sgr(D.foreground)}" }
  },
  "modules": [
    { "type": "custom", "format": ${JSON.stringify(oneLine(`${subject.name.toUpperCase()} · ${subject.id === 'master' ? DOMAIN : subject.caption}`).replace(/[{}]/g, ''))} },
    "separator",
    "title",
    "os",
    "host",
    "kernel",
    "uptime",
    "packages",
    "shell",
    "terminal",
    "cpu",
    "memory",
    "disk",
    "localip"
  ]
}
`;
}

/* ---------------------------------------------------------------- */
/* Omarchy                                                            */
/* ---------------------------------------------------------------- */

/**
 * An Omarchy theme's colours. Omarchy 4 makes every application's colours
 * from the named keys; Omarchy 3 from color0 … color15 and the selection
 * pair. One file carries both — each release reads the keys it knows.
 */
export function omarchyColors(): string {
  const c = (h: string) => `"${h.toLowerCase()}"`;
  const a = D.ansi;
  return `# The Olympus — an Omarchy theme in the house's greys, its terminal colours in the house's pigments (Omarchy 3 and 4).
mode = "dark"
accent = "#9a9a9a"
cursor = ${c(D.cursor)}
foreground = ${c(D.foreground)}
background = ${c(D.background)}
selection = ${c(D.selection)}
muted = "#5e5e5e"
dark_background = "#080808"
darker_background = "#040404"
lighter_background = "#1c1c1c"
dark_foreground = "#5e5e5e"
light_foreground = "#9a9a9a"
bright_foreground = ${c(D.bold)}
red = ${c(a[1])}
green = ${c(a[2])}
yellow = ${c(a[3])}
blue = ${c(a[4])}
magenta = ${c(a[5])}
cyan = ${c(a[6])}
orange = ${c(PIGMENTS.gold.darkBright)}
brown = ${c(PIGMENTS.gold.light)}
bright_red = ${c(a[9])}
bright_green = ${c(a[10])}
bright_yellow = ${c(a[11])}
bright_blue = ${c(a[12])}
bright_magenta = ${c(a[13])}
bright_cyan = ${c(a[14])}

# Omarchy 3
selection_foreground = ${c(D.selectionText)}
selection_background = ${c(D.selection)}
${a.map((x, i) => `color${i} = ${c(x)}`).join('\n')}
`;
}

/* ---------------------------------------------------------------- */
/* The parts                                                          */
/* ---------------------------------------------------------------- */

const CONFIG = '"${XDG_CONFIG_HOME:-$HOME/.config}"';
const DATA = '"${XDG_DATA_HOME:-$HOME/.local/share}"';
/** GNOME Terminal's profile for the house: a fixed identifier, so it is found again to update or remove. */
export const GNOME_PROFILE = '7b0f3f3e-0d5e-4c1e-9a52-01ad0e7f6c11';
const GNOME_DEFAULT = 'b1dcc9dd-5262-4d8d-a863-c897e6d979b9';

export const SHELL_PARTS: readonly ScreenPart[] = [
  { id: 'bash', label: 'bash prompt', dir: 'shell/bash', fits: 'command -v bash >/dev/null 2>&1', installed: `grep -qsF '# The Olympus prompt' "$HOME/.bashrc"`, unfit: 'bash is not installed', options: [] },
  { id: 'fish', label: 'fish prompt and colours', dir: 'shell/fish', fits: 'command -v fish >/dev/null 2>&1', installed: `[ -f ${CONFIG}/fish/conf.d/the-olympus.fish ]`, unfit: 'fish is not installed', options: [] },
  { id: 'fastfetch', label: 'fastfetch with the seal', dir: 'shell/fastfetch', fits: 'command -v fastfetch >/dev/null 2>&1', installed: `[ -f ${CONFIG}/fastfetch/the-olympus.jsonc ]`, unfit: 'fastfetch is not installed', options: [] },
  { id: 'tmux', label: 'tmux status bar', dir: 'shell/tmux', fits: 'command -v tmux >/dev/null 2>&1', installed: `[ -f ${CONFIG}/tmux/the-olympus.conf ]`, unfit: 'tmux is not installed', options: [] },
  { id: 'gnome-terminal', label: 'GNOME Terminal profile', dir: 'shell/gnome-terminal', fits: 'command -v gnome-terminal >/dev/null 2>&1 && command -v dconf >/dev/null 2>&1', installed: `dconf read /org/gnome/terminal/legacy/profiles:/list 2>/dev/null | grep -q ${GNOME_PROFILE}`, unfit: 'GNOME Terminal is not installed', options: [] },
  { id: 'ptyxis', label: 'Ptyxis palette', dir: 'shell/ptyxis', fits: 'command -v ptyxis >/dev/null 2>&1 || [ -d "$HOME/.var/app/app.devsuite.Ptyxis" ]', installed: `[ -f ${DATA}/org.gnome.Ptyxis/palettes/the-olympus.palette ] || [ -f "$HOME/.var/app/app.devsuite.Ptyxis/data/org.gnome.Ptyxis/palettes/the-olympus.palette" ]`, unfit: 'Ptyxis is not installed', options: [] },
  { id: 'kitty', label: 'kitty colours', dir: 'shell/kitty', fits: 'command -v kitty >/dev/null 2>&1', installed: `[ -f ${CONFIG}/kitty/the-olympus.conf ]`, unfit: 'kitty is not installed', options: [] },
  { id: 'alacritty', label: 'Alacritty colours', dir: 'shell/alacritty', fits: 'command -v alacritty >/dev/null 2>&1', installed: `[ -f ${CONFIG}/alacritty/the-olympus.toml ]`, unfit: 'Alacritty is not installed', options: [] },
  { id: 'omarchy', label: 'Omarchy theme', dir: 'shell/omarchy', fits: 'command -v omarchy-theme-set >/dev/null 2>&1', installed: `[ -d ${CONFIG}/omarchy/themes/the-olympus ]`, unfit: 'Omarchy is not installed', options: [] },
  { id: 'wezterm', label: 'WezTerm colour scheme', dir: 'shell/wezterm', fits: 'command -v wezterm >/dev/null 2>&1', installed: `[ -f ${CONFIG}/wezterm/colors/the-olympus.toml ]`, unfit: 'WezTerm is not installed', options: [] },
];

/** A part's installer: a header, then what --restore does, then what installing does. */
const script = (title: string, restore: string, install: string) => `#!/bin/sh
# The Olympus — ${title}. Run as yourself (not with sudo).
#
#   sh install.sh            install
#   sh install.sh --restore  remove it again
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONFIG=${CONFIG}

# Remove the lines carrying a marker from a file, keeping everything else.
unmark() { [ -f "$1" ] || return 0; grep -vF "$2" "$1" > "$1.the-olympus.tmp" || true; cat "$1.the-olympus.tmp" > "$1"; rm -f "$1.the-olympus.tmp"; }

if [ "\${1:-}" = "--restore" ]; then
${restore.trim().split('\n').map((l) => `  ${l}`).join('\n')}
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
${install.trim()}
`;

function installers(): Record<string, string> {
  return {
    bash: script(
      'the bash prompt',
      `unmark "$HOME/.bashrc" '# The Olympus prompt'
rm -f "$CONFIG/the-olympus/prompt.bash"
echo "The prompt is removed; it is gone from new terminals."`,
      `mkdir -p "$CONFIG/the-olympus"
cp "$DIR/prompt.bash" "$CONFIG/the-olympus/prompt.bash"
touch "$HOME/.bashrc"
grep -qF '# The Olympus prompt' "$HOME/.bashrc" || printf '[ -f "%s" ] && . "%s"  # The Olympus prompt\\n' "$CONFIG/the-olympus/prompt.bash" "$CONFIG/the-olympus/prompt.bash" >> "$HOME/.bashrc"
echo "The prompt is installed; open a new terminal to see it."`,
    ),
    fish: script(
      'the fish prompt and colours',
      `rm -f "$CONFIG/fish/conf.d/the-olympus.fish"
echo "Removed; open a new terminal. (fish's own prompt returns; colours you had set with set -U are untouched.)"`,
      `mkdir -p "$CONFIG/fish/conf.d"
cp "$DIR/the-olympus.fish" "$CONFIG/fish/conf.d/the-olympus.fish"
echo "Installed; open a new terminal to see it."`,
    ),
    fastfetch: script(
      'fastfetch with the seal',
      `F="$CONFIG/fastfetch"
if [ -f "$F/config.jsonc" ] && head -n 1 "$F/config.jsonc" | grep -qF 'The Olympus'; then rm -f "$F/config.jsonc"; fi
rm -f "$F/the-olympus.jsonc" "$F/the-olympus-logo.txt"
echo "Removed."`,
      `F="$CONFIG/fastfetch"
mkdir -p "$F"
cp "$DIR/the-olympus-logo.txt" "$F/the-olympus-logo.txt"
cp "$DIR/the-olympus.jsonc" "$F/the-olympus.jsonc"
if [ ! -f "$F/config.jsonc" ] || head -n 1 "$F/config.jsonc" | grep -qF 'The Olympus'; then
  cp "$DIR/the-olympus.jsonc" "$F/config.jsonc"
  echo "Installed: run fastfetch."
else
  echo "Installed beside your own config.jsonc (left as it is): run fastfetch -c the-olympus."
fi`,
    ),
    tmux: script(
      'the tmux status bar',
      `unmark "$HOME/.tmux.conf" '# The Olympus'
unmark "$CONFIG/tmux/tmux.conf" '# The Olympus'
rm -f "$CONFIG/tmux/the-olympus.conf"
echo "Removed; restart tmux (or tmux source-file your configuration)."`,
      `mkdir -p "$CONFIG/tmux"
cp "$DIR/the-olympus.conf" "$CONFIG/tmux/the-olympus.conf"
if [ -f "$CONFIG/tmux/tmux.conf" ]; then RC="$CONFIG/tmux/tmux.conf"; else RC="$HOME/.tmux.conf"; fi
touch "$RC"
grep -qF '# The Olympus' "$RC" || printf 'source-file "%s"  # The Olympus\\n' "$CONFIG/tmux/the-olympus.conf" >> "$RC"
echo "Installed; restart tmux, or run: tmux source-file $RC"`,
    ),
    'gnome-terminal': script(
      'the GNOME Terminal profile',
      `P=/org/gnome/terminal/legacy/profiles:/
dconf reset -f "$P:${GNOME_PROFILE}/"
list=$(dconf read "\${P}list" || true)
[ -z "$list" ] || dconf write "\${P}list" "$(printf '%s' "$list" | sed "s/, *'${GNOME_PROFILE}'//; s/'${GNOME_PROFILE}', *//")"
echo "The profile is removed."`,
      `P=/org/gnome/terminal/legacy/profiles:/
dconf load "$P:${GNOME_PROFILE}/" < "$DIR/the-olympus.dconf"
list=$(dconf read "\${P}list" || true)
case "$list" in
  *${GNOME_PROFILE}*) ;;
  ""|"@as []") dconf write "\${P}list" "['${GNOME_DEFAULT}', '${GNOME_PROFILE}']" ;;
  *) dconf write "\${P}list" "$(printf '%s' "$list" | sed "s/]$/, '${GNOME_PROFILE}']/")" ;;
esac
echo "Installed: in GNOME Terminal, open a new tab with the profile 'The Olympus' (Preferences → set it as default if you like)."`,
    ),
    ptyxis: script(
      'the Ptyxis palette',
      `rm -f ${DATA}/org.gnome.Ptyxis/palettes/the-olympus.palette "$HOME/.var/app/app.devsuite.Ptyxis/data/org.gnome.Ptyxis/palettes/the-olympus.palette"
echo "Removed."`,
      `if [ -d "$HOME/.var/app/app.devsuite.Ptyxis" ] && ! command -v ptyxis >/dev/null 2>&1; then D="$HOME/.var/app/app.devsuite.Ptyxis/data/org.gnome.Ptyxis/palettes"; else D=${DATA}/org.gnome.Ptyxis/palettes; fi
mkdir -p "$D"
cp "$DIR/the-olympus.palette" "$D/the-olympus.palette"
echo "Installed: in Ptyxis, Preferences → Color palette → The Olympus (it has a light and a dark version)."`,
    ),
    kitty: script(
      'the kitty colours',
      `unmark "$CONFIG/kitty/kitty.conf" 'the-olympus.conf'
rm -f "$CONFIG/kitty/the-olympus.conf"
echo "Removed; reload kitty's configuration (ctrl+shift+F5)."`,
      `mkdir -p "$CONFIG/kitty"
cp "$DIR/the-olympus.conf" "$CONFIG/kitty/the-olympus.conf"
touch "$CONFIG/kitty/kitty.conf"
grep -qF 'include the-olympus.conf' "$CONFIG/kitty/kitty.conf" || printf 'include the-olympus.conf\\n' >> "$CONFIG/kitty/kitty.conf"
echo "Installed; reload kitty's configuration (ctrl+shift+F5)."`,
    ),
    alacritty: script(
      'the Alacritty colours',
      `A="$CONFIG/alacritty"
if [ -f "$A/alacritty.toml" ] && head -n 1 "$A/alacritty.toml" | grep -qF 'The Olympus'; then rm -f "$A/alacritty.toml"; fi
rm -f "$A/the-olympus.toml"
echo "Removed."`,
      `A="$CONFIG/alacritty"
mkdir -p "$A"
cp "$DIR/the-olympus.toml" "$A/the-olympus.toml"
if [ ! -f "$A/alacritty.toml" ]; then
  # Alacritty 0.14 reads imports under [general]; 0.13 at the top.
  if alacritty --version 2>/dev/null | grep -qE ' 0\\.(1[0-3]|[0-9])\\.'; then printf '# The Olympus\\nimport = ["%s"]\\n' "$A/the-olympus.toml" > "$A/alacritty.toml"
  else printf '# The Olympus\\n[general]\\nimport = ["%s"]\\n' "$A/the-olympus.toml" > "$A/alacritty.toml"; fi
  echo "Installed; Alacritty picks it up at once."
else
  echo "Installed. Add this file to the imports in your alacritty.toml:"
  echo "  import = [\\"$A/the-olympus.toml\\"]   (under [general] on Alacritty 0.14 or later)"
fi`,
    ),
    omarchy: script(
      'the Omarchy theme',
      `T="$CONFIG/omarchy/themes/the-olympus"
PREV=$(cat "$CONFIG/the-olympus/omarchy-previous" 2>/dev/null || true)
rm -rf "$T"
rm -f "$CONFIG/the-olympus/omarchy-previous"
if [ -n "$PREV" ] && [ "$PREV" != the-olympus ]; then omarchy-theme-set "$PREV"; echo "Back to $PREV."
else echo "Removed: choose another theme (Omarchy menu → Style → Theme)."; fi`,
      `T="$CONFIG/omarchy/themes/the-olympus"
# The theme in use now, to go back to on --restore.
PREV=$(omarchy-theme-current 2>/dev/null || basename "$(readlink "$CONFIG/omarchy/current/theme" 2>/dev/null)" 2>/dev/null || true)
if [ -n "$PREV" ] && [ "$PREV" != the-olympus ] && [ "$PREV" != . ]; then mkdir -p "$CONFIG/the-olympus"; printf '%s\n' "$PREV" > "$CONFIG/the-olympus/omarchy-previous"; fi
rm -rf "$T"
mkdir -p "$CONFIG/omarchy/themes"
cp -R "$DIR/the-olympus" "$T"
omarchy-theme-set the-olympus
echo "The Olympus is your Omarchy theme."`,
    ),
    wezterm: script(
      'the WezTerm colour scheme',
      `W="$CONFIG/wezterm"
if [ -f "$W/wezterm.lua" ] && head -n 1 "$W/wezterm.lua" | grep -qF 'The Olympus'; then rm -f "$W/wezterm.lua"; fi
rm -f "$W/colors/the-olympus.toml"
echo "Removed."`,
      `W="$CONFIG/wezterm"
mkdir -p "$W/colors"
cp "$DIR/the-olympus.toml" "$W/colors/the-olympus.toml"
if [ ! -f "$W/wezterm.lua" ] && [ ! -f "$HOME/.wezterm.lua" ]; then
  printf -- "-- The Olympus\\nlocal wezterm = require 'wezterm'\\nlocal config = wezterm.config_builder()\\nconfig.color_scheme = 'The Olympus'\\nreturn config\\n" > "$W/wezterm.lua"
  echo "Installed; WezTerm picks it up at once."
else
  echo "Installed. In your wezterm.lua, set: config.color_scheme = 'The Olympus'"
fi`,
    ),
  };
}

/** The per-user kit: each part's folder, and the colour schemes for terminals set up by hand. */
export function shellFiles(subject: ScreenSubject, backgrounds: [name: string, png: Uint8Array][] = []): [path: string, data: string | Uint8Array][] {
  const inst = installers();
  return [
    ['shell/bash/install.sh', inst.bash],
    ['shell/bash/prompt.bash', bashPrompt()],
    ['shell/fish/install.sh', inst.fish],
    ['shell/fish/the-olympus.fish', fishConfig()],
    ['shell/fastfetch/install.sh', inst.fastfetch],
    ['shell/fastfetch/the-olympus-logo.txt', fastfetchLogo(subject)],
    ['shell/fastfetch/the-olympus.jsonc', fastfetchConfig(subject)],
    ['shell/tmux/install.sh', inst.tmux],
    ['shell/tmux/the-olympus.conf', tmuxConf()],
    ['shell/gnome-terminal/install.sh', inst['gnome-terminal']],
    ['shell/gnome-terminal/the-olympus.dconf', gnomeTerminalProfile(SCHEMES.dark)],
    ['shell/ptyxis/install.sh', inst.ptyxis],
    ['shell/ptyxis/the-olympus.palette', ptyxis(SCHEMES.light, SCHEMES.dark)],
    ['shell/kitty/install.sh', inst.kitty],
    ['shell/kitty/the-olympus.conf', kitty(SCHEMES.dark)],
    ['shell/alacritty/install.sh', inst.alacritty],
    ['shell/alacritty/the-olympus.toml', alacritty(SCHEMES.dark)],
    ['shell/omarchy/install.sh', inst.omarchy],
    ['shell/omarchy/the-olympus/colors.toml', omarchyColors()],
    ...backgrounds.map(([name, png]): [string, Uint8Array] => [`shell/omarchy/the-olympus/backgrounds/${name}`, png]),
    ['shell/wezterm/install.sh', inst.wezterm],
    ['shell/wezterm/the-olympus.toml', wezterm(SCHEMES.dark)],
    // Set up by hand: the guide says how.
    ['shell/schemes/windows-terminal.json', `[\n${[SCHEMES.dark, SCHEMES.light].map((s) => windowsTerminal(s).trimEnd().replace(/^/gm, '  ')).join(',\n')}\n]\n`],
    ['shell/schemes/The Olympus.itermcolors', itermColors(SCHEMES.dark)],
    ['shell/schemes/The Olympus Light.itermcolors', itermColors(SCHEMES.light)],
    ['shell/schemes/The Olympus.terminal', terminalApp(SCHEMES.dark)],
    ['shell/schemes/The Olympus Light.terminal', terminalApp(SCHEMES.light)],
    ['shell/schemes/kitty-light.conf', kitty(SCHEMES.light)],
    ['shell/schemes/alacritty-light.toml', alacritty(SCHEMES.light)],
    ['shell/schemes/wezterm-light.toml', wezterm(SCHEMES.light)],
    ['shell/schemes/starship.toml', starshipToml()],
  ];
}
