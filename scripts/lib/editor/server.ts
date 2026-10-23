// The map's edit API: the one part of the site that is not a static file. It
// reads the merged catalogue and the map for anyone, and — with the house's
// password, a session cookie and the page's token — saves services, machines
// and places into the server's data folder, one write at a time. The site's
// own server (scripts/serve.ts) mounts it under /api/ and is told of every
// change, so the house is rebuilt for it at once.
//
//   GET    /api/map /api/catalog /api/session
//   POST   /api/login /api/logout
//   PUT    /api/services/<id>   { spec, logoSvg? }
//   PUT    /api/machines/<id>   { spec, logoSvg? }
//   PUT    /api/places/<id>     { place | null }
//   DELETE /api/services/<id>   /api/machines/<id>
//
// Node's own modules only (besides the house's), like the automatic rebuild.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog, CATALOG_DIR, LOGO_MAX_BYTES } from '../../../src/node/catalog.ts';
import { dataLogo, loadMachines, loadPlaces, removeItem, saveMachine, savePlace, saveService } from '../../../src/node/data.ts';
import { ID, SPEC_KEYS, validateSpec } from '../../../src/catalog/service.ts';
import { validateMachine } from '../../../src/catalog/machine.ts';
import { validatePlace } from '../../../src/map/places.ts';
import { island } from '../../../src/node/island.ts';
import { mapData, sealPath } from '../../../src/map/items.ts';
import { building } from '../../../src/map/buildings/index.ts';
import { importLogo } from '../../../src/geometry/logo.ts';
import { Sessions, Throttle, checkPassword, hasPassword, setPassword } from './auth.ts';

export { setPassword, hasPassword };

const BODY_MAX = 600 * 1024;
const COOKIE = 'olympus_session';
/** The repository: its own assets/, where a seal is when no built site is named. */
const REPO = join(import.meta.dirname, '..', '..', '..');

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * A logo the house will draw and serve: an SVG with shapes and nothing that
 * runs or reaches out — no scripts, handlers, external links, foreign content
 * or entities. The same importer as the command line must accept it.
 */
export function checkLogo(svg: string): void {
  if (svg.length > LOGO_MAX_BYTES) throw new HttpError(413, `the logo is larger than ${LOGO_MAX_BYTES / 1024} KB`);
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg)) throw new HttpError(400, 'the logo must be an SVG file');
  if (/<script|<foreignObject|<iframe|<!ENTITY|<!DOCTYPE|javascript:|\son[a-z]+\s*=|<use[^>]+href\s*=\s*["'](?!#)|href\s*=\s*["'](?!#)|@import|url\(\s*['"]?(?!#)/i.test(svg)) throw new HttpError(400, 'the logo has scripts, links or embedded content: only shapes are accepted');
  try {
    if (!importLogo(svg).d) throw new Error('no shapes');
  } catch (e) {
    throw new HttpError(400, `the logo could not be read: ${(e as Error).message}`);
  }
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > BODY_MAX) {
      // Read no further; the connection closes after the answer.
      req.resume();
      throw new HttpError(413, 'too large');
    }
    chunks.push(c as Buffer);
  }
  if (!size) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new HttpError(400, 'the request must be a JSON object');
  }
}

const cookieOf = (req: IncomingMessage) => (req.headers.cookie ?? '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
const send = (res: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(value));
};

export type ApiOptions = {
  delayScale?: number;
  /** Told of each saved change (what changed); its answer — the change's number — goes back to the page, which waits for that change to be published. */
  onChange?: (what: 'place' | 'service' | 'machine' | 'removed') => number | undefined;
  /** The folder of the site being served (its files under files/), to offer only seals that are there; else the repository's own. */
  site?: () => string | null | undefined;
};
export type EditorOptions = ApiOptions & { port: number; host: string };
export type EditorApi = { handle: (req: IncomingMessage, res: ServerResponse) => Promise<void> };

