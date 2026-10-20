# Uptime Kuma

Uptime Kuma lets each public status page carry its own logo and stylesheet. The kit gives a status page Monitoring's seal and the house's dark grounds; the up and down colours keep their meaning.

Made from Monitoring’s seal. The files are in `themes/uptime-kuma/` of the integration kit
(Downloads → Dashboards and themes), with this guide as their README.

## What it changes

- The status page’s logo.
- Its grounds and cards: obsidian and charcoal.
- Its title, set in capitals like the house’s inscriptions.

## What it cannot change

- The dashboard you manage monitors from: Uptime Kuma has no setting for it.
- Green, amber and red: they say whether a service is up, and stay as they are.

## Before you start

- Uptime Kuma 1.23 or later, with a status page.
- The status page on the dark theme.

## Install

1. Open the status page and choose **Edit Status Page**.

2. Click the logo and upload `logo.png`.

3. Paste `status-page.css` into **Custom CSS**.

4. Choose **Save**.

## Check that it worked

- The status page shows the seal, on dark grounds, with the title in capitals.

## Undo

1. In **Edit Status Page**, clear **Custom CSS** and put your own logo back.

## Files

| File | What it is |
|---|---|
| `status-page.css` | The stylesheet |
| `logo.png` | The seal on its own disc, 512 px |

---

Written for Uptime Kuma 1.23. Not applied to a live server here.
