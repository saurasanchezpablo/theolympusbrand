// Arch Linux, CachyOS, Omarchy: the screens as a pacman package. makepkg
// fetches every file of the kit from the house's site, each checked against
// its SHA-256 written here; the package puts them in /usr/share/the-olympus/
// with two commands — `sudo the-olympus` for the machine, `the-olympus-terminal`
// for your own terminal — and removing it undoes what `the-olympus` set.

import type { ManifestLine } from './parts.ts';

export type ArchFile = { path: string; sha256: string; executable: boolean };

/** A source file's name in makepkg's folder: the kit's path, flattened. */
const flat = (path: string) => path.replace(/\//g, '__').replace(/[^A-Za-z0-9._-]/g, '_');
const url = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export const archCommand = `#!/bin/sh
# The Olympus — boot screens, the crest at login, wallpapers: every part this
# machine can take. Run as root:  sudo the-olympus   (--list, --restore, or parts by name)
exec sh /usr/share/the-olympus/screens/install.sh "$@"
`;

export const archTerminalCommand = `#!/bin/sh
# The Olympus — your own terminal: prompt, fastfetch, tmux, colours, Omarchy.
# Run as yourself:  the-olympus-terminal   (--list, --restore, or parts by name)
exec sh /usr/share/the-olympus/screens/shell/install.sh "$@"
`;

export const archInstallHooks = `# The Olympus — pacman install hooks.

post_install() {
  echo "The Olympus is installed. To apply it to this machine:"
  echo "  sudo the-olympus            (sudo the-olympus --list shows what it can take)"
  echo "And to your own terminal:"
  echo "  the-olympus-terminal"
}

post_upgrade() {
  echo "The Olympus was updated. Run sudo the-olympus (and the-olympus-terminal) again to apply the new files."
}

pre_remove() {
  # Undo what sudo the-olympus set (each user undoes their terminal with: the-olympus-terminal --restore).
  sh /usr/share/the-olympus/screens/install.sh --restore >/dev/null 2>&1 || true
}
`;

/**
 * The PKGBUILD. `files` are the kit's files under the screens folder (paths
 * relative to it); `base` is that folder's address on the site.
 */
export function pkgbuild({ id, files, base, local }: { id: string; files: ArchFile[]; base: string; local: { name: string; sha256: string }[] }): string {
  const pkg = id === 'master' ? 'the-olympus-screens' : `the-olympus-${id}-screens`;
  const sources = files.map((f) => `  "${flat(f.path)}::$_site/${url(base + f.path)}"`);
  return `# The Olympus — boot screens, the crest at login, wallpapers and your terminal,
# as a pacman package. Build and install it with the address of the house's site:
#
#   OLYMPUS_SITE=http://olympus.lan:8080 makepkg -si
#
# then apply it:  sudo the-olympus   (and, as yourself, the-olympus-terminal)

pkgname=${pkg}
pkgver=0
pkgrel=1
pkgdesc="The Olympus: boot screens, the crest at login, wallpapers and terminal colours"
arch=('any')
url="https://theolympus.cloud"
license=('LicenseRef-AllRightsReserved')
${id === 'master' ? '' : `provides=('the-olympus-screens')\nconflicts=('the-olympus-screens')\n`}optdepends=('plymouth: the boot splash' 'grub: the boot menu background' 'limine: the boot menu theme' 'fastfetch: the seal beside the facts of the machine')
install=the-olympus.install
_site=\${OLYMPUS_SITE:?set OLYMPUS_SITE to the address of the site of the house, e.g. OLYMPUS_SITE=http://olympus.lan:8080 makepkg -si}
_site=\${_site%/}

source=(
${local.map((l) => `  "${l.name}"`).join('\n')}
${sources.join('\n')}
)
sha256sums=(
${[...local.map((l) => l.sha256), ...files.map((f) => f.sha256)].map((s) => `  '${s}'`).join('\n')}
)

# Each build is newer than the last: the site's files may have changed.
pkgver() {
  date -u +%Y%m%d.%H%M
}

package() {
  local d="$pkgdir/usr/share/the-olympus/screens"
  install -Dm755 "$srcdir/the-olympus" "$pkgdir/usr/bin/the-olympus"
  install -Dm755 "$srcdir/the-olympus-terminal" "$pkgdir/usr/bin/the-olympus-terminal"
${files.map((f) => `  install -Dm${f.executable ? '755' : '644'} "$srcdir/${flat(f.path)}" "$d/${f.path}"`).join('\n')}
}
`;
}

/** The kit's files for the package: everything the two installers may need, and the installers. */
export function archFiles(manifest: readonly ManifestLine[], shellManifest: readonly ManifestLine[], umbrellas: { path: string; sha256: string }[]): ArchFile[] {
  const exec = (p: string) => p.endsWith('.sh') || p.endsWith('20-the-olympus');
  return [
    ...umbrellas.map((u) => ({ path: u.path, sha256: u.sha256, executable: true })),
    ...manifest.map((m) => ({ path: m.path, sha256: m.sha256, executable: exec(m.path) })),
    ...shellManifest.map((m) => ({ path: `shell/${m.path}`, sha256: m.sha256, executable: exec(m.path) })),
  ].sort((a, b) => a.path.localeCompare(b.path));
}