/** The API, as a handler for /api/… requests: any server can mount it. */
export function createEditorApi(opts: ApiOptions = {}): EditorApi {
  const { plan } = island();
  const sessions = new Sessions();
  const throttle = new Throttle(opts.delayScale ?? 1);
  let queue: Promise<unknown> = Promise.resolve();
  /** Writes happen one after the other: no two writes of places.json overlap. */
  const serial = <T>(fn: () => T): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  };

  const live = () => {
    const services = loadCatalog();
    const machines = loadMachines();
    const logos = new Set([...services, ...machines].filter((x) => x.logo && (dataLogo(x.id) || existsSync(join(CATALOG_DIR, x.logo)))).map((x) => x.id));
    const site = opts.site?.();
    const sealed = (id: string) => existsSync(site ? join(site, sealPath(id)) : join(REPO, sealPath(id).replace(/^files\//, '')));
    return { services, machines, data: mapData(services, machines, loadPlaces(), plan, logos, sealed) };
  };
  const logoText = (id: string, logo: string | undefined) => {
    if (!logo) return null;
    const file = dataLogo(id) ?? join(CATALOG_DIR, logo);
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  };

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://editor');
    const path = url.pathname.replace(/\/+$/, '');
    const method = req.method ?? 'GET';

    if (method === 'GET' && path === '/api/map') {
      const { data } = live();
      // A spot chosen for the owner is kept from the first time it is shown: adding a service never moves the others.
      const auto = data.items.filter((e) => e.placed === 'auto');
      if (auto.length) await serial(() => {
        for (const e of auto) savePlace(e.id, e.place);
      });
      return send(res, 200, data);
    }
    if (method === 'GET' && path === '/api/catalog') {
      const { services } = live();
      const specs = services.map((s) => Object.fromEntries(SPEC_KEYS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])));
      const logos: Record<string, string> = {};
      for (const s of services) {
        const t = logoText(s.id, s.logo);
        if (t) logos[s.id] = t;
      }
      return send(res, 200, { services: specs, logos });
    }
    if (method === 'GET' && path === '/api/session') {
      const s = sessions.get(cookieOf(req));
      return send(res, 200, s ? { editing: true, csrf: s.csrf } : { editing: false, ...(hasPassword() ? {} : { setup: 'npm run editor -- password' }) });
    }
    // A write (signing in included) must come from this site: a page elsewhere is refused, whatever cookies the browser holds.
    if (method !== 'GET' && method !== 'HEAD' && typeof req.headers.origin === 'string') {
      const here = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '');
      let there = '';
      try {
        there = new URL(req.headers.origin).host;
      } catch {
        /* not a URL: refused below */
      }
      if (there !== here) throw new HttpError(403, 'this request did not come from the map page');
    }
    if (method === 'POST' && path === '/api/login') {
      const { password } = await body(req);
      const ok = await throttle.attempt(() => (typeof password === 'string' ? checkPassword(password) : Promise.resolve(false)));
      if (!ok) return send(res, 401, { error: hasPassword() ? 'wrong password' : 'no password is set on the server yet: npm run editor -- password' });
      const { token, session } = sessions.open();
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      return send(res, 200, { csrf: session.csrf }, { 'set-cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${Sessions.maxAge}${secure}` });
    }

    // Everything below writes: the session and the page's token, both.
    const token = cookieOf(req);
    const session = sessions.get(token);
    if (!session) throw new HttpError(401, 'sign in to edit the map');
    if (req.headers['x-olympus-csrf'] !== session.csrf) throw new HttpError(403, 'this request did not come from the map page');
    if (method === 'POST' && path === '/api/logout') {
      sessions.close(token);
      return send(res, 200, { ok: true }, { 'set-cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0` });
    }
    const m = path.match(/^\/api\/(services|machines|places)\/([^/]+)$/);
    if (!m) throw new HttpError(404, 'no such thing');
    const [, what, id] = m;
    if (!ID.test(id)) throw new HttpError(400, `"${id}" is not an id`);
    const b = method === 'DELETE' ? {} : await body(req);
    if (what === 'places' && method === 'PUT') {
      const place = b.place === null ? null : validated(() => validatePlace(b.place));
      if (place && !building(place.building)) throw new HttpError(400, `there is no building "${place.building}"`);
      await serial(() => savePlace(id, place));
      return send(res, 200, { ok: true, change: opts.onChange?.('place') });
    }
    const kind = what === 'services' ? 'service' : 'machine';
    if (method === 'DELETE' && what !== 'places') {
      await serial(() => removeItem(kind, id));
      return send(res, 200, { ok: true, change: opts.onChange?.('removed') });
    }
    if (method !== 'PUT') throw new HttpError(405, 'not allowed');
    const raw = b.spec as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== 'object') throw new HttpError(400, 'a "spec" is needed');
    if (raw.id !== id) throw new HttpError(400, `the address names "${id}" but the spec is "${String(raw.id)}"`);
    const logoSvg = typeof b.logoSvg === 'string' ? b.logoSvg : undefined;
    if (logoSvg !== undefined) {
      checkLogo(logoSvg);
      raw.logo = `logos/${id}.svg`;
    }
    // An item's logo is its own file; naming another's would leave the catalogue unreadable.
    if (raw.logo !== undefined && raw.logo !== `logos/${id}.svg`) throw new HttpError(400, `a logo is kept as logos/${id}.svg`);
    const spec = validated(() => (kind === 'service' ? validateSpec(raw) : validateMachine(raw)));
    if (spec.logo && logoSvg === undefined && !dataLogo(id) && !existsSync(join(CATALOG_DIR, spec.logo))) throw new HttpError(400, `the logo ${spec.logo} does not exist: send it with the spec`);
    await serial(() => (kind === 'service' ? saveService(spec as never, logoSvg) : saveMachine(spec as never, logoSvg)));
    return send(res, 200, { ok: true, change: opts.onChange?.(kind) });
  }

  const validated = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  };

  return {
    handle: (req, res) =>
      route(req, res).catch((e: unknown) => {
        const status = e instanceof HttpError ? e.status : 500;
        // An unexpected failure is logged here and answered plainly: no paths or stack reach the page.
        if (status === 500) console.error(e);
        if (!res.headersSent) send(res, status, { error: status === 500 ? 'the server could not do that; its log says why' : e instanceof Error ? e.message : String(e) }, status === 413 ? { connection: 'close' } : {});
        else res.end();
      }),
  };
}

/** The API on a server of its own (the tests use it; the site's server mounts the handler itself). */
export async function createEditor(opts: EditorOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const api = createEditorApi(opts);
  const server = createServer((req, res) => void api.handle(req, res));
  await new Promise<void>((r) => server.listen(opts.port, opts.host, r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://${opts.host}:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
