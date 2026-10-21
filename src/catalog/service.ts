// A service in the catalogue: what it is called, what kind of service it is,
// and who its patron is. One small JSON file per service in catalog/services/.
//
//   {
//     "id": "jellyfin",               ← file name and asset folder (kebab-case)
//     "name": "Jellyfin",             ← shown in the lockups
//     "category": "media",            ← picks the default god
//     "god": "apollo",                ← optional: another god, or "monogram"
//     "monogram": "J",                ← optional: letter for monograms and print slots
//     "logo": "logos/jellyfin.svg",   ← optional: app logo for the fine logo slot
//     "caption": "The Olympus · Media", ← optional: the lockup's second line
//     "url": "https://jellyfin.theolympus.cloud", ← optional: where it lives (QR labels)
//     "app": "jellyfin",              ← optional: the application it runs, for its theme kit
//     "description": "Personal media streaming"
//   }

import { CATEGORIES, GODS, defaultPatron, initialOf, type Category, type GodId, type Patron } from '../geometry/pantheon.ts';

export type ServiceSpec = {
  id: string;
  name: string;
  category: Category;
  god?: GodId | 'monogram';
  monogram?: string;
  logo?: string;
  caption?: string;
  url?: string;
  /** Its address on the network, for the map's online check: an IPv4 or IPv6 address, or a host name. */
  ip?: string;
  /** The application the service runs (a theme kit's id, such as "nextcloud"): its kit is made from this service. */
  app?: string;
  description?: string;
};

export type Service = ServiceSpec & { patron: Patron; letter: string; caption: string };

export const slugify = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SPEC_KEYS = ['id', 'name', 'category', 'god', 'monogram', 'logo', 'caption', 'url', 'ip', 'app', 'description'] as const;

/** A host to check: an IPv4 or IPv6 address, or a host name — never anything a command could read as an option or a word. */
export const isHost = (v: unknown): v is string => typeof v === 'string' && v.length <= 253 && (/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(v) || /^[0-9a-fA-F:]{2,39}$/.test(v));
const KEYS = new Set<string>(SPEC_KEYS);

/** Validate a parsed JSON value as a service spec; throws with every problem found. */
export function validateSpec(raw: unknown, where = 'service'): ServiceSpec {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`${where}: expected a JSON object`);
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.has(k)) errors.push(`unknown field "${k}"`);
  if (typeof o.id !== 'string' || !ID.test(o.id)) errors.push('"id" must be kebab-case (a-z, 0-9, hyphens)');
  // Free text goes into scripts, stylesheets and pages: one line, no control characters, a sensible length.
  const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(v);
  if (!text(o.name, 48)) errors.push('"name" is required: one line of at most 48 characters, without control characters');
  if (typeof o.category !== 'string' || !(o.category in CATEGORIES)) errors.push(`"category" must be one of: ${Object.keys(CATEGORIES).join(', ')}`);
  if (o.god !== undefined && (typeof o.god !== 'string' || !(o.god === 'monogram' || o.god in GODS))) errors.push(`"god" must be "monogram" or one of: ${Object.keys(GODS).join(', ')}`);
  if (o.god === 'zeus') errors.push('"zeus" is reserved for the master crest');
  if (o.monogram !== undefined && (typeof o.monogram !== 'string' || !/^[A-Za-z0-9]$/.test(o.monogram))) errors.push('"monogram" must be a single letter or digit');
  if (o.logo !== undefined && (typeof o.logo !== 'string' || !/^logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/.test(o.logo))) errors.push('"logo" must be a file in catalog/logos/, such as "logos/jellyfin.svg"');
  if (o.caption !== undefined && !text(o.caption, 48)) errors.push('"caption" must be one line of at most 48 characters, without control characters');
  // Addresses: the characters of a URL, but none that quote or substitute in a shell, a stylesheet or a page.
  if (o.url !== undefined && (typeof o.url !== 'string' || !/^https?:\/\/[A-Za-z0-9._~:/?#@!&()*+,;=%-]+$/.test(o.url) || o.url.length > 120)) errors.push('"url" must be an http(s) address of at most 120 characters, without quotes, spaces, $, <, > or backslashes');
  if (o.ip !== undefined && !isHost(o.ip)) errors.push('"ip" must be an IPv4 or IPv6 address, or a host name');
  if (o.app !== undefined && (typeof o.app !== 'string' || !ID.test(o.app))) errors.push('"app" must be an application id in kebab-case, such as "nextcloud"');
  if (o.description !== undefined && !(o.description === '' || text(o.description, 120))) errors.push('"description" must be one line of at most 120 characters, without control characters');
  if (errors.length) throw new Error(`${where}:\n  - ${errors.join('\n  - ')}`);
  return o as unknown as ServiceSpec;
}

/** Resolve a spec into a buildable service: its patron, monogram letter and lockup caption. */
export function resolve(spec: ServiceSpec): Service {
  const letter = (spec.monogram ?? initialOf(spec.name)).toUpperCase();
  const patron: Patron =
    spec.god === 'monogram' ? { monogram: letter } : spec.god ? { god: spec.god } : defaultPatron(spec.category, spec.name);
  const patronName = 'god' in patron ? GODS[patron.god].name : null;
  return { ...spec, patron, letter, caption: spec.caption?.trim() || (patronName ? `The Olympus · ${patronName}` : 'The Olympus') };
}
