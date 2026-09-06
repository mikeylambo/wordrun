/**
 * A minimal animated-GIF89a encoder — the fallback path for RC9.8's clip.
 *
 * WebM through MediaRecorder is the good path and is what most devices take.
 * This exists for the ones that cannot record a canvas stream, where the
 * alternative would be offering a moving thing the player cannot keep.
 *
 * Deliberately small and deliberately dumb about colour. This game's palette
 * is narrow — dark blues, cyan, white, one red — so a histogram over a 5-bit
 * RGB cube and the 255 most common cells is a better fit than a median cut,
 * costs a fraction of the code, and quantises the frames it will actually be
 * given rather than an imaginary photograph. Every frame is encoded whole:
 * inter-frame diffing would roughly halve the size and is the obvious next
 * thing if anyone ever needs it.
 *
 * Zero dependencies, no DOM, no game: ImageData-shaped inputs in, bytes out.
 * The LZW here is the GIF variant — variable code width, clear and end codes,
 * flushed into 255-byte sub-blocks — and it is the whole reason this file is
 * longer than it looks like it should be.
 */

const MAX_COLORS = 256;

class ByteStream {
  constructor() { this.bytes = []; }
  byte(b) { this.bytes.push(b & 0xff); }
  short(v) { this.byte(v); this.byte(v >> 8); }
  str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  raw(arr) { for (const b of arr) this.byte(b); }
}

/** Top-N colours over a 5-bit cube, plus a map from cube cell to palette index. */
function quantize(frames, width, height) {
  const counts = new Map();
  for (const px of frames) {
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      const key = ((px[o] >> 3) << 10) | ((px[o + 1] >> 3) << 5) | (px[o + 2] >> 3);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])
    .slice(0, MAX_COLORS).map(([k]) => k);
  const palette = top.map((k) => [
    ((k >> 10) & 31) << 3, ((k >> 5) & 31) << 3, (k & 31) << 3,
  ]);
  while (palette.length < 2) palette.push([0, 0, 0]);
  // Nearest palette entry per cube cell, resolved once and reused for every
  // pixel of every frame — 32,768 lookups instead of width*height*frames.
  const lut = new Uint8Array(32768);
  for (let k = 0; k < 32768; k++) {
    const r = ((k >> 10) & 31) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3;
    let best = 0, bestD = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0], dg = g - palette[p][1], db = b - palette[p][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = p; }
    }
    lut[k] = best;
  }
  return { palette, lut };
}

/** GIF-variant LZW over one frame's palette indices. */
function lzw(indices, minCodeSize) {
  const out = [];
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let dict = new Map();
  let next = end + 1;
  let width = minCodeSize + 1;
  let bits = 0, acc = 0;
  const chunk = [];

  const emit = (code) => {
    acc |= code << bits;
    bits += width;
    while (bits >= 8) { chunk.push(acc & 0xff); acc >>= 8; bits -= 8; }
  };
  const reset = () => {
    dict = new Map();
    next = end + 1;
    width = minCodeSize + 1;
  };

  emit(clear);
  reset();
  let prev = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i];
    const key = prev * 4096 + c;
    if (dict.has(key)) { prev = dict.get(key); continue; }
    emit(prev);
    dict.set(key, next++);
    if (next > (1 << width)) {
      if (width < 12) width++;
      else { emit(clear); reset(); }
    }
    prev = c;
  }
  emit(prev);
  emit(end);
  if (bits > 0) chunk.push(acc & 0xff);

  // Sub-blocks: one length byte, up to 255 payload bytes, terminated by zero.
  for (let i = 0; i < chunk.length; i += 255) {
    const slice = chunk.slice(i, i + 255);
    out.push(slice.length, ...slice);
  }
  out.push(0);
  return out;
}

/**
 * @param {object} o
 * @param {Uint8ClampedArray[]} o.frames RGBA pixel arrays, all the same size
 * @param {number} o.width
 * @param {number} o.height
 * @param {number} [o.delayMs] per-frame delay
 * @returns {Blob} an image/gif blob, looping forever
 */
export function encodeGif({ frames, width, height, delayMs = 100 }) {
  const { palette, lut } = quantize(frames, width, height);
  let bits = 1;
  while ((1 << bits) < palette.length) bits++;
  const tableSize = 1 << bits;

  const s = new ByteStream();
  s.str('GIF89a');
  s.short(width); s.short(height);
  s.byte(0xf0 | (bits - 1));   // global table, 8-bit colour resolution
  s.byte(0); s.byte(0);
  for (let i = 0; i < tableSize; i++) {
    const c = palette[i] || [0, 0, 0];
    s.byte(c[0]); s.byte(c[1]); s.byte(c[2]);
  }
  // NETSCAPE2.0: loop forever.
  s.byte(0x21); s.byte(0xff); s.byte(11);
  s.str('NETSCAPE2.0');
  s.byte(3); s.byte(1); s.short(0); s.byte(0);

  const delay = Math.max(2, Math.round(delayMs / 10));   // GIF counts hundredths
  const minCode = Math.max(2, bits);
  const idx = new Uint8Array(width * height);
  for (const px of frames) {
    s.byte(0x21); s.byte(0xf9); s.byte(4);
    s.byte(0x04);            // dispose: restore to background
    s.short(delay);
    s.byte(0); s.byte(0);
    s.byte(0x2c);            // image descriptor
    s.short(0); s.short(0); s.short(width); s.short(height);
    s.byte(0);               // no local table, not interlaced
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      idx[i] = lut[((px[o] >> 3) << 10) | ((px[o + 1] >> 3) << 5) | (px[o + 2] >> 3)];
    }
    s.byte(minCode);
    s.raw(lzw(idx, minCode));
  }
  s.byte(0x3b);              // trailer
  return new Blob([new Uint8Array(s.bytes)], { type: 'image/gif' });
}

export default encodeGif;
