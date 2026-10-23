# 13 — The map

The map is the house seen from above: an island in a dark sea, Mount Olympus
rising on its north side in engraved graphite stone, and under it a city
laid out as the ancient planned cities were. Every service and every machine
is a marble building in its own walled precinct in that city. Open it from
the site's header (**Map**).

## The city

- **Streets of three ranks.** The *sacred way* runs north from the harbour
  through the agora to the sanctuary, and the *main street* crosses it at the
  agora; both are paved in great pale slabs. Streets come every few blocks,
  and lanes of small dark setts run between them. Every street has a raised
  walkway on each side, and stepping stones cross the roadway at the corners.
- **Blocks on terraces.** The town steps up the hill block by block. Where a
  terrace meets a street at a different height, its retaining wall shows.
- **Places.** The *agora*, where the avenues cross, is the city's market
  square: stoas, stalls, statues, a fountain and benches. The *sanctuary*,
  at the top of the sacred way under the mountain, holds five precincts for
  temples round a court lined with cypresses. A *grove* of olive trees has a
  fountain at its heart, two *sports grounds* have a running track and banks
  for onlookers, and the *works quarter* lies by the harbour.
- **The wall.** A wall with towers surrounds the town. Gates open where the
  avenues leave it, and roads run on from them to the sea. The south road
  ends at the harbour's mole and its lighthouse. Olive groves ring the town
  outside the wall, and forest covers the mountain.
- **Houses.** Every plot no service or machine takes is filled by the city's
  own houses: two courtyard houses to a quarter block, here and there a
  two-storey house, a house round a peristyle, a garden, an orchard,
  workshops in the works quarter. A building that leaves a plot gives it
  back to the houses.
- **People.** People walk the walkways, keeping to their side, and cross at
  the stepping stones, waiting when two are already crossing. Each has
  somewhere to go: on errands from one building's door to another's, to see
  a temple or the sanctuary, to stroll in the grove or across the agora, or
  to stand about a square; some walk in pairs or threes. They slow behind
  someone slower, keep right when someone comes the other way, step round
  people standing, and go round the fountains. There are about four to a
  block of the town. They are drawn only when the view is close enough to
  see them, and stop three minutes after you last touch the map. With
  reduced motion they stand still.
- **Trees in the breeze.** While the people move, the trees' crowns sway a
  little.

**The town grows with its buildings.** A map with a few buildings has a
compact town round the agora and up the sacred way; as buildings are added,
the town takes more blocks — always the next ones in a fixed order, filling
out round what is there — and its wall, gates and roads move outward with
it; the grove and the sports grounds join when the town reaches them. A
building never moves because the town grew: every plot keeps its place and
its name, and a block with a building on it is never taken away. Removing
buildings lets the town shrink back from its outer, empty blocks. The town
can grow to about a hundred and fifty buildings, the island's gentle land.

The city is the same for the same buildings: it is planned when the map is
built (`assets/map/city.json`, beside the island's `assets/map/terrain.bin`)
and again on the server whenever its buildings change.

## Looking around

The first time in a visit, the map opens above the clouds: **Explore the
map** parts them and brings the island into view; **All places** goes
straight to the list of every place. Then drag (or swipe) to move, scroll
(or pinch) to come down closer, right-drag (or two fingers) to tilt; the
map shows each gesture once.

Every building carries a mark: a **round** one for a service, a **square**
one for a machine. Hover or focus a
mark to see its name; click it (or press Enter) to travel there. The camera
comes down to the building and a panel opens beside it — at the bottom on a
phone — with:

- the building on its own, its name and a line about it;
- for a service, its address, with **Open** and **Copy the address**;
- for a machine, its address on the network, its host name, its system and its role;
- **Previous** and **Next** to go from place to place, and **The island**
  (or ×, Escape, or the house button in the bar) to come back up.

The bar at the bottom names where you are. Its selector opens the
**directory**: every place, by kind, with a search box and a filter for
services or machines — the way to every place from the keyboard or a screen
reader. The compass in the corner turns with the view; click it to face
north.

The address follows: `#/map` is the island, `#/map/<id>` a place — the
browser's back button returns, and a link to a place opens it directly.

On a slow connection (saving data) or in a browser without WebGL, the map
is a picture of the island from straight above. **Turn it in 3D** brings the
island when you want it.

## Changing it

**Edit** asks for the house's password (set on the server, see
[the site on your server](07-self-hosting.md)). Then:

