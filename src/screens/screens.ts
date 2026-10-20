// Screens: wallpapers for desktops, ultrawides and phones; the boot screens
// (a GRUB background and a Plymouth theme); and the crest in the terminal —
// the message of the day, the console login and the SSH banner. One plan for
// the command line and the Atelier: SVG and text here, rasterised by the host.

import type { Mark } from '../geometry/crest.ts';
import { SCREEN_PARTS, screensInstaller } from './parts.ts';
import { commentText, mdText, oneLine, shQuote, xmlText as xmlEscape } from '../catalog/text.ts';
import { SHELL_PARTS, shellFiles } from './shell.ts';
import { limineInstall } from './limine.ts';
import { archCommand, archFiles, archInstallHooks, archTerminalCommand, pkgbuild } from './arch.ts';
import { shellGuide } from './shell-guide.ts';
import { ARTBOARD } from '../geometry/math.ts';
import { lineText } from '../geometry/fonts.ts';
import { PALETTE } from '../brand/palette.ts';
import { DOMAIN } from '../brand/identity.ts';
import { base64 } from '../export/png.ts';
import { ascii, braille } from './terminal.ts';

const S = ARTBOARD;
const P = PALETTE;

export type ScreenSubject = {
  /** "master" or a service id — for file names. */
  id: string;
  /** "The Olympus" or the service's name. */
  name: string;
  /** The line under it: the domain for the master, "The Olympus · APOLLO" for a service. */
  caption: string;
  url?: string;
  marks: { crest: Mark; seal: Mark };
};

/* ---------------------------------------------------------------- */
/* Wallpapers                                                         */
/* ---------------------------------------------------------------- */

export const WALLPAPER_SIZES = {
  '1080p': { label: 'Desktop · 1920 × 1080', w: 1920, h: 1080 },
  '1440p': { label: 'Desktop · 2560 × 1440', w: 2560, h: 1440 },
  '4k': { label: 'Desktop · 3840 × 2160 (4K)', w: 3840, h: 2160 },
  ultrawide: { label: 'Ultrawide · 3440 × 1440', w: 3440, h: 1440 },
  phone: { label: 'Phone · 1179 × 2556', w: 1179, h: 2556 },
} as const;
export type WallpaperSize = keyof typeof WALLPAPER_SIZES;

export const WALLPAPER_STYLES = {
  marble: { label: 'Black marble', ground: 'marble-dark' },
  'marble-light': { label: 'White marble', ground: 'marble-light' },
  graphite: { label: 'Graphite', ground: null },
  blueprint: { label: 'Blueprint', ground: null },
} as const;
export type WallpaperStyle = keyof typeof WALLPAPER_STYLES;

export const wallpaperName = (id: string, style: WallpaperStyle, size: WallpaperSize) => `the-olympus-${id}-wallpaper-${style}-${size}.png`;

/** Where the crest sits: centred on desktops, a little high and wider on a phone. */
function placement(w: number, h: number): { size: number; cx: number; cy: number } {
  if (h > w) return { size: w * 0.74, cx: w / 2, cy: h * 0.5 };
  return { size: h * 0.58, cx: w / 2, cy: h / 2 };
}

const at = (x: number, y: number, k: number) => `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(5)})`;

/**
 * A wallpaper as SVG. Marble styles need `ground`: the PNG of the marble
 * (marbleScreen, encoded) at the wallpaper's size.
 */
