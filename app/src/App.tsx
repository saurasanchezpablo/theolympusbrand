import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useRoute } from './site/files.ts';
import { HomePage } from './site/HomePage.tsx';
import { Icon } from './components/Icon.tsx';

// Each part of the site loads when it is first visited. The Atelier and the
// catalogue draw lettering, so they wait for the brand fonts as well.
const loadBrandFonts = () => import('./fonts.ts').then((m) => m.loadBrandFonts());
const Atelier = lazy(() => Promise.all([import('./Atelier.tsx'), loadBrandFonts()]).then(([m]) => m));
const CataloguePage = lazy(() => Promise.all([import('./site/CataloguePage.tsx'), loadBrandFonts()]).then(([m]) => ({ default: m.CataloguePage })));
const MapPage = lazy(() => import('./site/map/MapPage.tsx').then((m) => ({ default: m.MapPage })));
const GuidePage = lazy(() => import('./site/GuidePage.tsx').then((m) => ({ default: m.GuidePage })));
const DownloadsPage = lazy(() => import('./site/DownloadsPage.tsx').then((m) => ({ default: m.DownloadsPage })));

// Opened straight on the Atelier or the catalogue: start fetching them and the fonts now, alongside the shell.
if (/^#\/(atelier|catalogue)/.test(location.hash)) {
  void import(location.hash.startsWith('#/atelier') ? './Atelier.tsx' : './site/CataloguePage.tsx');
  void loadBrandFonts();
}

const PAGES = [
  ['atelier', 'Atelier'],
  ['catalogue', 'Catalogue'],
  ['map', 'Map'],
  ['guide', 'Guide'],
  ['downloads', 'Downloads'],
] as const;

export function Loading({ what }: { what: string }) {
  return (
    <div className="loading" role="status">
      <span className="loading__mark" aria-hidden="true" />
      <span>Opening {what}…</span>
    </div>
  );
}

export function App() {
  const [route] = useRoute();
  const inAtelier = route.page === 'atelier';
  // The Atelier stays mounted once opened: work in progress survives a visit to another page.
  const [atelierOpened, setAtelierOpened] = useState(inAtelier);
  useEffect(() => {
    if (inAtelier) setAtelierOpened(true);
  }, [inAtelier]);
  // Load it in the background once the page is quiet, so opening it later is instant.
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 2500));
    idle(() => void import('./Atelier.tsx'));
  }, []);

  // A veil passes between pages: not on arrival, and never for visitors who ask for less motion.
  const [passage, setPassage] = useState(0);
  const lastPage = useRef(route.page);
  useEffect(() => {
    if (route.page === lastPage.current) return;
    lastPage.current = route.page;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPassage((n) => n + 1);
  }, [route.page]);

  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => setMenu(false), [route.page, route.arg]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      menuButton.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  return (
    <div className={`app${inAtelier ? ' app--atelier' : ''}`}>
      <a className="skip" href={inAtelier ? '#atelier-main' : '#site-main'} onClick={(e) => {
        e.preventDefault();
        document.getElementById(inAtelier ? 'atelier-main' : 'site-main')?.focus();
      }}>
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="#/" aria-label="The Olympus — home">
          <img className="brand__seal" src="files/assets/master/web/favicon.svg" alt="" width="30" height="30" />
          <span className="brand__name">The Olympus</span>
        </a>
        <button ref={menuButton} type="button" className="menu-toggle" aria-expanded={menu} aria-controls="site-nav" onClick={() => setMenu((m) => !m)}>
          <Icon name={menu ? 'close' : 'menu'} />
          <span className="visually-hidden">{menu ? 'Close the menu' : 'Menu'}</span>
        </button>
        <nav id="site-nav" className={`sitenav${menu ? ' is-open' : ''}`} aria-label="Site">
          {PAGES.map(([page, label]) => (
            <a key={page} href={`#/${page}`} aria-current={route.page === page ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </header>

      {passage > 0 && (
        <div key={passage} className="veil" aria-hidden="true" onAnimationEnd={() => setPassage(0)}>
          <img src="files/assets/master/web/favicon.svg" alt="" width="56" height="56" />
        </div>
      )}

      {atelierOpened && (
        <Suspense fallback={inAtelier ? <Loading what="the Atelier" /> : null}>
          <Atelier active={inAtelier} />
        </Suspense>
      )}

      {!inAtelier && (
        <main className={`site${route.page === 'map' ? ' site--map' : ''}`} id="site-main" tabIndex={-1}>
          <Suspense fallback={<Loading what={route.page === 'home' ? 'the page' : `the ${route.page}`} />}>
            {route.page === 'home' && <HomePage />}
            {route.page === 'catalogue' && <CataloguePage />}
            {route.page === 'map' && <MapPage arg={route.arg} />}
            {route.page === 'guide' && <GuidePage doc={route.arg} />}
            {route.page === 'downloads' && <DownloadsPage />}
          </Suspense>
        </main>
      )}
    </div>
  );
}
