# Nextcloud

Nextcloud's Theming app takes a name, colours and images; the kit's script sets them all with `occ`, and adds a small stylesheet so that the accent stays visible in the dark themes. Every user sees the house's look, whatever theme they pick.

Made from Nextcloud’s seal. The files are in `themes/nextcloud/` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

- The name (*The Olympus*), the address, and the slogan (*theolympus.cloud*) on the sign-in page.
- The primary colour: charcoal; the background colour: obsidian.
- The sign-in logo (the emblem), the header logo (the seal) and the favicon.
- The sign-in background: black marble.
- With the Custom CSS app: in the dark themes, the accent in marble instead of charcoal.

## What it cannot change

- Error, warning, success and the favourite star keep their colours.
- The desktop and phone apps draw their own interface.
- Users can still choose their own background and colour unless you turn that off (*Administration → Theming → Disable user theming*).

## Before you start

- Nextcloud 28 or later (older releases get the colour through its older setting).
- A shell on the server: `docker exec` into the container, or `occ` as the web server’s user.
- For `--with-css`: the server can reach the App Store, or the *Custom CSS* app is already installed.

## Install

1. Copy this folder to the server.

2. Run the script — with Docker naming the container, otherwise telling it how to call `occ`. Add `--with-css` for the dark themes’ accent.

   ```sh
   NEXTCLOUD_CONTAINER=nextcloud sh apply.sh --with-css
   # or
   OCC="sudo -u www-data php /var/www/nextcloud/occ" sh apply.sh --with-css
   ```

3. Reload Nextcloud (Ctrl+Shift+R).

## Check that it worked

- Signed out, the sign-in page shows the emblem on black marble and *theolympus.cloud*.
- Signed in, the header shows the seal; buttons are charcoal (light theme) or marble (dark theme).

## Undo

1. Reset every value the script set, and the stylesheet.

   ```sh
   NEXTCLOUD_CONTAINER=nextcloud sh apply.sh --restore
   ```

2. Or reset each value by hand in *Administration settings → Theming*.

## After an update

Nextcloud keeps theming settings and the Custom CSS app’s stylesheet across updates.

## Files

| File | What it is |
|---|---|
| `apply.sh` | Sets everything with `occ` (`--with-css`, `--restore`) |
| `custom.css` | The dark themes’ accent, for the Custom CSS app |
| `logo.svg` | The sign-in logo: the emblem in marble |
| `logoheader.svg` | The header logo: the seal in marble |
| `favicon.png` | The favicon |
| `background.png` | The sign-in background: black marble, 2560 × 1440 |

---

Written for Nextcloud 28 to 31. The test suite runs the script with a stand-in for `occ` (in dash and bash): every setting, the fallback for older releases, the stylesheet only when the app is enabled, and the restore; it has not been applied to a live server here.
