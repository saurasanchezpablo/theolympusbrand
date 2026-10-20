// The parts of the screens kit, and the one script that installs them.
//
// Each part is a folder with its own install.sh (which also takes --restore).
// This registry says, for each, how to tell whether a machine can take it and
// whether it is installed, and which options it accepts. To add a part:
// generate its folder in screensKit and list it here; to drop one, remove it
// from both. The umbrella install.sh is written from this list, with every
// file it may need and that file's SHA-256, so it can fetch the parts from
// the house's site and check them before running anything.

export type ScreenPart = {
  id: string;
  label: string;
  /** Its folder in the kit; its installer is <dir>/install.sh. */
  dir: string;
  /** A shell test: can this machine take it? */
  fits: string;
  /** A shell test: is it installed (so --restore has something to undo)? */
  installed: string;
  /** Why it is skipped, when `fits` fails. */
  unfit: string;
  /** Options its installer accepts, besides --restore. */
  options: readonly string[];
};

export const SCREEN_PARTS: readonly ScreenPart[] = [
  {
    id: 'grub',
    label: 'GRUB background',
    dir: 'boot/grub',
    fits: '[ -f /etc/default/grub ]',
    installed: '[ -f /etc/default/grub.the-olympus.orig ]',
    unfit: 'this machine does not boot with GRUB',
    options: [],
  },
  {
    id: 'limine',
    label: 'Limine boot menu',
    dir: 'boot/limine',
    fits: '( for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do [ -f "$c" ] && exit 0; done; exit 1 )',
    installed: '( for c in ${LIMINE_CONF:-} /boot/limine.conf /boot/limine/limine.conf /boot/EFI/limine/limine.conf /efi/limine.conf /efi/EFI/limine/limine.conf /boot/efi/limine.conf /boot/efi/EFI/limine/limine.conf /boot/EFI/BOOT/limine.conf; do grep -qsF "# The Olympus — begin" "$c" && exit 0; done; exit 1 )',
    unfit: 'this machine does not boot with Limine',
    options: [],
  },
  {
    id: 'plymouth',
    label: 'Plymouth boot splash',
    dir: 'boot/plymouth',
    fits: 'command -v plymouth-set-default-theme >/dev/null 2>&1',
    installed: '[ -d /usr/share/plymouth/themes/the-olympus ]',
    unfit: 'Plymouth is not installed (apt install plymouth, or pacman -S plymouth)',
    options: [],
  },
  {
    id: 'terminal',
    label: 'Terminal: message of the day, console login, SSH banner',
    dir: 'terminal',
    fits: '[ -f /etc/issue ]',
    installed: '[ -f /etc/update-motd.d/20-the-olympus ] || [ -f /etc/motd.d/the-olympus ] || [ -f /etc/issue.the-olympus.orig ]',
    unfit: 'no /etc/issue: not a Linux system with a console login',
    options: ['--ascii'],
  },
  {
    id: 'wallpapers',
    label: 'Wallpapers, in the desktop’s own picker',
    dir: 'wallpapers',
    fits: '[ -d /usr/share/xsessions ] || [ -d /usr/share/wayland-sessions ]',
    installed: '[ -d /usr/share/backgrounds/the-olympus ]',
    unfit: 'no desktop installed',
    options: [],
  },
];

/** A file the umbrella script may fetch: which part it belongs to, where it is, its SHA-256. */
export type ManifestLine = { part: string; path: string; sha256: string };

