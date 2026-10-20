# Home Assistant

A Home Assistant theme: the house's greys for the whole interface, in a light and a dark mode that follow each user's own setting, with Home Assistant's banner for a dashboard card.

Made from Home Assistant’s seal. The files are in `themes/home-assistant/` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

- Grounds, cards, sidebar and header: the house’s greys, light or dark.
- Home Assistant’s accent colour and its whole colour scale: greys instead of blue.
- Card corners: square, as the house’s are.
- A picture card with Home Assistant's banner, for the top of a dashboard.

## What it cannot change

- The sidebar title (*Home Assistant*), a logo in the sidebar and the favicon: no theme can change them.
- Colours that carry meaning — a light that is on, an alarm, an error — keep them.
- Home Assistant documents only a few theme variables; the kit also sets the colour scale newer screens use, which an update may rename (blue would then show again in places — rebuild the kit).

## Before you start

- Home Assistant 2026.10 or close to it.
- Access to its configuration folder: through Docker (`HA_CONTAINER`), or as a folder on disk (the *Samba share* or *File editor* add-ons, or SSH).

## Install

1. Run the script — with Docker, naming the container; otherwise, giving the configuration folder.

   ```sh
   HA_CONTAINER=homeassistant sh apply.sh
   # or
   sh apply.sh /path/to/homeassistant/config
   ```

2. If the script says Home Assistant does not read the themes folder yet, add these two lines to `configuration.yaml` and restart Home Assistant once.

   ```sh
   frontend:
     themes: !include_dir_merge_named themes
   ```

3. Reload the themes: **Developer tools → Actions → Frontend: Reload themes**.

4. On your **profile** page, choose **The Olympus** as the theme. Each user chooses for themselves; *Mode* there picks light or dark.

5. Optional: on a dashboard, **Edit → Add card → Manual**, and paste `picture-card.yaml`.

## Check that it worked

- The sidebar, header and cards are grey; switches and sliders are grey rather than blue.
- Switching the profile’s mode between light and dark changes the whole interface with it.

## Undo

1. Choose another theme on your profile page.

2. Remove the files the script installed, then reload the themes.

   ```sh
   sh apply.sh /path/to/homeassistant/config --restore
   ```

## After an update

Home Assistant keeps themes across updates. If an update renames the colour scale, parts of the interface turn blue again: rebuild the kit and run the script again.

## Files

| File | What it is |
|---|---|
| `apply.sh` | Installs the theme and the images (`--restore` removes them) |
| `the-olympus.yaml` | The theme, with its light and dark modes |
| `picture-card.yaml` | A dashboard card with the banner |
| `www/banner.svg` | The banner, served by Home Assistant as /local/the-olympus/banner.svg |
| `www/seal.svg` | The seal on its own disc |

---

Written for Home Assistant 2026.10. The test suite parses the theme, checks that both modes are grey, and runs the script against a stand-in configuration folder; it has not been applied to a live instance here.
