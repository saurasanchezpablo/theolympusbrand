# 07 — The site on your server

Everything in this repository is available through one website: the
**Atelier** (make and export designs, stickers and printable models), the
**Catalogue**, this **Guide**, and **Downloads** of every file the house has
made. It is a static site — no database, no server code, no account — and it
makes no requests outside your server: fonts, scripts and files are all served
from the same place. That makes it a good fit for a home network.

## Build it

```sh
npm install
npm run site          # → app/dist/
```

`app/dist/` is the whole site: the page, its scripts, and a `files/` folder
with the published parts of the repository (`assets/`, `docs/`, `catalog/`,
the master's printable models and stickers) and an index of them. Any static
web server can serve it.

## Run it with Docker

The repository includes a two-stage image: Node builds the site, nginx serves
it.

```sh
docker compose -f deploy/docker-compose.yml up -d --build
```

The site is then on port **8080** of the server. The container runs
read-only, restarts with the server, and serves:

- the correct types for the brand's files (STL, 3MF, PDF, web manifests),
- compressed text, SVG and meshes,
- long-lived caching for the built scripts; the brand's files are checked
  with the server on each visit, so a rebuilt site shows at once,
- a strict Content-Security-Policy: the page may only load from its own
  server.

To build and run without compose:

```sh
docker build -f deploy/Dockerfile -t theolympus-site .
docker run -d -p 8080:80 --restart unless-stopped --name olympus theolympus-site
```

Rebuild the image after changing the repository (a new service, new models):
the site is a snapshot of it — or let the server do it, as below.

## Rebuilt automatically

`deploy/docker-compose.auto.yml` runs the site from the repository on the
server (a git clone) and keeps it up to date by itself:

```sh
cd deploy && docker compose -f docker-compose.auto.yml up -d --build
```

Two containers share the built site: a **builder** and the web server. The
builder watches `catalog/` — add a service there (by hand, with
`npm run service -- add`, or by dropping in the files of an Atelier asset
pack's `catalog/` folder), change one or remove it, and the site follows
within seconds. It also pulls from GitHub every `OLYMPUS_GIT_INTERVAL`
minutes (10 by default; 0 turns it off), so work pushed from another machine
arrives on its own.

It rebuilds only what changed:

| What changed | What is rebuilt |
|---|---|
| A service added or changed | That service's files, the catalogue's index, boards and tables, the dashboards and theme kits, the site |
| A service removed | Its files go; the index, dashboards, theme kits and site are rebuilt without it |
| Documents or committed files (a pull) | The site |
| The code or the dependencies | Everything (`npm ci` first if the dependencies changed) |

Each build becomes a new release, and the web server switches to it in one
step, so visitors never see half a build; the previous release is kept. If a
build fails — a service file with a mistake, say — the site stays as it was.
The Downloads page says when the site was last rebuilt, or that the last
attempt failed and why; the builder's log has the detail
(`docker logs olympus-builder`).

Pulling never discards anything: if a file changed on the server would be
overwritten by the pull, git refuses, the page says so, and nothing changes
until you resolve it (commit or move your change). New files — a service
added on the server — do not get in the way.

The first start installs the dependencies and builds everything, which takes
a few minutes. The builder runs as uid 1000; the clone must be writable by
it (`sudo chown -R 1000:1000 theolympusbrand`), or set `user:` in the compose
file to your own and make the volumes yours.

Without Docker, the same builder runs on its own:

```sh
OLYMPUS_OUT=/srv/olympus OLYMPUS_GIT_INTERVAL=10 npm run autobuild
```

and any web server can serve `/srv/olympus/current` (it follows the switch to
each new release). `npm run autobuild -- --once` does a single pass.

## The map's edit service

The map (*#/map*) can be changed from the browser — a building added, moved,
renamed, given an address — and the changes are saved on the server. That
needs one small process beside the site: the **edit service**. It writes only
into the server's data folder (`data/` in the repository, or
`OLYMPUS_DATA`), which git never sees; the automatic rebuild watches that
folder as it watches `catalog/`, so the rest of the house follows. See
[the map](13-the-map.md).

With Docker, `docker-compose.auto.yml` already runs it (the `editor`
container). Set its password once:

```sh
docker compose -f docker-compose.auto.yml run --rm -it editor node scripts/editor.ts password
```

Without Docker, run it with systemd beside the builder:

```ini
# /etc/systemd/system/the-olympus-editor.service
[Unit]
Description=The Olympus — the map's edit service
After=network-online.target

[Service]
User=olympus
WorkingDirectory=/srv/theolympusbrand
Environment=OLYMPUS_DATA=/srv/theolympusbrand/data
ExecStart=/usr/bin/env node scripts/editor.ts serve
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```sh
cd /srv/theolympusbrand && sudo -u olympus npm run editor -- password
sudo systemctl enable --now the-olympus-editor
```

and let the web server pass `/api/` to it (it listens on 127.0.0.1:8091):

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8091;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 1m;
}
```

Without the edit service the map is still shown, read-only.

## Without Docker

Copy `app/dist/` to any static host — nginx (use `deploy/nginx.conf` as a
starting point), Caddy, Apache, or a NAS's web station. The site uses
relative paths and `#/` routes, so it works from a sub-path
(`http://server/olympus/`) and needs no rewrite rules.

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
