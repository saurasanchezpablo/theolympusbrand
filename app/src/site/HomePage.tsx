import { useEffect, useRef, useState } from 'react';
import { fileUrl } from './files.ts';
import { Hero } from './Hero.tsx';
import type { SceneHandle } from './medallion-scene.ts';
import './home.css';

type Service = { id: string; name: string; category: string; patron: { god: string } | { monogram: string }; title?: string | null; url?: string | null };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const godOf = (s: Service) => ('god' in s.patron ? cap(s.patron.god) : `Monogram ${s.patron.monogram}`);
const host = (s: Service) => (s.url ?? `https://${s.id}.theolympus.cloud`).replace(/^https?:\/\//, '');
const seal = (s: Service) => fileUrl(`assets/services/${s.id}/svg/the-olympus-${s.id}-seal.svg`);

/** The crest, part by part, as the anatomy tells it. Each part is drawn from the crest's own geometry. */
const ANATOMY = [
  { part: 'rim', name: 'The rim', text: 'The outer ring is the boundary of the house. Its silhouette never changes, whichever service the seal stands for.' },
  { part: 'ornament', name: 'The border', text: 'A running Greek key and a ring of beads, cut like the edge of an ancient coin.' },
  { part: 'laurels', name: 'The laurels', text: 'Eight pairs of leaves on either side: the wreath of a house that means to last.' },
  { part: 'temple', name: 'The temple', text: 'The temple is the server. The triglyphs are its vents, the columns its drive bays, and Zeus’ thunderbolt rules the pediment. In the central bay stands the god of the service.' },
  { part: 'plinth', name: 'The name', text: 'THE OLYMPUS is cut into the plinth, and the plinth’s upper edge is the mountain itself.' },
  { part: 'clouds', name: 'The clouds', text: 'The temple stands above them — theolympus.cloud. A medallion resting on the clouds carries the service’s seal, or its own logo.' },
] as const;

const ROOMS = [
  { href: '#/atelier', name: 'Atelier', text: 'Make the mark for a new service: choose its god, see it in marble, and take every file — logos, stickers, printable models, wallpapers.', preview: 'showcase/atelier.webp' },
  { href: '#/catalogue', name: 'Catalogue', text: 'Every service in the house with its god, and the designs you have made here.', preview: 'showcase/catalogue.webp' },
  { href: '#/guide', name: 'Guide', text: 'How the crest is built and used: construction, palette, the pantheon, printing, stickers, your server.', preview: 'showcase/guide.webp' },
  { href: '#/downloads', name: 'Downloads', text: 'The master identity, every service’s files, models, stickers, dashboards and screens.', preview: 'showcase/downloads.webp' },
];

const prefersMotion = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The house's front page: the ascent through the clouds, the crest's anatomy, the pantheon, the workshop. */
export function HomePage() {
  const [services, setServices] = useState<Service[] | null>(null);
  useEffect(() => {
    fetch(fileUrl('assets/services/index.json'))
      .then((r) => (r.ok ? (r.json() as Promise<Service[]>) : []))
      .then(setServices, () => setServices([]));
  }, []);

  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null);

  // The header turns to stone while the opening scene is behind it.
  useEffect(() => {
    const app = root.current?.closest<HTMLElement>('.app');
    const ascent = root.current?.querySelector('.ascent-run');
    const scroller = document.getElementById('site-main');
    if (!app || !ascent || !scroller) return;
    const seen = new IntersectionObserver(([e]) => (app.dataset.over = e.isIntersecting ? 'stone' : ''), { root: scroller, rootMargin: '0px 0px -99% 0px' });
    seen.observe(ascent);
    return () => {
      seen.disconnect();
      delete app.dataset.over;
    };
  }, []);

  // The drifting clouds and the running names move only while they are on screen: out of view, nothing is drawn for them.
  useEffect(() => {
    const scroller = document.getElementById('site-main');
    const moving = root.current ? [...root.current.querySelectorAll<HTMLElement>('.ascent__clouds, .band')] : [];
    if (!moving.length) return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-moving', e.isIntersecting);
      },
      { root: scroller },
    );
    for (const el of moving) seen.observe(el);
    return () => seen.disconnect();
  }, [services]);

  // The scroll choreography loads after the page has drawn, and only for visitors who want motion.
  useEffect(() => {
    if (!services || !prefersMotion()) return;
    let undo: (() => void) | null = null;
    let gone = false;
    import('./choreography.ts').then((m) => {
      if (!gone && root.current) undo = m.choreograph(root.current, { scroller: document.getElementById('site-main')!, ascend: (p) => scene.current?.ascend(p) });
    });
    return () => {
      gone = true;
      undo?.();
    };
  }, [services]);

  return (
    <div className="home" ref={root}>
      <Ascent onScene={(h) => (scene.current = h)} />
      <Passage count={services?.length} />
      {services && services.length > 0 && <Band services={services} />}
      <Anatomy />
      <Pantheon services={services ?? []} />
      <Workshop />
      <Closing />
    </div>
  );
}

