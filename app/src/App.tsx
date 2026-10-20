import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { productionSvg } from '../../src/render/svg.ts';
import { slugify } from '../../src/catalog/service.ts';
import { designFile, libraryFile, parseDesigns, type Design } from '../../src/catalog/design.ts';
import type { MarkKey } from '../../src/catalog/fileset.ts';
import type { Mark } from '../../src/geometry/crest.ts';
import { HOUSE, loadLibrary, newKey, nowIso, saveLibrary, type Saved } from './library.ts';
import { MASTER, draftOf, letteringIssues, marksFor, newDraft, printFor, readLogo, renderableService, specIssues, type Draft } from './model.ts';
import { DEFAULT_SETTINGS, defaults, type ParamKey, type Params, type PrintSettings, type ProductId } from '../../src/manufacturing/products.ts';
import type { Subject } from '../../src/manufacturing/files.ts';
import { DOMAIN } from '../../src/brand/identity.ts';
import type { BuildRequest, BuildResult } from './model-worker.ts';
import { STICKER_DEFAULTS, type Paper, type StickerSpec } from '../../src/manufacturing/stickers.ts';
import { StickerView } from './components/StickerView.tsx';
import { useRoute } from './site/files.ts';
import { HomePage } from './site/HomePage.tsx';
import { CataloguePage } from './site/CataloguePage.tsx';
import { GuidePage } from './site/GuidePage.tsx';
import { DownloadsPage } from './site/DownloadsPage.tsx';
import { StickerPanel, type StickerBuild } from './components/StickerPanel.tsx';
import { ModelView } from './components/ModelView.tsx';
import { ModelPanel, type ModelBuild } from './components/ModelPanel.tsx';
import { assetPack, download } from './exporters.ts';
import { Library, Icon, type Current, type Entry } from './components/Library.tsx';
import { Canvas, type CanvasState } from './components/Canvas.tsx';
import { Config, MasterCard } from './components/Config.tsx';
import { ExportPanel } from './components/ExportPanel.tsx';
import { SvgImage } from './components/ui.tsx';

type Open = { kind: 'master' } | { kind: 'draft'; draft: Draft; saved: string };

const SETTINGS_KEY = 'the-olympus/print-settings';
const STICKER_KEY = 'the-olympus/sticker';

/** What a save compares against: the parts of a draft that end up in the file. */
const fingerprint = (d: Draft) => JSON.stringify([d.spec, d.logoSvg ?? null]);

/** The design a draft saves as. */
function designOf(d: Draft, previous?: Design): Design {
  const now = nowIso();
  const { logo: _, ...spec } = d.spec;
  return {
    spec: d.logoSvg ? { ...spec, logo: `logos/${spec.id}.svg` } : spec,
    logoSvg: d.logoSvg,
    version: previous ? previous.version + 1 : 1,
    created: previous?.created ?? now,
    updated: now,
  };
}

