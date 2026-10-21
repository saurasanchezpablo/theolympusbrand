# The Olympus map — design

Date: 2026-10-21. Status: agreed in conversation, to be planned.

## Intent

The owner runs many more services and machines on the home server than the
sixteen in the house's catalogue, and adds, renames and moves them often. They
want two things, and they are one feature:

1. **An easy way to add and change services** — name, address, logo and the
   rest — from the browser, saved on the server, so every device sees the same
   thing and the rest of the house (seals, theme kits, dashboards, screens)
   follows automatically.
2. **A map of the house**: a detailed 3D island with Mount Olympus seen from
   above, in the spirit of Primland's "explore the map", where every service
   and every machine is a marble building placed by hand. The map *is* the
   editor: the owner opens it, adds a building from a catalogue, drops it on
   the land, and fills in what it stands for.

The map is fully modular: it is drawn from the catalogue, so anything added —
on the map or by any other means — appears on it with no code change.

## Goals

- A new page, `#/map`, in the existing static site (React 19 + Vite + three.js),
  loaded lazily in its own chunk like the home medallion.
- **View mode** (anyone who can open the site): explore the island; click a
  building to open its card.
- **Edit mode** (password): add, move, rotate, swap, edit and delete buildings;
  every change is saved on the server.
- A **building catalogue of more than 50 Greek building types**, detailed:
  fluted columns with entasis, Doric/Ionic/Corinthian capitals, triglyph
  friezes, pediments with raking cornices and roof tiles, acroteria.
- **Services and machines told apart at a glance** (see *Machines*), with a
  key and a filter (all / services / machines).
- **Online / offline** for anything with an IP or address: a ping from the
  server, shown on the card (and faintly on the map).
- **Performance**: smooth on an ordinary laptop; the earlier mockups that
  redrew ~25 000 trees and their shadows every frame were too slow.

## Non-goals

- No "runs on" link between services and machines, and no roads joining them:
  services move between nodes; the owner said so explicitly. Placement is free.
- No metrics (CPU, memory, traffic) — a reachability check is enough.
- No editing of the land itself (no terraforming tools): one fixed island.
- No multi-user accounts or roles: one edit password for the house.

## Anti-goals (it fails even if it "works" if…)

- …any hue appears. **Grayscale only** (R = G = B) — land, trees, sea, marble,
  UI. Enforced by the existing palette test and viewport hue guard.
- …it looks like the first mockups ("low quality"): blocky terrain, cone trees,
  box temples. The quality bar is the approved mockups `mountain-aerial-v5` and
  `buildings-v4` (kept in the brainstorm session; their techniques are
  described below) — and higher.
- …it is slow or janky, or loads three.js / the map into the site's first-load
  chunk (≈ 75 kB gz today; must not grow).
- …the edit service can be used to write outside the catalogue, run commands,
  or probe arbitrary hosts.
- …it breaks the house's invariants: deterministic generation (same input →
  same output, seeded noise only), no third-party logo copying, no fake
  buttons, the "invisibility rule" for tooling files.

## Approved look

From the mockups the owner chose:

- **Land**: an island seen from above (map camera: pan by drag, zoom by
  scroll, tilt by right-drag, clamped so it never goes under the land or
  loses the island). Ridged, domain-warped terrain with a central massif and
  a summit plateau. **Engraved graphite stone**: dark grey, paler on high
  meadows, darker on cliffs, with engraved contour lines (minor every 4 units,
  a stronger one every 20) drawn in the shader with `fwidth` so they stay
  crisp at every zoom. A dark sea with engraved swell rings. Soft clouds
  drifting at the edges.
- **Vegetation**: forests by altitude and slope — rounded broadleaf trees
  low, layered pines higher, none on cliffs or the summit, in patches from
  noise. Dark greys.
- **Buildings**: white veined marble — a 3D-noise vein shader in each
  building's own space (no seams, no texture files), varying roughness. A
  second, different material for the land (the engraved graphite above).
