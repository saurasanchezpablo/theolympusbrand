// Folders of the site's files, zipped in the browser.

import { zipSync } from 'fflate';
import { fileUrl, filesUnder, type FileIndex } from './files.ts';

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