export function wallpaperSvg(subject: ScreenSubject, style: WallpaperStyle, size: WallpaperSize, ground?: Uint8Array): string {
  const { w, h } = WALLPAPER_SIZES[size];
  const { size: s, cx, cy } = placement(w, h);
  const k = s / S;
  const t = at(cx - s / 2, cy - s / 2, k);
  const d = subject.marks.crest.d;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n<title>The Olympus — ${esc(subject.name)} — ${WALLPAPER_STYLES[style].label.toLowerCase()} wallpaper</title>\n`;
  if (style === 'marble' || style === 'marble-light') {
    if (!ground) throw new Error('wallpaperSvg: a marble style needs its ground');
    const dark = style === 'marble';
    const blur = h * 0.006;
    return `${open}<defs><filter id="lift" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="${(blur * 0.8).toFixed(2)}" stdDeviation="${blur.toFixed(2)}" flood-color="#000000" flood-opacity="${dark ? 0.6 : 0.2}"/></filter></defs>
<image width="${w}" height="${h}" preserveAspectRatio="none" href="data:image/png;base64,${base64(ground)}"/>
<g filter="url(#lift)"><path transform="${t}" d="${d}" fill="${dark ? P.marble : P.charcoal}"/></g>
</svg>
`;
  }
  if (style === 'graphite') {
    // Tone on tone: the crest pressed into a graphite ground, lit from above.
    const o = Math.max(1.5, s * 0.0022) / k;
    return `${open}<defs><radialGradient id="sheen" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#2C2C2C"/><stop offset="0.65" stop-color="#1A1A1A"/><stop offset="1" stop-color="#101010"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#sheen)"/>
<g transform="${t}"><path transform="translate(0 ${(-o).toFixed(3)})" d="${d}" fill="#0A0A0A"/><path transform="translate(0 ${o.toFixed(3)})" d="${d}" fill="#555555"/><path d="${d}" fill="#262626"/></g>
</svg>
`;
  }
  // Blueprint: a drawing sheet — grid, centre lines, the crest in outline, a title block.
  const grid = Math.round(Math.min(w, h) / 54);
  const major = grid * 5;
  const ox = (cx % major).toFixed(2);
  const oy = (cy % major).toFixed(2);
  const line = (text: string, size: number, role: 'inscription' | 'companion', x: number, y: number) => {
    const p = lineText(text, { cx: 0, baseline: 0, size: 100, tracking: role === 'inscription' ? 0.12 : 0.22, role });
    const kk = size / p.capHeight;
    return { d: `<path transform="${at(x, y, kk)}" d="${p.d}"/>`, width: p.width * kk };
  };
  const cap = Math.max(10, Math.min(w, h) * 0.016);
  const titleText = subject.name.toUpperCase();
  const subText = (subject.caption === DOMAIN ? DOMAIN : `${subject.caption} · ${DOMAIN}`).toUpperCase();
  const pad = cap * 1.2;
  const bw = Math.max(line(titleText, cap, 'inscription', 0, 0).width, line(subText, cap * 0.5, 'companion', 0, 0).width) + 2 * pad;
  const bh = cap * 2.9 + 2 * pad;
  const bx = w - bw - major * 0.6;
  const by = h - bh - major * 0.6;
  const tl = line(titleText, cap, 'inscription', bx + pad, by + pad + cap);
  const sl = line(subText, cap * 0.5, 'companion', bx + pad, by + pad + cap * 2.4);
  return `${open}<defs>
  <pattern id="minor" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M${grid} 0H0V${grid}" fill="none" stroke="#202020" stroke-width="1"/></pattern>
  <pattern id="major" width="${major}" height="${major}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><rect width="${major}" height="${major}" fill="url(#minor)"/><path d="M${major} 0H0V${major}" fill="none" stroke="#2B2B2B" stroke-width="1.5"/></pattern>
</defs>
<rect width="${w}" height="${h}" fill="#151515"/>
<rect width="${w}" height="${h}" fill="url(#major)"/>
<path d="M${cx} 0V${h}M0 ${cy}H${w}" stroke="#3A3A3A" stroke-width="1.2" stroke-dasharray="${grid * 1.6} ${grid * 0.4} ${grid * 0.3} ${grid * 0.4}"/>
<circle cx="${cx}" cy="${cy}" r="${(s / 2) * 1.08}" fill="none" stroke="#3A3A3A" stroke-width="1.2" stroke-dasharray="${grid * 0.5} ${grid * 0.3}"/>
<path transform="${t}" d="${d}" fill="${P.marble}" fill-opacity="0.05" stroke="${P.silver}" stroke-width="${(1.3 / k).toFixed(3)}"/>
<g fill="${P.silver}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#151515" stroke="${P.slate}" stroke-width="1.5"/>${tl.d}<g fill="${P.slate}">${sl.d}</g></g>
</svg>
`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ---------------------------------------------------------------- */
/* Boot screens                                                       */
/* ---------------------------------------------------------------- */

export const BOOT = { w: 1920, h: 1080 } as const;

/** The GRUB background: dark marble, the crest faint beneath the menu so the menu stays legible. */
export function grubSvg(subject: ScreenSubject, ground: Uint8Array): string {
  const { w, h } = BOOT;
  const s = h * 0.62;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image width="${w}" height="${h}" href="data:image/png;base64,${base64(ground)}"/><path transform="${at((w - s) / 2, (h - s) / 2, s / S)}" d="${subject.marks.crest.d}" fill="${P.marble}" fill-opacity="0.14"/></svg>\n`;
}

/** The crest alone in marble ink on transparent — the Plymouth theme draws it over the marble. */
export function crestSvg(subject: ScreenSubject): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><path d="${subject.marks.crest.d}" fill="${P.marble}"/></svg>\n`;
}

export const swatchSvg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" width="4" height="4"><rect width="4" height="4" fill="${fill}"/></svg>\n`;

export function grubScript(): string {
  return `#!/bin/sh
# The Olympus — GRUB background. Run as root.
#
#   sh install.sh            install the background and regenerate GRUB's menu
#   sh install.sh --restore  put /etc/default/grub back as it was
#
# For machines that boot with GRUB (most Debian, Ubuntu and Proxmox VE BIOS
# installs). A Proxmox VE node on ZFS with UEFI boots with systemd-boot: this
# changes nothing there.
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
CONF=/etc/default/grub
IMAGE=/boot/grub/the-olympus.png
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ -f "$CONF" ] || { echo "$CONF not found: this machine does not boot with GRUB" >&2; exit 1; }

regenerate() {
  if command -v update-grub >/dev/null 2>&1; then update-grub
  elif command -v grub-mkconfig >/dev/null 2>&1; then grub-mkconfig -o /boot/grub/grub.cfg
  else echo "neither update-grub nor grub-mkconfig found: regenerate GRUB's configuration by hand" >&2; fi
  if command -v proxmox-boot-tool >/dev/null 2>&1; then proxmox-boot-tool refresh || true; fi
}

if [ "\${1:-}" = "--restore" ]; then
  [ -f "$CONF.the-olympus.orig" ] && mv "$CONF.the-olympus.orig" "$CONF"
  rm -f "$IMAGE"
  regenerate
  echo "GRUB is back as it was."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }

install -D -m 644 "$DIR/background.png" "$IMAGE"
[ -f "$CONF.the-olympus.orig" ] || cp -p "$CONF" "$CONF.the-olympus.orig"
sed -i '/^#\\{0,1\\}GRUB_BACKGROUND=/d' "$CONF"
echo "GRUB_BACKGROUND=\\"$IMAGE\\"" >> "$CONF"
grep -q '^GRUB_GFXMODE=' "$CONF" || echo 'GRUB_GFXMODE="1920x1080,auto"' >> "$CONF"
regenerate
echo "The Olympus background is set; it shows at the next boot."
`;
}

export function plymouthTheme(): string {
  return `[Plymouth Theme]
Name=The Olympus
Description=The Olympus crest on black marble, with a quiet progress line.
ModuleName=script

[script]
ImageDir=/usr/share/plymouth/themes/the-olympus
ScriptFile=/usr/share/plymouth/themes/the-olympus/the-olympus.script
`;
}

export function plymouthScript(): string {
  return `# The Olympus — Plymouth boot theme (script plugin).
# The marble fills the screen; the crest sits above a thin progress line;
# passphrase prompts (encrypted disks) and messages appear beneath it.

Window.SetBackgroundTopColor(0.055, 0.055, 0.055);
Window.SetBackgroundBottomColor(0.055, 0.055, 0.055);

screen_x = Window.GetX();
screen_y = Window.GetY();
screen_w = Window.GetWidth();
screen_h = Window.GetHeight();

marble = Image("background.png");
cover = Math.Max(screen_w / marble.GetWidth(), screen_h / marble.GetHeight());
marble_w = Math.Int(marble.GetWidth() * cover);
marble_h = Math.Int(marble.GetHeight() * cover);
ground = Sprite(marble.Scale(marble_w, marble_h));
ground.SetX(screen_x + (screen_w - marble_w) / 2);
ground.SetY(screen_y + (screen_h - marble_h) / 2);
ground.SetZ(-100);

crest_size = Math.Int(Math.Min(screen_w, screen_h) * 0.42);
crest = Sprite(Image("crest.png").Scale(crest_size, crest_size));
crest_top = screen_y + Math.Int(screen_h * 0.44) - crest_size / 2;
crest.SetX(screen_x + (screen_w - crest_size) / 2);
crest.SetY(crest_top);
crest.SetZ(10);

bar_w = Math.Int(crest_size * 0.7);
bar_x = screen_x + (screen_w - bar_w) / 2;
bar_y = crest_top + crest_size + Math.Int(screen_h * 0.05);
track = Sprite(Image("track.png").Scale(bar_w, 2));
track.SetX(bar_x);
track.SetY(bar_y);
track.SetZ(10);
fill_image = Image("fill.png");
fill = Sprite();
fill.SetX(bar_x);
fill.SetY(bar_y);
fill.SetZ(11);

fun progress_callback(duration, progress) {
  width = Math.Int(bar_w * progress);
  if (width < 1) width = 1;
  fill.SetImage(fill_image.Scale(width, 2));
}
Plymouth.SetBootProgressFunction(progress_callback);

prompt = Sprite();
prompt.SetZ(20);
entry = Sprite();
entry.SetZ(20);
message = Sprite();
message.SetZ(20);

fun centre(sprite, image, y) {
  sprite.SetImage(image);
  sprite.SetX(screen_x + (screen_w - image.GetWidth()) / 2);
  sprite.SetY(y);
  sprite.SetOpacity(1);
}

fun password_callback(text, bullets) {
  centre(prompt, Image.Text(text, 0.93, 0.93, 0.93), bar_y + 24);
  dots = "";
  i = 0;
  while (i < bullets && i < 40) {
    dots = dots + "•";
    i = i + 1;
  }
  if (dots == "") dots = " ";
  centre(entry, Image.Text(dots, 0.93, 0.93, 0.93), bar_y + 52);
}
Plymouth.SetDisplayPasswordFunction(password_callback);

fun question_callback(text, answer) {
  centre(prompt, Image.Text(text, 0.93, 0.93, 0.93), bar_y + 24);
  if (answer == "") answer = " ";
  centre(entry, Image.Text(answer, 0.93, 0.93, 0.93), bar_y + 52);
}
Plymouth.SetDisplayQuestionFunction(question_callback);

fun normal_callback() {
  prompt.SetOpacity(0);
  entry.SetOpacity(0);
}
Plymouth.SetDisplayNormalFunction(normal_callback);

fun message_callback(text) {
  centre(message, Image.Text(text, 0.6, 0.6, 0.6), screen_y + screen_h - 60);
}
Plymouth.SetMessageFunction(message_callback);
`;
}

export function plymouthInstall(): string {
  return `#!/bin/sh
# The Olympus — Plymouth boot theme. Run as root on a machine with Plymouth
# (apt install plymouth, or pacman -S plymouth); the kernel command line needs
# "quiet splash".
#
#   sh install.sh            install the theme, make it the default, rebuild the initramfs
#   sh install.sh --restore  go back to the distribution's theme
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
DEST=/usr/share/plymouth/themes/the-olympus
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
command -v plymouth-set-default-theme >/dev/null 2>&1 || { echo "Plymouth is not installed (apt install plymouth, or pacman -S plymouth)" >&2; exit 1; }

if [ "\${1:-}" = "--restore" ]; then
  if [ -f "$DEST/previous" ]; then plymouth-set-default-theme -R "$(cat "$DEST/previous")"; else plymouth-set-default-theme -r; plymouth-set-default-theme -R "$(plymouth-set-default-theme)"; fi
  rm -rf "$DEST"
  echo "Plymouth is back to its previous theme."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }

current=$(plymouth-set-default-theme)
mkdir -p "$DEST"
[ "$current" = "the-olympus" ] || echo "$current" > "$DEST/previous"
for f in the-olympus.plymouth the-olympus.script background.png crest.png track.png fill.png; do install -m 644 "$DIR/the-olympus/$f" "$DEST/$f"; done
plymouth-set-default-theme -R the-olympus
# Arch and CachyOS: Plymouth runs only if the initramfs has its hook.
if [ -f /etc/mkinitcpio.conf ] && ! grep -Eqs '^[[:space:]]*HOOKS=.*[( ]plymouth[ )]' /etc/mkinitcpio.conf /etc/mkinitcpio.conf.d/*.conf; then
  echo "note: add plymouth to HOOKS in /etc/mkinitcpio.conf (after base and udev or systemd), then run mkinitcpio -P" >&2
fi
echo "The Olympus boot theme is installed; it shows at the next boot."
`;
}

/* ---------------------------------------------------------------- */
/* The terminal                                                       */
/* ---------------------------------------------------------------- */

const spaced = (s: string) => s.toUpperCase().split(' ').map((w) => [...w].join(' ')).join('   ');

/** The seal, with the name and its lines set beside it, vertically centred. */
function beside(art: string[], lines: string[], gap = 4): string[] {
  const width = Math.max(...art.map((l) => [...l].length));
  const top = Math.max(0, Math.floor((art.length - lines.length) / 2));
  return art.map((l, i) => {
    const text = lines[i - top];
    return (text === undefined ? l : l + ' '.repeat(width - [...l].length + gap) + text).trimEnd();
  });
}

/** Text for terminals that may know only ASCII: the middle dot becomes a hyphen, accents fall away. */
const plain = (s: string) => s.replace(/·/g, '-').normalize('NFKD').replace(/[^\x20-\x7E]/g, '');

/** The name, its caption, and its address unless the caption already is it (the master's). */
const textLines = (subject: ScreenSubject, ascii = false) =>
  [spaced(oneLine(subject.name)), '', oneLine(subject.caption), ...(subject.url && !subject.url.endsWith(`//${subject.caption}`) ? [oneLine(subject.url)] : [])].map((l) => (ascii ? plain(l) : l));

/** Lines for a shell script to print: each one a single-quoted word, so no text can end anything early. */
const printLines = (text: string) => `printf '%s\\n' \\\n${text.split('\n').map((l) => `  ${shQuote(l)}`).join(' \\\n')}`;

/** The message of the day, drawn in braille (fine; needs a font with braille) or ASCII (any terminal). */
export function motd(subject: ScreenSubject, kind: 'braille' | 'ascii'): string {
  const d = subject.marks.seal.d;
  const art = kind === 'braille' ? braille(d, S, S, 24) : ascii(d, S, S, 30);
  return beside(art, textLines(subject, kind === 'ascii')).join('\n') + '\n';
}

/** /etc/update-motd.d/ script: the crest, then the host and how long it has been up. */
export function motdScript(subject: ScreenSubject): string {
  return `#!/bin/sh
# The Olympus — message of the day. Install as /etc/update-motd.d/20-the-olympus
# (executable). Set OLYMPUS_ART=ascii in /etc/default/the-olympus for terminals
# without braille.
[ -r /etc/default/the-olympus ] && . /etc/default/the-olympus
echo
if [ "\${OLYMPUS_ART:-braille}" = ascii ]; then
${printLines(motd(subject, 'ascii').trimEnd())}
else
${printLines(motd(subject, 'braille').trimEnd())}
fi
echo
printf '  %s · up %s\\n\\n' "$(hostname -f 2>/dev/null || hostname)" "$(uptime -p 2>/dev/null | sed 's/^up //')"
`;
}

/** /etc/issue: the console login. Getty fills in \\n (the host) and \\l (the terminal). */
export function issue(subject: ScreenSubject): string {
  const art = ascii(subject.marks.seal.d, S, S, 30);
  // Getty reads backslashes as its escapes: the name's and caption's are doubled.
  const lit = (s: string) => plain(s).replace(/\\/g, '\\\\');
  return beside(art, [lit(spaced(oneLine(subject.name))), '', lit(oneLine(subject.caption)), '', '\\n - \\l']).join('\n') + '\n\n';
}

/** The SSH banner, shown before login: plain ASCII, and nothing about the system beyond its name. */
export function sshBanner(subject: ScreenSubject): string {
  const art = ascii(subject.marks.seal.d, S, S, 24);
  return '\n' + beside(art, [plain(spaced(oneLine(subject.name))), '', plain(oneLine(subject.caption)), '', 'Private system. Authorised access only.']).join('\n') + '\n\n';
}

export function terminalInstall(): string {
  return `#!/bin/sh
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

if [ "\${1:-}" = "--restore" ]; then
  rm -f "$MOTD" "$BANNER" "$DROPIN" /etc/default/the-olympus /etc/motd.d/the-olympus
  [ -f /etc/issue.the-olympus.orig ] && mv /etc/issue.the-olympus.orig /etc/issue
  reload_ssh || true
  echo "Removed."
  exit 0
fi
art=braille
case "\${1:-}" in
  "") ;;
  --ascii) art=ascii ;;
  *) echo "unknown option: $1" >&2; exit 2 ;;
esac

# Message of the day. Debian, Ubuntu, Proxmox VE: a script pam_motd runs at login, with the host and uptime.
# Arch, CachyOS and other systems whose pam_motd reads /etc/motd.d/: the crest as text.
if [ -d /etc/update-motd.d ]; then
  install -m 755 "$DIR/20-the-olympus" "$MOTD"
  echo "OLYMPUS_ART=$art" > /etc/default/the-olympus
elif grep -qs pam_motd /etc/pam.d/system-login /etc/pam.d/login /etc/pam.d/sshd; then
  install -D -m 644 "$DIR/motd-$art.txt" /etc/motd.d/the-olympus
else
  echo "no /etc/update-motd.d and no pam_motd: copy motd-$art.txt to /etc/motd instead" >&2
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
`;
}

/* ---------------------------------------------------------------- */
/* Wallpapers, installed                                              */
/* ---------------------------------------------------------------- */

const kdeId = (style: string) => `TheOlympus-${style.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`;

/**
 * The wallpapers, offered in the desktop's own picker: GNOME, Cinnamon and
 * MATE read background properties; KDE Plasma reads wallpaper packages, one
 * per style, choosing the image that best fits the screen.
 */
/** GNOME's list of the wallpapers (background properties), installed beside them. */
export function wallpaperList(subject: ScreenSubject): string {
  const styles = Object.keys(WALLPAPER_STYLES) as WallpaperStyle[];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE wallpapers SYSTEM "gnome-wp-list.dtd">
<wallpapers>
${styles
  .map(
    (style) => `  <wallpaper deleted="false">
    <name>${xmlEscape(`${subject.name} — ${WALLPAPER_STYLES[style].label}`)}</name>
    <filename>/usr/share/backgrounds/the-olympus/${wallpaperName(subject.id, style, '4k')}</filename>
    <options>zoom</options>
    <shade_type>solid</shade_type>
    <pcolor>${P.obsidian}</pcolor>
    <scolor>${P.obsidian}</scolor>
  </wallpaper>`,
  )
  .join('\n')}
</wallpapers>
`;
}

export function wallpaperInstall(subject: ScreenSubject): string {
  const styles = Object.keys(WALLPAPER_STYLES) as WallpaperStyle[];
  const sizes = Object.keys(WALLPAPER_SIZES) as WallpaperSize[];
  const title = (style: WallpaperStyle) => `${oneLine(subject.name)} — ${WALLPAPER_STYLES[style].label}`;
  const kde = styles
    .map((style) => {
      const d = `"$KDE/${kdeId(style)}"`;
      const meta = JSON.stringify({ KPlugin: { Id: kdeId(style), Name: title(style), Authors: [{ Name: 'The Olympus' }], License: 'All rights reserved' } });
      return [
        `mkdir -p ${d}/contents/images`,
        ...sizes.map((size) => `ln -sf "$DEST/${wallpaperName(subject.id, style, size)}" ${d}/contents/images/${WALLPAPER_SIZES[size].w}x${WALLPAPER_SIZES[size].h}.png`),
        `printf '%s\\n' '${meta.replace(/'/g, `'\\''`)}' > ${d}/metadata.json`,
      ].join('\n');
    })
    .join('\n');
  return `#!/bin/sh
# ${commentText(subject.name)} — wallpapers, offered in the desktop's own picker. Run as root.
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

if [ "\${1:-}" = "--restore" ]; then
  rm -rf "$DEST" "$GNOME"${styles.map((s) => ` "$KDE/${kdeId(s)}"`).join('')}
  echo "The wallpapers are removed. Anyone using one keeps a blank background until they choose another."
  exit 0
fi
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }

mkdir -p "$DEST"
for f in "$DIR"/*.png; do install -m 644 "$f" "$DEST/"; done
mkdir -p "$(dirname "$GNOME")"
install -m 644 "$DIR/the-olympus-wallpapers.xml" "$GNOME"
${kde}
echo "The wallpapers are in the desktop's background settings."
`;
}

