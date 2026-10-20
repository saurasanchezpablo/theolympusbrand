# Navidrome

Navidrome has no setting for a stylesheet or a logo, so the kit uses what it does offer: its most neutral built-in theme (*Extra Dark*: black and greys, with a blue accent) as the default, the house's black marble behind the sign-in form, and a welcome line naming the house. If you run Navidrome behind nginx, an optional stylesheet turns the remaining blue grey as well.

Made from the master’s seal. The files are in `themes/navidrome/` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

- The default theme for new browsers: *Extra Dark*.
- The sign-in background: black marble, served from the house’s own site.
- The sign-in page’s welcome message: *The Olympus · theolympus.cloud*.
- Optionally, through nginx: buttons, tabs, sliders, switches and links in greys instead of blue.

## What it cannot change

- The logo and the name *Navidrome*: no setting changes them.
- The default theme applies to browsers that have not chosen one; a listener who picked another keeps it (*Personal → Theme*).
- The stylesheet through nginx is not a Navidrome feature: it names the interface’s component classes, which an update may change — then parts turn blue again, and nothing breaks.
- The apps (Subsonic clients) draw their own interface.

## Before you start

- Navidrome 0.64 or close to it.
- The house’s site reachable from the listeners’ browsers (for the background).
- For the optional stylesheet: Navidrome behind nginx.

## Install

1. With Docker: merge `docker-compose.override.yml` into Navidrome’s compose file (or keep it beside it), then recreate the container with the address of the house’s site.

   ```sh
   OLYMPUS_SITE=http://olympus.lan:8080 docker compose up -d navidrome
   ```

2. Without Docker: add the three lines of `navidrome.toml` to Navidrome’s configuration, putting in the site’s address, and restart Navidrome.

3. Optional — the greys, through nginx: copy `navidrome.css` to `/etc/nginx/the-olympus/`, merge the two locations of `nginx.conf` into the server block that proxies Navidrome, and reload nginx.

   ```sh
   sudo mkdir -p /etc/nginx/the-olympus
   sudo cp navidrome.css /etc/nginx/the-olympus/
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Check that it worked

- Signed out, the sign-in form stands on black marble with the welcome line.
- In a private window, the interface opens in *Extra Dark*.
- With the stylesheet: the play buttons and the active tab are marble white, not blue.

## Undo

1. Remove the three settings (or the override) and restart Navidrome.

2. Remove the two nginx locations (or just the `sub_filter` lines) and reload nginx.

## After an update

The settings stay across updates. If an update renames the interface’s classes, the optional stylesheet stops reaching some parts: rebuild the kit when a newer one is out.

## Files

| File | What it is |
|---|---|
| `docker-compose.override.yml` | The three settings, for Docker |
| `navidrome.toml` | The same, for navidrome.toml |
| `navidrome.css` | Optional: the accents in greys |
| `nginx.conf` | Optional: how nginx adds the stylesheet to the page |

---

Written for Navidrome 0.64. The test suite parses the compose file and checks the stylesheet is grey; nothing here was applied to a live server, and the optional stylesheet in particular is unofficial.
