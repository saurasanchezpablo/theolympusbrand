# Proxmox VE

The whole Proxmox VE web interface in the house's greys, with Proxmox's seal and name in the header and on the browser tab. The theme is made on the node itself from the dark theme Proxmox ships — every blue and blue-grey becomes the grey of the same lightness — and the house's own layer goes on top: an obsidian ground, marble buttons and tabs, a marble rule beside what is selected, and the house's pigments for what reports a state (verde antico for good, gold for a warning, rosso antico for an error). Because it is made from the installed release, it matches whatever version the node runs, and it is made again after every update.

Made from Proxmox’s seal. The files are in `themes/proxmox/` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

- Every panel, tree, grid, toolbar, menu and window: Proxmox’s dark theme, in greys, on an obsidian ground.
- The main buttons and the open tab: marble, with dark lettering; what is selected in the trees and lists: a lighter stone with a marble rule.
- The sign-in window, in the same greys.
- The header logo: Proxmox's seal and name (Proxmox VE 8 and 9 each have their own file; both are replaced).
- The icon of the browser tab: the seal on its own disc.
- States in the house’s pigments: good in verde antico, warnings and the gauges’ warning band in gold, errors and critical gauges in rosso antico, notices in lapis; the journal’s errors and warnings likewise.

## What it cannot change

- The console (noVNC, xterm.js) has no theme setting; its colours stay. The crest *at login* in a shell is the screens kit’s *terminal* part.
- A few states Proxmox paints in places the kit does not know keep Proxmox’s own colour (still green, orange or red: their meaning is kept).
- The charts’ series colours (CPU usage in olive, IO delay in blue…) are set in Proxmox’s code, not its stylesheets: no theme can change them.
- Proxmox Backup Server is not covered by this kit.
- It changes Proxmox’s own page template (one line) and adds files to its folders: `debsums` or `dpkg --verify` list the template as modified until the next update puts Proxmox’s back — and the hook makes it again.

## Before you start

- Proxmox VE 8 or 9 (7.4 and later have the dark theme it is made from).
- A root shell on each node: the web interface’s *Shell*, or SSH.

## Install

1. Copy this folder to the node, for instance with `scp -r proxmox root@<node>:/root/the-olympus-proxmox`.

2. Run the script as root.

   ```sh
   cd /root/the-olympus-proxmox
   sh apply.sh
   ```

3. Reload the web interface with Ctrl+Shift+R (the browser keeps the old stylesheet otherwise).

4. Repeat on every node of a cluster: each serves its own interface.

## Check that it worked

- `sh /usr/local/share/the-olympus/proxmox/apply.sh --check` lists what is in place and whether the node serves the theme.
- The interface is grey from the sign-in window on, the main buttons marble; the header shows the seal and the name.
- If nothing changed, reload with Ctrl+Shift+R: the browser may still hold the page from before.
- A running guest’s icon is still green; a stopped one grey.
- `ls /etc/apt/apt.conf.d/99-the-olympus-logo` shows the hook is in place.

## Undo

1. Put Proxmox’s look back and remove the hook.

   ```sh
   sh /usr/local/share/the-olympus/proxmox/apply.sh --restore
   ```

## After an update

An update of `pve-manager` puts Proxmox’s page template and logo back; the APT hook runs right after and makes the theme again from the new release’s dark theme. Install with `--no-persist` if you would rather re-run the script yourself. Only the logo and favicon, on Proxmox’s light theme: `sh apply.sh --logo-only`.

## Files

| File | What it is |
|---|---|
| `apply.sh` | Makes and installs the theme, the logo and the icon; `--check` says what is in place; `--restore` undoes |
| `layer.css` | What the house adds on top of the greyed dark theme: grounds, marble buttons, tabs and selection |
| `logo-dark-theme.png` | The header logo for the grey (dark) interface — Proxmox VE 8 |
| `logo-dark-theme.svg` | The same, for Proxmox VE 9 |
| `logo-light-theme.png` | The header logo for Proxmox’s light theme (`--logo-only`) — Proxmox VE 8 |
| `logo-light-theme.svg` | The same, for Proxmox VE 9 |
| `logo-128.png` | The icon of the browser tab |
| `favicon.ico` | The favicon: 16, 32 and 48 px |

---

Written for Proxmox VE 8 and 9. The test suite runs the script against a stand-in node — the theme made from a sample of the dark theme (blues to grey, status colours kept), the template linked once however often it runs, the hook re-applying, and `--restore` putting everything back. The result was looked at in Proxmox VE 9.2’s own web interface, served from its packages with a stand-in for the API; it has not been run on a live node here.
