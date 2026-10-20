import { productionSvg, treatmentSvg } from '../../../src/render/svg.ts';
import { DOMAIN } from '../../../src/brand/identity.ts';
import { resolve } from '../../../src/catalog/service.ts';
import { MASTER, sealFor, title } from '../model.ts';
import { HOUSE } from '../library.ts';
import { GODS } from '../../../src/geometry/pantheon.ts';
import { SvgImage } from '../components/ui.tsx';

const DOORS = [
  { href: '#/atelier', name: 'Atelier', text: 'Make a logo for a new service: pick its god, preview it on marble, export everything — files, stickers, printable models.' },
  { href: '#/catalogue', name: 'Catalogue', text: 'Every service in the house, each with its god — and the designs you have made here.' },
  { href: '#/guide', name: 'Guide', text: 'The design system: construction, palette, typography, the pantheon, printing and stickers.' },
  { href: '#/downloads', name: 'Downloads', text: 'The master identity, every service’s files, printable models and sticker sheets.' },
];

export function HomePage() {
  const crest = MASTER.marks()['crest-fine'];
  return (
    <div className="page home">
      <section className="home__hero">
        <SvgImage className="home__crest" svg={treatmentSvg(crest, 'relief-white', { size: 900 })} alt="The Olympus — the crest in white marble" />
        <div className="home__intro">
          <p className="home__kicker">{DOMAIN}</p>
          <h1>The Olympus</h1>
          <p className="home__lede">The visual identity of a private server: a temple on Mount Olympus is the server, and every service it runs is a god with a domain.</p>
          <div className="home__actions">
            <a className="btn btn--primary" href="#/atelier">
              Open the Atelier
            </a>
            <a className="btn" href="#/guide">
              Read the guide
            </a>
          </div>
        </div>
      </section>

      <section className="home__pantheon" aria-label="The pantheon">
        {HOUSE.map((d) => {
          const s = resolve(d.spec);
          return (
            <a key={s.id} className="home__god" href="#/catalogue" title={`${s.name} — ${'god' in s.patron ? title(GODS[s.patron.god].name) : 'monogram'}`}>
              <SvgImage svg={productionSvg(sealFor(s.patron), { ground: 'transparent' })} alt="" />
              <span>{s.name}</span>
            </a>
          );
        })}
      </section>

      <section className="home__doors">
        {DOORS.map((d) => (
          <a key={d.href} className="door" href={d.href}>
            <span className="door__name">{d.name}</span>
            <span className="door__text">{d.text}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
