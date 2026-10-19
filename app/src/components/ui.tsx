import { useEffect, useId, useState, type ReactNode } from 'react';

/** An SVG document shown as an image (keeps each document's ids and filters isolated). */
export function SvgImage({ svg, alt, className }: { svg: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [svg]);
  return url ? <img src={url} alt={alt} className={className} draggable={false} /> : <span className={className} role="img" aria-label={alt} />;
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