/* ---------------------------------------------------------------- */
/* The whole set                                                      */
/* ---------------------------------------------------------------- */

export type ScreenFile = { path: string; data: string | Uint8Array };
export type ScreenHost = {
  /** Render SVG to PNG at a pixel width. `gray`: everything is neutral — an 8-bit gray PNG is enough. */
  png: (svg: string, width: number, opts?: { gray?: boolean }) => Uint8Array | Promise<Uint8Array>;
  /** A marble ground as an encoded gray PNG. */
  ground: (w: number, h: number, tone: 'marble-dark' | 'marble-light') => Uint8Array | Promise<Uint8Array>;
  /** The SHA-256 of a file, in hex: the one-command installer checks what it fetches. */
  sha256: (data: string | Uint8Array) => string | Promise<string>;
};

export async function screensKit(subject: ScreenSubject, host: ScreenHost, { wallpapers = true } = {}): Promise<ScreenFile[]> {
  const files: ScreenFile[] = [];
  const add = (path: string, data: string | Uint8Array) => files.push({ path, data });
  if (wallpapers)
    for (const style of Object.keys(WALLPAPER_STYLES) as WallpaperStyle[])
      for (const size of Object.keys(WALLPAPER_SIZES) as WallpaperSize[]) {
        const { w, h } = WALLPAPER_SIZES[size];
        const tone = WALLPAPER_STYLES[style].ground;
        const ground = tone ? await host.ground(w, h, tone) : undefined;
        add(`wallpapers/${wallpaperName(subject.id, style, size)}`, await host.png(wallpaperSvg(subject, style, size, ground), w, { gray: true }));
      }
  if (wallpapers) {
    add('wallpapers/install.sh', wallpaperInstall(subject));
    add('wallpapers/the-olympus-wallpapers.xml', wallpaperList(subject));
  }
  const boot = await host.ground(BOOT.w, BOOT.h, 'marble-dark');
  // GRUB reads 8-bit RGB(A) PNGs, not gray ones.
  add('boot/grub/background.png', await host.png(grubSvg(subject, boot), BOOT.w));
  add('boot/grub/install.sh', grubScript());
  // Limine shows the same picture as GRUB: the crest faint on black marble.
  add('boot/limine/install.sh', limineInstall(subject));
  add('boot/limine/wallpaper.png', files.find((f) => f.path === 'boot/grub/background.png')!.data);
  add('boot/plymouth/install.sh', plymouthInstall());
  add('boot/plymouth/the-olympus/the-olympus.plymouth', plymouthTheme());
  add('boot/plymouth/the-olympus/the-olympus.script', plymouthScript());
  add('boot/plymouth/the-olympus/background.png', boot);
  add('boot/plymouth/the-olympus/crest.png', await host.png(crestSvg(subject), 1024));
  add('boot/plymouth/the-olympus/track.png', await host.png(swatchSvg(P.graphite), 4));
  add('boot/plymouth/the-olympus/fill.png', await host.png(swatchSvg(P.marble), 4));
  add('terminal/motd-braille.txt', motd(subject, 'braille'));
  add('terminal/motd-ascii.txt', motd(subject, 'ascii'));
  add('terminal/20-the-olympus', motdScript(subject));
  add('terminal/issue', issue(subject));
  add('terminal/issue.net', sshBanner(subject));
  add('terminal/install.sh', terminalInstall());
  // Your own terminal: per user, with its own one-command installer.
  // Omarchy takes the wallpapers as its theme's backgrounds.
  const backgrounds = (['marble', 'graphite', 'blueprint'] as const)
    .map((style): [string, Uint8Array] | null => {
      const f = files.find((x) => x.path === `wallpapers/${wallpaperName(subject.id, style, '1440p')}`);
      return f && typeof f.data !== 'string' ? [`${style}.png`, f.data] : null;
    })
    .filter((x): x is [string, Uint8Array] => x !== null);
  for (const [path, data] of shellFiles(subject, backgrounds)) add(path, data);
  // One command for all of it: the parts present, every file they need with its checksum.
  const parts = SCREEN_PARTS.filter((p) => files.some((f) => f.path.startsWith(`${p.dir}/`)));
  const manifest = await Promise.all(
    files
      .map((f) => ({ f, part: parts.find((p) => f.path.startsWith(`${p.dir}/`)) }))
      .filter((x) => x.part)
      .sort((a, b) => a.f.path.localeCompare(b.f.path))
      .map(async ({ f, part }) => ({ part: part!.id, path: f.path, sha256: await host.sha256(f.data) })),
  );
  const base = subject.id === 'master' ? 'files/assets/screens/' : `files/assets/screens/services/${subject.id}/`;
  add('install.sh', screensInstaller(parts, manifest, { path: base }));
  const shellParts = SHELL_PARTS.map((p) => ({ ...p, dir: p.dir.slice('shell/'.length) }));
  const shellManifest = await Promise.all(
    files
      .filter((f) => f.path.startsWith('shell/') && !f.path.startsWith('shell/schemes/'))
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(async (f) => ({ part: SHELL_PARTS.find((p) => f.path.startsWith(`${p.dir}/`))!.id, path: f.path.slice('shell/'.length), sha256: await host.sha256(f.data) })),
  );
  const umbrella = files.find((f) => f.path === 'install.sh')!.data as string;
  const shellUmbrella = screensInstaller(shellParts, shellManifest, { path: `${base}shell/`, user: true });
  add('shell/install.sh', shellUmbrella);
  add('shell/README.md', shellGuide(subject));
  // Arch, CachyOS, Omarchy: the same files as a pacman package, each pinned by its checksum.
  const local: [string, string][] = [['the-olympus', archCommand], ['the-olympus-terminal', archTerminalCommand], ['the-olympus.install', archInstallHooks]];
  const pinned = archFiles(manifest, shellManifest, [
    { path: 'install.sh', sha256: await host.sha256(umbrella) },
    { path: 'shell/install.sh', sha256: await host.sha256(shellUmbrella) },
  ]);
  for (const [name, text] of local) add(`arch/${name}`, text);
  add('arch/PKGBUILD', pkgbuild({ id: subject.id, files: pinned, base, local: await Promise.all(local.map(async ([name, text]) => ({ name, sha256: await host.sha256(text) }))) }));
  add('README.md', screensReadme(subject, wallpapers));
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function screensReadme(subject: ScreenSubject, wallpapers: boolean): string {
  const sizes = Object.values(WALLPAPER_SIZES).map((s) => s.label).join('; ');
  const styles = Object.values(WALLPAPER_STYLES).map((s) => s.label.toLowerCase()).join(', ');
  return `# ${mdText(subject.name)} — screens

Generated by \`npm run screens${subject.id === 'master' ? '' : ` -- ${subject.id}`}\`. The guide's chapter *Screens* explains each part.
${wallpapers ? `
## Wallpapers — \`wallpapers/\`

${styles[0].toUpperCase()}${styles.slice(1)}; each at ${sizes}. Grayscale PNGs.
` : ''}
## Boot — \`boot/\`

- \`grub/\` — a background for the GRUB menu (dark marble, the crest faint beneath
  the menu). \`sudo sh install.sh\` sets it and regenerates GRUB's menu;
  \`--restore\` undoes it.
- \`plymouth/\` — a boot splash theme: the crest on marble, a thin progress line,
  the passphrase prompt for encrypted disks. \`sudo sh install.sh\`; \`--restore\`.

## Terminal — \`terminal/\`

- \`20-the-olympus\` — the message of the day: the seal drawn in braille (or
  ASCII), the name beside it, then the host and its uptime.
- \`issue\` — the console login screen; \`issue.net\` — the SSH banner, shown
  before the password prompt (plain ASCII; it names nothing but the house).
- \`sudo sh install.sh\` installs all three (\`--ascii\` for terminals without
  braille; \`--restore\` removes them).

The scripts are written for Debian, Ubuntu and Proxmox VE. They keep a copy of
every file they change and check the SSH configuration before reloading it.
They have not been run on a live machine here.
`;
}
