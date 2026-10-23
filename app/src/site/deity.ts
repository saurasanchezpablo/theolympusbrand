// What the home page's pantheon says of a service: a card headed by its god —
// the god's title under it, the service named below — or, for a service no god
// stands for (its own logo, its initial), headed by its own name.

export type HomeService = { id: string; name: string; category: string; patron: { god: string } | { monogram: string } | { logo: true; letter: string }; title?: string | null; url?: string | null };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function deityCard(s: HomeService): { heading: string; under: string | null; service: string } {
  if ('god' in s.patron) return { heading: cap(s.patron.god), under: s.title ?? null, service: s.name };
  return { heading: s.name, under: 'monogram' in s.patron ? `Under its initial, ${s.patron.monogram}` : 'Under its own logo', service: cap(s.category) };
}

/** The name the moving band shows: the god's, or the service's own. */
export const bandName = (s: HomeService): string => ('god' in s.patron ? cap(s.patron.god) : s.name);
