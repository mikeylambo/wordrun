import * as THREE from 'three';

const SIZE = 64;
const TAU = Math.PI * 2;

function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }

function hash(x, y, seed) {
  let n = Math.imul((x + seed * 17) | 0, 374761393) ^ Math.imul((y - seed * 31) | 0, 668265263);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function heightField(seed, { streak = 0, grain = 1, ridge = 0 } = {}) {
  const h = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n0 = hash(x, y, seed);
      const n1 = hash(x >> 2, y >> 2, seed + 19);
      const n2 = hash(x >> 4, y >> 4, seed + 47);
      const wind = streak ? Math.sin((x * 0.16 + y * 0.035) + seed) * 0.5 + 0.5 : 0.5;
      const ribs = ridge ? Math.abs(Math.sin((x + y * 0.22) * ridge)) : 0;
      h[y * SIZE + x] = clamp(
        0.48 + (n0 - 0.5) * 0.22 * grain + (n1 - 0.5) * 0.24 +
        (n2 - 0.5) * 0.12 + (wind - 0.5) * streak * 0.20 + ribs * 0.08
      );
    }
  }
  return h;
}

function dataTexture(bytes, { srgb = false, repeat = [1, 1] } = {}) {
  const tex = new THREE.DataTexture(bytes, SIZE, SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function neutralMap(h, amount = 0.08, repeat = [1, 1]) {
  const b = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < h.length; i++) {
    const v = Math.round(255 * clamp(1 - amount + h[i] * amount));
    const o = i * 4;
    b[o] = v; b[o + 1] = v; b[o + 2] = v; b[o + 3] = 255;
  }
  return dataTexture(b, { srgb: true, repeat });
}

function roughnessMap(h, lo, hi, invert = false, repeat = [1, 1]) {
  const b = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < h.length; i++) {
    const k = invert ? 1 - h[i] : h[i];
    const v = Math.round(255 * (lo + (hi - lo) * k));
    const o = i * 4;
    b[o] = v; b[o + 1] = v; b[o + 2] = v; b[o + 3] = 255;
  }
  return dataTexture(b, { repeat });
}

function normalMap(h, strength = 1, repeat = [1, 1]) {
  const b = new Uint8Array(SIZE * SIZE * 4);
  const at = (x, y) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv; nz *= inv;
      const o = (y * SIZE + x) * 4;
      b[o] = Math.round((nx * 0.5 + 0.5) * 255);
      b[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      b[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      b[o + 3] = 255;
    }
  }
  return dataTexture(b, { repeat });
}

function makeSurface(seed, opts) {
  const h = heightField(seed, opts.height);
  return {
    map: neutralMap(h, opts.albedo ?? 0.06, opts.repeat),
    roughnessMap: roughnessMap(h, opts.rough[0], opts.rough[1], !!opts.invertRough, opts.repeat),
    normalMap: normalMap(h, opts.normal ?? 1, opts.repeat),
    normalScale: new THREE.Vector2(opts.normalScale ?? 0.2, opts.normalScale ?? 0.2),
  };
}

export const SURFACES = {
  snow: makeSurface(11, {
    height: { streak: 0.72, grain: 0.7, ridge: 0.08 },
    albedo: 0.045, rough: [0.78, 0.98], normal: 0.8, normalScale: 0.14, repeat: [1, 1],
  }),
  rock: makeSurface(29, {
    height: { streak: 0.12, grain: 1.35, ridge: 0.34 },
    albedo: 0.11, rough: [0.72, 0.96], normal: 1.8, normalScale: 0.28, repeat: [2.4, 2.4],
  }),
  bark: makeSurface(43, {
    height: { streak: 1.0, grain: 0.7, ridge: 0.52 },
    albedo: 0.12, rough: [0.80, 0.98], normal: 1.6, normalScale: 0.25, repeat: [1.4, 3.0],
  }),
  cloth: makeSurface(61, {
    height: { streak: 0.18, grain: 0.62, ridge: 0.74 },
    albedo: 0.035, rough: [0.74, 0.94], normal: 0.9, normalScale: 0.10, repeat: [3.2, 3.2],
  }),
  hide: makeSurface(83, {
    height: { streak: 0.08, grain: 1.1, ridge: 0.23 },
    albedo: 0.07, rough: [0.72, 0.95], normal: 1.25, normalScale: 0.18, repeat: [2.2, 2.2],
  }),
  metal: makeSurface(101, {
    height: { streak: 0.78, grain: 0.38, ridge: 0.1 },
    albedo: 0.025, rough: [0.28, 0.58], normal: 0.55, normalScale: 0.07, repeat: [2.4, 1.2],
  }),
  ice: makeSurface(127, {
    height: { streak: 0.9, grain: 0.42, ridge: 0.12 },
    albedo: 0.035, rough: [0.18, 0.38], invertRough: true,
    normal: 0.65, normalScale: 0.08, repeat: [1.6, 1.6],
  }),
};

export function applySurface(material, surface, options = {}) {
  if (!material || !surface || material.isMeshBasicMaterial) return material;
  material.map = surface.map;
  material.roughnessMap = surface.roughnessMap;
  material.normalMap = surface.normalMap;
  material.normalScale = surface.normalScale.clone();
  if (options.roughness != null) material.roughness = options.roughness;
  if (options.metalness != null) material.metalness = options.metalness;
  material.dithering = true;
  material.needsUpdate = true;
  return material;
}

export default SURFACES;