function Ascent({ onScene }: { onScene: (h: SceneHandle | null) => void }) {
  return (
    <div className="ascent-run">
      <section className="ascent" aria-labelledby="home-title">
        <h1 id="home-title" className="ascent__title">
          <span className="ascent__word ascent__word--the">The</span> <span className="ascent__word ascent__word--olympus">Olympus</span>
        </h1>
        <div className="ascent__stage">
          <Hero onScene={onScene} />
        </div>
        <div className="ascent__veil" aria-hidden="true" />
        <div className="ascent__clouds" aria-hidden="true">
          <div className="cloudbank cloudbank--back" />
          <div className="cloudbank cloudbank--front" />
        </div>
        <div className="ascent__intro">
          <p className="ascent__lede">A private server, drawn as a temple on Mount Olympus. Every service it runs is a god with a domain, and every god has its seal.</p>
          <div className="ascent__actions">
            <a className="btn btn--light" href="#/atelier">
              Open the Atelier
            </a>
            <a className="btn btn--outline-light" href="#/guide">
              Read the guide
            </a>
          </div>
        </div>
      </section>
      </div>
    );
  }

function Passage({ count }: { count?: number }) {
  return (
    <section className="passage" aria-labelledby="passage-title">
      <p id="passage-title" className="passage__domain" data-scramble>
        theolympus.cloud
      </p>
      <p className="passage__text">
        Above the cloud stands one temple: the server. {count ? `${count} services` : 'Its services'} live inside it, each kept by a god, and each god has a seal that is drawn, printed and cut from the same geometry.
      </p>
    </section>
  );
}

/** The gods' names, moving: decoration — the names themselves are listed in the pantheon below. */
function Band({ services }: { services: Service[] }) {
  const names = services.map(godOf);
  const row = (outline: boolean) => (
    <div className={`band__row${outline ? ' band__row--outline' : ''}`}>
      {[0, 1].map((copy) => (
        <span className="band__run" key={copy}>
          {names.map((n, i) => (
            <span className="band__item" key={`${n}${i}`}>
              {n}
              <img className="band__seal" src="files/assets/master/web/favicon.svg" alt="" width="40" height="40" />
            </span>
          ))}
        </span>
      ))}
    </div>
  );
  return (
    <div className="band" aria-hidden="true">
      {row(false)}
      {row(true)}
    </div>
  );
}

