// The house's terminal colours: grey grounds and text, and for the six colours
// that tell things apart in a program — an error, an addition, a folder — the
// house's pigments (gold, rosso antico, verde antico, lapis, porphyry,
// aquamarine), muted like stone. Black and white stay grey. A grey set of
// sixteen remains for screens that must stay grey (the boot menu). Then each
// terminal's own format for the same sixteen.

import { PALETTE } from '../brand/palette.ts';
import { ANSI_PIGMENTS, PIGMENTS } from '../brand/pigments.ts';

const P = PALETTE;

export type Tone = 'dark' | 'light';
export const ANSI = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const;

export type Scheme = {
  name: string;
  tone: Tone;
  background: string;
  foreground: string;
  bold: string;
  cursor: string;
  cursorText: string;
  selection: string;
  selectionText: string;
  /** The eight normal colours, then the eight bright ones. */
  ansi: string[];
};

export const SCHEMES: Record<Tone, Scheme> = {
  dark: {
    name: 'The Olympus',
    tone: 'dark',
    background: P.obsidian,
    foreground: P.ash,
    bold: P.paper,
    cursor: P.marble,
    cursorText: P.obsidian,
    selection: P.graphite,
    selectionText: P.paper,
    // black, the six pigments, white; then the same, bright.
    ansi: [P.charcoal, ...ANSI_PIGMENTS.map((p) => PIGMENTS[p].dark), P.ash, '#5E5E5E', ...ANSI_PIGMENTS.map((p) => PIGMENTS[p].darkBright), P.paper],
  },
  light: {
    name: 'The Olympus Light',
    tone: 'light',
    background: P.paper,
    foreground: P.charcoal,
    bold: P.obsidian,
    cursor: P.charcoal,
    cursorText: P.paper,
    selection: P.ash,
    selectionText: P.obsidian,
    ansi: [P.charcoal, ...ANSI_PIGMENTS.map((p) => PIGMENTS[p].light), '#8E8E8E', '#4E4E4E', ...ANSI_PIGMENTS.map((p) => PIGMENTS[p].lightBright), P.obsidian],
  },
};

/** The sixteen as greys, told apart by lightness alone: for screens that stay grey (the boot menu). */
export const STONE_ANSI = [P.charcoal, '#8A8A8A', '#B4B4B4', '#D2D2D2', '#727272', P.silver, '#C2C2C2', '#DADADA', '#6A6A6A', '#A6A6A6', '#C8C8C8', '#E6E6E6', '#8E8E8E', '#B0B0B0', '#D6D6D6', P.paper];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lower = (hex: string) => hex.toLowerCase();

/** Windows Terminal: a scheme for settings.json → "schemes". */
export function windowsTerminal(s: Scheme): string {
  const [n, b] = [s.ansi.slice(0, 8), s.ansi.slice(8)];
  const key = (i: number) => (ANSI[i] === 'magenta' ? 'purple' : ANSI[i]);
  const entries: [string, string][] = [
    ['name', s.name],
    ['background', s.background],
    ['foreground', s.foreground],
    ['cursorColor', s.cursor],
    ['selectionBackground', s.selection],
    ...n.map((c, i): [string, string] => [key(i), c]),
    ...b.map((c, i): [string, string] => [`bright${key(i)[0].toUpperCase()}${key(i).slice(1)}`, c]),
  ];
  return JSON.stringify(Object.fromEntries(entries), null, 2) + '\n';
}

/** Alacritty (0.13 or later): a TOML file to import. */
export function alacritty(s: Scheme): string {
  const group = (name: string, cs: string[]) => `[colors.${name}]\n${ANSI.map((a, i) => `${a} = "${lower(cs[i])}"`).join('\n')}`;
  return `# ${s.name} — Alacritty colours.
[colors.primary]
background = "${lower(s.background)}"
foreground = "${lower(s.foreground)}"
bright_foreground = "${lower(s.bold)}"

[colors.cursor]
cursor = "${lower(s.cursor)}"
text = "${lower(s.cursorText)}"

[colors.selection]
background = "${lower(s.selection)}"
text = "${lower(s.selectionText)}"

${group('normal', s.ansi.slice(0, 8))}

${group('bright', s.ansi.slice(8))}
`;
}