export function App() {
  const [route, navigate] = useRoute();
  const initial = useMemo(() => loadLibrary(), []);
  const [mine, setMine] = useState<Saved>(initial.designs);
  const [storageOk, setStorageOk] = useState(initial.available);
  const [open, setOpen] = useState<Open>({ kind: 'master' });
  const [canvas, setCanvas] = useState<CanvasState>({ view: 'crest', edition: 'fine', surface: 'flat', ground: 'light' });
  const [toast, setToast] = useState<string | null>(null);
  const [packProgress, setPackProgress] = useState<number | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [product, setProduct] = useState<ProductId>('medallion');
  const [overrides, setOverrides] = useState<Partial<Record<ProductId, Params>>>({});
  const [build, setBuild] = useState<ModelBuild | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);

  const persist = useCallback(
    (next: Saved) => {
      setMine(next);
      const ok = saveLibrary(next);
      setStorageOk(ok);
      if (!ok) say('This browser refused to store the library — export it to keep your designs.');
    },
    [say],
  );

  const dirty = open.kind === 'draft' && fingerprint(open.draft) !== open.saved;
  const guard = () => !dirty || window.confirm('Discard the unsaved changes to this design?');

  /* ---------- the open design, rendered ---------- */
  const draft = open.kind === 'draft' ? open.draft : null;
  const service = useMemo(() => (draft ? renderableService(draft.spec) : null), [draft]);
  const logo = useMemo(() => readLogo(draft?.logoSvg), [draft?.logoSvg]);
  const logoD = logo && 'd' in logo ? logo.d : undefined;
  const marks: Partial<Record<MarkKey, Mark>> = useMemo(() => (service ? marksFor(service, logoD) : MASTER.marks()), [service, logoD]);
  const print = useMemo(() => (service ? printFor(service.patron) : null), [service]);
  const issues = useMemo(() => (draft ? specIssues(draft.spec) : []), [draft]);
  const idClash = draft && Object.entries(mine).some(([k, d]) => d.spec.id === draft.spec.id && !(draft.origin.kind === 'mine' && draft.origin.key === k));
  const warnings = useMemo(() => {
    if (!service) return [];
    const w = letteringIssues(service);
    if (logo && 'warnings' in logo) w.push(...logo.warnings.map((x) => `Logo: ${x}.`));
    if (print && !print.ok) w.push(`The print edition loses detail at the 0.4 mm nozzle minimum.`);
    if (idClash) w.push(`Another of your designs already uses the identifier “${draft!.spec.id}”; exports would share file names.`);
    return w;
  }, [service, logo, print, idClash, draft]);

  /* ---------- the printable model (built in a worker) ---------- */
  const showModel = canvas.view === 'model';
  const subject = useMemo<Subject>(
    () => (service ? { id: service.id, title: `The Olympus — ${service.name}`, name: service.name, caption: service.caption, url: service.url } : { id: 'master', title: 'The Olympus', name: 'The Olympus', caption: DOMAIN, url: `https://${DOMAIN}` }),
    [service?.id, service?.name, service?.caption, service?.url],
  );
  const patron = service?.patron;
  const [settings, setSettings] = useState<PrintSettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* a convenience only */
    }
  }, [settings]);
  const [suggested, setSuggested] = useState<{ product: ProductId; values: Required<Params>; markMin: number | null } | null>(null);
  // One worker builds both models and stickers; each kind drops replies older than its latest request.
  const worker = useRef<Worker | null>(null);
  const latest = useRef({ model: 0, sticker: 0 });
  const handlers = useRef<{ model?: (r: BuildResult) => void; sticker?: (r: BuildResult) => void }>({});
  const send = (msg: BuildRequest) => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./model-worker.ts', import.meta.url), { type: 'module' });
      worker.current.onmessage = (e: MessageEvent<BuildResult>) => {
        const r = e.data;
        if (r.req === latest.current[r.kind]) handlers.current[r.kind]?.(r);
      };
    }
    worker.current.postMessage(msg);
  };
  const requestKey = JSON.stringify([subject, patron ?? null, product, overrides[product] ?? {}, overrides.medallion ?? {}, settings]);
  useEffect(() => {
    if (!showModel) return;
    setBuilding(true);
    const t = window.setTimeout(() => {
      const req = ++latest.current.model;
      handlers.current.model = (r) => {
        setBuilding(false);
        if (r.ok && r.kind === 'model') {
          setBuild({ model: r.model, files: r.files, base: r.base });
          setSuggested({ product: r.model.product, values: r.suggested, markMin: r.markMin });
          setBuildError(null);
        } else if (!r.ok) {
          setBuild(null);
          setBuildError(`The model could not be built: ${r.error}`);
        }
      };
      const [subj, pat, prod, own, med, set] = JSON.parse(requestKey);
      send({ kind: 'model', req, subject: subj, patron: pat ?? undefined, product: prod, overrides: own, medallion: med, settings: set });
    }, 150);
    return () => window.clearTimeout(t);
  }, [showModel, requestKey]);

  /* ---------- the sticker (built in the same worker) ---------- */
  const showSticker = canvas.view === 'sticker';
  const [stickerSpec, setStickerSpec] = useState<StickerSpec>(() => {
    try {
      return { ...STICKER_DEFAULTS, ...JSON.parse(localStorage.getItem(STICKER_KEY) ?? '{}') };
    } catch {
      return STICKER_DEFAULTS;
    }
  });
  const [paper, setPaper] = useState<Paper>('a4');
  const [stickerBuild, setStickerBuild] = useState<StickerBuild | null>(null);
  const [stickerError, setStickerError] = useState<string | null>(null);
  const [stickerBusy, setStickerBusy] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(STICKER_KEY, JSON.stringify(stickerSpec));
    } catch {
      /* a convenience only */
    }
  }, [stickerSpec]);
  const stickerKey = JSON.stringify([subject, patron ?? null, stickerSpec, paper]);
  useEffect(() => {
    if (!showSticker) return;
    setStickerBusy(true);
    const t = window.setTimeout(() => {
      const req = ++latest.current.sticker;
      handlers.current.sticker = (r) => {
        setStickerBusy(false);
        if (r.ok && r.kind === 'sticker') {
          setStickerBuild({ sticker: r.sticker, files: r.files, base: r.base, perSheet: r.perSheet, previews: r.previews });
          setStickerError(null);
        } else if (!r.ok) {
          setStickerBuild(null);
          setStickerError(`The sticker could not be built: ${r.error}`);
        }
      };
      const [subj, pat, spec, pap] = JSON.parse(stickerKey);
      send({ kind: 'sticker', req, subject: subj, patron: pat ?? undefined, spec, paper: pap });
    }, 150);
    return () => window.clearTimeout(t);
  }, [showSticker, stickerKey]);
  useEffect(() => () => worker.current?.terminate(), []);
  const values = { ...(suggested?.product === product ? suggested.values : defaults(product)), ...overrides[product] } as Record<ParamKey, number>;

  const current: Current = open.kind === 'master' ? { kind: 'master' } : open.draft.origin.kind === 'house' ? { kind: 'house', id: open.draft.origin.id } : open.draft.origin.kind === 'mine' ? { kind: 'mine', key: open.draft.origin.key } : { kind: 'new' };

  /* ---------- actions ---------- */
  const openDraft = (d: Draft) => setOpen({ kind: 'draft', draft: d, saved: fingerprint(d) });

  const onNew = () => {
    if (!guard()) return;
    const d = newDraft();
    setOpen({ kind: 'draft', draft: d, saved: '' });
    setCanvas((c) => ({ ...c, view: 'crest' }));
  };

  const onOpen = (e: Entry) => {
    if (!guard()) return;
    openDraft(draftOf(e.design, e.kind === 'house' ? { kind: 'house', id: e.id } : { kind: 'mine', key: e.key }));
  };

  const onDuplicate = (e: Entry) => {
    if (!guard()) return;
    const name = `${e.design.spec.name} copy`;
    const copy: Design = { ...e.design, spec: { ...e.design.spec, name, id: slugify(name) }, version: 1, created: nowIso(), updated: nowIso() };
    const key = newKey();
    persist({ ...mine, [key]: copy });
    openDraft(draftOf(copy, { kind: 'mine', key }));
    say(`Duplicated as “${name}”.`);
  };

  const onDelete = (key: string) => {
    const d = mine[key];
    if (!d || !window.confirm(`Delete “${d.spec.name}” from your designs? This cannot be undone.`)) return;
    const { [key]: _, ...rest } = mine;
    persist(rest);
    if (current.kind === 'mine' && current.key === key) setOpen({ kind: 'master' });
    say(`Deleted “${d.spec.name}”.`);
  };

  const onSave = () => {
    if (!draft || issues.length) return;
    const key = draft.origin.kind === 'mine' ? draft.origin.key : newKey();
    const design = designOf(draft, draft.origin.kind === 'mine' ? mine[key] : undefined);
    persist({ ...mine, [key]: design });
    openDraft({ ...draft, origin: { kind: 'mine', key } });
    say(draft.origin.kind === 'mine' ? `Saved — version ${design.version}.` : `Saved to your designs.`);
  };

  const onRevert = () => {
    if (!draft || !window.confirm('Discard the unsaved changes?')) return;
    const o = draft.origin;
    if (o.kind === 'mine' && mine[o.key]) openDraft(draftOf(mine[o.key], o));
    else if (o.kind === 'house') {
      const h = HOUSE.find((x) => x.spec.id === o.id);
      if (h) openDraft(draftOf(h, o));
    } else setOpen({ kind: 'draft', draft: newDraft(), saved: '' });
  };

  const exportDesign = (d: Design) => download(`${d.spec.id}.olympus.json`, designFile(d), 'application/json');

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const designs = parseDesigns(await file.text(), nowIso());
      const next = { ...mine };
      let firstKey = '';
      for (const d of designs) {
        const key = newKey();
        next[key] = d;
        firstKey ||= key;
      }
      persist(next);
      if (designs.length === 1 && guard()) openDraft(draftOf(designs[0], { kind: 'mine', key: firstKey }));
      say(`Imported ${designs.length} design${designs.length === 1 ? '' : 's'}.`);
    } catch (e) {
      say(`Import failed: ${(e as Error).message}`);
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const onExportLibrary = () => {
    const list = Object.values(mine);
    if (!list.length) return say('There are no saved designs to export yet.');
    download(`the-olympus-library-${nowIso().slice(0, 10)}.json`, libraryFile(list, nowIso()), 'application/json');
  };

  const onPack = draft && service
    ? async () => {
        setPackProgress(0);
        try {
          const zip = await assetPack(designOf(draft), service, marks as Record<MarkKey, Mark>, print!, warnings, (done, total) => setPackProgress(done / total));
          download(`the-olympus-${service.id}.zip`, zip, 'application/zip');
          say('Asset pack ready.');
        } finally {
          setPackProgress(null);
        }
      }
    : null;

  // Ctrl/Cmd + S saves.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  // Lockups need a service name: the master falls back to the crest.
  useEffect(() => {
    if (open.kind === 'master' && canvas.view.startsWith('lockup')) setCanvas((c) => ({ ...c, view: 'crest' }));
  }, [open.kind, canvas.view]);

  const savedDesign = draft?.origin.kind === 'mine' ? mine[draft.origin.key] : undefined;
  const status = !draft
    ? 'The master · read-only'
    : dirty
      ? draft.origin.kind === 'house'
        ? 'Edited · saving makes it one of your designs'
        : 'Unsaved changes'
      : savedDesign
        ? `Saved · version ${savedDesign.version}`
        : draft.origin.kind === 'house'
          ? 'House catalogue · read-only until saved as yours'
          : 'Not saved yet';

  const inAtelier = route.page === 'atelier';
  return (
    <div className={`app${inAtelier ? '' : ' app--page'}`}>
      <header className="topbar">
        <a className="brand" href="#/" aria-label="The Olympus — home">
          <SvgImage className="brand__seal" svg={productionSvg(MASTER.marks().seal, { ground: 'transparent' })} alt="" />
          <span className="brand__name">The Olympus</span>
        </a>
        <nav className="sitenav" aria-label="Site">
          {(
            [
              ['atelier', 'Atelier'],
              ['catalogue', 'Catalogue'],
              ['guide', 'Guide'],
              ['downloads', 'Downloads'],
            ] as const
          ).map(([page, label]) => (
            <a key={page} href={`#/${page}`} aria-current={route.page === page ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <div className="topbar__actions" hidden={!inAtelier}>
          <button type="button" className="btn btn--ghost" onClick={() => importRef.current?.click()}>
            <Icon name="upload" /> Import
          </button>
          <button type="button" className="btn btn--ghost" onClick={onExportLibrary}>
            <Icon name="download" /> Export library
          </button>
          <button type="button" className="btn btn--primary" onClick={onNew}>
            <Icon name="plus" /> New design
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
      </header>

      <Library
        house={HOUSE}
        mine={mine}
        current={current}
        storageAvailable={storageOk}
        onOpenMaster={() => guard() && setOpen({ kind: 'master' })}
        onOpen={onOpen}
        onDuplicate={onDuplicate}
        onExport={(e) => exportDesign(e.design)}
        onDelete={onDelete}
      />

      <Canvas
        model={<ModelView model={build && build.model.product === product ? build.model : null} busy={building} layer={settings.layer} />}
        sticker={<StickerView build={stickerBuild} busy={stickerBusy} />}
        state={canvas}
        onChange={setCanvas}
        marks={marks}
        isMaster={!draft}
        name={service?.name ?? 'The Olympus'}
        print={print}
      />

      <div className="side">
        <div className="side__scroll">
          {showModel && (
            <ModelPanel
              product={product}
              values={values}
              build={build && build.model.product === product ? build : null}
              error={buildError}
              markMin={suggested?.product === product ? suggested.markMin : null}
              settings={settings}
              onSettings={setSettings}
              onProduct={setProduct}
              onParam={(k, v) => setOverrides((o) => ({ ...o, [product]: { ...o[product], [k]: v } }))}
              onReset={() => setOverrides((o) => ({ ...o, [product]: {} }))}
            />
          )}
          {draft && service ? <Config draft={draft} service={service} logo={logo} issues={issues} warnings={warnings} onChange={(d) => setOpen({ ...open, kind: 'draft', draft: d, saved: open.kind === 'draft' ? open.saved : '' })} /> : <MasterCard onNew={onNew} />}
          {showSticker && <StickerPanel spec={stickerSpec} paper={paper} build={stickerBuild} error={stickerError} onSpec={setStickerSpec} onPaper={setPaper} />}
          {!showModel && !showSticker && <ExportPanel
            canvas={canvas}
            marks={marks}
            id={service?.id ?? 'master'}
            name={service?.name ?? 'Master'}
            onPack={onPack}
            onDesignFile={draft ? () => exportDesign(designOf(draft, savedDesign)) : null}
            packProgress={packProgress}
            disabledReason={issues.length ? 'Fix the problems above before exporting the pack.' : null}
          />}
        </div>
        <footer className="savebar">
          <span className={`savebar__status${dirty ? ' is-dirty' : ''}`} aria-live="polite">
            {status}
          </span>
          {draft && (
            <span className="savebar__actions">
              {dirty && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={onRevert}>
                  Discard
                </button>
              )}
              <button type="button" className="btn btn--primary btn--sm" disabled={issues.length > 0 || (!dirty && draft.origin.kind === 'mine')} onClick={onSave} title={issues.length ? 'Fix the problems above first' : 'Ctrl+S'}>
                {draft.origin.kind === 'mine' ? 'Save' : 'Save as mine'}
              </button>
            </span>
          )}
        </footer>
      </div>

      {!inAtelier && (
        <main className="site">
          {route.page === 'home' && <HomePage />}
          {route.page === 'catalogue' && (
            <CataloguePage
              mine={mine}
              onOpen={(e) => {
                navigate('#/atelier');
                onOpen(e);
              }}
            />
          )}
          {route.page === 'guide' && <GuidePage doc={route.arg} />}
          {route.page === 'downloads' && <DownloadsPage />}
        </main>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
