// The site's files, served: a release folder with the headers the house's
// nginx used to send — the content policy, no sniffing, no referrer, the
// hashed scripts cached for good, the brand's files checked back on each
// visit — each text file as the compressed copy the build made (brotli or
// gzip, as the browser accepts), validated with an ETag, and ranges for the
// large downloads. Nothing outside the release is ever read, nor any hidden
// file, nor a folder listed.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { extname, join, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.scad': 'text/plain; charset=utf-8',
  '.yaml': 'text/plain; charset=utf-8',
  '.yml': 'text/plain; charset=utf-8',
  '.sh': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.stl': 'model/stl',
  '.3mf': 'model/3mf',
};
const typeOf = (path: string) => TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';

/** The page's content policy: everything from this server; nothing from the internet. */
export const CONTENT_POLICY = "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'";
/** The brand's files are shown, never run: a sandbox, and no scripts. */
const FILES_POLICY = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";
export const COMMON_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
};

/** How long a path may be cached: the built scripts carry their hash in their names; the brand's files change with each build. */
function caching(path: string): string {
  if (path.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (path === '/build.json') return 'no-store';
  return 'no-cache';
}

/** The release file for a request path, or null: never outside the release, never a hidden file. */
export function resolvePath(root: string, urlPath: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (path.includes('\0') || path.split('/').some((p) => p === '..' || (p.startsWith('.') && p.length > 0))) return null;
  const full = join(root, path);
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

/** Serve a GET or HEAD from the release folder `root`; false when there is no such file (the caller answers 404). */
export function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url ?? '/', 'http://site');
  let path = url.pathname;
  if (path.endsWith('/')) path += 'index.html';
  let real: string;
  try {
    real = realpathSync(root);
  } catch {
    return false;
  }
  const full = resolvePath(real, path);
  if (!full || !existsSync(full)) return false;
  const st = statSync(full);
  if (!st.isFile()) return false;

  const headers: Record<string, string> = {
    ...COMMON_HEADERS,
    'content-type': typeOf(full),
    'cache-control': caching(path),
    'content-security-policy': path.startsWith('/files/') ? FILES_POLICY : CONTENT_POLICY,
    vary: 'accept-encoding',
  };
  // The compressed copy the browser takes, when the build made one.
  const accepts = String(req.headers['accept-encoding'] ?? '');
  let file = full,
    size = st.size,
    encoding: string | null = null;
  for (const [enc, ext] of [
    ['br', '.br'],
    ['gzip', '.gz'],
  ] as const)
    if (new RegExp(`\\b${enc}\\b`).test(accepts) && existsSync(full + ext)) {
      file = full + ext;
      size = statSync(file).size;
      encoding = enc;
      break;
    }
  const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}${encoding ? `-${encoding}` : ''}"`;
  headers.etag = etag;
  headers['last-modified'] = st.mtime.toUTCString();
  if (encoding) headers['content-encoding'] = encoding;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  // A range of the file as stored (the large downloads: models, the brand book), never of a compressed copy.
  const range = !encoding && typeof req.headers.range === 'string' ? req.headers.range.match(/^bytes=(\d*)-(\d*)$/) : null;
  if (range) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    if (!range[1]) end = size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` });
      res.end();
      return true;
    }
    res.writeHead(206, { ...headers, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, { ...headers, 'accept-ranges': encoding ? 'none' : 'bytes', 'content-length': String(size) });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  return true;
}