/** kitty: a conf file to include. */
export function kitty(s: Scheme): string {
  return `# ${s.name} — kitty colours.
background ${lower(s.background)}
foreground ${lower(s.foreground)}
cursor ${lower(s.cursor)}
cursor_text_color ${lower(s.cursorText)}
selection_background ${lower(s.selection)}
selection_foreground ${lower(s.selectionText)}
${s.ansi.map((c, i) => `color${i} ${lower(c)}`).join('\n')}
`;
}

/** WezTerm: a colour scheme file for ~/.config/wezterm/colors/. */
export function wezterm(s: Scheme): string {
  const list = (cs: string[]) => `[${cs.map((c) => `"${lower(c)}"`).join(', ')}]`;
  return `# ${s.name} — WezTerm colour scheme.
[colors]
background = "${lower(s.background)}"
foreground = "${lower(s.foreground)}"
cursor_bg = "${lower(s.cursor)}"
cursor_fg = "${lower(s.cursorText)}"
cursor_border = "${lower(s.cursor)}"
selection_bg = "${lower(s.selection)}"
selection_fg = "${lower(s.selectionText)}"
ansi = ${list(s.ansi.slice(0, 8))}
brights = ${list(s.ansi.slice(8))}

[metadata]
name = "${s.name}"
`;
}

