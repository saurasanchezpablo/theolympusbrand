// Text to copy — a command, a file's contents — and the means to copy it on any page.

import { useState } from 'react';

/** The site's own address, without the route: what the one command fetches from. */
export const siteAddress = () => location.href.replace(/[#?].*$/, '').replace(/\/(index\.html)?$/, '');

/**
 * Put text on the clipboard. Browsers give the clipboard only to secure pages
 * (HTTPS, localhost); a site on the local network over plain HTTP gets the
 * older way, a selection copied by the page itself. False when neither works.
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Refused (permissions): the older way below.
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.append(area);
  area.select();
  let done = false;
  try {
    done = document.execCommand('copy');
  } catch {
    done = false;
  }
  area.remove();
  return done;
}

/** A Copy button: says Copied, or that the text must be selected by hand. */
export function CopyButton({ text, label = 'Copy', className = 'btn btn--ghost btn--sm' }: { text: () => string | Promise<string>; label?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const ok = await copyText(await text());
        setState(ok ? 'copied' : 'failed');
        window.setTimeout(() => setState('idle'), ok ? 1600 : 4000);
      }}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select it and copy' : label}
    </button>
  );
}

/** A command to copy: selectable by hand, with a Copy button. */
export function Command({ label, command }: { label: string; command: string }) {
  return (
    <div className="dl__command">
      <code tabIndex={0} role="region" aria-label={label}>
        {command}
      </code>
      <CopyButton text={() => command} />
    </div>
  );
}
