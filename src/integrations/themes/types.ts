// The shape of a theme kit. One module per application (in this folder),
// listed once in index.ts: that is all it takes to add one, or to remove it.

import type { Category } from '../../geometry/pantheon.ts';
import type { Entry } from '../dashboards.ts';
import type { KitMarks } from '../marks.ts';
import type { ScreenTone } from '../../render/wallpaper.ts';
import type { Guide } from './shared.ts';

/** What a kit is made from: the service it themes (or the master), and the means to draw. */
export type ThemeContext = {
  /** The catalogue service this kit is for; null when none matches and the master's seal stands in. */
  entry: Entry | null;
  id: string;
  name: string;
  url: string;
  marks: KitMarks;
  png: (svg: string, width: number) => Promise<Uint8Array>;
  /** A marble ground, w × h, grey PNG; the same size and tone is drawn once. */
  ground: (w: number, h: number, tone: ScreenTone) => Uint8Array;
};

export type ThemeKit = {
  /** The application's id: the folder under themes/, and what a service names in its "app" field. */
  id: string;
  label: string;
  /** Services this kit fits without naming it: by id first, then by category. */
  match: { ids: readonly string[]; category?: Category };
  /** For the kit's README: how it is applied. */
  how: string;
  /** The kit's files, relative to its folder. */
  files: (ctx: ThemeContext) => Promise<[path: string, data: string | Uint8Array][]>;
  /** Its step-by-step guide: the folder's README, and a chapter of the site's guide. */
  guide: (ctx: ThemeContext) => Guide;
  /** For the one-command installer: how to find the application on a machine and apply the kit. Kits set up by hand have none. */
  installer?: KitInstaller;
};

export type KitInstaller = {
  /** What the menu says it does. */
  summary: string;
  /**
   * A shell test: is the application on this machine? It may print a value
   * (a container's name, a folder) that becomes the default answer to `ask`.
   */
  detect: string;
  /** A question for the person installing: its answer goes to apply.sh in this environment variable. */
  ask?: { env: string; prompt: string };
  /** Options for apply.sh. */
  args?: string;
  /** apply.sh needs root (the system's files, or Docker). */
  root: boolean;
};
