# Jellyfin

Jellyfin's own branding settings take a stylesheet, a line of text for the sign-in page and a splash screen. The kit fills all three, so the house's marks and greys replace Jellyfin's blue, with Jellyfin's seal and name in the header.

Made from Jellyfin’s seal. The files are in `themes/jellyfin/` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

- The grounds: obsidian and charcoal instead of Jellyfin’s dark blue-grey.
- The accent: buttons, tabs, progress bars, check boxes and played markers in marble instead of blue.
- The header: Jellyfin's seal and name in place of Jellyfin's logo.
- The sign-in page: a line naming the house beneath the form.
- The splash screen shown while the apps start: the crest on black marble.

## What it cannot change

- The apps for TV and phone draw their own interface: the stylesheet reaches the web interface and the apps that show it (the desktop app, Android TV through the web view), not the native ones.

## Before you start

- Jellyfin 10.10 or later, and an administrator account.
- Each user’s *Display* setting on the **Dark** theme (the stylesheet is written over it).

## Install

1. Open **Dashboard → Branding**.

2. Paste the whole of `custom.css` into **Custom CSS code**.

3. Paste `login-disclaimer.html` into **Login disclaimer**.

4. Under **Splash screen**, enable it and upload `splashscreen.png`.

5. Save, then reload the page (Ctrl+Shift+R).

## Check that it worked

- The header shows the seal and the name instead of Jellyfin’s logo.
- The *Save* buttons and the active tab are marble white, not blue.
- Signed out, the sign-in page shows *The Olympus · theolympus.cloud* under the form.

## Undo

1. Clear **Custom CSS code** and **Login disclaimer**, disable the splash screen, and save.

## After an update

Updates keep the branding settings. A release that renames parts of the interface may leave some elements in Jellyfin’s own colours: rebuild the kit (`npm run integrations`) once a newer stylesheet is out.

## Files

| File | What it is |
|---|---|
| `custom.css` | The stylesheet, with the banner embedded in it |
| `login-disclaimer.html` | The line under the sign-in form |
| `splashscreen.png` | The crest on black marble, 1920 × 1080 |

---

Written for Jellyfin 10.10. The test suite decodes the banner embedded in the stylesheet; the kit has not been applied to a live server here.
