// Vaultwarden: the web vault re-inked through user.vaultwarden.scss.hbs,
// which Vaultwarden (1.33 or later) compiles into its own stylesheet. Written
// for Vaultwarden 1.37 with web vault 2026.7.
//
// The web vault's colours are CSS variables: the older ones as space-separated
// RGB triplets, the newer brand and grey scales as hex with "-rgb" companions.
// Every blue and blue-grey is set to a neutral grey, in the light and the dark
// theme; danger, success and warning keep their meaning. The logos on the
// sign-in page, in the side navigation and on the loading screen are replaced
// (the selectors are those of Vaultwarden's own wiki). The favicon belongs to
// the web vault's files and is not changed.

import { PALETTE } from '../../brand/palette.ts';
import { bannerMark, coinSvg, markSvg } from '../marks.ts';
import { cssSvg } from './shared.ts';
import type { ThemeKit } from './types.ts';
import { commentText } from '../../catalog/text.ts';

const P = PALETTE;
// The interface's lightest greys, beside the brand's eight.
const LINE = '#E1E1E1';
const PANEL = '#F5F5F5';
const WHITE = '#FFFFFF';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const triplet = (hex: string) => rgb(hex).join(' ');
const commas = (hex: string) => rgb(hex).join(', ');

/** A neutral scale, lightest to darkest, for the brand and grey steps 050 … 950. */
const STEPS = ['050', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
const GREYS = ['#F5F5F5', P.marble, LINE, P.ash, P.silver, '#7A7A7A', P.slate, '#4A4A4A', P.graphite, P.charcoal, P.obsidian];

function scales(): string {
  const lines: string[] = [];
  STEPS.forEach((step, i) => {
    for (const name of ['brand', 'gray']) {
      lines.push(`  --color-${name}-${step}: ${GREYS[i]};`, `  --color-${name}-${step}-rgb: ${commas(GREYS[i])};`);
    }
  });
  return lines.join('\n');
}

const legacy = (t: { primary: [string, string, string, string]; bg: string; alt: string[]; text: string; muted: string }) =>
  [
    ...(['100', '300', '600', '700'] as const).map((k, i) => `  --color-primary-${k}: ${triplet(t.primary[i])};`),
    ...(['100', '300', '500', '600', '700'] as const).map((k, i) => `  --color-secondary-${k}: ${triplet([LINE, P.ash, P.silver, P.slate, P.graphite][i])};`),
    ...(['100', '500', '600', '700'] as const).map((k, i) => `  --color-info-${k}: ${triplet([LINE, P.silver, P.slate, P.graphite][i])};`),
    `  --color-background: ${triplet(t.bg)};`,
    ...t.alt.map((c, i) => `  --color-background-alt${i ? i + 1 : ''}: ${triplet(c)};`),
    `  --color-text-main: ${triplet(t.text)};`,
    `  --color-text-muted: ${triplet(t.muted)};`,
    `  --color-marketing-logo: ${triplet(t.text)};`,
    `  --color-bw-blue: ${triplet(P.charcoal)};`,
  ].join('\n');

export function vaultwardenScss({ name, seal, bannerDark, bannerLight }: { name: string; seal: string; bannerDark: string; bannerLight: string }): string {
  return `/* The Olympus — Vaultwarden web vault (${commentText(name)}).
   Vaultwarden 1.37, web vault 2026.7. Lives in the data folder as
   templates/scss/user.vaultwarden.scss.hbs and is compiled into Vaultwarden's
   own stylesheet; restart Vaultwarden after changing it. Delete it to undo. */

$olympus-banner-dark: ${cssSvg(bannerDark)};
$olympus-banner-light: ${cssSvg(bannerLight)};
$olympus-seal: ${cssSvg(seal)};

/* Colours: neutral greys for every blue; danger, success and warning are left as they are. */
:root {
${legacy({ primary: [LINE, P.silver, P.charcoal, P.obsidian], bg: WHITE, alt: [PANEL, P.charcoal, P.graphite, P.obsidian], text: P.charcoal, muted: P.slate })}
${scales()}
}

.theme_dark {
${legacy({ primary: [P.graphite, P.slate, P.marble, P.paper], bg: P.charcoal, alt: [P.obsidian, '#161616', P.graphite, P.obsidian], text: P.marble, muted: P.silver })}
}

/* The sign-in page: the house's banner in place of the vault's logo. */
auth-anon-layout bit-landing-header bit-svg > svg {
  display: none !important;
}
auth-anon-layout bit-landing-header bit-svg::before {
  content: "";
  display: block;
  width: 220px;
  height: 44px;
  background: $olympus-banner-dark no-repeat left center / contain;
}
.theme_dark auth-anon-layout bit-landing-header bit-svg::before {
  background-image: $olympus-banner-light;
}

/* The side navigation: the banner when open, the seal when folded. */
app-user-layout bit-nav-logo bit-svg > svg,
app-organization-layout bit-nav-logo bit-svg > svg {
  display: none !important;
}
app-user-layout bit-nav-logo bit-svg::before,
app-organization-layout bit-nav-logo bit-svg::before {
  content: "";
  display: block;
  width: 180px;
  height: 36px;
  background: $olympus-banner-light no-repeat left center / contain;
}
#bit-side-nav[style*="4.5rem"] bit-nav-logo bit-svg::before {
  width: 36px;
  background-image: $olympus-seal;
}

/* The loading screen. */
app-root img.new-logo-themed {
  content: $olympus-seal;
}
`;
}

export function vaultwardenScript(): string {
  return `#!/bin/sh
# The Olympus — Vaultwarden: installs the stylesheet in the data folder.
#
#   Docker:     VAULTWARDEN_CONTAINER=vaultwarden sh apply.sh
#   A folder:   sh apply.sh /path/to/vaultwarden/data
#   Undo:       add --restore to either
#
# Vaultwarden reads it when it starts: the Docker form restarts the container.
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
FILE=templates/scss/user.vaultwarden.scss.hbs
restore=0
data=
for a in "$@"; do
  case "$a" in
    --restore) restore=1 ;;
    -*) echo "unknown option: $a" >&2; exit 2 ;;
    *) data=$a ;;
  esac
done

if [ -n "\${VAULTWARDEN_CONTAINER:-}" ]; then
  if [ "$restore" = 1 ]; then docker exec "$VAULTWARDEN_CONTAINER" rm -f "/data/$FILE"
  else
    docker exec "$VAULTWARDEN_CONTAINER" mkdir -p /data/templates/scss
    docker cp "$DIR/user.vaultwarden.scss.hbs" "$VAULTWARDEN_CONTAINER:/data/$FILE"
  fi
  docker restart "$VAULTWARDEN_CONTAINER" >/dev/null
else
  [ -n "$data" ] || { echo "give Vaultwarden's data folder, or set VAULTWARDEN_CONTAINER" >&2; exit 2; }
  [ -d "$data" ] || { echo "$data is not a folder" >&2; exit 1; }
  if [ "$restore" = 1 ]; then rm -f "$data/$FILE"
  else
    mkdir -p "$data/templates/scss"
    cp "$DIR/user.vaultwarden.scss.hbs" "$data/$FILE"
  fi
  echo "Restart Vaultwarden to apply."
fi
if [ "$restore" = 1 ]; then echo "Vaultwarden's own look is back."; else echo "The Olympus stylesheet installed. Reload the web vault (Ctrl+Shift+R)."; fi
`;
}

export const vaultwarden: ThemeKit = {
  id: 'vaultwarden',
  label: 'Vaultwarden',
  match: { ids: ['vaultwarden', 'bitwarden', 'passwords'] },
  how: '`apply.sh` installs `user.vaultwarden.scss.hbs` in the data folder: greys for the web vault, the house’s logo',
  guide: (t) => ({
    title: 'Vaultwarden',
    intro: `Vaultwarden reads a stylesheet of your own from its data folder and adds it to the web vault's. The kit's turns every blue of the vault grey, in the light and the dark theme, and puts ${t.name}'s banner and seal where the vault's logo was.`,
    changes: [
      'Every blue and blue-grey of the web vault: greys, in its light and dark themes.',
      `The logo on the sign-in page and in the side navigation: ${t.name}'s banner (the seal alone when the navigation is folded).`,
      'The loading screen: the seal.',
    ],
    limits: [
      'The favicon: it belongs to the web vault’s own files.',
      'The browser extensions and the phone apps: they are Bitwarden’s, and draw themselves.',
      'Danger, success and warning colours keep their meaning.',
    ],
    requires: ['Vaultwarden 1.33 or later (written for 1.37 with web vault 2026.7).', 'Access to its data folder: the container’s `/data`, or the folder mounted there.'],
    steps: [
      { text: 'Run the script — with Docker, naming the container (it copies the file and restarts Vaultwarden); otherwise, giving the data folder.', code: 'VAULTWARDEN_CONTAINER=vaultwarden sh apply.sh\n# or\nsh apply.sh /path/to/vaultwarden/data' },
      { text: 'Without Docker, restart Vaultwarden: it reads the stylesheet when it starts.' },
      { text: 'Reload the web vault (Ctrl+Shift+R).' },
    ],
    check: ['The sign-in page shows the banner instead of the vault’s logo.', 'Buttons and links are grey, not blue — in *Settings → Preferences*, try both themes.'],
    undo: [{ text: 'Remove the stylesheet, then restart Vaultwarden.', code: 'sh apply.sh /path/to/vaultwarden/data --restore' }],
    updates: 'Updates keep the stylesheet. A new web vault may rename a colour or the logo’s place: the rest still applies; rebuild the kit when a newer one is out. If the stylesheet has a mistake, Vaultwarden says so in its log and uses its own.',
    files: [
      ['apply.sh', 'Installs the stylesheet (`--restore` removes it)'],
      ['user.vaultwarden.scss.hbs', 'The stylesheet, with the banner and seal embedded'],
    ],
    tested: 'Written for Vaultwarden 1.37 and web vault 2026.7. The test suite checks that every colour is grey and runs the script against a stand-in data folder and a stand-in `docker`; it has not been applied to a live instance here.',
  }),
  files: async (t) => {
    const banner = bannerMark(t.marks.seal, t.name);
    return [
      ['apply.sh', vaultwardenScript()],
      ['user.vaultwarden.scss.hbs', vaultwardenScss({ name: t.name, seal: coinSvg(t.marks.seal, 'dark'), bannerDark: markSvg(banner, P.charcoal), bannerLight: markSvg(banner, P.marble) })],
    ];
  },
};
