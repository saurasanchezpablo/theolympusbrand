# 10 — Handoff and validation

Where everything is, how to run and extend it, how it is checked, and what is
still unproven or undecided. State as of 20 October 2026.

## What there is

| Part | Where | Rebuilt by |
|---|---|---|
| **The master identity** — crest (fine and print editions), emblem, seal, lockups, favicons, web icons | `assets/master/` | `npm run build:master` |
| **The catalogue** — 16 services, each a god or a monogram, every file a service needs | `catalog/services/` → `assets/services/` | `npm run service -- build` |
| **The guide** — design system, catalogue, the Atelier, printing, stickers, self-hosting, integrations, screens | `docs/` | by hand; boards: `npm run build:docs` |
| **The brand book** — 12 A4 pages | `docs/the-olympus-brand-book.pdf` | `npm run brandbook` |
| **The website** — home, the Atelier, catalogue, guide, downloads | `app/`, `deploy/` | `npm run site` |
| **3D models** — medallion, engraved, two-colour, coaster, nameplate, rack panel, lithophane, token, wax-seal stamp, desk stand | `manufacturing/3d/master/` | `npm run model -- master` |
| **Stickers** — six colourways, sheets | `manufacturing/stickers/` | `npm run sticker -- master`, `-- sheet` |
| **Integrations** — Homepage, Dashy, Homer, bookmarks; Nextcloud, Jellyfin, Proxmox VE, Grafana, Uptime Kuma | `assets/integrations/` | `npm run integrations` |
| **Screens** — 20 wallpapers, GRUB, Plymouth, message of the day, console login, SSH banner | `assets/screens/` | `npm run screens` |

`npm run build` rebuilds everything kept in the repository except the models
and stickers. Every file is generated from the code in `src/`: the same
input gives the same bytes, on any machine and in any time zone.

## Running it on the server

[The site on your server](07-self-hosting.md) has the details. In short:

```sh
git clone <the repository> && cd theolympusbrand
docker compose -f deploy/docker-compose.yml up -d --build   # → port 8080
npm run app:check -- --url http://<server>:8080             # optional: drive it in Chrome
```

To update: `git pull`, then the same `docker compose … up -d --build`.

## Everyday tasks

**A new service.** In the Atelier: *New design*, name, category, address,
*Save*; then *Asset pack* and unzip it at the repository's root. Or from the
command line:

```sh
npm run service -- add --name "Vaultwarden" --category security --url https://vaultwarden.theolympus.cloud
npm run build                                   # its files, the catalogue, dashboards and themes
npm run model -- vaultwarden                    # its printable models, when wanted
npm run screens -- vaultwarden                  # its wallpapers and terminal crest, when wanted
```

**Change a service** — edit `catalog/services/<id>.json` (or open it in the
Atelier and export), then `npm run build`.

**Check before committing** — `npm test` (about a minute) and
`npm run typecheck`. Every push runs the full checks on GitHub (below).

**After a deliberate change to the master's geometry** — the test suite
holds fingerprints of every mark, so it fails on purpose. Look at the new
marks first, then accept them with `npm run test:update-golden`. Never run it
to silence a failure you do not understand.

## How it is checked

| Check | What it proves | Run |
|---|---|---|
| **Test suite** — 95 tests | Geometry is deterministic and matches its fingerprints; the silhouette stays inside the rim; the border is drawn as specified; every colour is a neutral gray; print editions hold at a 0.4 mm nozzle; every model of every product for every patron is a closed, manifold solid of the designed volume; QR codes decode (from labels and from printed layers); dashboards parse and list every service; install scripts work against stand-in systems and restore what they change; share links refuse damaged or oversized input. | `npm test` |
| **Browser checks** — 21 workflows | The website, driven in Chrome: every page, the Atelier's editing, saving, history, undo, share links, exports, models, stickers and wallpapers. Files made in the browser are byte-identical to the command line's (SVG, STL, sticker PDF, catalogue entry). No console errors. | `npm run app:check` |
| **GitHub, every push** | The two above; every generated file rebuilt from scratch and compared with the committed one; the server image built and served. | `.github/workflows/checks.yml` |
| **Independent tools** (20 October 2026) | OrcaSlicer reads the medallion, rack panel and both parts of the stamp as manifold, with the same volumes. Ghostscript separates a clear-vinyl sticker into its CutContour and White plates; poppler reads the brand book (12 pages, A4). jsQR decodes every code (in the tests). | by hand |

## Not yet proven

These were built carefully but could not be tried here. Each is said where
it is documented too.

- **Physical prints.** No model has been printed yet. The print checks assume
  0.5 mm is the finest feature a 0.4 mm nozzle draws reliably; the first
  prints will tell whether that holds on your printer. The rack panel's hole
  spacing (236.5 mm) is a common figure for 10-inch racks, not a standard:
  measure yours. PLA softens near sealing-wax temperatures: chill the stamp.
- **OpenSCAD sources** are generated but have never been rendered (OpenSCAD
  is not installed here). The STL and 3MF files are the validated ones.
- **Theme kits and install scripts** have been run only against stand-in
  systems, never against live Nextcloud, Jellyfin, Proxmox VE, Grafana,
  Uptime Kuma, GRUB, Plymouth or sshd. Each keeps a copy of what it changes
  and has a way back; try each on one machine first.
- **The Plymouth theme** has not been seen booting.
- **Stickers** have not been ordered: bleed, cut and minimum line differ
  between providers — confirm with yours.
- **The deployed site** has been built and served in CI, not yet on the
  server.

## Decisions still open

- **Service names.** The catalogue uses generic names — *Network*,
  *Storage*, *Backup*, *Monitoring* … Renaming them to the software actually
  running (a DNS server, a NAS system, a monitoring stack) makes the
  dashboards and nameplates more useful; `npm run build` carries a rename
  everywhere.
- **Where the website lives** — once it has an address (for example
  `brand.theolympus.cloud`), the dashboards can load their icons from it:
  `npm run integrations -- --icons-url https://…/files/assets/integrations/icons/ --out …`.
- **The repository's visibility.** The licence reserves every right, but a
  public GitHub repository can still be viewed and forked under GitHub's
  terms. Making it private is the only way to keep the files unseen.
- **OpenSCAD** — installing it would let the `.scad` sources be checked too.

## Map

```
src/            everything that draws: geometry, catalogue, render, print checks,
                manufacturing (3D, stickers), integrations, screens, exporters
scripts/        the command lines (build-master, service, model, sticker,
                integrations, screens, brandbook, app-check)
app/            the website and the Atelier (React, Vite)
catalog/        the services, one JSON file each, and their logos
assets/         generated: master, services, integrations, screens
manufacturing/  generated: 3D models and stickers
docs/           this guide and the brand book
tests/          the test suite
deploy/         Dockerfile, nginx configuration, compose file
```
