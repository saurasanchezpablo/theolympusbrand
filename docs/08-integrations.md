# 08 — Integrations

The house's look, carried into the software it runs: start pages that list
every service under its seal, and theme kits that put the crest into the
applications themselves. Everything is generated from the catalogue, so a
service added there appears everywhere on the next build.

```sh
npm run integrations      # → assets/integrations/
```

The kit is also on the website, under **Downloads → Dashboards and themes**.

## Icons

Each service's seal struck as a coin: the seal on a disc of its own ground,
so it reads on light and dark dashboards alike.

| File | Contents |
|---|---|
| `icons/olympus-<id>.png` | Dark coin, 256 px — what the dashboards use. |
| `icons/olympus-<id>-light.png` | Light coin, for light dashboards. |
| `icons/olympus-<id>.svg` | Dark coin, scalable. |
| `icons/olympus.*` | The master's. |
| `backgrounds/olympus-background.png` | Black marble, 1920 × 1080. |
| `backgrounds/olympus-background-light.png` | White marble, 1920 × 1080. |

The marble on screens is the house's seeded veining drawn for viewing whole:
a few long veins that taper and fade, finer veins across them, a soft
vignette. It is the same on every build.

## Start pages

Every service links to its address — `https://<service>.theolympus.cloud`
unless its catalogue entry gives another — and services are grouped by
category, in catalogue order.

### Homepage

1. Copy `dashboards/homepage/services.yaml` into Homepage's config folder.
2. Merge `settings.yaml` into yours: title, favicon, the dark theme with the
   **neutral** (pure gray) palette, and the marble background.
3. Mount the icons and background:

   ```yaml
   volumes:
     - ./config:/app/config
     - ./the-olympus/icons:/app/public/icons
     - ./the-olympus/backgrounds:/app/public/images
   ```

### Dashy

Copy `dashboards/dashy/conf.yml` to `user-data/conf.yml`, and `icons/` to
`user-data/item-icons/`. The file defines an *olympus* theme from three
colours (primary marble, obsidian background); the item icons are referred to
by file name.

### Homer

Copy `dashboards/homer/config.yml` to `assets/config.yml` and `icons/` to
`assets/icons/`. It sets Homer's light and dark colour schemes to the house
palette.

### Heimdall, Homarr and others

These keep their apps in their own database, not in a file. Add each service
in their interface from `dashboards/services.csv` (name, address, group,
description, icon file) and upload its icon from `icons/`.

### Browser bookmarks

`dashboards/bookmarks.html` imports into any browser (*Import bookmarks* →
*HTML file*): a folder **The Olympus** with a subfolder per group, each
bookmark carrying its seal.

### Icons from the site instead

If the site is running on your network, the dashboards can load the icons
from it rather than from their own folders:

```sh
npm run integrations -- --icons-url https://brand.theolympus.cloud/files/assets/integrations/icons/ --out ~/olympus-dashboards
```

### One service

The Atelier's **asset pack** has a `dashboard/` folder for the design it was
made from: the service's coins and a `README.md` with the block to paste into
Homepage, Dashy or Homer — for adding one service to a start page you
already have.

## Theme kits

Each kit uses only what the application offers for customisation (a theming
command, a custom-CSS field, files it serves) and is made from the catalogue
service that runs the application — Jellyfin's kit carries Apollo's lyre.

**Which service themes which application.** A service says what it runs with
`"app"` in its catalogue file (or `--app` when it is added, or *Application*
in the Atelier):

```json
{ "id": "vault", "name": "Vault", "category": "security", "god": "athena", "app": "vaultwarden" }
```

That service's seal then themes Vaultwarden, in `themes/vaultwarden/`; a
second service running the same application gets its own kit in
`themes/vaultwarden-<id>/`. A kit no service names is made from a service
that fits it by id or category, and otherwise from the master.
`npm run service -- apps` shows which service each kit comes from. A service
designed in the Atelier with an application also carries the kit in its
asset pack, under `theme/`.

**Adding or removing an application.** Each kit is one module in
`src/integrations/themes/` (its files, its guide, how it is applied, which
services fit it) listed once in `src/integrations/themes/index.ts`. Add a
module and a line to support a new application; delete both to drop one.
Everything else — the kit folder, its README and its chapter of this guide,
the Atelier's choices, `service apps` — follows the list.

They are written
for current releases (named in each file) and have not been run against live
instances here: if an update renames something, the rest still applies.
Status colours — up, down, alerts — are left alone; only the chrome is
re-inked.

### The guides

Each application has its own chapter — what the kit changes and what it
cannot, what you need, the steps, how to check it and how to undo it. The same
text is the README in the kit's folder.

| Application | How it is applied | Guide |
|---|---|---|
| Proxmox VE | A script turns the whole web interface grey — made from Proxmox's own dark theme on the node — with the logo and favicon, and makes it again after updates | [Proxmox VE](integrations/proxmox.md) |
| Nextcloud | A script sets the Theming app with `occ`; the Custom CSS app keeps the accent visible in dark themes | [Nextcloud](integrations/nextcloud.md) |
| Home Assistant | A theme with light and dark modes, and a dashboard card | [Home Assistant](integrations/home-assistant.md) |
| Navidrome | Its most neutral theme, marble behind the sign-in, a welcome line; optional greys through nginx | [Navidrome](integrations/navidrome.md) |
| Jellyfin | Custom CSS, a sign-in line and a splash screen, pasted into Branding | [Jellyfin](integrations/jellyfin.md) |
| Vaultwarden | A stylesheet in its data folder | [Vaultwarden](integrations/vaultwarden.md) |
| Grafana | Its logo, favicon and icon replaced by mounted files | [Grafana](integrations/grafana.md) |
| Uptime Kuma | A status page's logo and stylesheet | [Uptime Kuma](integrations/uptime-kuma.md) |

The terminal — prompts, fastfetch, tmux and the colours of the terminal apps —
has its own chapter under *Screens*: [Your terminal](screens/terminal.md).

## How the kit is checked

The test suite parses every YAML file with a YAML parser and checks that each
service is there, at its address, with an icon that exists — including names
with colons, quotes and accents. It reads the bookmarks and the table back,
runs the Nextcloud script with a stand-in for `occ` (in `dash` and `bash`),
runs the Proxmox, Home Assistant and Vaultwarden scripts against stand-in
folders (and a stand-in `docker`) — the Proxmox theme made from a sample of
its dark theme, blues to grey and status colours kept, re-applied after a
simulated update — checks that the Home Assistant theme, the Vaultwarden and
Navidrome stylesheets are grey, checks that every guide lists exactly the
files of its kit, and decodes the header
logo embedded in the Jellyfin CSS. The kit is rebuilt on every push and must
come out byte for byte the same.
