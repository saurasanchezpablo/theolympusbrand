# 13 — The map

The map is the house seen from above: Mount Olympus rising from a dark sea,
in engraved graphite stone, its forests and contours, and on its slopes a
marble building for every service and every machine. Open it from the site's
header (**Map**).

## Looking around

Drag to move across the island, scroll (or pinch) to come down closer,
right-drag (or two fingers) to tilt. Hover a building to see its name; click
it to open its card:

- its name, its seal or its own logo, what it is, and a line about it;
- for a service, its address, with **Open**;
- for a machine, its address on the network, its host name, its system and its role;
- whether it answers: a dot that says **Online** or **Offline**, and when it was last checked.

**Services** stand in temples, gates, halls, theatres, towers and monuments;
**machines** in the house's works — rack halls, forges, workshops, granaries,
watch towers. The key in the corner says which is which, and the filter shows
only one or the other. **List** opens every building as a list, with a search
box — the way to the cards from the keyboard or a screen reader.

On a phone, on a slow connection, or in a browser without WebGL, the map is a
picture of the island from straight above, with the same list and cards.
**Turn it in 3D** brings the island when you want it.

## Changing it

**Edit** asks for the house's password (set on the server, see
[the site on your server](07-self-hosting.md#the-maps-edit-service)). Then:

- **Add** opens the catalogue of buildings — more than fifty for services
  (temples of the three orders, round temples, treasuries, altars, gates,
  colonnades, council and assembly halls, libraries, markets, baths, theatres,
  a stadium, towers, a lighthouse, an aqueduct, monuments, houses) and eleven
  for machines. The ones that suit what you are adding come first; any
  building can stand for anything. Choose one, then click on the island to
  set it down: where it cannot stand — in the sea, on a cliff, too close to
  another building, off the island — the map says why. A terrace is levelled
  under it.
- Its card opens as a form: the name, the address, the network address, a
  logo (an SVG file), what kind of service it is; for a machine, its host
  name, system and role. **Save**.
- A building on the map: drag it to move it, turn it with the handle, give it
  another building, change its card, or **Delete** it.
- **Undo** (Ctrl+Z) takes back the last change.

Each change is saved on the server at once. A new service, or a change to a
service's name or logo, rebuilds the rest of the house for it — its seal, its
dashboard entries, its theme kit, its boot screens — within a minute or two;
the map says when the rebuild is done. Moving a building rebuilds only the map.

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
server's own tools read it — the edit service and the automatic rebuild,
which set `OLYMPUS_DATA` for themselves. A build run by hand on the server
should name it too (`OLYMPUS_DATA=data npm run build`); a working copy that
does not builds the house's catalogue alone, so nothing from a data folder
can be committed by mistake. **Back it up**
with the rest of the server's data. A service you add with
`npm run service -- add` (into `catalog/`) appears on the map too: the map
finds it a spot the first time it is shown and keeps it there until you move
it, so adding a service never moves the others. If the island has no room
left, the map says which buildings it could not place.

## Online and offline

The server pings each address on the map (a service's network address, or
the host of its web address; a machine's address or host name) when a card
is open, and every quarter of a minute at most. It never pings anything that
is not on the map. A machine that does not answer pings shows **Offline**
even when it is up.

## When something is wrong

| What you see | What to do |
|---|---|
| **Edit** says saving needs the edit service | The site is served without it: see [the site on your server](07-self-hosting.md#the-maps-edit-service) |
| The password is refused | Set it again on the server: `npm run editor -- password` |
| A building is not where you left it | Its building type no longer exists: it stands where it was, as the default building |
| A new service has no seal yet | The rebuild is still running, or failed: the Downloads page says which |
