// The people of the city as a simulation: each one has somewhere to go — a
// building's door, a square, the fountain — a route there over the walking
// network (nav.ts), and a way of going: on errands from door to door,
// visiting a landmark, strolling the squares and the grove, or standing about
// a square. Some walk in pairs or threes.
//
// Each person is a small state machine — walking, waiting at a crossing,
// pausing at the end of the way, choosing where next — stepped at a fixed
// rate (STEP) whatever the frame rate, so the same city gives the same crowd.
// On the way, people keep to a lane within the way's width (to the right
// when someone comes the other way), slow behind someone slower, step round
// people standing, turn at a natural rate and ease their speed in and out; a
// spatial hash finds who is near. Someone who has not got anywhere for a
// while takes another route. The drawing reads where each one is from
// `state` and interpolates between steps.

import { seeded } from '../noise.ts';
import { route, wayBetween, nearestWay, type Nav, type Destination } from './nav.ts';

/** Seconds per step of the simulation. */
export const STEP = 0.1;
/** A stride (two steps), in map units: the gait's phase turns once per stride walked. */
export const STRIDE = 0.62;
/** How fast a person steps aside (map units a second). */
const SIDESTEP = 0.4;

export type Profile = 'errand' | 'visitor' | 'stroller' | 'loiterer';
export type State = 'walking' | 'waiting' | 'pausing';

type Agent = {
  profile: Profile;
  /** The pace it walks at when the way is clear (map units a second). */
  pace: number;
  /** Its speed now. */
  v: number;
  /** The points of its way (x, y, z), each with the half-width it may use, and the way's index (−1 for a step onto a spot). */
  path: { x: number; y: number; z: number; half: number; way: number }[];
  /** The segment it is on (from path[seg] to path[seg + 1]) and how far along. */
  seg: number;
  s: number;
  /** The side of the way it keeps to (signed, from the middle, positive to its right) and its offset now, in the world. */
  lane: number;
  off: [number, number];
  state: State;
  timer: number;
  dest: number;
  /** Where in a square it stands: a direction and how far out. */
  spot: [number, number];
  /** A companion walks beside its leader (the leader's index) at `slot` to its right. */
  leader: number;
  slot: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Distance walked: the gait's phase is distance / STRIDE. */
  walked: number;
  /** How far it got in the last few seconds: a person not getting anywhere takes another route. */
  watch: { t: number; x: number; z: number };
};

/** What the drawing reads: per person, x, y, z, heading, speed, distance walked (the gait), standing (0/1). */
export type Frame = Float32Array;
export const FIELDS = 7;

export type Crowd = {
  count: number;
  /** Advance by `dt` seconds (any frame time): whole steps are taken; the result is how far into the next step the time is (0–1), for interpolation. */
  advance(dt: number): number;
  /** The last two steps' states (previous, current), FIELDS numbers per person. */
  frames(): { prev: Frame; cur: Frame };
  /** The buildings changed: doors are found again and everyone's way is planned again from where they stand. */
  setNav(nav: Nav): void;
  states(): { state: State; profile: Profile; dest: Destination | undefined; leader: number }[];
};

const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU + Math.PI) % TAU - Math.PI;

