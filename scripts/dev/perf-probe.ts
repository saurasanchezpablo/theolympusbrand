// Dev probe: how the home page and the Atelier load (first paint, heading
// shown, main-thread long tasks, bytes) at desktop and on a throttled phone.

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT } from '../lib/build-service.ts';

const PORT = 4181;
const server = spawn(join(ROOT, 'node_modules/.bin/vite'), ['preview', '--config', 'app/vite.config.ts', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
for (const profile of [{ name: 'desktop', w: 1440, h: 900, cpu: 1 }, { name: 'phone (4× CPU slowdown)', w: 360, h: 800, cpu: 4 }]) {
  for (const route of ['#/', '#/atelier']) {
    const ctx = await browser.newContext({ viewport: { width: profile.w, height: profile.h } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    let bytes = 0;
    page.on('response', async (r) => {
      const len = Number(r.headers()['content-length'] ?? 0);
      bytes += len || (await r.body().catch(() => Buffer.alloc(0))).length;
    });
    await page.addInitScript(() => {
      (window as any).__long = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => ((window as any).__long += e.duration))).observe({ type: 'longtask', buffered: true });
      (window as any).__lcp = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => ((window as any).__lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/${route}`);
    await page.locator(route === '#/' ? 'main h1' : '.stage__mark').first().waitFor({ timeout: 60000 });
    const shown = Date.now() - t0;
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0, lcp: (window as any).__lcp, long: (window as any).__long }));
    console.log(`${profile.name.padEnd(24)} ${route.padEnd(10)} content shown ${shown} ms · FCP ${Math.round(m.fcp)} · LCP ${Math.round(m.lcp)} · long tasks ${Math.round(m.long)} ms · ${(bytes / 1e6).toFixed(2)} MB`);
    await ctx.close();
  }
}
await browser.close();
process.exit(0);
