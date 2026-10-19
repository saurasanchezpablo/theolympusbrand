# The Olympus

The visual identity of a private server: a heraldic crest in which a temple on
Mount Olympus is the server, and every service is a god with a domain.

![The Olympus](assets/master/png/crest/the-olympus-crest-fine-512.png)

## Documentation

- [Design system](docs/02-design-system.md): construction, palette,
  typography, tiers, clear space, print rules and files.
- [Creative directions](docs/01-creative-directions.md): how the mark was
  arrived at.

## Master files

Production files are in [`assets/master/`](assets/master/):

- SVG for every tier (crest, emblem, seal), in both editions (fine, print)
  and on every ground;
- PNG at the sizes each tier is meant for;
- `favicon.ico`.

## Working on it

Requires Node.js 24 or later, which runs the TypeScript sources directly.

```sh
npm install
npm test               # locks the master: geometry, border, palette, printability
npm run build:master   # regenerate assets/master/
npm run build:docs     # regenerate the design-system boards
```

Every file is generated from the geometry in `src/`. The same configuration
always produces the same mark.

## Licences

Cinzel, Jost and JetBrains Mono are used under the SIL Open Font License 1.1.
