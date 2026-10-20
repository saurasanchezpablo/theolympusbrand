// Every page of the site at phone, tablet, laptop and desktop sizes: no
// sideways scrolling, nothing failing to load, no console errors, and an
// accessibility audit (axe-core) of each page. Screenshots on request.
//
//   npm run site && npm run app:viewports [-- --shots <dir>] [-- --url http://server:8080]
//
// Fails on overflow, console errors, failed requests, and serious or critical
// accessibility violations.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { ROOT } from './lib/build-service.ts';

const PORT = 4180;
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : null;
};
const REMOTE = arg('url')?.replace(/\/?$/, '/') ?? null;
const URL_ = REMOTE ?? `http://127.0.0.1:${PORT}/`;
const SHOTS = arg('shots');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

export const VIEWPORTS = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const ROUTES = [
  { name: 'home', hash: '#/', ready: 'main h1' },
  { name: 'atelier', hash: '#/atelier', ready: '.stage__mark' },
  { name: 'catalogue', hash: '#/catalogue', ready: '.card' },
  { name: 'guide', hash: '#/guide', ready: '.guide__doc h1, .doc h1, article h1' },
  { name: 'downloads', hash: '#/downloads', ready: '.dl' },
];

const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && existsSync(p));
if (!chrome) throw new Error('No Chrome or Chromium found — set CHROME_PATH.');
if (!REMOTE && !existsSync(join(ROOT, 'app', 'dist', 'index.html'))) throw new Error('Build the site first: npm run site');
const server = REMOTE ? null : spawn(join(ROOT, 'node_modules/.bin/vite'), ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => server?.kill());
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(URL_)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 100));
}

type Finding = { page: string; viewport: string; kind: string; detail: string };
const findings: Finding[] = [];

// The stylesheets as built, libraries' own CSS included: still grayscale.
if (!REMOTE) {
  const dir = join(ROOT, 'app', 'dist', 'assets');
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(join(dir, name), 'utf8');
    for (const [hex] of css.matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1);
      if (h.slice(0, 2) !== h.slice(2, 4) || h.slice(2, 4) !== h.slice(4, 6)) findings.push({ page: name, viewport: 'build', kind: 'colour with a hue', detail: hex });
    }
    for (const [fn] of css.matchAll(/\b(?:hsla?|hwb|oklab|oklch|lab|lch)\([^)]*\)/g)) if (!/^\w+\(\s*[\d.]+%?\s+0%?\s/.test(fn)) findings.push({ page: name, viewport: 'build', kind: 'colour with a hue', detail: fn });
  }
}
const axeNotes = new Map<string, { impact: string; help: string; pages: Set<string>; nodes: number }>();

/** Elements wider than the viewport, by their selector, when the page scrolls sideways. */
const overflow = (page: Page) =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= w + 1) return [];
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.right > w + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
        out.push(`${el.tagName.toLowerCase()}${id}${cls} (right ${Math.round(r.right)} > ${w})`);
      }
    }
    return out.slice(0, 6);
  });

/**
 * Content cut off inside a container that clips or scrolls sideways — the
 * page does not scroll, but something cannot be seen. Frames meant to scroll
 * (tables, code, previews, drawers off screen) are left out.
 */
const clipped = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (!el.offsetParent || el.closest('[hidden], .visually-hidden, .library, pre, [role=region], .stage, .layers, .band, .pantheon__viewport, .ascent, .hero__frame')) continue;
      const cs = getComputedStyle(el);
      if (!/(hidden|auto|scroll|clip)/.test(cs.overflowX) || el.scrollWidth <= el.clientWidth + 2) continue;
      if (cs.textOverflow === 'ellipsis') continue;
      const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
      out.push(`${el.tagName.toLowerCase()}${cls} (content ${el.scrollWidth}px in ${el.clientWidth}px)`);
    }
    return out.slice(0, 6);
  });

/** Any element drawn with a colour that is not a grey — a browser default, a library's accent. */
const hues = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (!el.getClientRects().length || el.closest('svg, canvas, img, video')) continue;
      const cs = getComputedStyle(el);
      for (const prop of ['color', 'background-color', 'border-top-color', 'outline-color'] as const) {
        const m = cs.getPropertyValue(prop).match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        if (!m || m[4] === '0') continue;
        if (m[1] !== m[2] || m[2] !== m[3]) {
          const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
          out.push(`${el.tagName.toLowerCase()}${cls} ${prop} ${m[0]}`);
        }
      }
    }
    return [...new Set(out)].slice(0, 6);
  });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
