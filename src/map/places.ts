// Where each service and machine stands on the map: a building type, a spot
// and a turn. Kept apart from the services themselves, so moving a building
// never rebuilds a service.

export type Place = { building: string; x: number; z: number; rotation: number };
export type Places = Record<string, Place>;

/** How far from the centre a building may stand, in map units. */
export const PLACE_LIMIT = 200;
const TURN = Math.PI * 2;

/** Validate one place; rotation comes back in [0, 2π). */
export function validatePlace(raw: unknown, where = 'place'): Place {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`${where}: expected an object`);
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  for (const k of Object.keys(o)) if (!['building', 'x', 'z', 'rotation'].includes(k)) errors.push(`unknown field "${k}"`);
  if (typeof o.building !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.building)) errors.push('"building" must be a building type id');
  for (const k of ['x', 'z'] as const) if (typeof o[k] !== 'number' || !Number.isFinite(o[k]) || Math.abs(o[k] as number) > PLACE_LIMIT) errors.push(`"${k}" must be a number within ±${PLACE_LIMIT}`);
  if (typeof o.rotation !== 'number' || !Number.isFinite(o.rotation)) errors.push('"rotation" must be a number (radians)');
  if (errors.length) throw new Error(`${where}:\n  - ${errors.join('\n  - ')}`);
  const r = (((o.rotation as number) % TURN) + TURN) % TURN;
  return { building: o.building as string, x: o.x as number, z: o.z as number, rotation: r };
}

/** Validate every place, by item id. */
export function validatePlaces(raw: unknown): Places {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('places: expected an object');
  const out: Places = {};
  for (const [id, p] of Object.entries(raw)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`places: "${id}" is not an id`);
    out[id] = validatePlace(p, `places.${id}`);
  }
  return out;
}
