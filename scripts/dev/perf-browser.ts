// Dev only: the site measured in Chrome — each page at desktop, tablet and
// phone sizes (the phone with its CPU slowed four times): timings, what is
// downloaded, script and layout time, the JavaScript heap; and for the map,
// how long until it can be used and how much it works while nothing moves.
//
//   node scripts/dev/perf-browser.ts <url> [out.json]
//
// Chrome draws WebGL here in software (SwiftShader): frame times are not a
// graphics card's; the CPU-side numbers (script, layout, idle work) are real.

import { writeFileSync } from 'node:fs';
import { chromium, type CDPSession } from 'playwright-core';

const [url = 'http://127.0.0.1:4173/', out] = process.argv.slice(2);
const SIZES = [
  { name: 'desktop', width: 1440, height: 900, mobile: false, cpu: 1 },
  { name: 'tablet', width: 768, height: 1024, mobile: true, cpu: 2 },
  { name: 'phone', width: 390, height: 844, mobile: true, cpu: 4 },
];
const PAGES = [
  { name: 'home', hash: '#/', ready: '.home, main' },
  { name: 'map', hash: '#/map', ready: '[data-phase="overview"], [data-phase="still"]' },
  { name: 'catalogue', hash: '#/catalogue', ready: 'main' },
  { name: 'atelier', hash: '#/atelier', ready: '#atelier-main' },
];

type Result = Record<string, unknown>;
const results: Result[] = [];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-precise-memory-info'] });

const metrics = async (cdp: CDPSession) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m: { name: string; value: number }) => [m.name, m.value]));

for (const size of SIZES)
  for (const pg of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Network.enable');
    if (size.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: size.cpu });
    const bytes: Record<string, number> = {};
    let requests = 0;
    const kinds = new Map<string, string>();
    cdp.on('Network.responseReceived', (e: { requestId: string; type: string }) => kinds.set(e.requestId, e.type));
    cdp.on('Network.loadingFinished', (e: { requestId: string; encodedDataLength: number }) => {
      requests++;
      const k = kinds.get(e.requestId) ?? 'Other';
      bytes[k] = (bytes[k] ?? 0) + e.encodedDataLength;
    });
    // The map's introduction is skipped (seen already this visit): the measure is of the map itself.
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('olympus-map-seen', '1');
      } catch {
        /* none */
      }
      (window as unknown as { __lcp: number }).__lcp = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) (window as unknown as { __lcp: number }).__lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const t0 = Date.now();
    await page.goto(url + pg.hash, { waitUntil: 'load' });
    const loaded = Date.now() - t0;
    let ready: number | null = null;
    try {
      await page.locator(pg.ready).first().waitFor({ timeout: 240_000 });
      ready = Date.now() - t0;
    } catch {
      ready = null;
    }
    await page.waitForTimeout(2500);
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
      return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp && Math.round(fcp), lcp: Math.round((window as unknown as { __lcp: number }).__lcp) };
    });
    const m1 = await metrics(cdp);
    // Ten seconds with nothing touched: how much the page still works.
    const s0 = pg.name === 'map' ? await page.evaluate(() => (window as unknown as { olympusMapStats?: () => { frames?: number } }).olympusMapStats?.()) : null;
    await page.waitForTimeout(10_000);
    const m2 = await metrics(cdp);
    const s1 = pg.name === 'map' ? await page.evaluate(() => (window as unknown as { olympusMapStats?: () => unknown }).olympusMapStats?.()) : null;
    const r: Result = {
      size: size.name,
      page: pg.name,
      loadMs: loaded,
      readyMs: ready,
      ...nav,
      requests,
      kb: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)])),
      totalKb: Math.round(Object.values(bytes).reduce((a, b) => a + b, 0) / 1024),
      scriptMs: Math.round(m1.ScriptDuration * 1000),
      taskMs: Math.round(m1.TaskDuration * 1000),
      layoutMs: Math.round(m1.LayoutDuration * 1000),
      heapMb: Math.round((m1.JSHeapUsedSize / 1048576) * 10) / 10,
      idleTaskMsPer10s: Math.round((m2.TaskDuration - m1.TaskDuration) * 1000),
      idleScriptMsPer10s: Math.round((m2.ScriptDuration - m1.ScriptDuration) * 1000),
      ...(pg.name === 'map' ? { mapStart: s0, mapAfterIdle: s1 } : {}),
    };
    results.push(r);
    console.log(JSON.stringify(r));
    await Promise.race([ctx.close(), new Promise((res) => setTimeout(res, 3000))]);
  }
if (out) writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(0);
