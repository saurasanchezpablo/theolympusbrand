// The one command: a single POSIX shell script, served at the site's root,
// that shows a small menu of everything the house can install on this
// machine — the boot screens and login text, your own terminal, the themes
// of the applications it finds — and installs (or undoes) what you choose.
//
// No dependencies beyond sh, curl or wget, and a SHA-256 tool: its menu is
// drawn with the terminal's own escape codes (grey: bold, dim and reverse
// only), keys are read from /dev/tty so it works piped from curl, and it
// runs anywhere with a POSIX shell — Linux, macOS, WSL. Without a terminal it
// takes its choices as options.
//
// Everything it lists comes from the registries the rest of the house uses:
// the screens' parts, the terminal's parts, and every theme kit that knows
// how to find its application (KitInstaller). It installs through the same
// installers, so there is one way to do each thing.

import type { ScreenPart } from '../screens/parts.ts';
import type { KitInstaller } from '../integrations/themes/types.ts';
import { oneLine, shQuote } from '../catalog/text.ts';

export type LauncherKit = { dir: string; label: string; installer?: KitInstaller; files: { path: string; sha256: string }[] };

export type LauncherInput = {
  system: readonly ScreenPart[];
  user: readonly ScreenPart[];
  kits: readonly LauncherKit[];
  /** Who a machine can be: the master, then each service whose screens the site builds. */
  identities: readonly { id: string; name: string }[];
  /** SHA-256 of the master's two installers, pinned here. */
  systemSum: string;
  userSum: string;
};

const sq = shQuote;

/** A shell `case` over item ids, one branch each. */
const cases = (fn: string, branches: [id: string, body: string][], fallback = 'return 1') =>
  `${fn}() {\n  case "$1" in\n${branches.map(([id, body]) => `    ${id}) ${body} ;;`).join('\n')}\n    *) ${fallback} ;;\n  esac\n}`;

