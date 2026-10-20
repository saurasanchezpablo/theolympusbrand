import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** An SVG document shown as an image (keeps each document's ids and filters isolated). */
export function SvgImage({ svg, alt, className }: { svg: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  // Earlier documents' addresses stay valid until the new one has loaded: the image
  // still shows the old one until then, and a revoked address fails to load.
  const made = useRef<string[]>([]);
  // Once an image has loaded, the addresses made before it are done with — not any made since.
  const settle = (loaded: string) => {
    const i = made.current.indexOf(loaded);
    if (i <= 0) return;
    for (const u of made.current.slice(0, i)) URL.revokeObjectURL(u);
    made.current = made.current.slice(i);
  };
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    made.current.push(u);
    setUrl(u);
  }, [svg]);
  // Gone from the page: an image may still be loading from its address, so let it finish first.
  useEffect(
    () => () => {
      const all = made.current;
      made.current = [];
      window.setTimeout(() => all.forEach((u) => URL.revokeObjectURL(u)), 10_000);
    },
    [],
  );
  return url ? (
    <img src={url} alt={alt} className={className} draggable={false} onLoad={() => settle(url)} onError={() => settle(url)} />
  ) : (
    <span className={className} role="img" aria-label={alt} />
  );
}

export type Option<T extends string> = { value: T; label: string; disabled?: boolean; hint?: string };

/** A row of mutually exclusive buttons. */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: { label: string; value: T; options: Option<T>[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className={`segmented segmented--${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'is-on' : undefined}
          disabled={o.disabled}
          title={o.hint}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <header className="section__head">
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

export function Notes({ items, tone = 'warn' }: { items: string[]; tone?: 'warn' | 'error' | 'info' }) {
  if (!items.length) return null;
  return (
    <ul className={`notes notes--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}
