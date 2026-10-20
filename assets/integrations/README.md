# The Olympus — integrations

Start pages and themes for the house's self-hosted services, generated from
the catalogue (16 services). Rebuild with `npm run integrations`.
The guide's chapter *Integrations* explains each one step by step.

## Dashboards — `dashboards/`

| Dashboard | File | Icons go in |
|---|---|---|
| Homepage | `homepage/services.yaml`, `homepage/settings.yaml` | `/app/public/icons`; the background in `/app/public/images` |
| Dashy | `dashy/conf.yml` | `user-data/item-icons/` |
| Homer | `homer/config.yml` | `assets/icons/` |
| Heimdall, Homarr | `services.csv` — set up in their own interface | upload from `icons/` |
| Any browser | `bookmarks.html` — Import bookmarks | built in |

Icons are referred to in each dashboard's own icon folder: copy `icons/` there.
Every service links to its address (`https://<service>.theolympus.cloud` unless the
catalogue says otherwise).

## Icons — `icons/`

Each service's seal struck as a coin: `olympus-<id>.png` (dark, 256 px),
`olympus-<id>-light.png` (light) and `olympus-<id>.svg`. The master's are
`olympus.*`. The coins read on light and dark dashboards alike.

## Themes — `themes/`

| Application | How | Made from |
|---|---|---|
| Nextcloud | `apply.sh` sets the Theming app with `occ` | Nextcloud’s seal |
| Jellyfin | `custom.css`, `login-disclaimer.html`, `splashscreen.png` — Dashboard → Branding | Jellyfin’s seal |
| Proxmox VE | `apply.sh` installs the header logo and favicon (`--restore` undoes) | Proxmox’s seal |
| Grafana | `docker-compose.override.yml` mounts the logo, favicon and icon | Monitoring’s seal |
| Uptime Kuma | `status-page.css` and `logo.png` — status page settings | Monitoring’s seal |
| Home Assistant | `apply.sh` installs the theme (light and dark) and the images; `picture-card.yaml` puts the seal on a dashboard | Home Assistant’s seal |
| Vaultwarden | `apply.sh` installs `user.vaultwarden.scss.hbs` in the data folder: greys for the web vault, the house’s logo | the master’s seal |

Each is written for a current release of the application (named in the
file) and only uses what it offers for customisation. They have not been run
against live instances here: if an update renames something, the rest still
applies.
