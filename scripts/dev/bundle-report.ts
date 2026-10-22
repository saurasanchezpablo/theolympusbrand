// Dev only: what each chunk of the site's build is made of — the largest
// modules in each, by their size in the bundle — and which chunks each page's
// entry pulls in. node scripts/dev/bundle-report.ts [--top 8]
import { build, type Plugin } from 'vite';
import { relative } from 'node:path';

const top = Number(process.argv[process.argv.indexOf('--top') + 1]) || 8;
const ROOT = new URL('../..', import.meta.url).pathname;
const report: Plugin = {
  name: 'bundle-report',
  generateBundle(_o, bundle) {
    const chunks = Object.values(bundle).filter((c) => c.type === 'chunk').sort((a, b) => b.code.length - a.code.length);
    for (const c of chunks) {
      if (c.type !== 'chunk') continue;
      const mods = Object.entries(c.modules).sort((a, b) => b[1].renderedLength - a[1].renderedLength);
      console.log(`\n${c.fileName} ${(c.code.length / 1024).toFixed(0)} kB${c.isEntry ? ' (entry)' : c.isDynamicEntry ? ' (lazy)' : ''} · imports: ${c.imports.join(', ') || '—'}`);
      for (const [id, m] of mods.slice(0, top)) console.log(`   ${(m.renderedLength / 1024).toFixed(1).padStart(7)} kB  ${relative(ROOT, id.replace(/\?.*$/, '')).replace(/^.*node_modules\//, '~')}`);
    }
  },
};
await build({ configFile: new URL('../../app/vite.config.ts', import.meta.url).pathname, logLevel: 'warn', build: { write: false }, plugins: [report] });
