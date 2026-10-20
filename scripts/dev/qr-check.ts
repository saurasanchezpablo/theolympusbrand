// Round-trip QR codes through an independent decoder: node scripts/dev/qr-check.ts
import jsQRModule from 'jsqr';
// jsQR is CommonJS: its function is the default export at runtime.
const jsQR = ((jsQRModule as unknown as { default?: unknown }).default ?? jsQRModule) as (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null;
import { qr } from '../../src/geometry/qr.ts';
const texts = ['https://theolympus.cloud', 'https://jellyfin.theolympus.cloud', 'http://192.168.1.20:8096/web/index.html#!/home.html', 'x', 'https://home-assistant.theolympus.cloud/lovelace/dashboard?kiosk&edit=0', 'A'.repeat(150), 'b'.repeat(110), 'c'.repeat(170), 'd'.repeat(200), 'e'.repeat(260), 'f'.repeat(60), 'g'.repeat(85)];
for (const level of ['M', 'Q'] as const) {
  for (const t of texts) {
    let code;
    try { code = qr(t, level); } catch (e) { console.log(level, 'too long:', t.length); continue; }
    const scale = 6, q = 4, n = (code.size + 2 * q) * scale;
    const px = new Uint8ClampedArray(n * n * 4).fill(255);
    code.modules.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) { const o = (((r + q) * scale + y) * n + (c + q) * scale + x) * 4; px[o] = px[o + 1] = px[o + 2] = 0; }
    }));
    const got = jsQR(px, n, n);
    console.log(level, `v${code.version} mask ${code.mask}`, got?.data === t ? 'OK ' : 'FAIL', JSON.stringify(t.slice(0, 40)), got ? '' : '(no decode)');
  }
}
