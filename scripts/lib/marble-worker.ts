// A worker drawing a band of rows of a marble ground (see marble.ts).
import { parentPort, workerData } from 'node:worker_threads';
import { marbleRows, type ScreenTone } from '../../src/render/wallpaper.ts';

const { w, h, tone, y0, y1 } = workerData as { w: number; h: number; tone: ScreenTone; y0: number; y1: number };
const rows = marbleRows(w, h, tone, y0, y1);
parentPort!.postMessage(rows, [rows.buffer as ArrayBuffer]);
