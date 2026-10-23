# 07 — The site on your server

Everything in this repository is available through one website: the
**Atelier** (make and export designs, stickers and printable models), the
**Catalogue**, this **Guide**, and **Downloads** of every file the house has
made. The site itself is static — no database, no account — and it makes no
requests outside your server: fonts, scripts and files are all served from
the same place. One small Node service serves it, keeps it built, and lets
the map be edited from the browser. That makes it a good fit for a home
network.

## Build it

```sh
npm install
npm run site          # → app/dist/
```

`app/dist/` is the whole site: the page, its scripts, and a `files/` folder
with the published parts of the repository (`assets/`, `docs/`, `catalog/`,
the master's printable models and stickers) and an index of them. Any static
web server can serve it.

## The house's server: one service, one port

`npm start` (`scripts/serve.ts`) is the whole house on a server, in one Node
process on one port (8080):

- it **serves the site** — each text file as the brotli or gzip copy made at
  build time, the built scripts cached for good, the brand's files checked
  back on each visit, the correct types for STL, 3MF, PDF and web manifests,
  a strict Content-Security-Policy, ranges for the large downloads;
- it **answers the map's edit API** under `/api/`, on the same origin (no
  second process, no proxy) — see [the map](13-the-map.md);
- it **keeps the site built**: every change saved on the map, every change
  to `catalog/` or the data folder, every commit pulled, is rebuilt — only
  what it touches — into a new release, which replaces the served one in a
  single step once it is complete. `/build.json` says what it is doing.

```sh
npm ci
npm run editor -- password      # once: the password for editing the map
npm start                       # → http://127.0.0.1:8080 (HOST=0.0.0.0 for the network)
```

The first start builds everything (a few minutes the very first time; the
build cache in `.cache/` makes every later one incremental). Its settings,
all optional:

| Variable | What | Default |
|---|---|---|
| `PORT`, `HOST` | Where it listens | `8080`, `127.0.0.1` |
| `OLYMPUS_DATA` | The server's own data: what the map adds, the password | `data/` in the repository |
| `OLYMPUS_OUT` | The published releases (`releases/`, `current`) | `site-releases/` in the repository |
| `OLYMPUS_CACHE` | What the build keeps between runs | `.cache/` in the repository |
| `OLYMPUS_GIT_INTERVAL` | Minutes between pulls from the remote; 0: never | `0` |
| `OLYMPUS_GIT_REMOTE`, `OLYMPUS_GIT_BRANCH` | What it pulls | `origin`, the current branch |
| `OLYMPUS_POLL` | Seconds between looks at `catalog/` and the data folder | `10` |
| `OLYMPUS_KEEP` | Releases kept, the served one included | `2` |
| `OLYMPUS_SITE` | Serve this built folder as it is, never rebuilt (the checks use it) | — |

It rebuilds only what changed:

| What changed | What is rebuilt |
|---|---|
| A building moved on the map | The map's list and picture; the site's files that changed |
| A service added or changed | That service's files and screens, the catalogue's index, boards and tables, the dashboards and theme kits, the installer, the map |
| A service removed | Its files go; the index, dashboards, theme kits, installer and map are rebuilt without it |
| Documents or committed files (a pull) | The site's files that changed |
| The code | Each step whose code changed, and what depends on it |
| The dependencies | `npm ci` first, then everything |

**A save is not a publication.** A change saved on the map is on the server
at once (the map shows it); the site's files show it when a build that
includes it is published. The page says which: "saved on the server,
publishing…", then "saved and published" — or, if the build failed, that
the change is saved but the published site is unchanged, and why. A failed
build never replaces the served release; the release before it is kept.
Changes made while a build runs are built after it, together.

Pulling never discards anything: if a file changed on the server would be
overwritten by the pull, git refuses, `/build.json` says so, and nothing
changes until you resolve it. Generated files the pull also changes are put
back first (they are made again).

With systemd:

```ini
# /etc/systemd/system/the-olympus.service
[Unit]
Description=The Olympus
After=network-online.target

[Service]
User=olympus
WorkingDirectory=/srv/theolympusbrand
Environment=HOST=0.0.0.0 OLYMPUS_DATA=/srv/olympus-data OLYMPUS_OUT=/srv/olympus-site
ExecStart=/usr/bin/env node scripts/serve.ts
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```sh
cd /srv/theolympusbrand && sudo -u olympus env OLYMPUS_DATA=/srv/olympus-data npm run editor -- password
sudo systemctl enable --now the-olympus
```

## Run it with Docker

The image is the same service: the repository, its dependencies and a warm
build cache, running `scripts/serve.ts` as an unprivileged user.

```sh
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml exec olympus node scripts/editor.ts password
```

The site is then on port **8080** of the server. Two volumes keep its state:
`data` (what the map adds, the password — back it up) and `site` (the
published releases, rebuilt from the image and the data if lost). A new
container — after `docker compose up --build`, say — serves the release in
the volume at once and rebuilds it for the new image. The container drops
every capability and cannot gain new ones.

`password --stdin` takes the password from the first line piped in, for a
secrets file or a setup script.

### Following the repository

`deploy/docker-compose.auto.yml` runs the same service on a git clone on the
server instead of the image's copy:

```sh
cd deploy && docker compose -f docker-compose.auto.yml up -d --build
```

It watches the clone's `catalog/` and `data/` — add a service there (by
hand, with `npm run service -- add`, or from an Atelier asset pack's
`catalog/` folder), change one or remove it, and the site follows within
seconds — and pulls every `OLYMPUS_GIT_INTERVAL` minutes (10 here). It runs
as uid 1000; the clone must be writable by it
(`sudo chown -R 1000:1000 theolympusbrand`), or set `user:` to your own.

## On another web server

`npm run site` makes `app/dist/`, the whole site as static files; copy it to
any static host (Caddy, Apache, nginx, a NAS's web station). The site uses
relative paths and `#/` routes, so it works from a sub-path
(`http://server/olympus/`) and needs no rewrite rules. Send the same headers
as the house's server (`scripts/lib/static.ts`: the content policy, no
sniffing, no referrer) if you can.

There the map is shown read-only: editing it needs the house's server, which
answers `/api/` itself. `npm run autobuild` (`OLYMPUS_OUT=/srv/olympus npm
run autobuild`) keeps releases built for another web server to serve from
`/srv/olympus/current`, with the status in `current/build.json`.

## A name on the network

The house's domain is **theolympus.cloud**. On a home network, a name such as
`atelier.theolympus.cloud` can point at the server through your local DNS
(the router, Pi-hole, AdGuard Home…) and your reverse proxy can route it to
port 8080, adding HTTPS if it already manages certificates for the domain.
Nothing in the site depends on its address.

**Use HTTPS.** The install commands on the Downloads page fetch scripts that
run as root; over plain HTTP, anyone who can tamper with the network on the
way could change them. Behind a reverse proxy with a certificate (Caddy,
Traefik, Nginx Proxy Manager…) they cannot — see [Security](11-security.md).

## What stays in the browser

Designs you save in the Atelier live in that browser's storage, on that
device (see [the Atelier](04-generator.md)). The server only serves files:
it never receives your designs. Use **Export library** to move them, or add
them to the repository's `catalog/` (the Atelier's asset pack includes the
catalogue file) and rebuild the site to make them part of the house.

## Checking a deployed copy

The browser check that guards the site can run against any address:

```sh
npm run app:check -- --url http://server:8080
```

It walks through the Atelier, stickers, printable models, the catalogue, the
guide and the downloads, and compares files made by the site with files made
by the command line.

The same check of every page at phone, tablet, laptop and desktop sizes —
nothing scrolling sideways, nothing cut off, no errors, and an
accessibility audit with axe-core — runs the same way:

```sh
npm run app:viewports -- --url http://server:8080
```

## What a visitor's browser loads

The home page loads only the page itself (about 75 kB of script, compressed)
and a still of the master medallion. On a screen 720 px wide or more, and
unless the browser asks to save data, it then brings the medallion to life in
WebGL from its STL (about 340 kB compressed, plus the 3D library, about
130 kB); on a phone, the still stays until the visitor taps **Turn it in 3D**.
Visitors who ask their system for reduced motion get the medallion lit but
still. Where WebGL is missing, the still stays.

The Atelier and the catalogue load when first opened, with the brand fonts
they draw lettering with; the guide and the downloads load on their own.