export function launcher(input: LauncherInput): string {
  type Item = { id: string; group: string; label: string; fits: string; installed: string; unfit: string };
  const kits = [...input.kits.filter((k) => k.installer), ...input.kits.filter((k) => !k.installer)];
  const items: Item[] = [
    ...input.system.map((p) => ({ id: `sys:${p.id}`, group: 'The machine', label: p.label, fits: p.fits, installed: p.installed, unfit: p.unfit })),
    ...input.user.map((p) => ({ id: `usr:${p.id}`, group: 'Your terminal', label: p.label, fits: p.fits, installed: p.installed, unfit: p.unfit })),
    ...kits.map((k) =>
      k.installer
        ? { id: `kit:${k.dir}`, group: 'Applications', label: `${k.label} — ${k.installer.summary}`, fits: k.installer.requires ?? 'true', installed: k.installer.installed ?? 'false', unfit: `${k.label} is not on this machine` }
        : { id: `doc:${k.dir}`, group: 'Applications set up by hand', label: `${k.label} — save its files and guide to ./the-olympus-${k.dir}/`, fits: 'true', installed: 'false', unfit: '' },
    ),
  ];
  const auto = input.kits.filter((k) => k.installer);
  const placed = auto.filter((k) => k.installer!.places?.length);
  const groups = [...new Set(items.map((i) => i.group))];
  const manifest = input.kits.flatMap((k) => k.files.map((f) => `${k.dir} ${f.path} ${f.sha256}`));

  // What the machine is, looked at in one go: "fit <id>", "inst <id>", "at <id> <VARIABLE> <where>" lines.
  // The machine's parts and the applications are looked at as root when that is possible
  // (the boot partition, Docker), your terminal's as you.
  const look = (list: Item[]) => list.map((i) => `if ( ${i.fits} ) >/dev/null 2>&1; then echo 'fit ${i.id}'; fi\nif ( ${i.installed} ) >/dev/null 2>&1; then echo 'inst ${i.id}'; fi`).join('\n');
  const probeSys = [
    `containers() {\n  { docker ps --format '{{.Names}} {{.Image}}'; podman ps --format '{{.Names}} {{.Image}}'; } 2>/dev/null | grep . || sudo -n docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null\n}`,
    look(items.filter((i) => !i.id.startsWith('usr:'))),
    ...placed.flatMap((k) => k.installer!.places!.map((p) => `v=$( ( ${p.detect} ) 2>/dev/null | head -n 1 ); [ -z "$v" ] || printf 'at %s %s %s\\n' 'kit:${k.dir}' '${p.env}' "$v"`)),
  ].join('\n');
  const probeUsr = look(items.filter((i) => i.id.startsWith('usr:')));

  return `#!/bin/sh
# The Olympus — one command for this machine: a menu of everything the house
# can install here, and the means to undo it.
#
#   curl -fsSL http://<site>/install.sh | OLYMPUS_SITE=http://<site> sh
#
# Options, for scripts and machines without a terminal:
#   --list            what this machine can take, and what is installed
#   --yes             install everything this machine can take, without asking
#   --only a,b,…      just these (ids from --list)
#   --restore         undo instead of install (with --yes or --only, or from the menu)
#   --as <id>         which identity the screens show: master, or a service's id
#   --set NAME=VALUE  where an application is, instead of what was found (the
#                     names are in --list: NEXTCLOUD_CONTAINER=…, OCC=…, HA_CONFIG=…)
#   --site <address>  instead of OLYMPUS_SITE
#
# Every file is fetched from the site and checked against the SHA-256 written
# here (or in the installer it runs) before it is used. Serve the site over
# HTTPS: over plain HTTP, this script itself could be changed on its way.
set -eu

SITE=\${OLYMPUS_SITE:-}
MODE=install
YES=0
LIST=0
ONLY=
AS=
SETS=
while [ $# -gt 0 ]; do
  case "$1" in
    --site) SITE=\${2:?--site needs an address}; shift ;;
    --yes) YES=1 ;;
    --list) LIST=1 ;;
    --only) ONLY=$(printf '%s' "\${2:?--only needs ids}" | tr ',' ' '); shift ;;
    --restore) MODE=restore ;;
    --as) AS=\${2:?--as needs an identity}; shift ;;
    --set)
      case "\${2:-}" in
        [A-Z]*=*) SETS="$SETS$2
" ;;
        *) echo "--set needs NAME=VALUE" >&2; exit 2 ;;
      esac
      shift ;;
    -h|--help) sed -n '2,24p' "$0" 2>/dev/null || true; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
  shift
done
SITE=\${SITE%/}

if [ "$(id -u)" = 0 ]; then SUDO=; else SUDO=sudo; fi
if command -v curl >/dev/null 2>&1; then get() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then get() { wget -qO "$2" "$1"; }
else echo "curl or wget is needed" >&2; exit 1; fi
if command -v sha256sum >/dev/null 2>&1; then sum() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then sum() { shasum -a 256 "$1" | cut -d' ' -f1; }
else echo "sha256sum (or shasum) is needed to check the files" >&2; exit 1; fi

TMP=$(mktemp -d)
TTYSTATE=
cleanup() {
  if [ -n "$TTYSTATE" ]; then stty "$TTYSTATE" </dev/tty 2>/dev/null || true; printf '\\033[?25h\\033[?1049l' >/dev/tty 2>/dev/null || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ---------------------------------------------------------------- the items

ITEMS=${sq(items.map((i) => `${i.id}|${i.group}|${oneLine(i.label)}`).join('\n'))}
GROUPS=${sq(groups.join('\n'))}

${cases('unfit', items.map((i) => [i.id, `echo ${sq(i.unfit)}`]), 'echo')}

# How to look at the machine (see look below).
PROBE_SYS=${sq(probeSys)}
PROBE_USR=${sq(probeUsr)}

# Where an application can be: <VARIABLE>|<how the menu says it>|<the question>, a line each.
${cases('places', placed.map((k) => [`kit:${k.dir}`, `printf '%s\\n' ${sq(k.installer!.places!.map((p) => `${p.env}|${p.label}|${p.prompt}`).join('\n'))}`]), 'true')}
${cases('kit_name', auto.map((k) => [`kit:${k.dir}`, `echo ${sq(k.label)}`]), 'true')}
${cases('kit_args', auto.map((k) => [`kit:${k.dir}`, `echo ${sq(k.installer!.args ?? '')}`]), 'true')}
${cases('kit_root', auto.map((k) => [`kit:${k.dir}`, k.installer!.root ? 'return 0' : 'return 1']))}

# Every file of every kit, and its SHA-256: <folder> <path> <sum>.
KITS=${sq(manifest.join('\n'))}
SYS_SUM=${input.systemSum}
USR_SUM=${input.userSum}
IDENTITIES=${sq(input.identities.map((i) => `${i.id}|${oneLine(i.name)}`).join('\n'))}

nth() { printf '%s\\n' "$1" | sed -n "$2p"; }
count() { printf '%s\\n' "$1" | grep -c . || true; }
has() { case " $1 " in *" $2 "*) return 0 ;; *) return 1 ;; esac; }

# ---------------------------------------------------------------- the menu

# Keys from the terminal, even when this script arrives through a pipe.
key() {
  k=$(dd bs=1 count=1 2>/dev/null </dev/tty)
  case "$k" in
    "$(printf '\\033')")
      k=$(dd bs=1 count=2 2>/dev/null </dev/tty)
      case "$k" in '[A'|'OA') echo up ;; '[B'|'OB') echo down ;; *) echo esc ;; esac ;;
    '') echo enter ;;
    ' ') echo space ;;
    k|K) echo up ;;
    j|J) echo down ;;
    q|Q) echo quit ;;
    a|A) echo all ;;
    n|N) echo none ;;
    *) echo other ;;
  esac
}

tui_open() {
  TTYSTATE=$(stty -g </dev/tty)
  stty -icanon -echo min 1 time 0 </dev/tty
  printf '\\033[?1049h\\033[?25l' >/dev/tty
}
tui_close() {
  stty "$TTYSTATE" </dev/tty
  TTYSTATE=
  printf '\\033[?25h\\033[?1049l' >/dev/tty
}

B=$(printf '\\033[1m'); D=$(printf '\\033[2m'); R=$(printf '\\033[7m'); O=$(printf '\\033[0m')

# pick <title> <options, one per line> — one of them; prints its number.
pick() {
  n=$(count "$2"); c=1
  while :; do
    {
      printf '\\033[H\\033[2J\\n  %s▲ THE OLYMPUS%s\\n\\n  %s\\n\\n' "$B" "$O" "$1"
      i=1
      while [ "$i" -le "$n" ]; do
        if [ "$i" = "$c" ]; then printf '  %s ❯ %s %s\\n' "$R" "$(nth "$2" "$i")" "$O"; else printf '     %s\\n' "$(nth "$2" "$i")"; fi
        i=$((i + 1))
      done
      printf '\\n  %s↑ ↓ choose · enter confirm · q quit%s\\n' "$D" "$O"
    } >/dev/tty
    case $(key) in
      up) [ "$c" -gt 1 ] && c=$((c - 1)) ;;
      down) [ "$c" -lt "$n" ] && c=$((c + 1)) ;;
      enter) echo "$c"; return 0 ;;
      quit|esc) return 1 ;;
    esac
  done
}

# choose <title> <ids, one per line> <ids chosen to begin with> — prints the ids chosen.
choose() {
  n=$(count "$2"); c=1; on=" $3 "; top=1
  rows=$(stty size </dev/tty 2>/dev/null | cut -d' ' -f1); rows=\${rows:-24}
  room=$((rows - 12)); [ "$room" -ge 4 ] || room=4
  while :; do
    [ "$c" -lt "$top" ] && top=$c
    [ "$c" -ge $((top + room)) ] && top=$((c - room + 1))
    {
      printf '\\033[H\\033[2J\\n  %s▲ THE OLYMPUS%s\\n\\n  %s\\n' "$B" "$O" "$1"
      i=$top; last=
      while [ "$i" -le "$n" ] && [ "$i" -lt $((top + room)) ]; do
        id=$(nth "$2" "$i"); line=$(printf '%s\\n' "$ITEMS" | grep "^$id|")
        group=$(printf '%s' "$line" | cut -d'|' -f2); label=$(printf '%s' "$line" | cut -d'|' -f3-)
        [ "$group" = "$last" ] || printf '\\n  %s%s%s\\n' "$B" "$group" "$O"
        last=$group
        if ! has "$FIT" "$id" && [ "$MODE" = install ]; then mark='   '; text="$D$label — $(unfit "$id")$O"
        elif has "$on" "$id"; then mark='[x]'; text=$label
        else mark='[ ]'; text=$label; fi
        if has "$INST" "$id"; then text="$text $D(installed)$O"
        elif [ -n "$(places "$id")" ] && [ "$MODE" = install ]; then
          if w=$(where "$id"); then text="$text $D— found: \${w#* }$O"; else text="$text $D— not found here: you will say where$O"; fi
        fi
        if [ "$i" = "$c" ]; then printf '  %s❯ %s%s %s\\n' "$R" "$mark" "$O" "$text"; else printf '    %s %s\\n' "$mark" "$text"; fi
        i=$((i + 1))
      done
      [ "$n" -gt "$room" ] && printf '\\n  %s%s of %s%s\\n' "$D" "$c" "$n" "$O"
      printf '\\n  %s↑ ↓ move · space choose · a all · n none · enter continue · q quit%s\\n' "$D" "$O"
    } >/dev/tty
    id=$(nth "$2" "$c")
    case $(key) in
      up) [ "$c" -gt 1 ] && c=$((c - 1)) ;;
      down) [ "$c" -lt "$n" ] && c=$((c + 1)) ;;
      space)
        if has "$on" "$id"; then on=$(printf '%s' "$on" | sed "s/ $id / /")
        elif [ "$MODE" = restore ] || has "$FIT" "$id"; then on="$on$id "; fi ;;
      all) on=" "; for x in $2; do if [ "$MODE" = restore ] || has "$FIT" "$x"; then on="$on$x "; fi; done ;;
      none) on=" " ;;
      enter) echo $on; return 0 ;;
      quit|esc) return 1 ;;
    esac
  done
}

# ask <question> <default> — a line of text.
ask() {
  tui_close
  printf '\\n  %s [%s]: ' "$1" "$2" >/dev/tty
  read -r answer </dev/tty || answer=
  tui_open
  printf '%s' "\${answer:-$2}"
}

# ---------------------------------------------------------------- doing it

ALL=$(printf '%s\\n' "$ITEMS" | cut -d'|' -f1)

# What this machine can take, what is in place, and where its applications are: looked at
# once, as root when that needs no password (the boot partition and Docker are root's),
# your terminal's parts as you.
look() {
  if [ -z "$SUDO" ]; then sh -c "$PROBE_SYS"
  elif sudo -n true 2>/dev/null; then sudo -n sh -c "$PROBE_SYS"
  else sh -c "$PROBE_SYS"; fi
  sh -c "$PROBE_USR"
}
seen() {
  SEEN=$(look)
  FIT=" $(printf '%s\\n' "$SEEN" | awk '$1 == "fit" { printf "%s ", $2 }')"
  INST=" $(printf '%s\\n' "$SEEN" | awk '$1 == "inst" { printf "%s ", $2 }')"
}
seen
# where <id> [<VARIABLE>] — "<VARIABLE> <where>" of what was found for a kit (the first of its places, or that one).
where() { printf '%s\\n' "$SEEN" | awk -v id="$1" -v v="\${2:-}" '$1 == "at" && $2 == id && (v == "" || $3 == v) { sub(/^at [^ ]+ /, ""); print; f = 1; exit } END { exit !f }'; }
# given <VARIABLE> — what --set or the environment says.
given() {
  g=$(printf '%s' "$SETS" | grep "^$1=" | tail -n 1 | cut -d= -f2-)
  [ -n "$g" ] || eval "g=\\\${$1:-}"
  printf '%s' "$g"
}

if [ "$LIST" = 1 ]; then
  for id in $ALL; do
    if has "$INST" "$id"; then s=installed; elif ! has "$FIT" "$id"; then s="skipped: $(unfit "$id")"
    elif [ -n "$(places "$id")" ]; then
      if w=$(where "$id"); then s="can be installed — found: \${w#* } (\${w%% *})"
      else s="can be installed — not found here: say where with $(places "$id" | cut -d'|' -f1 | sed 's/^/--set /; s/$/=…/' | paste -sd' ' - | sed 's/ --set/ or --set/g')"; fi
    else s='can be installed'; fi
    printf '%-24s %s — %s\\n' "$id" "$(printf '%s\\n' "$ITEMS" | grep "^$id|" | cut -d'|' -f3-)" "$s"
  done
  [ -z "$SUDO" ] || sudo -n true 2>/dev/null || echo "(looked as you: with sudo it can also look into the boot partition and Docker)"
  exit 0
fi

[ -n "$SITE" ] || { echo "set OLYMPUS_SITE to the address of the house's site (e.g. OLYMPUS_SITE=http://olympus.lan:8080)" >&2; exit 1; }

INTERACTIVE=0
if [ "$YES" = 0 ] && [ -z "$ONLY" ]; then
  stty -g </dev/tty >/dev/null 2>&1 || { echo "no terminal to show the menu on: use --yes, --only or --list" >&2; exit 2; }
  INTERACTIVE=1
fi

CHOSEN=
if [ "$INTERACTIVE" = 1 ]; then
  tui_open
  m=$(pick 'What would you like to do?' "$(printf 'Install the house on this machine\\nUndo what the house installed\\nQuit')") || exit 0
  case "$m" in 1) MODE=install ;; 2) MODE=restore ;; *) exit 0 ;; esac
  if [ "$MODE" = install ]; then
    begin=; for id in $ALL; do case "$id" in doc:*) ;; *) if has "$FIT" "$id" && ! has "$INST" "$id" && { [ -z "$(places "$id")" ] || where "$id" >/dev/null; }; then begin="$begin $id"; fi ;; esac; done
    CHOSEN=$(choose 'Choose what to install — the parts this machine cannot take are dimmed.' "$ALL" "$begin") || exit 0
  else
    begin=; for id in $ALL; do if has "$INST" "$id"; then begin="$begin $id"; fi; done
    CHOSEN=$(choose 'Choose what to undo.' "$(for id in $ALL; do case "$id" in doc:*) ;; *) echo "$id" ;; esac; done)" "$begin") || exit 0
  fi
elif [ -n "$ONLY" ]; then
  for id in $ONLY; do printf '%s\\n' "$ALL" | grep -qx "$id" || { echo "unknown item: $id (see --list)" >&2; exit 2; }; done
  CHOSEN=$ONLY
else
  for id in $ALL; do
    case "$id" in doc:*) continue ;; esac
    if [ "$MODE" = restore ]; then if has "$INST" "$id"; then CHOSEN="$CHOSEN $id"; fi
    elif has "$FIT" "$id" && { [ -z "$(places "$id")" ] || where "$id" >/dev/null; }; then CHOSEN="$CHOSEN $id"; fi
  done
fi
[ -n "$(echo $CHOSEN)" ] || { [ "$INTERACTIVE" = 1 ] && tui_close; echo "Nothing chosen."; exit 0; }

# Which identity the screens show: the master, or a service.
if [ -z "$AS" ]; then
  AS=master
  case " $CHOSEN " in *" sys:"*|*" usr:"*) screens=1 ;; *) screens=0 ;; esac
  if [ "$INTERACTIVE" = 1 ] && [ "$(count "$IDENTITIES")" -gt 1 ] && [ "$screens" = 1 ]; then
    names=$(printf '%s\\n' "$IDENTITIES" | cut -d'|' -f2-)
    i=$(pick 'Whose seal should this machine show?' "$names") || exit 0
    AS=$(nth "$IDENTITIES" "$i" | cut -d'|' -f1)
  fi
fi
printf '%s\\n' "$IDENTITIES" | cut -d'|' -f1 | grep -qx "$AS" || { echo "unknown identity: $AS" >&2; exit 2; }
if [ "$AS" = master ]; then BASE="$SITE/files/assets/screens/"; else BASE="$SITE/files/assets/screens/services/$AS/"; fi

# Root, once, before anything is asked: with it the applications are looked for again
# (Docker and their folders are often root's alone), so what is asked starts from what is there.
needs_root=0
for id in $CHOSEN; do case "$id" in sys:*) needs_root=1 ;; kit:*) if kit_root "$id"; then needs_root=1; fi ;; esac; done
if [ -n "$SUDO" ] && [ "$needs_root" = 1 ] && ! sudo -n true 2>/dev/null && [ "$INTERACTIVE" = 1 ]; then
  tui_close
  printf '\\n  Some of this is done as root: sudo asks for your password once.\\n\\n'
  sudo -v || exit 1
  tui_open
fi
case " $CHOSEN " in *" kit:"*) if [ -n "$SUDO" ] && sudo -n true 2>/dev/null; then seen; fi ;; esac

# Where each chosen application is: what --set or the environment says, else what was found
# (asked to confirm, in the menu), else asked.
ANSWERS=
SKIP=' '
for id in $CHOSEN; do
  pl=$(places "$id")
  [ -n "$pl" ] || continue
  var=; value=
  for v in $(printf '%s\\n' "$pl" | cut -d'|' -f1); do
    g=$(given "$v"); if [ -n "$g" ]; then var=$v; value=$g; break; fi
  done
  if [ -z "$var" ] && [ "$INTERACTIVE" = 1 ]; then
    name=$(kit_name "$id")
    opts=$(printf '%s\\n' "$pl" | while IFS='|' read -r v label prompt; do
      if w=$(where "$id" "$v"); then printf '%s — found: %s\\n' "$label" "\${w#* }"; else printf '%s\\n' "$label"; fi
    done; printf 'Skip %s\\n' "$name")
    i=$(pick "Where is $name?" "$opts") || exit 0
    if [ "$i" -gt "$(count "$pl")" ]; then SKIP="$SKIP$id "; continue; fi
    line=$(nth "$pl" "$i"); var=\${line%%|*}; prompt=\${line##*|}
    w=$(where "$id" "$var") || w=
    value=$(ask "$prompt" "\${w#* }")
  elif [ -z "$var" ]; then
    if w=$(where "$id"); then var=\${w%% *}; value=\${w#* }; fi
  fi
  if [ -z "$value" ]; then
    echo "$id: $(kit_name "$id") was not found here — say where with $(printf '%s\\n' "$pl" | cut -d'|' -f1 | sed 's/^/--set /; s/$/=…/' | paste -sd' ' - | sed 's/ --set/ or --set/g')" >&2
    [ "$INTERACTIVE" = 0 ] || tui_close
    exit 2
  fi
  ANSWERS="$ANSWERS$id $var=$value
"
done
[ "$INTERACTIVE" = 0 ] || tui_close

answer() { printf '%s' "$ANSWERS" | grep "^$1 " | head -n 1 | cut -d' ' -f2-; }
fetch() { # fetch <url> <file> [<sha256>]
  get "$1" "$2" || { echo "could not fetch $1" >&2; exit 1; }
  if [ -n "\${3:-}" ] && [ "$(sum "$2")" != "$3" ]; then echo "$1 does not match its checksum: not using it" >&2; exit 1; fi
}

echo
FAILED=
DONE=

# The machine's parts, through the screens' own installer (as root).
SYS=; for id in $CHOSEN; do case "$id" in sys:*) SYS="$SYS \${id#sys:}" ;; esac; done
if [ -n "$SYS" ]; then
  if [ "$AS" = master ]; then fetch "\${BASE}install.sh" "$TMP/system.sh" "$SYS_SUM"; else fetch "\${BASE}install.sh" "$TMP/system.sh"; fi
  flag=; [ "$MODE" = restore ] && flag=--restore
  # shellcheck disable=SC2086
  if $SUDO env OLYMPUS_FROM="$BASE" sh "$TMP/system.sh" $flag $SYS; then DONE="$DONE$SYS"; else FAILED="$FAILED$SYS"; fi
fi

# Your terminal's parts, as you.
USR=; for id in $CHOSEN; do case "$id" in usr:*) USR="$USR \${id#usr:}" ;; esac; done
if [ -n "$USR" ]; then
  if [ "$AS" = master ]; then fetch "\${BASE}shell/install.sh" "$TMP/user.sh" "$USR_SUM"; else fetch "\${BASE}shell/install.sh" "$TMP/user.sh"; fi
  [ "$(id -u)" != 0 ] || echo "note: running as root, so the terminal parts go to root's own terminal" >&2
  flag=; [ "$MODE" = restore ] && flag=--restore
  # shellcheck disable=SC2086
  if OLYMPUS_FROM="\${BASE}shell/" sh "$TMP/user.sh" $flag $USR; then DONE="$DONE$USR"; else FAILED="$FAILED$USR"; fi
fi

# A kit's files, each checked: <folder> <into>.
kit_files() {
  printf '%s\\n' "$KITS" | while read -r dir path s; do
    [ "$dir" = "$1" ] || continue
    mkdir -p "$2/$(dirname "$path")"
    fetch "$SITE/files/assets/integrations/themes/$dir/$path" "$2/$path" "$s"
  done
}

# Applications: each kit's own apply.sh, with what was asked.
for id in $CHOSEN; do
  case "$id" in
    kit:*)
      has "$SKIP" "$id" && continue
      dir=\${id#kit:}; into="$TMP/kit-$dir"
      kit_files "$dir" "$into"
      set --
      a=$(answer "$id"); [ -z "$a" ] || set -- "$a"
      if [ "$MODE" = restore ]; then args=--restore; else args=$(kit_args "$id"); fi
      if kit_root "$id"; then as=$SUDO; else as=; fi
      echo "· $dir\${a:+ ($a)}"
      # shellcheck disable=SC2086
      if $as env "$@" sh "$into/apply.sh" $args; then DONE="$DONE $dir"; else FAILED="$FAILED $dir"; fi ;;
    doc:*)
      dir=\${id#doc:}; into="./the-olympus-$dir"
      [ ! -e "$into" ] || { echo "$into already exists: not overwriting it" >&2; FAILED="$FAILED $dir"; continue; }
      kit_files "$dir" "$TMP/doc-$dir"
      cp -R "$TMP/doc-$dir" "$into"
      echo "· $dir: files and guide (README.md) saved in $into"
      DONE="$DONE $dir" ;;
  esac
done

echo
if [ "$MODE" = restore ]; then word=Undone; else word=Done; fi
[ -z "$DONE" ] || echo "$word:$DONE"
if [ -n "$FAILED" ]; then echo "Failed:$FAILED" >&2; exit 1; fi
`;
}
