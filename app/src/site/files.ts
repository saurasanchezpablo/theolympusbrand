// The site's published files (see app/files-plugin.ts): the index, and zips of
// whole folders made in the browser.

import { useEffect, useState } from 'react';
import { zipSync } from 'fflate';

export type FileIndex = { groups: { dir: string; group: string; label: string }[]; files: { path: string; size: number }[] };

/** URL of a published file, relative to the page (works from any sub-path). */
export const fileUrl = (path: string) => `files/${path.split('/').map(encodeURIComponent).join('/')}`;

let cached: Promise<FileIndex> | null = null;
export function loadIndex(): Promise<FileIndex> {
  cached ??= fetch('files/index.json').then((r) => {
    if (!r.ok) throw new Error(`The file index could not be loaded (${r.status}).`);
    return r.json() as Promise<FileIndex>;
  });
  return cached;
}

export function useIndex(): { index: FileIndex | null; error: string | null } {
  const [index, setIndex] = useState<FileIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, []);
  return { index, error };
}

export const filesUnder = (index: FileIndex, prefix: string) => index.files.filter((f) => f.path === prefix || f.path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Fetch every file under a folder and zip them, paths relative to the folder's parent. */
export async function zipFolder(index: FileIndex, prefix: string, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const files = filesUnder(index, prefix);
  const parent = prefix.replace(/\/?[^/]+\/?$/, '');
  const out: Record<string, Uint8Array> = {};
  let done = 0;
  // A few at a time: kind to a small home server.
  const queue = [...files];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const res = await fetch(fileUrl(f.path));
        if (!res.ok) throw new Error(`${f.path}: ${res.status}`);
        out[parent ? f.path.slice(parent.length + 1) : f.path] = new Uint8Array(await res.arrayBuffer());
        onProgress?.(++done, files.length);
      }
    }),
  );
  return zipSync(out, { level: 6 });
}

/* ---------------------------------------------------------------- */
/* Routes: #/, #/atelier, #/catalogue, #/guide/<doc>, #/downloads     */
/* ---------------------------------------------------------------- */

export type Route = { page: 'home' | 'atelier' | 'catalogue' | 'guide' | 'downloads'; arg?: string };

export function parseRoute(hash: string): Route {
  const [page, ...rest] = hash.replace(/^#\/?/, '').split('/');
  const arg = rest.join('/') || undefined;
  if (page === 'atelier' || page === 'catalogue' || page === 'guide' || page === 'downloads') return { page, arg };
  return { page: 'home' };
}

export function useRoute(): [Route, (r: string) => void] {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [route, (r: string) => (location.hash = r)];
}
