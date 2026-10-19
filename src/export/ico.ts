// favicon.ico with PNG-compressed entries (works with Node Buffers and browser bytes alike).
export function ico(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const headerLen = 6 + 16 * images.length;
  const out = new Uint8Array(headerLen + images.reduce((n, i) => n + i.png.length, 0));
  const v = new DataView(out.buffer);
  v.setUint16(0, 0, true);
  v.setUint16(2, 1, true);
  v.setUint16(4, images.length, true);
  let offset = headerLen;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    v.setUint8(e, size >= 256 ? 0 : size);
    v.setUint8(e + 1, size >= 256 ? 0 : size);
    v.setUint16(e + 4, 1, true); // colour planes
    v.setUint16(e + 6, 32, true); // bits per pixel
    v.setUint32(e + 8, png.length, true);
    v.setUint32(e + 12, offset, true);
    out.set(png, offset);
    offset += png.length;
  });
  return out;
}
