// What the theme kits share: how to embed an SVG in CSS, how to quote for the shell.

/** An SVG as a CSS url(): only the characters CSS and URLs require are escaped. */
export const cssSvg = (svg: string) =>
  `url("data:image/svg+xml,${svg.replace(/\n\s*/g, ' ').replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}")`;

/** A single-quoted shell word. */
/** For a place's detect: the first running container whose image matches `image` (an awk pattern, lower case) and not `not`. */
export const containerOf = (image: string, not?: string) => `containers | awk 'tolower($2) ~ /${image}/${not ? ` && tolower($2) !~ /${not}/` : ''} { print $1; exit }'`;

/** For a place's detect: the first of these folders that passes `test` (written with "$d"). */
export const folderOf = (dirs: readonly string[], test: string) => `for d in ${dirs.join(' ')}; do if ${test}; then echo "$d"; exit 0; fi; done`;

/** For apply.sh: Podman stands in for Docker when only Podman is there. */
export const PODMAN = 'if ! command -v docker >/dev/null 2>&1 && command -v podman >/dev/null 2>&1; then docker() { podman "$@"; }; fi';

export const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** A kit's guide, always in the same order, so every application reads alike. Markdown. */
export type Guide = {
  title: string;
  /** One paragraph: what the kit does for the application. */
  intro: string;
  /** What it changes. */
  changes: string[];
  /** What it cannot change, and why — said plainly. */
  limits?: string[];
  /** What is needed first. */
  requires: string[];
  /** The steps, in order; each may carry a shell block. */
  steps: { text: string; code?: string }[];
  check: string[];
  undo: { text: string; code?: string }[];
  /** What an update of the application does to it. */
  updates?: string;
  files: [name: string, what: string][];
  /** Written for which release; tested how. */
  tested: string;
};

const block = (code?: string) => (code ? `\n\n   \`\`\`sh\n${code.split('\n').map((l) => `   ${l}`).join('\n')}\n   \`\`\`` : '');

export function guideMarkdown(g: Guide, madeFrom: string, dir: string): string {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n');
  return `# ${g.title}

${g.intro}

Made from ${madeFrom}. The files are in \`themes/${dir}/\` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

${list(g.changes)}
${g.limits?.length ? `\n## What it cannot change\n\n${list(g.limits)}\n` : ''}
## Before you start

${list(g.requires)}

## Install

${g.steps.map((s, i) => `${i + 1}. ${s.text}${block(s.code)}`).join('\n\n')}

## Check that it worked

${list(g.check)}

## Undo

${g.undo.map((s, i) => `${i + 1}. ${s.text}${block(s.code)}`).join('\n\n')}
${g.updates ? `\n## After an update\n\n${g.updates}\n` : ''}
## Files

| File | What it is |
|---|---|
${g.files.map(([f, w]) => `| \`${f}\` | ${w} |`).join('\n')}

---

${g.tested}
`;
}