export function createCrowd(start: Nav, opts: { count: number; seed?: number }): Crowd {
  let nav = start;
  const rnd = seeded(opts.seed ?? 4711);
  const agents: Agent[] = [];

  // ---- where people go ----
  const doors = () => nav.destinations.filter((d) => d.kind === 'door');
  const squares = () => nav.destinations.filter((d) => d.kind === 'square');
  const pick = (list: Destination[]): number => {
    if (!list.length) return Math.floor(rnd() * nav.destinations.length);
    const total = list.reduce((s, d) => s + d.weight, 0);
    let r = rnd() * total;
    for (const d of list) if ((r -= d.weight) <= 0) return nav.destinations.indexOf(d);
    return nav.destinations.indexOf(list[list.length - 1]);
  };
  const destinationFor = (a: Agent): number => {
    const r = rnd();
    switch (a.profile) {
      case 'errand':
        return pick(r < 0.8 && doors().length ? doors() : squares());
      case 'visitor': {
        const landmarks = doors().filter((d) => d.weight >= 2.5);
        return pick(r < 0.65 && landmarks.length ? landmarks : squares().filter((d) => d.of === 'agora' || d.of === 'sanctuary'));
      }
      case 'stroller':
        return pick(squares().filter((d) => d.of === 'grove' || d.of === 'agora' || d.of === 'field'));
      case 'loiterer':
        return pick(squares());
    }
  };
  const pauseFor = (a: Agent, d: Destination | undefined): number => {
    if (!d) return 2;
    const r = rnd();
    if (a.profile === 'loiterer') return 20 + r * 40;
    if (d.kind === 'door') return a.profile === 'visitor' ? 8 + r * 14 : 3 + r * 8;
    return a.profile === 'stroller' ? 4 + r * 8 : 6 + r * 14;
  };

  /** A spot to stand at about a destination: in a square, anywhere across it clear of its middle. */
  const spotPoint = (d: Destination, spot: [number, number]): [number, number, number] => {
    const p = nav.pts[d.node];
    if (d.spread <= 0.7) return [p[0], p[1], p[2]];
    const r = 2.6 + spot[1] * Math.max(0.5, d.spread - 2.6);
    return [p[0] + Math.cos(spot[0]) * r, p[1], p[2] + Math.sin(spot[0]) * r];
  };
  /** A spot in a square that is free to stand on and can be walked to straight from (x, z); null when none is found in a few tries. */
  const freeSpot = (d: Destination, x: number, z: number): [number, number] | null => {
    for (let k = 0; k < 10; k++) {
      const spot: [number, number] = [rnd() * TAU, Math.sqrt(rnd())];
      const [sx, , sz] = spotPoint(d, spot);
      if (nav.free(sx, sz) && nav.clear(x, z, sx, sz)) return spot;
    }
    return null;
  };

  /** Plan a way from where an agent stands (on node `from`, or anywhere) to its destination. */
  const plan = (a: Agent, from: number) => {
    const d = nav.destinations[a.dest];
    const nodes = d ? route(nav, from, d.node) : null;
    a.path = [{ x: a.x, y: a.y, z: a.z, half: 0.4, way: -1 }];
    if (nodes) {
      // To a square: to where the way meets it, then straight to a free spot in it (not through its fountain).
      let spot: [number, number] | null = null;
      if (d && d.spread > 0.7 && nodes.length > 1) {
        const entry = nav.pts[nodes[nodes.length - 2]];
        spot = freeSpot(d, entry[0], entry[2]);
        // No free spot in reach from there: it stops at the square's edge, never in its middle.
        nodes.pop();
      }
      for (let k = 0; k < nodes.length; k++) {
        const p = nav.pts[nodes[k]];
        const way = k ? wayBetween(nav, nodes[k - 1], nodes[k]) : -1;
        // The first point is the node it stands on or nearest: from where it is.
        if (k === 0 && Math.hypot(p[0] - a.x, p[2] - a.z) < 0.05) continue;
        // Across a square: never through its middle (its fountain) — straight from edge to edge when that is clear, else round it.
        if (nav.centres.has(nodes[k]) && k > 0 && k < nodes.length - 1) {
          const P = nav.pts[nodes[k - 1]],
            N = nav.pts[nodes[k + 1]];
          if (nav.clear(P[0], P[2], N[0], N[2])) continue;
          // Round the middle on an arc, from the side it comes in by to the side it leaves by, the shorter way round.
          const from = Math.atan2(P[2] - p[2], P[0] - p[0]);
          const sweep = wrap(Math.atan2(N[2] - p[2], N[0] - p[0]) - from);
          const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 4)));
          const arc: [number, number][] = [];
          for (let n = 0; n <= steps; n++) {
            const t = from + (sweep * n) / steps;
            arc.push([p[0] + Math.cos(t) * 4, p[2] + Math.sin(t) * 4]);
          }
          if (arc.every(([x, z]) => nav.free(x, z))) {
            for (const [x, z] of arc) a.path.push({ x, y: p[1], z, half: 0.5, way });
            continue;
          }
        }
        a.path.push({ x: p[0], y: p[1], z: p[2], half: way >= 0 ? nav.ways[way].half : 0.4, way });
      }
      if (d && spot) {
        a.spot = spot;
        const [x, y, z] = spotPoint(d, spot);
        a.path.push({ x, y, z, half: 1, way: -1 });
      }
    }
    a.seg = 0;
    a.s = 0;
    a.state = a.path.length > 1 ? 'walking' : 'pausing';
    a.timer = a.path.length > 1 ? 0 : 1 + rnd() * 3;
  };

  /** Where to set off from a point: the nearer end of the nearest way (at a door, the door — people leave the way they came), never a square's middle — out of a square, by the nearest way to its edge that can be walked to straight. */
  const nodeNear = (x: number, z: number): number => {
    const n = nearestWay(nav.pts, nav.ways, x, z);
    if (!n) return 0;
    const w = nav.ways[n.way];
    const end = n.t < 0.5 ? w.a : w.b;
    if (!nav.centres.has(end)) return end;
    const other = end === w.a ? w.b : w.a;
    if (!nav.centres.has(other) && nav.clear(x, z, nav.pts[other][0], nav.pts[other][2])) return other;
    // The centre's other ways: the end of one that is clear to walk to.
    for (const k of nav.out[end]) {
      const o = nav.ways[k].a === end ? nav.ways[k].b : nav.ways[k].a;
      if (nav.clear(x, z, nav.pts[o][0], nav.pts[o][2])) return o;
    }
    return other;
  };

  // ---- the people: spread over the city as they would be, already on their way ----
  const profiles: Profile[] = ['errand', 'errand', 'visitor', 'stroller', 'errand', 'loiterer', 'visitor', 'errand', 'stroller', 'loiterer'];
  for (let k = 0; k < opts.count; k++) {
    // Every sixth walks beside the one before; every seventeenth makes a three.
    const companion = k > 0 && (k % 6 === 0 || (k % 17 === 0 && agents[k - 1].leader >= 0)) && agents[k - 1].profile !== 'loiterer';
    const lead = companion ? (agents[k - 1].leader >= 0 ? agents[k - 1].leader : k - 1) : -1;
    const a: Agent = {
      profile: lead >= 0 ? agents[lead].profile : profiles[Math.floor(rnd() * profiles.length)],
      pace: 0.42 + rnd() * 0.2,
      v: 0,
      path: [],
      seg: 0,
      s: 0,
      lane: (0.35 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1),
      off: [0, 0],
      state: 'walking',
      timer: 0,
      dest: 0,
      spot: [rnd() * TAU, Math.sqrt(rnd())],
      leader: lead,
      slot: lead >= 0 ? (agents.filter((o) => o.leader === lead).length ? -0.42 : 0.42) : 0,
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      walked: rnd() * STRIDE,
      watch: { t: 0, x: 0, z: 0 },
    };
    if (a.profile === 'stroller') a.pace *= 0.8;
    if (lead >= 0) {
      a.pace = agents[lead].pace;
      agents.push(a);
      continue;
    }
    // Start somewhere along a way to somewhere: a random point of the network, heading to a destination.
    const starts = nav.reachable.filter((n) => !nav.centres.has(n));
    const origin = starts[Math.floor(rnd() * starts.length)] ?? 0;
    const p = nav.pts[origin];
    a.x = p[0];
    a.y = p[1];
    a.z = p[2];
    a.dest = destinationFor(a);
    plan(a, origin);
    // A share already standing about where they were going (and anyone with nowhere to go yet).
    if (a.path.length < 2 || rnd() < 0.22) {
      const end = a.path[a.path.length - 1];
      a.x = end.x;
      a.y = end.y;
      a.z = end.z;
      a.path = [end];
      a.state = 'pausing';
      a.timer = rnd() * pauseFor(a, nav.destinations[a.dest]);
    } else {
      // Part of the way along already.
      let walk = rnd() * routeLength(a);
      while (a.seg < a.path.length - 1) {
        const l = segLen(a, a.seg);
        if (walk < l) {
          a.s = walk;
          break;
        }
        walk -= l;
        a.seg++;
      }
      if (a.seg >= a.path.length - 1) {
        a.seg = Math.max(0, a.path.length - 2);
        a.s = segLen(a, a.seg);
      }
      position(a);
      a.v = a.pace;
      // Facing the way it is going.
      const A = a.path[a.seg],
        B = a.path[a.seg + 1];
      if (B) a.heading = Math.atan2(B.x - A.x, B.z - A.z);
    }
    a.watch = { t: 0, x: a.x, z: a.z };
    agents.push(a);
  }
  for (const a of agents) if (a.leader >= 0) follow(a);

  function segLen(a: Agent, k: number): number {
    const A = a.path[k],
      B = a.path[k + 1];
    return Math.max(0.001, Math.hypot(B.x - A.x, B.z - A.z));
  }
  function routeLength(a: Agent): number {
    let l = 0;
    for (let k = 0; k < a.path.length - 1; k++) l += segLen(a, k);
    return l;
  }
  /** Where an agent is on its segment, with its lane offset (eased in the world, so turning a corner does not jump). */
  function position(a: Agent, dt = 0) {
    if (a.path.length < 2) {
      const p = a.path[0];
      if (p) {
        a.x = p.x + a.off[0];
        a.y = p.y;
        a.z = p.z + a.off[1];
      }
      return;
    }
    const A = a.path[a.seg],
      B = a.path[a.seg + 1];
    const l = segLen(a, a.seg);
    const t = Math.min(1, a.s / l);
    const ux = (B.x - A.x) / l,
      uz = (B.z - A.z) / l;
    // To its right, within the way's width (the step onto a spot has none: it walks straight to it); narrowing before a narrower way ahead.
    let half = B.way >= 0 ? B.half : 0;
    const C = a.path[a.seg + 2];
    const end = l - a.s;
    if (C && end < 1.5) half = Math.min(half, (C.way >= 0 ? C.half : 0) + (half - (C.way >= 0 ? C.half : 0)) * Math.max(0, end / 1.5));
    const lane = Math.max(-half, Math.min(half, a.lane * half));
    const tx = -uz * lane,
      tz = ux * lane;
    drift(a.off, tx, tz, dt);
    a.x = A.x + (B.x - A.x) * t + a.off[0];
    a.y = A.y + (B.y - A.y) * t;
    a.z = A.z + (B.z - A.z) * t + a.off[1];
  }
  /** Move a sideways offset towards where it should be, no faster than a person steps aside (all at once when placing, dt 0). */
  function drift(off: [number, number], tx: number, tz: number, dt: number) {
    const dx = tx - off[0],
      dz = tz - off[1];
    const d = Math.hypot(dx, dz);
    const most = dt ? SIDESTEP * dt : Infinity;
    const k = d > most ? most / d : 1;
    off[0] += dx * k;
    off[1] += dz * k;
  }

  /** A companion: beside its leader where the way is wide enough for two, a step behind where it is not; at the leader's pace, doing what the leader does. */
  function follow(a: Agent, dt = 0) {
    const l = agents[a.leader];
    // The leader's way (sin h, cos h) and right (−cos h, sin h) for its heading h.
    const fx = Math.sin(l.heading),
      fz = Math.cos(l.heading);
    const rx = -fz,
      rz = fx;
    const way = l.path[l.seg + 1];
    const half = way && way.way >= 0 ? way.half : 1;
    // Where the leader walks across the way, and where beside it the companion would be.
    const across = l.off[0] * rx + l.off[1] * rz;
    const beside = Math.abs(across + a.slot) <= half + 0.05 || l.state !== 'walking';
    const tx = beside ? rx * a.slot : -fx * 0.6 + rx * a.slot * 0.2,
      tz = beside ? rz * a.slot : -fz * 0.6 + rz * a.slot * 0.2;
    drift(a.off, tx, tz, dt);
    a.x = l.x + a.off[0];
    a.y = l.y;
    a.z = l.z + a.off[1];
    a.heading = l.heading;
    a.v = l.v;
    a.state = l.state;
  }

  // ---- the step ----
  const CELL = 1.5;
  const grid = new Map<number, number[]>();
  const cellKey = (x: number, z: number) => (Math.floor(x / CELL) + 4096) * 8192 + (Math.floor(z / CELL) + 4096);
  const near = (x: number, z: number, out: number[]) => {
    out.length = 0;
    const cx = Math.floor(x / CELL),
      cz = Math.floor(z / CELL);
    for (let i = cx - 1; i <= cx + 1; i++)
      for (let j = cz - 1; j <= cz + 1; j++) {
        const c = grid.get((i + 4096) * 8192 + (j + 4096));
        if (c) for (const k of c) out.push(k);
      }
    return out;
  };
  const busy = new Map<number, number>();
  const neighbours: number[] = [];
  let clock = 0;

  function step() {
    clock += STEP;
    grid.clear();
    busy.clear();
    agents.forEach((a, k) => {
      const c = cellKey(a.x, a.z);
      const list = grid.get(c);
      if (list) list.push(k);
      else grid.set(c, [k]);
      if (a.state === 'walking' && a.path[a.seg + 1]?.way >= 0 && nav.ways[a.path[a.seg + 1].way]?.kind === 'crossing') busy.set(a.path[a.seg + 1].way, (busy.get(a.path[a.seg + 1].way) ?? 0) + 1);
    });
    for (let k = 0; k < agents.length; k++) {
      const a = agents[k];
      if (a.leader >= 0) continue;
      if (a.state === 'pausing') {
        a.v = Math.max(0, a.v - 1.6 * STEP);
        a.timer -= STEP;
        if (a.timer <= 0) {
          const here = nav.destinations[a.dest];
          // A loiterer moves to another spot in the same square more often than it leaves.
          const next = a.profile === 'loiterer' && here?.kind === 'square' && rnd() < 0.65 ? freeSpot(here, a.x, a.z) : null;
          if (here && next) {
            a.spot = next;
            const [x, y, z] = spotPoint(here, a.spot);
            a.path = [{ x: a.x, y: a.y, z: a.z, half: 1, way: -1 }, { x, y, z, half: 1, way: -1 }];
            a.seg = 0;
            a.s = 0;
            a.off = [0, 0];
            a.state = 'walking';
          } else {
            a.dest = destinationFor(a);
            a.off = [0, 0];
            plan(a, nodeNear(a.x, a.z));
          }
          a.watch = { t: clock, x: a.x, z: a.z };
        }
        continue;
      }
      if (a.state === 'waiting') {
        a.v = Math.max(0, a.v - 1.6 * STEP);
        a.timer -= STEP;
        const w = a.path[a.seg + 1]?.way ?? -1;
        if (a.timer <= 0 || (busy.get(w) ?? 0) < 2) a.state = 'walking';
        continue;
      }
      // Walking: the way ahead, and who is on it.
      const A = a.path[a.seg],
        B = a.path[a.seg + 1];
      const l = segLen(a, a.seg);
      const ux = (B.x - A.x) / l,
        uz = (B.z - A.z) / l;
      let want = a.pace;
      let side = 0;
      for (const n of near(a.x, a.z, neighbours)) {
        if (n === k) continue;
        const o = agents[n];
        const rx = o.x - a.x,
          rz = o.z - a.z;
        const ahead = rx * ux + rz * uz;
        const lat = rx * -uz + rz * ux;
        if (ahead <= 0 || ahead > 1.4 || Math.abs(lat) > 0.34) continue;
        const ox = Math.sin(o.heading),
          oz = Math.cos(o.heading);
        const same = ox * ux + oz * uz;
        if (o.state !== 'walking' || o.v < 0.05) side += lat >= 0 ? -1 : 1; // someone standing: round them
        else if (same > 0.3) want = Math.min(want, ahead < 0.6 ? o.v * 0.6 : o.v); // someone slower ahead: fall in behind
        else if (same < -0.3) side += 1; // someone coming: keep right
      }
      if (side > 0) a.lane = Math.min(1, a.lane + 0.8 * STEP);
      else if (side < 0) a.lane = Math.max(-1, a.lane - 0.8 * STEP);
      // Speed eases in and out; slower near the end of the way.
      const left = routeRemaining(a);
      if (left < 1.2) want = Math.min(want, 0.12 + left * 0.35);
      a.v += Math.max(-1.6 * STEP, Math.min(0.8 * STEP, want - a.v));
      // Turning at a natural rate, towards the way ahead.
      const target = Math.atan2(ux, uz);
      a.heading = wrap(a.heading + Math.max(-3 * STEP, Math.min(3 * STEP, wrap(target - a.heading))));
      a.s += a.v * STEP;
      a.walked += a.v * STEP;
      while (a.s >= segLen(a, a.seg)) {
        if (a.seg >= a.path.length - 2) {
          // Arrived.
          a.s = segLen(a, a.seg);
          a.state = 'pausing';
          a.timer = pauseFor(a, nav.destinations[a.dest]);
          break;
        }
        a.s -= segLen(a, a.seg);
        a.seg++;
        // A crossing ahead with two already on it: wait at the curb.
        const next = a.path[a.seg + 1].way;
        if (next >= 0 && nav.ways[next]?.kind === 'crossing' && (busy.get(next) ?? 0) >= 2) {
          a.state = 'waiting';
          a.timer = 2.5;
          a.s = 0;
          break;
        }
      }
      position(a, STEP);
      // Not getting anywhere for a while: another route, somewhere else.
      if (clock - a.watch.t > 6) {
        if (a.state === 'walking' && Math.hypot(a.x - a.watch.x, a.z - a.watch.z) < 0.3) {
          a.dest = destinationFor(a);
          a.off = [0, 0];
          plan(a, nodeNear(a.x, a.z));
        }
        a.watch = { t: clock, x: a.x, z: a.z };
      }
    }
    for (const a of agents) if (a.leader >= 0) {
      const before = [a.x, a.z];
      follow(a, STEP);
      a.walked += Math.hypot(a.x - before[0], a.z - before[1]);
    }
  }
  function routeRemaining(a: Agent): number {
    let l = segLen(a, a.seg) - a.s;
    for (let k = a.seg + 1; k < a.path.length - 1; k++) l += segLen(a, k);
    return l;
  }

  // ---- what the drawing reads ----
  let prev = new Float32Array(agents.length * FIELDS);
  let cur = new Float32Array(agents.length * FIELDS);
  const write = (f: Float32Array) =>
    agents.forEach((a, k) => {
      const o = k * FIELDS;
      f[o] = a.x;
      f[o + 1] = a.y;
      f[o + 2] = a.z;
      f[o + 3] = a.heading;
      f[o + 4] = a.v;
      f[o + 5] = a.walked;
      f[o + 6] = a.state === 'walking' ? 0 : 1;
    });
  write(cur);
  prev.set(cur);
  let acc = 0;

  return {
    count: agents.length,
    advance(dt) {
      acc += Math.min(dt, 0.5);
      while (acc >= STEP) {
        acc -= STEP;
        [prev, cur] = [cur, prev];
        step();
        write(cur);
      }
      return acc / STEP;
    },
    frames: () => ({ prev, cur }),
    setNav(next) {
      nav = next;
      for (const a of agents) {
        if (a.leader >= 0) continue;
        if (!nav.destinations[a.dest]) a.dest = destinationFor(a);
        a.off = [0, 0];
        plan(a, nodeNear(a.x, a.z));
      }
    },
    states: () => agents.map((a) => ({ state: a.state, profile: a.profile, dest: nav.destinations[a.dest], leader: a.leader })),
  };
}