- Low sun, long soft shadows.

## The building catalogue (50+ types)

Every type is a parametric generator that returns **one merged geometry** in
a shared marble material, built from shared parts (crepidoma steps, fluted
columns per order, entablature with triglyphs or a continuous frieze, gable
with tiles and acroteria, domes, arches, walls with crenellations).
Generators are deterministic and drawn once per type, then reused wherever
placed.

Families (the list is the minimum; the builder may add):

- **Temples**: Doric peripteral, Ionic peripteral, Corinthian peripteral,
  hexastyle prostyle, tetrastyle prostyle, amphiprostyle, temple in antis,
  double-in-antis, octastyle (Parthenon-scale), dipteral (double colonnade),
  temple on a podium, pseudoperipteral, round tholos (Doric), round monopteros
  (open, no cella), Erechtheion-like temple with a caryatid porch.
- **Sanctuary**: treasury, great altar (Pergamon-like with stairs), small
  altar, propylon (gate), propylaea with wings, oracle shrine/adyton, heroon,
  nymphaeum, sacred spring house, votive column, tripod monument.
- **Civic**: stoa, two-storey stoa, L-shaped stoa, bouleuterion, ekklesiasterion
  (stepped assembly), prytaneion, odeon, library, archive, mint, agora market
  hall, row of market stalls, fountain house, bathhouse.
- **Performance and sport**: theatre, small theatre, stadium (track and
  banks), hippodrome turn with spina, gymnasium court, palaestra, xystus
  (covered track).
- **Defence and works**: acropolis wall segment with gate, round tower,
  square tower, fortified gatehouse, lighthouse (pharos), aqueduct (two tiers),
  bridge, cistern, harbour mole, ship sheds, granary, workshop/forge,
  kiln, windmill-less mill house.
- **Monuments and homes**: column of honour with statue, statue on plinth,
  choragic monument (Lysicrates-like), mausoleum (Halicarnassus-like stepped
  pyramid), tumulus tomb, stelae row, exedra (curved bench), courtyard house,
  villa with peristyle garden, farmhouse.

Each type carries: `id`, name, family, footprint (for the terrace and
collision), and a **suggested use** (e.g. lighthouse → monitoring, treasury →
passwords, theatre → media). Suggestions only order the picker; **any type can
be used for anything**.

## Machines vs services

