// Home Assistant: a frontend theme (light and dark modes) and the house's
// seal for a dashboard picture card. Written for Home Assistant 2026.10.
//
// Home Assistant documents only primary-color, accent-color and the state
// colours as theme variables; the rest are the frontend's own and may be
// renamed by an update. Newer components read the primary colour scale
// (ha-color-primary-05 … 95) directly, so it is set too — otherwise blue shows
// through. Status and state colours keep their meaning and are left alone.
// No theme can change the sidebar title, a sidebar logo or the favicon.

import { PALETTE } from '../../brand/palette.ts';
import { DOMAIN } from '../../brand/identity.ts';
import { bannerMark, coinSvg, markSvg } from '../marks.ts';
import { containerOf, folderOf, PODMAN, sq } from './shared.ts';
import type { ThemeKit } from './types.ts';

const P = PALETTE;
// The interface's lightest greys, beside the brand's eight.
const LINE = '#E1E1E1';
const PANEL = '#F5F5F5';
const WHITE = '#FFFFFF';
export const HA_THEME = 'The Olympus';

/** The primary scale, darkest to lightest: neutral greys in place of Home Assistant's blue. */
const SCALE: [string, string][] = [
  ['05', P.obsidian],
  ['10', P.charcoal],
  ['20', '#2B2B2B'],
  ['30', P.graphite],
  ['40', '#4A4A4A'],
  ['50', P.slate],
  ['60', '#7A7A7A'],
  ['70', P.silver],
  ['80', P.ash],
  ['90', LINE],
  ['95', P.marble],
];

const MODES = {
  light: {
    'primary-color': P.charcoal,
    'accent-color': P.slate,
    'light-primary-color': LINE,
    'dark-primary-color': P.obsidian,
    'text-primary-color': P.paper,
    'primary-background-color': P.paper,
    'secondary-background-color': PANEL,
    'card-background-color': WHITE,
    'primary-text-color': P.charcoal,
    'secondary-text-color': P.slate,
    'disabled-text-color': P.silver,
    'divider-color': LINE,
    'state-icon-color': P.slate,
    'sidebar-background-color': PANEL,
    'sidebar-text-color': P.charcoal,
    'sidebar-icon-color': P.slate,
    'sidebar-selected-text-color': P.obsidian,
    'sidebar-selected-icon-color': P.obsidian,
    'app-header-background-color': PANEL,
    'app-header-text-color': P.charcoal,
    'ha-card-border-color': LINE,
  },
  dark: {
    'primary-color': P.marble,
    'accent-color': P.silver,
    'light-primary-color': P.graphite,
    'dark-primary-color': P.paper,
    'text-primary-color': P.obsidian,
    'primary-background-color': P.obsidian,
    'secondary-background-color': '#161616',
    'card-background-color': P.charcoal,
    'primary-text-color': P.marble,
    'secondary-text-color': P.silver,
    'disabled-text-color': P.slate,
    'divider-color': P.graphite,
    'state-icon-color': P.silver,
    'sidebar-background-color': '#161616',
    'sidebar-text-color': P.marble,
    'sidebar-icon-color': P.silver,
    'sidebar-selected-text-color': P.paper,
    'sidebar-selected-icon-color': P.paper,
    'app-header-background-color': '#161616',
    'app-header-text-color': P.marble,
    'ha-card-border-color': P.graphite,
  },
} as const;

const yamlVars = (vars: Record<string, string>, indent: string) => Object.entries(vars).map(([k, v]) => `${indent}${k}: "${v}"`).join('\n');

export function homeAssistantTheme(): string {
  return `# The Olympus — Home Assistant theme (Home Assistant 2026.10).
# Goes in <config>/themes/ (apply.sh puts it there). Then: Developer tools →
# Actions → "Frontend: Reload themes", and choose "${HA_THEME}" on your
# profile page. Light or dark follows your profile's setting.
${JSON.stringify(HA_THEME)}:
  # The house's square corners.
  ha-card-border-radius: "2px"
  ha-card-border-width: "1px"
  # Home Assistant's own colour scale, in greys (not documented: may change).
${yamlVars(Object.fromEntries(SCALE.map(([k, v]) => [`ha-color-primary-${k}`, v])), '  ')}
  modes:
    light:
${yamlVars(MODES.light, '      ')}
    dark:
${yamlVars(MODES.dark, '      ')}
`;
}

