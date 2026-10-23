# The living city — architecture

How the map's city is planned, how it grows with the buildings on it, and how
its people move. This page starts with what was there before this work, and
then describes the systems as they are now.

## 1. What there was (audit, 2026-10-23)

**Rendering.** three.js r186 in its own lazy chunk (`app/src/site/map/map-scene.ts`),
React only for the page around it. Land: one 625×625 height grid, drawn in a
graphite contour shader; sea: one opaque plane. The city: slabs (streets,
terraces, squares) built from the plan (`city-mesh.ts`), instanced houses
(`src/map/fabric.ts`), buildings for the services from a catalogue of 77
parametric kinds (`src/map/buildings/`). Measured at the start (SwiftShader,
desktop): about 850 k triangles in 63 draw calls; first frame 0.46 s after setup.

**The city plan** (`src/map/city.ts`, `planCity(land)`), pure and deterministic:

- a grid of streets of three ranks (avenues 6, streets 4.2, lanes 3 units
  wide, walkways on both sides) through the crossing of the two avenues;
- blocks: every grid cell wholly on the town's gentle land, the connected group
  around the agora — **107 blocks, 428 quarter plots**;
- squares: agora (4 cells), sanctuary at the top of the sacred way, grove,
  two sports fields; precincts and field plots;
- a circuit wall along the outer streets, gates where the avenues leave, roads
  out of the gates, a mole with a lighthouse;
- the walking network (`plan.walk`, 574 nodes, 1066 edges): both walkways of
  every street, stepping-stone crossings, paths over the squares.

**What it did not do.** The plan depended only on the land: the same 107
blocks whether there were 3 services or 150. Every plot no service took was
filled with houses. Adding a building never changed the city; the city could
not grow; plot ids were stable only because nothing ever changed.

