// Browser host for the brand fonts: the same files the command line reads,
// fetched and parsed so lettering is outlined exactly as in the CLI builds.

import opentype from 'opentype.js';
import { registerFont, type FontRole } from '../../src/geometry/fonts.ts';
import cinzelBold from '@fontsource/cinzel/files/cinzel-latin-700-normal.woff?url';
import cinzelBlack from '@fontsource/cinzel/files/cinzel-latin-900-normal.woff?url';
import jostSemibold from '@fontsource/jost/files/jost-latin-600-normal.woff?url';
import jostRegular from '@fontsource/jost/files/jost-latin-400-normal.woff?url';

const FILES: Record<FontRole, string> = {
  inscription: cinzelBold,
  inscriptionHeavy: cinzelBlack,
  companion: jostSemibold,
  body: jostRegular,
};

let loading: Promise<void> | null = null;

/** Fetch and register the brand fonts, once; the parts of the site that draw lettering wait for it. */
export function loadBrandFonts(): Promise<void> {
  loading ??= loadAll().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

async function loadAll(): Promise<void> {
  await Promise.all(
    (Object.entries(FILES) as [FontRole, string][]).map(async ([role, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not load the ${role} font (${res.status}).`);
      registerFont(role, opentype.parse(await res.arrayBuffer()));
    }),
  );
}
