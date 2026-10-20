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
`src/integrations/themes/` (its files, how it is applied, which services fit
it) listed once in `src/integrations/themes/index.ts`. Add a module and a line
to support a new application; delete both to drop one. Everything else — the
kit folder, the README, the Atelier's choices, `service apps` — follows the
list.

They are written
for current releases (named in each file) and have not been run against live
instances here: if an update renames something, the rest still applies.
Status colours — up, down, alerts — are left alone; only the chrome is
re-inked.

### Nextcloud — `themes/nextcloud/`

`apply.sh` sets the Theming app with `occ`: name, address, slogan
(*theolympus.cloud*), charcoal primary colour, obsidian background colour,
the login logo (the emblem), the header logo (the seal), the favicon and a
black-marble login background (2560 × 1440).

```sh
NEXTCLOUD_CONTAINER=nextcloud sh apply.sh                            # Docker
OCC="sudo -u www-data php /var/www/nextcloud/occ" sh apply.sh        # installed
```

Written for Nextcloud 28 or later; on older releases it falls back to the
older name of the colour setting. Undo in *Administration settings →
Theming*: each value has a reset.

### Jellyfin — `themes/jellyfin/`

In *Dashboard → Branding*:

- **Custom CSS code** — paste `custom.css`. With the *Dark* theme it turns the
  grounds obsidian and charcoal, the accent from blue to marble, and puts the
  service's seal and name in the header.
- **Login disclaimer** — paste `login-disclaimer.html`.
- **Splash screen** — upload `splashscreen.png` (the crest on black marble).

Written for Jellyfin 10.10. Clear the field to undo.

### Proxmox VE — `themes/proxmox/`

`apply.sh`, run as root on each node, installs the header logo — the seal and
the service's name, 30 px tall, so it reads *Proxmox · Virtual Environment* —
and the favicon. Proxmox's own files are kept beside them.

```sh
sh apply.sh             # for the light theme (the default)
sh apply.sh --dark      # for the dark theme
sh apply.sh --persist   # also restore them after Proxmox updates (an APT hook)
sh apply.sh --restore   # put Proxmox's files back and remove the hook
```

Updates to `pve-manager` replace the logo; `--persist` adds a hook that puts
it back after every package operation. The test suite runs the script
against a stand-in system: install, re-install, restore.

### Grafana — `themes/grafana/`

Grafana's open-source edition has no branding settings, but serves its logo,
favicon and home-screen icon as files. `docker-compose.override.yml` mounts
the kit's files over them (read-only, so they survive updates) and sets the
dark theme as the default. For an installed Grafana, copy the three files to
`/usr/share/grafana/public/img/` (an update overwrites them).

### Uptime Kuma — `themes/uptime-kuma/`

On a status page, *Edit Status Page*: upload `logo.png` and paste
`status-page.css` into **Custom CSS**. Written for Uptime Kuma 1.23 with the
dark theme; the up and down colours keep their meaning.

### Home Assistant — `themes/home-assistant/`

`apply.sh` copies the theme to the configuration's `themes/` folder and the
seal and banner to `www/the-olympus/`:

```sh
HA_CONTAINER=homeassistant sh apply.sh      # Docker
sh apply.sh /path/to/homeassistant/config   # a folder
sh apply.sh … --restore                     # remove both
```

If `configuration.yaml` does not read the themes folder yet, the script
prints the two lines to add (then restart Home Assistant once). Afterwards:
*Developer tools → Actions → Frontend: Reload themes*, and choose *The
Olympus* on your profile page — it has a light and a dark mode, following
the profile's setting. `picture-card.yaml` is a dashboard card with the
service's banner.

Written for Home Assistant 2026.10. Home Assistant documents only a few theme
variables; the kit also sets the frontend's own colour scale, without which
newer screens stay blue — an update may rename those. No theme can change the
sidebar title, add a logo there or change the favicon.

### Vaultwarden — `themes/vaultwarden/`

`apply.sh` puts `user.vaultwarden.scss.hbs` in the data folder's
`templates/scss/`, where Vaultwarden (1.33 or later) compiles it into its own
stylesheet: neutral greys for every blue in the light and dark themes, and
the service's banner and seal in place of the logos on the sign-in page, in
the side navigation and on the loading screen.

```sh
VAULTWARDEN_CONTAINER=vaultwarden sh apply.sh   # Docker: copies it and restarts
sh apply.sh /path/to/vaultwarden/data            # a folder: restart Vaultwarden after
sh apply.sh … --restore                          # remove it
```

Written for Vaultwarden 1.37 with web vault 2026.7. Danger, success and
warning colours keep their meaning. The favicon belongs to the web vault's
files and is not changed.

## How the kit is checked

The test suite parses every YAML file with a YAML parser and checks that each
service is there, at its address, with an icon that exists — including names
with colons, quotes and accents. It reads the bookmarks and the table back,
runs the Nextcloud script with a stand-in for `occ` (in `dash` and `bash`),
runs the Proxmox, Home Assistant and Vaultwarden scripts against stand-in
folders (and a stand-in `docker`), checks that the Home Assistant theme and the
Vaultwarden stylesheet are grey in both modes, and decodes the header
logo embedded in the Jellyfin CSS. The kit is rebuilt on every push and must
come out byte for byte the same.