const shWord = (s: string) => (/^[\w./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

/** The umbrella installer for a kit with these parts (in the order given) and files. */
export function screensInstaller(parts: readonly ScreenPart[], manifest: readonly ManifestLine[], { site = '<your site>', path = 'files/assets/screens/', user = false } = {}): string {
  const ids = parts.map((p) => p.id);
  const options = [...new Set(parts.flatMap((p) => p.options))];
  const caseOf = (key: keyof ScreenPart, indent = '    ') => parts.map((p) => `${indent}${p.id}) ${p[key]} ;;`).join('\n');
  const head = user
    ? `#!/bin/sh
# The Olympus — your terminal, every part in one command. Run as yourself
# (not with sudo): everything goes into your home folder.
#
#   sh install.sh                          every part this machine has a program for
#   sh install.sh ${ids.slice(0, 2).join(' ')}             only the parts named
#   sh install.sh --restore                undo every part that is installed
#   sh install.sh --list                   the parts, and which this machine can take
#
# Straight from the house's site, without downloading the folder first:
#
#   curl -fsSL ${site}/${path}install.sh | OLYMPUS_FROM=${site}/${path} sh
#   curl -fsSL ${site}/${path}install.sh | OLYMPUS_FROM=${site}/${path} sh -s -- bash
#`
    : `#!/bin/sh
# The Olympus — screens, every part in one command. Run as root.
#
#   sudo sh install.sh                     every part this machine can take
#   sudo sh install.sh ${ids.slice(0, 2).join(' ')}          only the parts named
#   sudo sh install.sh terminal --ascii    options go to the parts that take them
#   sudo sh install.sh --restore           undo every part that is installed
#   sh install.sh --list                   the parts, and which this machine can take
#
# Straight from the house's site, without downloading the folder first:
#
#   curl -fsSL ${site}/${path}install.sh | sudo OLYMPUS_FROM=${site}/${path} sh
#   curl -fsSL ${site}/${path}install.sh | sudo OLYMPUS_FROM=${site}/${path} sh -s -- terminal
#`;
  return `${head}
# Every file fetched is checked against the SHA-256 written below before
# anything runs. Parts: ${ids.join(', ')}.
set -eu

FROM=\${OLYMPUS_FROM:-}
ALL=${shWord(ids.join(' '))}
OPTIONS=${shWord(options.join(' '))}

fits() {
  case "$1" in
${caseOf('fits')}
  esac
}
installed() {
  case "$1" in
${caseOf('installed')}
  esac
}
unfit() {
  case "$1" in
${parts.map((p) => `    ${p.id}) echo ${shWord(p.unfit)} ;;`).join('\n')}
  esac
}
label() {
  case "$1" in
${parts.map((p) => `    ${p.id}) echo ${shWord(p.label)} ;;`).join('\n')}
  esac
}
dir_of() {
  case "$1" in
${parts.map((p) => `    ${p.id}) echo ${p.dir} ;;`).join('\n')}
  esac
}
accepts() {
  case "$1 $2" in
${parts.flatMap((p) => p.options.map((o) => `    "${p.id} ${o}") return 0 ;;`)).join('\n')}
    *) return 1 ;;
  esac
}

MANIFEST='${manifest.map((m) => `${m.part} ${m.path} ${m.sha256}`).join('\n')}'

restore=0
list=0
chosen=
opts=
while [ $# -gt 0 ]; do
  case "$1" in
    --restore) restore=1 ;;
    --list) list=1 ;;
    --from) FROM=\${2:?--from needs an address}; shift ;;
    -*)
      case " $OPTIONS " in *" $1 "*) opts="$opts $1" ;; *) echo "unknown option: $1" >&2; exit 2 ;; esac ;;
    *)
      case " $ALL " in *" $1 "*) chosen="$chosen $1" ;; *) echo "unknown part: $1 (parts: $ALL)" >&2; exit 2 ;; esac ;;
  esac
  shift
done

if [ "$list" = 1 ]; then
  for p in $ALL; do
    if installed "$p"; then state="installed"; elif fits "$p"; then state="can be installed"; else state="skipped: $(unfit "$p")"; fi
    printf '%-12s %s — %s\\n' "$p" "$(label "$p")" "$state"
  done
  exit 0
fi
${user ? `[ "$(id -u)" != 0 ] || echo "note: running as root, so this themes root's own terminal" >&2` : `[ "$(id -u)" = 0 ] || { echo "run as root (sudo)" >&2; exit 1; }`}

# Where the parts come from: this folder, or the site.
if [ -n "$FROM" ]; then
  SRC=$(mktemp -d)
  trap 'rm -rf "$SRC"' EXIT INT TERM
  if command -v curl >/dev/null 2>&1; then get() { curl -fsSL "$1" -o "$2"; }
  elif command -v wget >/dev/null 2>&1; then get() { wget -qO "$2" "$1"; }
  else echo "neither curl nor wget is installed" >&2; exit 1; fi
  # sha256sum on Linux, shasum on macOS.
  if command -v sha256sum >/dev/null 2>&1; then digest() { sha256sum "$1" | cut -d' ' -f1; }
  elif command -v shasum >/dev/null 2>&1; then digest() { shasum -a 256 "$1" | cut -d' ' -f1; }
  else echo "sha256sum (or shasum) is needed to check the files" >&2; exit 1; fi
  fetch() { # fetch <part> [scripts-only]
    echo "$MANIFEST" | while read -r part path sum; do
      [ "$part" = "$1" ] || continue
      [ -z "\${2:-}" ] || [ "\${path##*/}" = install.sh ] || continue
      mkdir -p "$SRC/$(dirname "$path")"
      get "\${FROM%/}/$path" "$SRC/$path" || { echo "could not fetch \${FROM%/}/$path" >&2; exit 1; }
      [ "$(digest "$SRC/$path")" = "$sum" ] || { echo "$path does not match its checksum: not installing" >&2; exit 1; }
    done
  }
else
  SRC=$(cd "$(dirname "$0")" && pwd)
  [ -f "$SRC/$(dir_of "\${ALL%% *}")/install.sh" ] || { echo "run this from the screens folder, or set OLYMPUS_FROM to the site's screens address" >&2; exit 1; }
  fetch() { :; }
fi

done_parts=
skipped=
failed=
for p in \${chosen:-$ALL}; do
  if [ "$restore" = 1 ]; then
    if [ -n "$chosen" ] || installed "$p"; then
      fetch "$p" scripts
      if sh "$SRC/$(dir_of "$p")/install.sh" --restore; then done_parts="$done_parts $p"; else failed="$failed $p"; fi
    fi
    continue
  fi
  if ! fits "$p"; then
    skipped="$skipped $p"
    echo "· $p skipped: $(unfit "$p")"
    continue
  fi
  echo "· $(label "$p")"
  fetch "$p"
  args=
  for o in $opts; do if accepts "$p" "$o"; then args="$args $o"; fi; done
  # shellcheck disable=SC2086
  if sh "$SRC/$(dir_of "$p")/install.sh" $args; then done_parts="$done_parts $p"; else failed="$failed $p"; fi
done

echo
[ -z "$done_parts" ] || echo "$( [ "$restore" = 1 ] && echo Restored || echo Installed ):$done_parts"
[ -z "$skipped" ] || echo "Skipped:$skipped"
if [ -n "$failed" ]; then echo "Failed:$failed" >&2; exit 1; fi
`;
}