export function homeAssistantCard(): string {
  return `# The Olympus — the house's seal on a dashboard: Edit dashboard → Add card →
# Manual, and paste this. The image is served from <config>/www/the-olympus/.
type: picture
image: /local/the-olympus/banner.svg
alt_text: The Olympus · ${DOMAIN}
`;
}

export function homeAssistantScript(): string {
  return `#!/bin/sh
# The Olympus — Home Assistant: installs the theme and the dashboard images.
#
#   Docker:      HA_CONTAINER=homeassistant sh apply.sh
#   A folder:    sh apply.sh /path/to/homeassistant/config   (or HA_CONFIG=/path/…)
#   Undo:        add --restore to either
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
${PODMAN}
restore=0
config=\${HA_CONFIG:-}
for a in "$@"; do
  case "$a" in
    --restore) restore=1 ;;
    -*) echo "unknown option: $a" >&2; exit 2 ;;
    *) config=$a ;;
  esac
done

if [ -n "\${HA_CONTAINER:-}" ]; then
  run() { docker exec "$HA_CONTAINER" sh -c "$1"; }
  put() { docker cp "$1" "$HA_CONTAINER:$2"; }
  config=/config
else
  [ -n "$config" ] || { echo "give the Home Assistant config folder, or set HA_CONTAINER" >&2; exit 2; }
  [ -f "$config/configuration.yaml" ] || { echo "$config/configuration.yaml not found: is this Home Assistant's config folder?" >&2; exit 1; }
  run() { sh -c "$1"; }
  put() { cp "$1" "$2"; }
fi

if [ "$restore" = 1 ]; then
  run "rm -f '$config/themes/the-olympus.yaml' && rm -rf '$config/www/the-olympus'"
  echo "Removed. Choose another theme on your profile page, and reload themes."
  exit 0
fi

run "mkdir -p '$config/themes' '$config/www/the-olympus'"
put "$DIR/the-olympus.yaml" "$config/themes/the-olympus.yaml"
for f in banner.svg seal.svg; do put "$DIR/www/$f" "$config/www/the-olympus/$f"; done

if ! run "grep -q 'include_dir_merge_named themes' '$config/configuration.yaml'"; then
  cat <<'EOF'
One more step: Home Assistant does not read the themes folder yet. Add this to
configuration.yaml, then restart Home Assistant once:

frontend:
  themes: !include_dir_merge_named themes
EOF
fi
echo "Installed. Reload themes (Developer tools → Actions → Frontend: Reload themes),"
echo "then choose ${sq(HA_THEME)} on your profile page."
`;
}