/** iTerm2: an .itermcolors file (a property list) to import. */
export function itermColors(s: Scheme): string {
  const color = (key: string, hex: string) => {
    const [r, g, b] = rgb(hex).map((v) => (v / 255).toFixed(6));
    return `\t<key>${key}</key>\n\t<dict>\n\t\t<key>Alpha Component</key>\n\t\t<real>1</real>\n\t\t<key>Blue Component</key>\n\t\t<real>${b}</real>\n\t\t<key>Color Space</key>\n\t\t<string>sRGB</string>\n\t\t<key>Green Component</key>\n\t\t<real>${g}</real>\n\t\t<key>Red Component</key>\n\t\t<real>${r}</real>\n\t</dict>`;
  };
  const keys: [string, string][] = [
    ...s.ansi.map((c, i): [string, string] => [`Ansi ${i} Color`, c]),
    ['Background Color', s.background],
    ['Bold Color', s.bold],
    ['Cursor Color', s.cursor],
    ['Cursor Text Color', s.cursorText],
    ['Foreground Color', s.foreground],
    ['Selected Text Color', s.selectionText],
    ['Selection Color', s.selection],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${keys.map(([k, c]) => color(k, c)).join('\n')}
</dict>
</plist>
`;
}

/** The scheme as dconf keys for a GNOME Terminal profile. */
export function gnomeTerminalProfile(s: Scheme): string {
  const q = (hex: string) => `'${lower(hex)}'`;
  return `[/]
visible-name='${s.name}'
use-theme-colors=false
background-color=${q(s.background)}
foreground-color=${q(s.foreground)}
bold-color-same-as-fg=false
bold-color=${q(s.bold)}
cursor-colors-set=true
cursor-background-color=${q(s.cursor)}
cursor-foreground-color=${q(s.cursorText)}
highlight-colors-set=true
highlight-background-color=${q(s.selection)}
highlight-foreground-color=${q(s.selectionText)}
palette=[${s.ansi.map(q).join(', ')}]
`;
}

/** Ptyxis (GNOME's newer terminal): one palette file holds the light and the dark scheme. */
export function ptyxis(light: Scheme, dark: Scheme): string {
  const section = (title: string, s: Scheme) => `[${title}]
Foreground=${s.foreground}
Background=${s.background}
${s.ansi.map((c, i) => `Color${i}=${c}`).join('\n')}

BellForeground=${s.background}
BellBackground=${s.foreground}
RemoteForeground=${s.bold}
RemoteBackground=${s.selection}
SuperuserForeground=${s.cursorText}
SuperuserBackground=${s.cursor}`;
  return `[Palette]
Name=The Olympus

${section('Light', light)}

${section('Dark', dark)}
`;
}

/* ---------------------------------------------------------------- */
/* macOS Terminal                                                     */
/* ---------------------------------------------------------------- */

type Plist = string | number | Uint8Array | { uid: number } | Plist[] | { [k: string]: Plist };

/**
 * A compact property list (bplist00) — the format of an archived object in a
 * Terminal profile. Only what an archived colour needs: dictionaries, arrays,
 * ASCII strings, integers, data and object references.
 */
function bplist(root: Plist): Uint8Array {
  const objects: Uint8Array[] = [];
  const marker = (type: number, n: number): number[] => (n < 15 ? [(type << 4) | n] : [(type << 4) | 15, 0x10, n]);
  const add = (v: Plist): number => {
    const i = objects.length;
    objects.push(new Uint8Array());
    let bytes: number[];
    if (typeof v === 'string') bytes = [...marker(5, v.length), ...[...v].map((c) => c.charCodeAt(0))];
    else if (typeof v === 'number') bytes = v < 0x100 ? [0x10, v] : v < 0x10000 ? [0x11, v >> 8, v & 255] : [0x12, (v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255];
    else if (v instanceof Uint8Array) bytes = [...marker(4, v.length), ...v];
    else if (Array.isArray(v)) {
      const refs = v.map(add);
      bytes = [...marker(10, refs.length), ...refs];
    } else if ('uid' in v && Object.keys(v).length === 1) bytes = [0x80, v.uid as number];
    else {
      const entries = Object.entries(v as Record<string, Plist>);
      const keys = entries.map(([k]) => add(k));
      const values = entries.map(([, x]) => add(x));
      bytes = [...marker(13, entries.length), ...keys, ...values];
    }
    objects[i] = Uint8Array.from(bytes);
    return i;
  };
  add(root);
  if (objects.length > 255) throw new Error('bplist: too many objects for one-byte references');
  const head = new TextEncoder().encode('bplist00');
  const offsets: number[] = [];
  let at = head.length;
  for (const o of objects) {
    offsets.push(at);
    at += o.length;
  }
  const offSize = at < 256 ? 1 : 2;
  const table = offsets.flatMap((o) => (offSize === 1 ? [o] : [o >> 8, o & 255]));
  const trailer = [0, 0, 0, 0, 0, 0, offSize, 1, ...[0, 0, 0, 0, 0, 0, 0, objects.length], ...[0, 0, 0, 0, 0, 0, 0, 0], ...[0, 0, 0, 0, 0, 0, at >> 8, at & 255]];
  const out = new Uint8Array(at + table.length + trailer.length);
  out.set(head, 0);
  let p = head.length;
  for (const o of objects) {
    out.set(o, p);
    p += o.length;
  }
  out.set(table, p);
  out.set(trailer, p + table.length);
  return out;
}

/** An NSColor (calibrated RGB) archived the way Terminal stores its colours. */
function archivedColor(hex: string): Uint8Array {
  const [r, g, b] = rgb(hex).map((v) => (v / 255).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''));
  const rgbText = new TextEncoder().encode(`${r} ${g} ${b}\0`);
  return bplist({
    $archiver: 'NSKeyedArchiver',
    $objects: ['$null', { NSColorSpace: 1, NSRGB: rgbText, $class: { uid: 2 } }, { $classname: 'NSColor', $classes: ['NSColor', 'NSObject'] }],
    $top: { root: { uid: 1 } },
    $version: 100000,
  } as unknown as Plist);
}

const base64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

/** macOS Terminal: a .terminal profile to double-click. */
export function terminalApp(s: Scheme): string {
  const names = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'];
  const colors: [string, string][] = [
    ['BackgroundColor', s.background],
    ['TextColor', s.foreground],
    ['TextBoldColor', s.bold],
    ['CursorColor', s.cursor],
    ['SelectionColor', s.selection],
    ...names.map((n, i): [string, string] => [`ANSI${n}Color`, s.ansi[i]]),
    ...names.map((n, i): [string, string] => [`ANSIBright${n}Color`, s.ansi[8 + i]]),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${colors.map(([k, c]) => `\t<key>${k}</key>\n\t<data>${base64(archivedColor(c))}</data>`).join('\n')}
\t<key>name</key>
\t<string>${s.name}</string>
\t<key>type</key>
\t<string>Window Settings</string>
\t<key>ProfileCurrentVersion</key>
\t<real>2.07</real>
</dict>
</plist>
`;
}