try {
  for (const motion of ['no-preference', 'reduce'] as const) {
    for (const vp of VIEWPORTS) {
      // Reduced motion: one pass at phone and desktop sizes is enough.
      if (motion === 'reduce' && vp.name !== 'phone' && vp.name !== 'desktop') continue;
      // The page's own content policy forbids injected scripts — the audit's checker is one, so it is let in here alone.
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: motion, deviceScaleFactor: 1, bypassCSP: true });
      const page = await context.newPage();
      const tag = `${vp.name}${motion === 'reduce' ? ' · reduced motion' : ''}`;
      page.on('console', (m) => m.type() === 'error' && findings.push({ page: page.url(), viewport: tag, kind: 'console error', detail: m.text() }));
      page.on('pageerror', (e) => findings.push({ page: page.url(), viewport: tag, kind: 'page error', detail: e.message }));
      page.on('response', (r) => r.status() >= 400 && findings.push({ page: page.url(), viewport: tag, kind: 'failed request', detail: `${r.status()} ${r.url()}` }));
      page.on('requestfailed', (r) => !/net::ERR_ABORTED/.test(r.failure()?.errorText ?? '') && findings.push({ page: page.url(), viewport: tag, kind: 'failed request', detail: `${r.failure()?.errorText} ${r.url()}` }));
      for (const route of ROUTES) {
        await page.goto(`${URL_}${route.hash}`);
        await page.locator(route.ready).first().waitFor({ timeout: 30000 });
        await page.waitForTimeout(400);
        for (const o of await overflow(page)) findings.push({ page: route.name, viewport: tag, kind: 'horizontal overflow', detail: o });
        for (const o of await clipped(page)) findings.push({ page: route.name, viewport: tag, kind: 'clipped content', detail: o });
        for (const o of await hues(page)) findings.push({ page: route.name, viewport: tag, kind: 'colour with a hue', detail: o });
        if (motion === 'no-preference') {
          await page.addScriptTag({ content: AXE });
          const result = await page.evaluate(async () => {
            const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; impact: string; help: string; nodes: unknown[] }[] }> } }).axe.run(document, { resultTypes: ['violations'] });
            return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
          });
          for (const v of result) {
            const n = axeNotes.get(v.id) ?? { impact: v.impact, help: v.help, pages: new Set<string>(), nodes: 0 };
            n.pages.add(`${route.name}@${vp.name}`);
            n.nodes += v.nodes;
            axeNotes.set(v.id, n);
            if (v.impact === 'serious' || v.impact === 'critical') findings.push({ page: route.name, viewport: tag, kind: `a11y ${v.impact}`, detail: `${v.id}: ${v.help} (${v.nodes})` });
          }
        }
        if (SHOTS) {
          // The site's pages scroll inside their frame: show the whole of each.
          const tall = route.name !== 'atelier' ? await page.addStyleTag({ content: '.app{height:auto!important}.site{overflow:visible!important}' }) : null;
          await page.screenshot({ path: join(SHOTS, `${route.name}-${vp.name}${motion === 'reduce' ? '-reduced' : ''}.png`), fullPage: route.name !== 'atelier' });
          await tall?.evaluate((el) => (el as Element).remove());
        }
      }
      await context.close();
    }
  }
} finally {
  // A page that drew WebGL can keep the browser from closing promptly: do not wait on it.
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
}

console.log('Accessibility (axe-core), all pages and sizes:');
if (!axeNotes.size) console.log('  no violations');
for (const [id, n] of [...axeNotes].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${n.impact.padEnd(9)} ${id} — ${n.help} · ${n.nodes} nodes · ${[...n.pages].join(', ')}`);
if (findings.length) {
  console.log(`\n✖ ${findings.length} problems:`);
  const seen = new Set<string>();
  for (const f of findings) {
    const line = `  [${f.viewport}] ${f.page}: ${f.kind} — ${f.detail}`;
    if (!seen.has(line)) console.log(line);
    seen.add(line);
  }
  process.exit(1);
}
console.log(`\n✔ ${ROUTES.length} pages × ${VIEWPORTS.length} sizes (and reduced motion at two): no overflow, no errors, no serious accessibility violations.`);
process.exit(0);
