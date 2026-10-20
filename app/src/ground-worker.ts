// Draws a marble ground off the main thread: a 4K wallpaper's stone takes several seconds.

import { marbleScreen, type ScreenTone } from '../../src/render/wallpaper.ts';
import { png } from '../../src/export/png.ts';

self.onmessage = (e: MessageEvent<{ w: number; h: number; tone: ScreenTone }>) => {
  const { w, h, tone } = e.data;
  const bytes = png(marbleScreen(w, h, tone), w, h, 1);
  (self as unknown as Worker).postMessage(bytes, [bytes.buffer]);
};
