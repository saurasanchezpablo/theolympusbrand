// Lockups: a crest with the service's name set beside it (horizontal) or
// beneath it (vertical). The crest itself never carries the name — this is
// where a service says what it is.
//
//   JELLYFIN               — Cinzel Bold, the service name
//   THE OLYMPUS · APOLLO   — Jost Semibold, tracked: the house and the patron

import { ARTBOARD } from './math.ts';
import { transformPath } from './path.ts';
import { lineText, type FontRole } from './fonts.ts';
import type { Mark } from './crest.ts';

export type LockupLayout = 'horizontal' | 'vertical';

type Line = { text: string; role: FontRole; cap: number; tracking: number };

function setLine(line: Line, x: number, baseline: number, align: 'left' | 'centre'): { d: string; width: number } {
  // Measure at the target cap height, then place.
  const probe = lineText(line.text, { cx: 0, baseline, size: 100, tracking: line.tracking, role: line.role });
  const size = (100 * line.cap) / probe.capHeight;
  const measured = lineText(line.text, { cx: 0, baseline, size, tracking: line.tracking, role: line.role });
  const cx = align === 'left' ? x + measured.width / 2 : x;
  return { d: lineText(line.text, { cx, baseline, size, tracking: line.tracking, role: line.role }).d, width: measured.width };
}

export type LockupParts = { crest: string; name: string; caption: string; width: number; height: number };

/**
 * The parts of a lockup, placed: the crest, the name and the caption, each as
 * its own path (the print nameplate makes each heavier in its own way). An
 * empty caption sets the name alone.
 */
export function lockupParts(crest: Mark, { name, caption, layout }: { name: string; caption: string; layout: LockupLayout }): LockupParts {
  const nameLine: Line = { text: name.toUpperCase(), role: 'inscription', cap: layout === 'horizontal' ? 104 : 78, tracking: 0.08 };
  const capLine: Line = { text: caption.toUpperCase(), role: 'companion', cap: layout === 'horizontal' ? 26 : 22, tracking: 0.24 };
  const hasCaption = caption.trim() !== '';
  const S = ARTBOARD;
  if (layout === 'horizontal') {
    const x = S + 72;
    const gap = 44;
    const block = hasCaption ? nameLine.cap + gap + capLine.cap : nameLine.cap;
    const nameBase = S / 2 - block / 2 + nameLine.cap;
    const n = setLine(nameLine, x, nameBase, 'left');
    const c = hasCaption ? setLine(capLine, x, nameBase + gap + capLine.cap, 'left') : { d: '', width: 0 };
    const width = Math.ceil(x + Math.max(n.width, c.width) + 8);
    return { crest: crest.d, name: n.d, caption: c.d, width, height: S };
  }
  const nameBase = S + 56 + nameLine.cap;
  const capBase = nameBase + 36 + capLine.cap;
  const probeN = setLine(nameLine, 0, nameBase, 'centre');
  const probeC = hasCaption ? setLine(capLine, 0, capBase, 'centre') : { d: '', width: 0 };
  const width = Math.ceil(Math.max(S, probeN.width + 16, probeC.width + 16));
  const cx = width / 2;
  const n = setLine(nameLine, cx, nameBase, 'centre');
  const c = hasCaption ? setLine(capLine, cx, capBase, 'centre') : { d: '', width: 0 };
  return { crest: transformPath(crest.d, 1, (width - S) / 2, 0), name: n.d, caption: c.d, width, height: Math.ceil((hasCaption ? capBase : nameBase) + 12) };
}

/** A crest (512 artboard) set with a name and caption. */
export function lockup(crest: Mark, opts: { name: string; caption: string; layout: LockupLayout }): Mark {
  const p = lockupParts(crest, opts);
  return { id: `${crest.id}-lockup-${opts.layout === 'horizontal' ? 'h' : 'v'}`, d: p.crest + p.name + p.caption, width: p.width, height: p.height };
}
