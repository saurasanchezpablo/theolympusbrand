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
- long-lived caching for the built scripts, an hour for the brand's files,
- a strict Content-Security-Policy: the page may only load from its own
  server.

To build and run without compose:

```sh
docker build -f deploy/Dockerfile -t theolympus-site .
docker run -d -p 8080:80 --restart unless-stopped --name olympus theolympus-site
```

Rebuild the image after changing the repository (a new service, new models):
the site is a snapshot of it.

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
