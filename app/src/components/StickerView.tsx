import { useState } from 'react';
import { Segmented, SvgImage } from './ui.tsx';
import type { StickerBuild } from './StickerPanel.tsx';

type Mode = 'flat' | 'laptop' | 'server' | 'sheet';

/** The sticker as cut (dashed line), on a laptop or a server (mockups), or laid out on a sheet. */
export function StickerView({ build, busy }: { build: StickerBuild | null; busy: boolean }) {
  const [mode, setMode] = useState<Mode>('flat');
  return (
    <div className="modelview-wrap stickerview">
      <div className="modelview__modes">
        <Segmented
          label="Sticker view"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'flat', label: 'Sticker', hint: 'As cut: the dashed line is the cut path' },
            { value: 'laptop', label: 'On a laptop', hint: 'Mockup, at real size on a 13-inch lid' },
            { value: 'server', label: 'On a server', hint: 'Mockup, on a 2U rack front' },
            { value: 'sheet', label: 'Sheet', hint: 'As many as fit on the chosen paper' },
          ]}
        />
      </div>
      {build && <SvgImage className={`stickerview__img stickerview__img--${mode}`} svg={build.previews[mode]} alt={`Sticker — ${mode}`} />}
      {busy && <span className="modelview__busy">Building the sticker…</span>}
      <span className="modelview__hint">{mode === 'laptop' || mode === 'server' ? 'Mockup — a drawn scene, at the sticker’s real size' : mode === 'sheet' ? `${build?.perSheet ?? 0} per sheet` : 'The dashed line is where the blade cuts'}</span>
    </div>
  );
}