- **Add** opens the catalogue of buildings — more than fifty for services
  (temples of the three orders, round temples, treasuries, altars, gates,
  colonnades, council and assembly halls, libraries, markets, baths, theatres,
  a stadium, towers, a lighthouse, an aqueduct, monuments, houses) and eleven
  for machines. The ones that suit what you are adding come first; any
  building can stand for anything. Choose one, then click a plot to set it
  down. It stands on the smallest plot under the pointer that takes it (a
  quarter of a block, a half, a whole block, a precinct of the sanctuary, a
  sports ground for a stadium), centred and facing that plot's street. Where
  it cannot stand, the map says why: not on a plot (a street, the sea,
  outside the town), another building there, or too big for this plot.
- A form opens: the name, the address, a logo (an SVG file), what kind of
  service it is; for a machine, its network address, host name, system and
  role. **Save**.
- A service's building: **Link a design** gives it one of the designs saved
  in this browser's [Atelier](04-generator.md). The design's name, patron
  (god or monogram), logo and caption become the service's — on the map and
  in everything the house makes for it (its seal, dashboard icons, theme
  kit, screens), rebuilt and published as any other change. The building
  keeps its place and its id; an address or a line about it that the design
  does not have is kept. The panel then names the design and its version.
  Designs live in the browser that made them, so a design changed later in
  the Atelier does not reach the map by itself: the panel says when this
  browser has a newer version, and **Update from the design** applies it.
  A design linked from another browser is shown as such.
- A building on the map: drag it to another plot, turn it a quarter at a time
  (towards a side street when it fits that way), give it another building,
  change its details, or **Delete** it — from its panel.
- **Undo** (Ctrl+Z) takes back the last change.

Each change is saved on the server at once, and the map shows it. The rest
of the site follows when the server has rebuilt and published it: moving a
building rebuilds the map's list and picture (a few seconds); a new service,
or a change to a service's name or logo, rebuilds the rest of the house for
it too — its seal, its dashboard entries, its theme kit, its boot screens —
within a minute or two. The map says which it is: *saved on the server,
publishing…*, then *saved and published* — or, when a build fails, that the
change is saved but the published site is unchanged, and why. Several
changes in a row are built together.

Editing needs the house's own server (`npm start`, or the Docker image —
see [the site on your server](07-self-hosting.md)): it serves the site and
answers the map's edit API under `/api/` on the same address, so there is
nothing else to run or route.

## Where it is kept

What you change on the map is kept in the server's **data folder** —
`data/` in the repository there, or the folder `OLYMPUS_DATA` names:

| | |
|---|---|
| `services/<id>.json` | a service added on the map, or one of the house's changed |
| `machines/<id>.json` | the machines |
| `logos/<id>.svg` | their logos |
| `places.json` | where each building stands, which building, how it is turned |
| `removed.json` | the house's services taken off the map |
| `editor.json` | the password, as a hash |

git never sees this folder: nothing about your machines reaches the
repository, and the server keeps pulling the house's updates. Only the
server's own tools read it — the house's server (`npm start`), which sets
`OLYMPUS_DATA` for itself. A build run by hand on the server
should name it too (`OLYMPUS_DATA=data npm run build`); a working copy that
does not builds the house's catalogue alone, so nothing from a data folder
can be committed by mistake. **Back it up**
with the rest of the server's data. A service you add with
`npm run service -- add` (into `catalog/`) appears on the map too: the map
finds it a plot the first time it is shown, and keeps it there until you
move it, so adding a service never moves the others. Temples and shrines go
to the sanctuary first, machines to the works quarter, and everything else
to the plots nearest the agora. The city has room for about a hundred and
fifty buildings. If it is full, the map says which buildings it could not
place. A place saved before the city existed keeps its building on the
nearest free plot that takes it.

## When something is wrong

| What you see | What to do |
|---|---|
| **Edit** says saving needs the house's own server | This copy of the site is served by another web server: see [the site on your server](07-self-hosting.md) |
| The password is refused | Set it again on the server: `npm run editor -- password` |
| A building is not where you left it | Its building type no longer exists: it stands where it was, as the default building |
| A new service has no seal yet | The rebuild is still running, or failed: the map's notice and the Downloads page say which |
