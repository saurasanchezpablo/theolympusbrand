# 06 — Stickers

Every crest, emblem, seal and name lockup can be made into a die-cut sticker,
ready for a print provider: vector artwork, a cut path that follows the
design, bleed, and — on clear vinyl — a white underbase, each on its own
layer.

## Colourways

| Colourway | Substrate | What is printed |
|---|---|---|
| **White vinyl** | white vinyl | the design in charcoal; nothing else |
| **Dark** | white vinyl | a black ground to the edge, the design in white — premium on silver and light cases |
| **Clear · dark ink** | clear vinyl | only the design, charcoal, backed with white ink — for light surfaces |
| **Clear · light ink** | clear vinyl | only the design, light, backed with white ink — for black laptops and racks |
| **White marble** | white vinyl | a printed white-marble ground with gray veining, the design in charcoal |
| **Black marble** | white vinyl | a printed black-marble ground with silver veining, the design in white |

The marble grounds are the house's seeded veining, printed at 300 dpi — the
same on every file, never a photograph. A printed marble is a decorative look,
not stone.

## The QR label

Besides the crest, emblem, seal and name lockups, a sticker can be a
**label**: the service's seal, its name and address, and a QR code that opens
it — stick it on the machine and a phone takes you to the service. The
address is the service's `url` (set it in the Atelier or with `--url`);
without one, the code points to theolympus.cloud.

The code is always dark on light, as every scanner expects: with a light ink
(dark, clear · light ink, black marble) it is a light panel with the modules
cut out. Labels are cut as rounded rectangles. Every colourway is checked by
rendering the sticker and reading the code back with an independent
decoder.

## Making a sticker

**In the Atelier** — open a design and choose **Sticker** in the canvas. Pick
the design (crest, emblem, seal, or the name lockup), the colourway, the size
and the cut. The canvas shows the sticker with its cut path, on a laptop lid
and on a server's front panel (drawn mockups at real size), and laid out on a
sheet. Download the PDF, the SVG, the cut path alone, a sheet, or the whole
sticker pack.

**From the command line:**

```sh
npm run sticker -- master                          # every colourway of the crest
npm run sticker -- jellyfin --art seal --style dark --size 50
npm run sticker -- vpn --art lockup-horizontal --size 120 --shape rounded
npm run sticker -- jellyfin --art qr-label --size 90 --style dark
npm run sticker -- sheet                           # every service's seal on A4
npm run sticker -- sheet --art crest --size 60 --style marble-dark --paper a3
```

Output goes to `manufacturing/stickers/<id>/`. The master's stickers and the
catalogue sheets are kept in the repository; the rest are built on demand.

## The files

| File | Contents |
|---|---|
| `…-sticker-<design>-<colourway>.pdf` | The production file. Layers: **Bleed** (the ground), **Artwork**, **White** (underbase, clear vinyl only), **CutContour**. |
| `….svg` | The same, as layered SVG (Inkscape and Illustrator read the layers). |
| `…-cutline.svg` | The cut path alone — some providers ask for it separately. |
| `…-a4-sheet.pdf` | As many as fit on a sheet, each with its own cut path (kiss-cut). |
| `….md` | The sheet: sizes, substrate, notes. |

## What a print provider gets

- **Cut path** — one closed path on its own layer, in the spot colour named
  **CutContour**, 0.25 pt, set to overprint. It follows the design's
  silhouette grown by the border; gaps are closed so the blade runs one smooth
  line, and inside corners are no tighter than it can follow. A *rounded* cut
  is a rounded rectangle instead. Some providers want the cut in 100 %
  magenta: recolour that one layer (the brand's files stay grayscale).
- **Bleed** — the ground runs past the cut (2 mm by default) so a slightly
  off cut never shows a white edge.
- **Safe area** — the design stays at least the border (3 mm by default)
  inside the cut.
- **White underbase** — on clear vinyl, the spot colour **White** under the
  ink, choked 0.1 mm so no white halo shows if the plates shift.
- **Finest line** — the design's edition is chosen so its finest line is at
  least the provider's minimum (0.15 mm by default): the print edition for
  most sizes, the fine edition from about 200 mm. Too small for any edition,
  and the sticker says so. For very small stickers, use the seal (clean from
  17 mm).

Bleed, cut tolerance, minimum line and how they want the cut path differ
between providers: confirm them before ordering. The PDFs were checked with
poppler and Ghostscript, which read the layers and produce separate
CutContour and White plates.
