// A machine of the house — a node, a NAS, a small board — as the map shows it.
// Machines live only in the server's data folder: they have no seal, kit or
// screens, only a building on the map and a card.

import { ID, isHost } from './service.ts';

export type MachineSpec = {
  id: string;
  name: string;
  description?: string;
  ip?: string;
  hostname?: string;
  os?: string;
  role?: string;
  logo?: string;
};

export const MACHINE_KEYS = ['id', 'name', 'description', 'ip', 'hostname', 'os', 'role', 'logo'] as const;
const KEYS = new Set<string>(MACHINE_KEYS);

/** Validate a parsed JSON value as a machine; throws with every problem found. The same rules as a service's. */
export function validateMachine(raw: unknown, where = 'machine'): MachineSpec {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`${where}: expected a JSON object`);
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.has(k)) errors.push(`unknown field "${k}"`);
  if (typeof o.id !== 'string' || !ID.test(o.id)) errors.push('"id" must be kebab-case (a-z, 0-9, hyphens)');
  const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(v);
  if (!text(o.name, 48)) errors.push('"name" is required: one line of at most 48 characters, without control characters');
  for (const k of ['os', 'role'] as const) if (o[k] !== undefined && !text(o[k], 48)) errors.push(`"${k}" must be one line of at most 48 characters, without control characters`);
  if (o.description !== undefined && !(o.description === '' || text(o.description, 120))) errors.push('"description" must be one line of at most 120 characters, without control characters');
  for (const k of ['ip', 'hostname'] as const) if (o[k] !== undefined && !isHost(o[k])) errors.push(`"${k}" must be an IPv4 or IPv6 address, or a host name`);
  if (o.logo !== undefined && (typeof o.logo !== 'string' || !/^logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/.test(o.logo))) errors.push('"logo" must be "logos/<id>.svg"');
  if (errors.length) throw new Error(`${where}:\n  - ${errors.join('\n  - ')}`);
  return o as unknown as MachineSpec;
}