- A map item is either a **service** or a **machine**.
- **Services** use the sacred, civic, performance and monument families.
- **Machines** use a distinct family the builder designs for the purpose —
  "the house's works": forge/workshop, granary, tower, gatehouse, cistern,
  rack hall (a long hall whose facade reads as stacked units) — so a machine is
  recognisable at a glance. (Owner agreed to the principle: "an easy way to see
  which ones are services and which ones are computers".)
- The card, the key and the filter say which is which too.

## Data model

**Where edits live (owner: "what I add in the browser has to be kept in my
server").** The repository's `catalog/` stays the house's defaults, versioned
on GitHub. Everything saved from the browser goes to a **server data folder**
that git never sees — `OLYMPUS_DATA`, default `<repo>/data/` (git-ignored) —
so nothing about the owner's machines reaches the public repository, and the
automatic rebuild's `git pull --ff-only` keeps working (it never finds local
changes in tracked files).

- `data/services/<id>.json`, `data/machines/<id>.json`, `data/logos/<id>.svg`,
  and `data/places.json` (where each item stands on the map).
- The build reads the **merged catalogue**: repository `catalog/` overlaid by
  `data/` — a service file in `data/` replaces the repository's one with the
  same id (that is how a default service is edited from the browser), and a
  `data/removed.json` list hides defaults deleted from the browser. Every
  reader of the catalogue (CLI, build, autobuild fingerprints, installer,
  site index) goes through one loader that does this merge.
- The automatic rebuild watches `data/` as it watches `catalog/`. Moving a
  building only changes `places.json`, which must not trigger the slow
  per-service rebuilds (seals, ~74 s screens) — only the map's data.
- The data folder is part of what the owner backs up; the guide says so.

Services keep the existing shape (`ServiceSpec`, `validateSpec`). New:

- `ServiceSpec` gains optional `ip` (IPv4/IPv6 or hostname, validated) for the
  ping, and `place` (see below).
- **Machines**: `data/machines/<id>.json` (the repository may ship none) — `id`, `name`, `description?`,
  `ip?`, `hostname?`, `os?`, `role?`, `logo?`, `place`. Validated with the same
  rules as services (no control characters, length limits, safe charset).
  Machines are new to the house: in this project they appear only on the map
  (not in seals, kits or screens).
- `place`: `{ building: <type id>, x, z, rotation }` in map units, kept in
  `data/places.json` by id (not in the service files, so moving never
  rebuilds a service). Items
  without a `place` (e.g. the sixteen existing services, or services added by
  CLI) are **placed automatically** by a deterministic rule (spread on free
  terraces, seeded by id) and shown that way until the owner moves them —
  so the map is never missing anything.
- The island's terrain is generated **at build time** (deterministic seed)
  and shipped as a compact heightmap (e.g. 16-bit PNG or binary) alongside the
  map's static data — not computed in the browser.

## Saving: the edit service

The site is static today; saving needs a server side. A small **edit service**
(Node, built-ins only, like `scripts/autobuild.ts`), run beside the site:

- `POST/PUT/DELETE` for services and machines, and `PUT` for places; it
  validates exactly as the CLI does, writes into the data folder atomically
  (never anywhere else), and returns the result. Logos uploaded as SVG are
  sanitised by the existing logo importer rules and stored as
  `data/logos/<id>.svg`.
- Reads (`GET`) return the live merged catalogue and places, so the map shows
  a change at once; the rebuilt seals and kits follow when the build ends.
- Renames go through the existing rename path (the autobuild already handles
  changed ids and removes old outputs).
- The **automatic rebuild already watches `catalog/`**, so the site, seals,
  kits, screens and installer follow within seconds of a save. The map page
  shows the build status (the existing `build.json`) so the owner sees when a
  change is live.
- **Ping**: `GET /api/status` returns online/offline for the addresses **on the
  map only** (never an arbitrary host), checked by ICMP ping (or a TCP connect
  where ICMP is not allowed), cached for a few seconds, rate-limited.
- **Password**: one password, set on the server (hashed, in a config file or
  environment), exchanged for a session cookie (HttpOnly, SameSite=Strict);
  every write requires it and a CSRF token; failed logins are slowed. View
  mode and the status endpoint need no password.
- **Reach (owner):** the site is used through the owner's reverse proxy over
  HTTPS, and only the owner can reach the server. So view mode (including IPs
  and status) needs no password; the password guards writes. Cookies are
  `Secure` when the request came over HTTPS (`X-Forwarded-Proto` from the
  trusted proxy), so a direct `http://server:8080` still works on the LAN.
  The ping runs from the host's network (the edit service must reach the
  LAN and VPN subnets and the host's DNS — in Docker, host networking or the
  equivalent).
- Served under the same origin (nginx proxies `/api/` to it), so the site's
  CSP (`connect-src 'self'`) holds. Deployment: added to
  `deploy/docker-compose.auto.yml` and to the systemd instructions in
  `docs/07-self-hosting.md`; the plain static deployment keeps working
  read-only (the map shows, edit mode explains that saving needs the edit
  service).

## The page

- **View**: full-window map; header stays. Hover a building → its name.
  Click → **card** (side panel, phone: bottom sheet): name, logo/seal,
  service or machine, description, address with *Open* (services), IP /
  hostname / OS / role (machines), online/offline dot with last check time.
  Key + filter (all / services / machines). Keyboard: a list of all items
  (accessible alternative to the 3D view) that focuses and opens each card.