export const homeAssistant: ThemeKit = {
  id: 'home-assistant',
  label: 'Home Assistant',
  match: { ids: ['home-assistant', 'homeassistant', 'hass'], category: 'home' },
  how: '`apply.sh` installs the theme (light and dark) and the images; `picture-card.yaml` puts the seal on a dashboard',
  installer: {
    summary: 'the theme, light and dark, and the dashboard images',
    places: [
      { label: 'In a Docker or Podman container', env: 'HA_CONTAINER', prompt: 'Home Assistant’s container', detect: containerOf('home-?assistant', 'addon|supervisor|observer|-dns|-audio|-cli|-multicast') },
      { label: 'In a folder on this machine', env: 'HA_CONFIG', prompt: 'Home Assistant’s config folder (where configuration.yaml is)', detect: folderOf(['/config', '/homeassistant', '/var/lib/hass', '/home/homeassistant/.homeassistant', '/srv/homeassistant', '/srv/homeassistant/config', '/opt/homeassistant/config', '/usr/share/hassio/homeassistant'], '[ -f "$d/configuration.yaml" ]') },
    ],
    root: true,
  },
  guide: (t) => ({
    title: 'Home Assistant',
    intro: `A Home Assistant theme: the house's greys for the whole interface, in a light and a dark mode that follow each user's own setting, with ${t.name}'s banner for a dashboard card.`,
    changes: [
      'Grounds, cards, sidebar and header: the house’s greys, light or dark.',
      'Home Assistant’s accent colour and its whole colour scale: greys instead of blue.',
      'Card corners: square, as the house’s are.',
      `A picture card with ${t.name}'s banner, for the top of a dashboard.`,
    ],
    limits: [
      'The sidebar title (*Home Assistant*), a logo in the sidebar and the favicon: no theme can change them.',
      'Colours that carry meaning — a light that is on, an alarm, an error — keep them.',
      'Home Assistant documents only a few theme variables; the kit also sets the colour scale newer screens use, which an update may rename (blue would then show again in places — rebuild the kit).',
    ],
    requires: ['Home Assistant 2026.10 or close to it.', 'Access to its configuration folder: through Docker (`HA_CONTAINER`), or as a folder on disk (the *Samba share* or *File editor* add-ons, or SSH).'],
    steps: [
      { text: 'Run the script — with Docker, naming the container; otherwise, giving the configuration folder.', code: 'HA_CONTAINER=homeassistant sh apply.sh\n# or\nsh apply.sh /path/to/homeassistant/config' },
      { text: 'Home Assistant OS has no shell of its own for scripts: copy `the-olympus.yaml` into `/config/themes/` and the two images into `/config/www/the-olympus/` with the *File editor* or *Samba* add-on (this chapter’s files can be shown and copied below), then go on with the next step.' },
      { text: 'If the script says Home Assistant does not read the themes folder yet, add these two lines to `configuration.yaml` and restart Home Assistant once.', code: 'frontend:\n  themes: !include_dir_merge_named themes' },
      { text: 'Reload the themes: **Developer tools → Actions → Frontend: Reload themes**.' },
      { text: 'On your **profile** page, choose **The Olympus** as the theme. Each user chooses for themselves; *Mode* there picks light or dark.' },
      { text: 'Optional: on a dashboard, **Edit → Add card → Manual**, and paste `picture-card.yaml`.' },
    ],
    check: ['The sidebar, header and cards are grey; switches and sliders are grey rather than blue.', 'Switching the profile’s mode between light and dark changes the whole interface with it.'],
    undo: [
      { text: 'Choose another theme on your profile page.' },
      { text: 'Remove the files the script installed, then reload the themes.', code: 'sh apply.sh /path/to/homeassistant/config --restore' },
    ],
    updates: 'Home Assistant keeps themes across updates. If an update renames the colour scale, parts of the interface turn blue again: rebuild the kit and run the script again.',
    files: [
      ['apply.sh', 'Installs the theme and the images (`--restore` removes them)'],
      ['the-olympus.yaml', 'The theme, with its light and dark modes'],
      ['picture-card.yaml', 'A dashboard card with the banner'],
      ['www/banner.svg', 'The banner, served by Home Assistant as /local/the-olympus/banner.svg'],
      ['www/seal.svg', 'The seal on its own disc'],
    ],
    tested: 'Written for Home Assistant 2026.10. The test suite parses the theme, checks that both modes are grey, and runs the script against a stand-in configuration folder; it has not been applied to a live instance here.',
  }),
  files: async (t) => [
    ['apply.sh', homeAssistantScript()],
    ['the-olympus.yaml', homeAssistantTheme()],
    ['picture-card.yaml', homeAssistantCard()],
    ['www/banner.svg', markSvg(bannerMark(t.marks.seal, t.name), P.slate)],
    ['www/seal.svg', coinSvg(t.marks.seal, 'dark', `The Olympus — ${t.name}`)],
  ],
};