**The data.** `catalog/` (the house's services) with the server's data folder
over it (`OLYMPUS_DATA`: services, machines, `places.json`). `mapData()` places
everything on plots (`autoPlace`: the owner's places first, then a suitable
free plot for each other item). The map step (`scripts/map.ts`) writes
`assets/map/{city.json, terrain.bin, items.json, still.png}`; the server
(`scripts/serve.ts`) rebuilds and publishes after each saved change.

**The people** (`people.ts`): 420 walkers (160 on phones) on `plan.walk`. Each
stood on an edge and chose its next edge at each corner, weighted towards a
target (a square, or a random street); no route, no destination other than
squares; pairs walked side by side; no awareness of each other (they pass
through one another). Figures: four instanced stride poses, chosen by phase.

**Limits found:** no growth; buildings had no entrances and nobody visited
them; walkers overlapped; four-frame stride; the crowd was spread by edge
weight rather than by what is there.

## 2. The design

### 2.1 Growth: the city as a prefix of a fixed order

`src/map/city.ts` (`growthOf`, `planCity(land, extent)`) and
`src/map/world.ts` (`extentFor`).

1. **Every possible block, ranked once.** The candidate blocks are those
   `planCity` always considered (gentle land, above the sea, connected to the
   agora). From the core — the agora's four cells and the sacred way's
   column up to the sanctuary — the town grows one block at a time, always
   onto a block that touches it (so it stays connected): first one the town
   already holds on more sides (it fills out rather than reaching), else the
   nearest the agora — a little nearer along the avenues, a little further
   for steep ground. Ties are broken by the block's key. The result is a
   fixed total order of 121 cells (107 blocks and the squares' cells), from
   the land alone.
2. **A town of N blocks is the first N of that order.** A larger town only
   adds blocks: every block, plot id, street and plot of a smaller town is in
   it unchanged. This is what keeps the owner's buildings where they are.
3. **N comes from the data** (`extentFor`):
   - the plots the buildings need (each building's footprint: a quarter,
     half or whole block), with 0.6 block of town per quarter plot round
     them, never below 36 cells (a core and a ring of streets that still
     reads as a town);
   - never less than the blocks holding a building the owner placed;
   - and if a building still finds no plot, the town grows step by step until
     it does, or the island's land is used up.
4. **Squares join as the town reaches them.** The grove and the two fields
   keep their places from the full plan and appear when the town grows into
   them. Their plot ids no longer depend on how many fields exist (`f0` is
   always the west field, `f1` the east).
5. **Everything else follows the blocks:** the streets, crossings, terraces,
   the circuit wall (which moves outward as the town grows), the gates, the
   roads out of them, the furniture, the walking network, the houses, and the
   grading of the land under the town.

Removing a building never takes a block that holds another building away.
The town shrinks only when the outermost blocks are empty.

### 2.2 Who decides, and when

The server's data is the source of truth. The plan is a pure function of the
land and the extent; the extent is a pure function of the items and their
places. Both the map step and the edit API compute it the same way
(`townExtent()` in `src/map/items.ts`, over `src/map/world.ts`); the
planned and graded island is cached per extent (`src/node/island.ts`,
`.cache/island/<code>/<extent>/`). The edit API plans the town at the
extent the next build will publish. A saved
change is rebuilt and published by the existing release pipeline: only the
map step runs (and the site's changed files are linked anew). Several changes
in a row are built together (the server's settle window). A page that saved a
change compares the published `city.json` with the one it shows once the
change is published; when the town grew or shrank, the scene is drawn again
from the new one, at the same camera pose.

### 2.3 Manual and generated

| Kind | Where it lives | Regenerated? |
|---|---|---|
| Buildings placed by the owner | `places.json` (data folder) | never — the plan grows around them |
| Buildings placed automatically | computed by `autoPlace` | yes, deterministically; pinned on first read |
| Streets, terraces, squares, wall, roads | `city.json` | from the extent |
| Houses, trees, lamps, benches | from the plan and the taken plots | from the plan |
| People | runtime only, seeded | every page load |

### 2.4 The people

`src/map/crowd/nav.ts` (the graph), `src/map/crowd/crowd.ts` (the
simulation) — pure and seeded, tested in Node — and
`app/src/site/map/people.ts` (the drawing).

**The graph** is the walking network with:

- *a door for every building on the map*: on the middle of its front, or —
  for a building turned sideways to fit its plot — of the side nearest a
  way; joined by a short path to the nearest walkway that can be reached
  from the agora, or straight across a square's paving to its middle when
  the door opens onto a square;
- *ways that knew their kind and width*: walkways (half-widths 0.26–0.5
  by the street's rank), stepping-stone crossings (0.3), paths over squares
  (1.6), doors (0.4);
- *no way through a building*: a path over a square that a building now
  stands on (a stadium on a field, a temple in a precinct, the agora's
  stoas) is dropped, and only what is reachable from the agora is kept;
- `free(x, z)` and `clear(a, b)`: whether a point is clear of buildings,
  fountains (with room for two), benches and tree trunks, and whether a
  straight walk between two points is.

Routes: A* with straight-line distance; a crossing costs 1.6× its length (people
prefer not to cross), a square 0.9× (they like to cross one). A door is
never a way through: only the first or the last step of a route.

**The people** step at a fixed 10 Hz (`STEP`), whatever the frame rate; the
drawing interpolates between the last two steps. Each is a small state
machine — **walking**, **waiting** (at a crossing two people already use, at
most 2.5 s), **pausing** (at the end of the way) — and chooses where next by
its profile:

| Profile | Goes to | Pauses |
|---|---|---|
| errand | a building's door (80 %), else a square | 3–11 s at a door |
| visitor | a landmark (temples, the sanctuary's and civic buildings), else the agora or the sanctuary | 8–22 s |
| stroller | the grove, the agora, the fields — at 0.8× pace | 4–12 s |
| loiterer | a square, and other spots in it (65 % of the time) | 20–60 s |

Every sixth walks beside the one before, and now and then a third joins:
beside the leader where the way is wide enough for two, a step behind
where it is not. Destinations are weighted — the agora draws more than a
field, a temple more than a rack hall — so the crowd gathers where the
city is busy rather than evenly.

**On the way** each person keeps a lane across the way's width, narrowing
before a narrower way ahead; a spatial hash (1.5-unit cells) finds who is
near. Someone slower ahead: fall in behind. Someone coming: keep right.
Someone standing: step round. Sideways steps are limited to 0.4 units a
second, the turn to 3 radians a second, and speed eases in (0.8 /s²) and out
(1.6 /s²). In a square people walk straight from where they enter to a free
spot (never through the fountain); across one, straight from edge to edge,
or round the middle on an arc. Someone who has not got 0.3 units in six
seconds takes another route somewhere else. When the buildings change,
everyone plans again from where they stand; no one heads for a door that
is gone.

**How many**: four or so to a block of the town, from 60 to 420 (four in ten
on a phone).

**The figures**: one instanced mesh for the whole crowd — a knee-length
chiton, bare legs and feet, arms, a head, and for one in three a darker
mantle over the shoulders; heights vary by ±7 %, and clothes from near white
to dark grey. The vertex shader swings the legs (±0.46 rad) and arms
(±0.34 rad, against the legs) about the hip and the shoulder by each
person's gait: the phase is the distance walked over the stride (0.62 units,
scaled to the person's height), so the feet keep pace with the ground; the
swing fades with speed and is gone when standing, and the body rises a
little twice a stride. Drawn without shadows (the city's are cast once).

**Grounding**: heights come from the graph — walkways a curb (0.15) above the
crossings, squares at their paving — interpolated along each way.

**Wind**: the trees' crowns sway (vertex shader, by height above the trunk,
each tree in its own time) while the people are moving; never under
reduced motion.

### 2.5 What was considered and left out

- **Vehicles.** The city is an ancient Greek town of walkways and stepping
  stones; cars would be out of place, and its streets have no lanes for them.
  Not added.
- **A physics engine.** Walkers move on a known network of walkable ways;
  kinematic movement with neighbour separation gives the needed behaviour
  at a fraction of the cost.
- **Unbounded growth.** The city is limited to the island's gentle land
  (about 150 buildings). Beyond that a building finds no plot, and the map
  says so, as before.
- **Foot placement (IK).** The figures are a few boxes and cylinders seen
  from tens of metres; a gait phase-locked to the distance walked keeps the
  feet from sliding, and the walkways and squares are flat between their
  ends. Inverse kinematics would not show at this distance.
- **A day and night.** The map has one light; lamps that light up at dusk
  would need a day cycle the map does not have.
- **Birds, sound, construction.** Not added: they would draw the eye from
  the buildings without telling anything.

## 3. How a change reaches the city

1. A building is added, moved, turned or removed in the editor (or a
   service is added to `catalog/`, or a commit is pulled).
2. The edit API saves it in the data folder and answers with the change's
   number.
3. The server's rebuild (settling 1.5 s, coalescing what comes meanwhile)
   runs the map step: `townExtent` → the extent; `island(extent)` from the
   cache or planned and graded; `mapData` places every building;
   `city.json`, `terrain.bin`, `items.json`, `still.png` are written. Only
   files that changed reach the new release.
4. The release is published in one step; `/build.json` says which change it
   includes.
5. The page that saved sees its change published, reads `city.json` again,
   and when it differs draws the scene again. The people plan their ways
   again from where they stand whenever the buildings change.

Unaffected parts of the town stay exactly as they were: their plots, ids and
houses come from the same blocks.

## 4. Adding a building type

Building kinds live in `src/map/buildings/<family>.ts` (`kind(id, name,
family, kind, suggests, footprint, draw)`). A new kind is placed, measured
(`extentOf`), given a door (the middle of its front) and drawn without
anything else to change. Its family decides where it is placed first
(`SUITS` in `placement.ts`) and how much it draws people (`DRAW` in
`crowd/nav.ts`).

## 5. Running and testing

- `npm run map` — plans the town for the buildings on the map and writes
  `assets/map/`. `node scripts/dev/map-views.ts <url> <out> <tag>` takes
  screenshots from fixed poses (`VIEWS="name:x,z,distance,polar,azimuth;…"`).
- `tests/city-growth.test.ts` — the growth order, stability of plots across
  stages, every stage a whole town, more buildings never a smaller town, the
  owner's far building keeping its block.
- `tests/crowd.test.ts` — doors for every building, reachability, ways out
  of buildings, routes, the same crowd at any frame rate, people within the
  ways and apart, nobody stuck, nobody in a fountain, routes after the
  buildings change.
- `tests/map-people.test.ts` — the drawing: the same crowd, on the ways, no
  jumps, standing still under reduced motion.
- `npm run app:check` — the map's workflows in Chrome, editing included.

## 6. Measured

Software rendering (SwiftShader), one run each (`scripts/dev/perf-browser.ts`):

| | Before | After (first run) | After (second run) |
|---|---|---|---|
| Triangles, desktop overview | 1 016 k | 883 k | 883 k |
| Map ready, desktop | 4.4 s | 5.6 s | 4.1 s |
| Map ready, tablet | 6.0 s | 8.4 s | 6.2 s |
| Map ready, phone | 5.6 s | 8.5 s | 5.8 s |
| People (catalogue's 16 services) | 420 | 132 | 132 |
| Simulation step (132 people, 10 Hz) | — | ≈ 0.5 ms a frame | |

The machine was under other load during the first run (load average 6–7);
the second run is within the noise of the measurements before this work.
The town for the catalogue's 16 services is 41 cells instead of 121, so
fewer triangles are drawn; the people's graph and doors add about 0.1 s to
the map's start.

On the server: a saved change that grows the town (40 machines added at
once) was published 5 s after the last save; the town went from 33 to 79
blocks, every building placed. Removing them brought it back to 33.

## 7. Limits and known defects

- The figures are simple shapes; there is no face or hand detail, and no
  collision between a person and a lamp post.
- Companions and avoidance keep people apart most of the time, not always:
  the tests allow 0.15 % of walking pairs closer than 0.18 units.
- A walled court round a tall, narrow building (a rack hall) reads as a
  dark trench from above, where many stand side by side.
- Growth follows the island's grid: a town never grows beyond its gentle
  land, and the grid's orientation is fixed.
- A town shrinks only from its outer blocks: a building left alone far out
  keeps the blocks between it and the agora.