function Anatomy() {
  const [step, setStep] = useState(0);
  const steps = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const scroller = document.getElementById('site-main');
    const items = Array.from(steps.current?.children ?? []);
    // The step crossing the middle of the view is the one being told.
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setStep(items.indexOf(e.target));
      },
      { root: scroller, rootMargin: '-45% 0px -45% 0px' },
    );
    items.forEach((el) => seen.observe(el));
    return () => seen.disconnect();
  }, []);

  return (
    <section className="anatomy" aria-labelledby="anatomy-title">
      <div className="anatomy__figure" aria-hidden="true">
        <div className="anatomy__crest">
          {ANATOMY.map((a, i) => (
            <span key={a.part} className="anatomy__part" data-state={i < step ? 'set' : i === step ? 'now' : 'ahead'} style={{ WebkitMaskImage: `url(anatomy/${a.part}.svg)`, maskImage: `url(anatomy/${a.part}.svg)` }} />
          ))}
        </div>
      </div>
      <div className="anatomy__text">
        <h2 id="anatomy-title" className="section-title">
          How a seal is built
        </h2>
        <p className="section-lede">Six parts, always in the same order, always in the same place. Only the god in the temple changes from one service to the next.</p>
        <ol className="anatomy__steps" ref={steps}>
          {ANATOMY.map((a, i) => (
            <li key={a.part} className="anatomy__step" aria-current={i === step ? 'step' : undefined}>
              <h3>{a.name}</h3>
              <p>{a.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Pantheon({ services }: { services: Service[] }) {
  const tilt = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -10}deg`);
    e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 12}deg`);
  };
  const rest = (e: React.PointerEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.removeProperty('--rx');
    e.currentTarget.style.removeProperty('--ry');
  };
  return (
    <div className="pantheon-run">
      <section className="pantheon" aria-labelledby="pantheon-title">
        <div className="pantheon__head">
          <h2 id="pantheon-title" className="section-title">
            The pantheon
          </h2>
          <p className="section-lede">{services.length ? `${services.length} services, each kept by its god.` : 'The services of the house, each kept by its god.'} Open one in the catalogue.</p>
        </div>
        <div className="pantheon__viewport">
          <ol className="pantheon__track">
            {services.map((s, i) => (
              <li key={s.id} className="deity">
                <a href="#/catalogue" onPointerMove={tilt} onPointerLeave={rest}>
                  <span className="deity__index">
                    {String(i + 1).padStart(2, '0')} / {String(services.length).padStart(2, '0')}
                  </span>
                  <img className="deity__seal" src={seal(s)} alt="" width="220" height="220" loading="lazy" />
                  <span className="deity__god">{godOf(s)}</span>
                  {s.title && <span className="deity__title">{s.title}</span>}
                  <span className="deity__service">{s.name}</span>
                  <span className="deity__host">{host(s)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>
      </div>
    );
  }

function Workshop() {
  const [shown, setShown] = useState<number | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  // The preview follows a mouse; touch screens show it beside each room instead.
  const follow = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !preview.current) return;
    const r = preview.current.parentElement!.getBoundingClientRect();
    preview.current.style.setProperty('--x', `${e.clientX - r.left}px`);
    preview.current.style.setProperty('--y', `${e.clientY - r.top}px`);
  };
  return (
    <section className="workshop" aria-labelledby="workshop-title" onPointerMove={follow} onPointerLeave={() => setShown(null)}>
      <h2 id="workshop-title" className="section-title">
        The workshop
      </h2>
      <ul className="rooms">
        {ROOMS.map((r, i) => (
          <li key={r.href}>
            <a className="room" href={r.href} onPointerEnter={(e) => e.pointerType === 'mouse' && setShown(i)} onFocus={() => setShown(null)}>
              <span className="room__name">{r.name}</span>
              <span className="room__text">{r.text}</span>
              <img className="room__thumb" src={r.preview} alt="" width="360" height="240" loading="lazy" />
            </a>
          </li>
        ))}
      </ul>
      <div className="rooms__preview" ref={preview} data-shown={shown !== null ? 'yes' : undefined} aria-hidden="true">
        {ROOMS.map((r, i) => (
          <img key={r.href} src={r.preview} alt="" data-on={shown === i ? 'yes' : undefined} loading="lazy" />
        ))}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <h2 id="closing-title" className="closing__title">
        Every new service gets its god.
      </h2>
      <p className="closing__text">Name it, choose its patron, and take the seal home as files, stickers and stone.</p>
      <div className="closing__actions">
        <a className="btn btn--light" href="#/atelier">
          Open the Atelier
        </a>
        <a className="btn btn--outline-light" href="#/downloads">
          Browse the downloads
        </a>
      </div>
      <p className="closing__foot">
        <span>theolympus.cloud</span>
        <span>All rights reserved</span>
      </p>
    </section>
  );
}
