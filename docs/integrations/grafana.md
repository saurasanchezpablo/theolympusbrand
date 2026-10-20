# Grafana

Grafana's open-source edition has no branding settings, but it serves its logo, favicon and home-screen icon as plain files. The kit replaces those three with Monitoring's seal and makes the dark theme the default.

Made from Monitoring’s seal. The files are in `themes/grafana/` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

- The logo on the sign-in page and in the menu.
- The favicon and the icon for a phone’s home screen.
- The default theme for new users: dark.

## What it cannot change

- Colours and the *Welcome to Grafana* text: changing them is a feature of Grafana Enterprise, not of the open-source edition.

## Before you start

- Grafana run with Docker Compose (for an installed Grafana, see step 4).

## Install

1. Copy this folder next to the compose file that runs Grafana, as `the-olympus/grafana/`.

2. Merge `docker-compose.override.yml` into that compose file, renaming `grafana` to your service’s name if it differs (or keep it beside it as an override file).

3. Recreate the container.

   ```sh
   docker compose up -d grafana
   ```

4. Installed without Docker: copy `grafana_icon.svg`, `fav32.png` and `apple-touch-icon.png` to `/usr/share/grafana/public/img/` instead (an update puts Grafana’s back).

## Check that it worked

- Signed out, the sign-in page shows the seal instead of Grafana’s logo.
- The browser tab shows the seal.

## Undo

1. Remove the volume lines and the `GF_USERS_DEFAULT_THEME` line, then recreate the container.

## After an update

With Docker the files are mounted read-only over Grafana’s, so updates keep them.

## Files

| File | What it is |
|---|---|
| `docker-compose.override.yml` | The mounts and the default theme |
| `grafana_icon.svg` | The logo: the seal on its own disc |
| `fav32.png` | The favicon |
| `apple-touch-icon.png` | The home-screen icon |

---

Written for the open-source edition, which has served these three files under these names for several releases. Not applied to a live server here: if an update renames one, it simply stays Grafana’s.
