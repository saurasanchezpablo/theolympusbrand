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
import { sq } from './shared.ts';
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
#   A folder:    sh apply.sh /path/to/homeassistant/config
#   Undo:        add --restore to either
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
restore=0
config=
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
  files: async (t) => [
    ['apply.sh', homeAssistantScript()],
    ['the-olympus.yaml', homeAssistantTheme()],
    ['picture-card.yaml', homeAssistantCard()],
    ['www/banner.svg', markSvg(bannerMark(t.marks.seal, t.name), P.slate)],
    ['www/seal.svg', coinSvg(t.marks.seal, 'dark', `The Olympus — ${t.name}`)],
  ],
};
