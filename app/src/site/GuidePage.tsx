import { useEffect, useRef, useState } from 'react';
import { guideMarked, safeUrl } from './markdown.ts';
import { fileUrl, useIndex } from './files.ts';
import { KitFiles } from './KitFiles.tsx';

/** A chapter's title from its first heading, without the number and the house's name. */
const clean = (t: string) => t.replace(/^\d+\s*—\s*/, '').replace(/^The Olympus\s*—\s*/, '');

/** The guide: the repository's docs, rendered, with their links and pictures pointed at the site. */

/**
 * A chapter's images, found beside the chapter (files/docs/…) and loaded only
 * when near: set while the HTML is still inert, before the page asks for them.
 */
function withImages(html: string, chapter: string): string {
  const t = document.createElement('template');
  t.innerHTML = html;
  const base = new URL(`files/docs/${chapter}.md`, location.href);
  for (const img of t.content.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? '';
    if (!/^[a-z]+:/i.test(src)) img.setAttribute('src', new URL(src, base).href);
    img.setAttribute('loading', 'lazy');
  }
  return t.innerHTML;
}

export function GuidePage({ doc }: { doc?: string }) {
  const { index, error: indexError } = useIndex();
  const files = index?.files ?? [];
  const chapter = (path: string) => ({ id: path.slice(5, -3), title: clean(files.find((f) => f.path === path)?.title ?? path.slice(5, -3).split('/').pop()!) });
  // A folder of documents (docs/integrations/) sits under the chapter named after it (08-integrations).
  const chapters = files
    .filter((f) => /^docs\/[^/]+\.md$/.test(f.path))
    .map((f) => {
      const c = chapter(f.path);
      const folder = c.id.replace(/^\d+-/, '');
      return { ...c, sections: files.filter((g) => g.path.startsWith(`docs/${folder}/`) && /^docs\/[^/]+\/[^/]+\.md$/.test(g.path)).map((g) => chapter(g.path)) };
    });
  const all = chapters.flatMap((c) => [c, ...c.sections]);
  const current = all.find((c) => c.id === doc) ?? all.find((c) => c.id.startsWith('02')) ?? all[0];
  const [html, setHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const body = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!current) return;
    let live = true;
    setError(null);
    fetch(fileUrl(`docs/${current.id}.md`))
      .then((r) => {
        if (!r.ok) throw new Error(`This chapter could not be loaded (${r.status}). Reload the page; if it persists, rebuild the site.`);
        return r.text();
      })
      .then((md) => live && setHtml(withImages(guideMarked.parse(md) as string, current.id)))
      .catch((e: Error) => live && setError(e.message));
    setChaptersOpen(false);
    return () => {
      live = false;
    };
  }, [current?.id]);

  useEffect(() => {
    const el = body.current;
    if (!el || !current) return;
    const base = new URL(`files/docs/${current.id}.md`, location.href);
    for (const a of el.querySelectorAll('a')) {
      const href = a.getAttribute('href') ?? '';
      if (!safeUrl(href)) {
        a.removeAttribute('href');
        continue;
      }
      if (/^[a-z]+:/i.test(href) || href.startsWith('#')) continue;
      const target = new URL(href, base);
      const path = decodeURIComponent(target.pathname);
      const m = path.match(/\/files\/docs\/((?:[^/]+\/)?[^/]+)\.md$/);
      if (m) a.setAttribute('href', `#/guide/${m[1]}`);
      else if (path.endsWith('/') || /README\.md$/.test(path)) a.setAttribute('href', '#/downloads');
      else a.href = target.href;
    }
    for (const pre of el.querySelectorAll('pre')) pre.tabIndex = 0;
    // Wide tables scroll sideways in their own frame, which the keyboard can reach and a screen reader names.
    for (const t of el.querySelectorAll('table')) {
      let heading: Element | null = t;
      while (heading && !/^H[1-4]$/.test(heading.tagName)) heading = heading.previousElementSibling;
      const wrap = document.createElement('div');
      wrap.className = 'doc__table';
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', `Table${heading ? `: ${heading.textContent}` : ''}`);
      t.replaceWith(wrap);
      wrap.append(t);
    }
  }, [html, current?.id]);

  return (
    <div className="page guide">
      <nav className="guide__nav" aria-label="Guide">
        <button type="button" className="guide__toggle" aria-expanded={chaptersOpen} aria-controls="guide-chapters" onClick={() => setChaptersOpen((o) => !o)}>
          <span className="guide__toggle-label">Chapter</span>
          <span className="guide__toggle-current">{current?.title ?? 'Guide'}</span>
        </button>
        <div id="guide-chapters" className={`guide__chapters${chaptersOpen ? ' is-open' : ''}`}>
          <h2>Guide</h2>
          <a className="guide__book" href={fileUrl('docs/the-olympus-brand-book.pdf')} target="_blank" rel="noreferrer">
            Brand book (PDF)
          </a>
          <ol>
            {chapters.map((c) => (
              <li key={c.id}>
                <a href={`#/guide/${c.id}`} aria-current={c.id === current?.id ? 'page' : undefined}>
                  {c.title}
                </a>
                {c.sections.length > 0 && (
                  <ol className="guide__sections">
                    {c.sections.map((s) => (
                      <li key={s.id}>
                        <a href={`#/guide/${s.id}`} aria-current={s.id === current?.id ? 'page' : undefined}>
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </div>
      </nav>
      {indexError || error ? (
        <p className="notes notes--error">{indexError ?? error}</p>
      ) : html ? (
        <div className="guide__main">
          <article className="doc" ref={body} dangerouslySetInnerHTML={{ __html: html }} />
          {/* An application's chapter: its kit's files, to copy by hand. */}
          {index && current?.id.startsWith('integrations/') && <KitFiles key={current.id} index={index} dir={current.id.slice('integrations/'.length)} />}
        </div>
      ) : (
        <p className="doc doc--loading" role="status">
          Opening the chapter…
        </p>
      )}
    </div>
  );
}
