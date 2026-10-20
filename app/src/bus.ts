// A design to open in the Atelier, asked for elsewhere on the site (the
// catalogue). The Atelier may not be loaded yet: the request waits for it.

export type OpenRequest = { kind: 'house'; id: string } | { kind: 'mine'; key: string };

let pending: OpenRequest | null = null;
const listeners = new Set<() => void>();

export function requestOpen(r: OpenRequest): void {
  pending = r;
  for (const f of listeners) f();
}

export function takeOpenRequest(): OpenRequest | null {
  const r = pending;
  pending = null;
  return r;
}

export function onOpenRequest(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
