import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { fileUrl, useIndex } from './files.ts';

/** The guide: the repository's docs, rendered, with their links and pictures pointed at the site. */
export function GuidePage({ doc }: { doc?: string }) {
  const { index, error } = useIndex();
  const docs = (index?.files ?? []).filter((f) => /^docs\/[^/]+\.md$/.test(f.path)).map((f) => f.path.slice(5, -3));
  const current = doc && docs.includes(doc) ? doc : docs.find((d) => d.startsWith('02')) ?? docs[0];
  const [html, setHtml] = useState('');
  const [titles, setTitles] = useState<Record<string, string>>({});
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!docs.length) return;
    // Titles from each document's first heading.
    Promise.all(docs.map((d) => fetch(fileUrl(`docs/${d}.md`)).then((r) => r.text()).then((t) => [d, (t.match(/^#\s+(.+)$/m)?.[1] ?? d).replace(/^\d+\s*—\s*/, '').replace(/^The Olympus\s*—\s*/, '')] as const))).then((pairs) => setTitles(Object.fromEntries(pairs)));
  }, [docs.join('|')]);

  useEffect(() => {
    if (!current) return;
    fetch(fileUrl(`docs/${current}.md`))
      .then((r) => r.text())
      .then((md) => setHtml(marked.parse(md, { async: false }) as string));
  }, [current]);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const base = new URL(`files/docs/${current}.md`, location.href);
    for (const img of el.querySelectorAll('img')) {
      const src = img.getAttribute('src') ?? '';
      if (!/^[a-z]+:/i.test(src)) img.src = new URL(src, base).href;
      img.loading = 'lazy';
    }
    for (const a of el.querySelectorAll('a')) {
      const href = a.getAttribute('href') ?? '';
      if (/^[a-z]+:/i.test(href) || href.startsWith('#')) continue;
      const target = new URL(href, base);
      const path = decodeURIComponent(target.pathname);
      const m = path.match(/\/files\/docs\/([^/]+)\.md$/);
      if (m) a.setAttribute('href', `#/guide/${m[1]}`);
      else if (path.endsWith('/') || /README\.md$/.test(path)) a.setAttribute('href', '#/downloads');
      else a.href = target.href;
    }
    for (const t of el.querySelectorAll('table')) {
      const wrap = document.createElement('div');
      wrap.className = 'doc__table';
      t.replaceWith(wrap);
      wrap.append(t);
    }
  }, [html, current]);

  return (
    <div className="page guide">
      <nav className="guide__nav" aria-label="Guide">
        <h2>Guide</h2>
        <a className="guide__book" href={fileUrl('docs/the-olympus-brand-book.pdf')} target="_blank" rel="noreferrer">
          Brand book (PDF)
        </a>
        <ol>
          {docs.map((d) => (
            <li key={d}>
              <a href={`#/guide/${d}`} aria-current={d === current ? 'page' : undefined}>
                {titles[d] ?? d}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <article className="doc" ref={body} dangerouslySetInnerHTML={{ __html: error ? `<p>${error}</p>` : html }} />
    </div>
  );
}
