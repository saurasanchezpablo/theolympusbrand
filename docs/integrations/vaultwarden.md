# Vaultwarden

Vaultwarden reads a stylesheet of your own from its data folder and adds it to the web vault's. The kit's turns every blue of the vault grey, in the light and the dark theme, and puts The Olympus's banner and seal where the vault's logo was.

Made from the master’s seal. The files are in `themes/vaultwarden/` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

- Every blue and blue-grey of the web vault: greys, in its light and dark themes.
- The logo on the sign-in page and in the side navigation: The Olympus's banner (the seal alone when the navigation is folded).
- The loading screen: the seal.

## What it cannot change

- The favicon: it belongs to the web vault’s own files.
- The browser extensions and the phone apps: they are Bitwarden’s, and draw themselves.
- Danger, success and warning colours keep their meaning.

## Before you start

- Vaultwarden 1.33 or later (written for 1.37 with web vault 2026.7).
- Access to its data folder: the container’s `/data`, or the folder mounted there.

## Install

1. Run the script — with Docker, naming the container (it copies the file and restarts Vaultwarden); otherwise, giving the data folder.

   ```sh
   VAULTWARDEN_CONTAINER=vaultwarden sh apply.sh
   # or
   sh apply.sh /path/to/vaultwarden/data
   ```

2. Without Docker, restart Vaultwarden: it reads the stylesheet when it starts.

3. Reload the web vault (Ctrl+Shift+R).

## Check that it worked

- The sign-in page shows the banner instead of the vault’s logo.
- Buttons and links are grey, not blue — in *Settings → Preferences*, try both themes.

## Undo

1. Remove the stylesheet, then restart Vaultwarden.

   ```sh
   sh apply.sh /path/to/vaultwarden/data --restore
   ```

## After an update

Updates keep the stylesheet. A new web vault may rename a colour or the logo’s place: the rest still applies; rebuild the kit when a newer one is out. If the stylesheet has a mistake, Vaultwarden says so in its log and uses its own.

## Files

| File | What it is |
|---|---|
| `apply.sh` | Installs the stylesheet (`--restore` removes it) |
| `user.vaultwarden.scss.hbs` | The stylesheet, with the banner and seal embedded |

---

Written for Vaultwarden 1.37 and web vault 2026.7. The test suite checks that every colour is grey and runs the script against a stand-in data folder and a stand-in `docker`; it has not been applied to a live instance here.
