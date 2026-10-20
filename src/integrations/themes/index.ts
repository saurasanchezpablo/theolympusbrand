// Every theme kit the house can make, and which service each is made from.
//
// To add an application: write its module in this folder (see types.ts) and
// list it below. To remove one: delete its line and its module. A service in
// the catalogue says which application it runs with "app": "<kit id>"; that
// service's seal then themes the application. Without one, a kit falls back
// to a service that fits it by id or category, and then to the master.

import type { Entry } from '../dashboards.ts';
import type { ThemeKit } from './types.ts';
import { nextcloud } from './nextcloud.ts';
import { jellyfin } from './jellyfin.ts';
import { proxmox } from './proxmox.ts';
import { grafana } from './grafana.ts';
import { uptimeKuma } from './uptime-kuma.ts';
import { homeAssistant } from './home-assistant.ts';
import { vaultwarden } from './vaultwarden.ts';

export type { ThemeContext, ThemeKit } from './types.ts';

export const THEME_KITS: readonly ThemeKit[] = [nextcloud, jellyfin, proxmox, grafana, uptimeKuma, homeAssistant, vaultwarden];

export const themeKit = (id: string): ThemeKit | undefined => THEME_KITS.find((k) => k.id === id);

/** One kit to build: for which service (null: the master), into which folder under themes/. */
export type ThemeAssignment = { kit: ThemeKit; entry: Entry | null; dir: string };

/**
 * The kits to build for a catalogue. Every service that names an application
 * gets that application's kit — the first in themes/<app>/, any further one in
 * themes/<app>-<service>/. A kit no service names is made once, from the
 * service that fits it best, or from the master.
 */
export function themeAssignments(entries: readonly Entry[]): ThemeAssignment[] {
  const out: ThemeAssignment[] = [];
  for (const kit of THEME_KITS) {
    const named = entries.filter((e) => e.app === kit.id);
    if (named.length) {
      named.forEach((entry, i) => out.push({ kit, entry, dir: i === 0 ? kit.id : `${kit.id}-${entry.id}` }));
      continue;
    }
    const fit = entries.find((e) => !e.app && kit.match.ids.includes(e.id)) ?? (kit.match.category ? entries.find((e) => !e.app && e.category === kit.match.category) : undefined);
    out.push({ kit, entry: fit ?? null, dir: kit.id });
  }
  return out;
}

/** Services naming an application the house has no kit for (listed on dashboards, but not themed). */
export const unknownApps = (entries: readonly Entry[]): Entry[] => entries.filter((e) => e.app && !themeKit(e.app));