- **Edit** (after password): *Add* opens the building catalogue (searchable,
  grouped by family, small 3D/rendered thumbnails, suggested uses); choose a
  type, then click on the land to place it (a ghost follows the pointer;
  invalid spots — sea, cliffs, overlapping another — are refused); then the
  card opens as a form. Existing items: drag to move, handle to rotate, swap
  the building, edit fields, delete (with confirmation). Undo for the session.
- Terraces: the land is levelled under each placed building at render time
  (smooth blend), as in the mockups.
- First visit: the clouds part over the island (Primland), once; none of it
  under reduced motion.

## Scale

About 35 items at first (owner), growing over time: design and budget for
**150 items**, most of them different building types — so the per-type
triangle budget and a level of detail for buildings (not only trees) matter,
the island has room for 150 terraces with free space between them, and the
keyboard list has search and grouping (services / machines).

## Performance

- The map and three.js load only on `#/map` (own lazy chunk); nothing in the
  first-load chunk.
- Render **on demand**: draw only while the camera or a building moves, or a
  cloud drifts on screen (clouds stop when the tab is hidden / reduced motion).
- Buildings: one merged geometry per type, **instanced** for repeats; one
  marble material, one land material.
- Trees: instanced; **level of detail** — full models near the camera,
  low-poly or billboard impostors far away; total triangle budget set and
  measured.
- Shadows cast once (and again only after a building is placed or moved);
  shadow map size chosen for the budget.
- Terrain mesh from the prebuilt heightmap; pixel ratio capped (≈1.5).
- Phones / no WebGL / saveData: a still, top-down render of the map
  (made at build time) with the item list and cards — like the home hero.
- Target: 60 fps panning on an integrated-GPU laptop at 1440p; first draw
  under ~2 s after the chunk loads on the local network. Measured in the
  checks.

## Accessibility and the house's rules

- One h1, landmarks, the item list as the keyboard/screen-reader path, 44 px
  tap targets on phones, axe clean, no hue (viewport-check), reduced motion
  respected, dark/light tokens for the UI around the map (the map itself is
  "stone": fixed greys).
- Cinzel for names and titles, Jost sentence case for the rest.

## Testing

- Unit: every building generator is deterministic, produces a valid,
  non-degenerate merged geometry within its footprint; the catalogue has 50+
  unique types with families and suggestions; auto-placement is deterministic
  and collision-free; heightmap generation is deterministic.
- Edit service: validation parity with the CLI, atomic writes, rename,
  delete, logo sanitising, auth (no password → 401, bad CSRF → 403, slowed
  logins), path traversal refused, ping only for mapped addresses.
- Browser (app:check): the map loads, renders, places a building in edit mode
  against a stand-in edit service, the card shows the saved fields and a
  status; reduced motion; the list path works by keyboard. viewport-check
  adds `#/map`.
- Performance check: frame time and triangle/draw-call budget asserted in
  headless Chrome (SwiftShader numbers as a regression guard, not absolute).

## Decided by the owner

- Browser edits are kept on the server only (not in git, not on GitHub).
- Reached through the owner's reverse proxy; only the owner can reach it.
- About 35 items now, growing; hence the large building catalogue.
- Saved on the server, behind a password; edited in the browser.
- 3D island of Olympus seen from above, Primland-like; engraved-contour
  graphite land; marble buildings; grayscale only.
- More than 50 building types, Greek, detailed.
- Card on click: name, address, logo, IP, …; online/offline by ping.
- Free placement; no links or roads between services and machines; services
  do not record which machine runs them.
- Services and machines visibly distinct.

## Left to the builder

- Exact generators and proportions of each building type; the machines'
  family design.
- Auto-placement rule, terrace blending, the map's bounds and camera limits.
- Heightmap format and resolution; tree LOD scheme and counts within budget.
- Exact layout of the data folder files, within the rules above.
- Edit service internals (routing, storage of the password hash, session
  length), within the security requirements above.
- Card layout details, within the site's visual system.
