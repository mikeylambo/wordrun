/**
 * Corruption audio assets — Phase 4.
 *
 * The approved creature recordings (growls, footfalls, charges) are replaced
 * by procedurally rendered signal-noise textures: static swells, glitch
 * ticks, gated interference. Rendered offline to WAV so the runtime keeps
 * the exact approved-assets pipeline and asset ids it shipped with.
 *
 *   node tools/generate-corruption-audio.mjs
 *
 * Deterministic: a fixed seed renders byte-identical files.
 */

import fs from 'node:fs';
import path from 'node:path';

const OUT = 'public/audio/approved';
const RATE = 22050;

// mulberry32 — same generator family the sim uses.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple biquad (RBJ cookbook) run over a Float32Array. */
function biquad(x, type, f0, q = 0.8) {
  const w0 = 2 * Math.PI * (f0 / RATE);
  const alpha = Math.sin(w0) / (2 * q);
  const cosW = Math.cos(w0);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'bandpass') {
    b0 = alpha; b1 = 0; b2 = -alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosW) / 2; b1 = -(1 + cosW); b2 = (1 + cosW) / 2;
  } else { // lowpass
    b0 = (1 - cosW) / 2; b1 = 1 - cosW; b2 = (1 - cosW) / 2;
  }
  a0 = 1 + alpha; a1 = -2 * cosW; a2 = 1 - alpha;
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 / a0) * x[i] + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

const seconds = (s) => Math.floor(s * RATE);
const noise = (n, r) => Float32Array.from({ length: n }, () => r() * 2 - 1);

function envelope(x, fn) {
  for (let i = 0; i < x.length; i++) x[i] *= fn(i / x.length);
  return x;
}

/** Random gating — the dropout stutter that makes noise read as digital. */
function gate(x, r, holdMs = 26, dutyLo = 0.35, dutyHi = 1) {
  const hold = Math.max(8, seconds(holdMs / 1000));
  let level = 1;
  for (let i = 0; i < x.length; i++) {
    if (i % hold === 0) level = r() < 0.5 ? dutyLo + r() * (dutyHi - dutyLo) : (r() < 0.22 ? 0 : 1);
    x[i] *= level;
  }
  return x;
}

/** Bitcrush: quantize amplitude, decimate sample rate. */
function crush(x, bits = 6, every = 3) {
  const steps = 2 ** bits;
  let held = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % every === 0) held = Math.round(x[i] * steps) / steps;
    x[i] = held;
  }
  return x;
}

function mix(...parts) {
  const n = Math.max(...parts.map((p) => p.length));
  const out = new Float32Array(n);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

function sweep(x, type, f0, f1, q, chunks = 24) {
  const out = new Float32Array(x.length);
  const step = Math.ceil(x.length / chunks);
  for (let c = 0; c < chunks; c++) {
    const lo = c * step, hi = Math.min(x.length, lo + step);
    if (lo >= hi) break;
    const f = f0 * Math.pow(f1 / f0, c / (chunks - 1));
    const filtered = biquad(x.slice(Math.max(0, lo - 64), hi), type, f, q);
    out.set(filtered.subarray(Math.min(64, lo)), lo);
  }
  return out;
}

function normalize(x, peak = 0.86) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i] / m) * peak;
  return x;
}

function wav(x) {
  const n = x.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  }
  return buf;
}

const RENDER = {
  // Distant corruption wash: sparse mid-band crackle, breathing in and out.
  'corruption_distant-v01.wav': () => {
    const r = rng(101);
    let x = biquad(noise(seconds(2.2), r), 'bandpass', 1150, 1.1);
    gate(x, r, 44, 0.5, 0.9);
    envelope(x, (t) => Math.sin(t * Math.PI) * (0.7 + 0.3 * Math.sin(t * 19)));
    return normalize(x, 0.6);
  },
  // The tell layer: static swelling upward and cut dead.
  'corruption_close-v01.wav': () => {
    const r = rng(202);
    let x = sweep(noise(seconds(1.6), r), 'bandpass', 750, 3600, 1.6);
    crush(x, 7, 2);
    gate(x, r, 20, 0.55, 1);
    envelope(x, (t) => Math.pow(t, 1.4) * (t > 0.97 ? (1 - t) / 0.03 : 1));
    return normalize(x, 0.82);
  },
  // The approach tick.
  'corruption_step-v01.wav': () => {
    const r = rng(303);
    const click = envelope(biquad(noise(seconds(0.05), r), 'highpass', 4600, 0.7), (t) => Math.pow(1 - t, 3));
    const body = envelope(biquad(noise(seconds(0.16), r), 'bandpass', 900, 2.4), (t) => Math.pow(1 - t, 2.4) * 0.7);
    return normalize(crush(mix(click, body), 6, 2), 0.72);
  },
  // Hunt-leap: rising gated stutter.
  'corruption_leap-v01.wav': () => {
    const r = rng(404);
    let x = sweep(noise(seconds(1.1), r), 'bandpass', 620, 5200, 1.3);
    gate(x, r, 16, 0.3, 1);
    envelope(x, (t) => 0.3 + t * 0.7);
    return normalize(x, 0.8);
  },
  // Interference spike entering: pale high shimmer.
  'interference_enter-v01.wav': () => {
    const r = rng(505);
    let x = biquad(noise(seconds(1.4), r), 'highpass', 5600, 0.7);
    gate(x, r, 30, 0.4, 0.85);
    const glint = new Float32Array(seconds(1.4));
    for (let i = 0; i < glint.length; i++) {
      const t = i / glint.length;
      glint[i] = Math.sin(2 * Math.PI * (2900 + Math.sin(t * 34) * 260) * (i / RATE)) *
        0.16 * Math.max(0, Math.sin(t * Math.PI * 5)) * (1 - t);
    }
    envelope(x, (t) => Math.sin(t * Math.PI));
    return normalize(mix(x, glint), 0.66);
  },
  // Interference charge: hard AM buzz climbing.
  'interference_charge-v01.wav': () => {
    const r = rng(606);
    let x = sweep(noise(seconds(1.5), r), 'bandpass', 1500, 3800, 1.2);
    for (let i = 0; i < x.length; i++) {
      x[i] *= 0.5 + 0.5 * Math.sign(Math.sin(2 * Math.PI * 76 * (i / RATE)));
    }
    envelope(x, (t) => 0.35 + t * 0.65);
    return normalize(crush(x, 6, 2), 0.82);
  },
  // Interference vault: an arcing whoosh of noise.
  'interference_vault-v01.wav': () => {
    const r = rng(707);
    const up = sweep(noise(seconds(0.6), r), 'bandpass', 1100, 4600, 1.4);
    const down = sweep(noise(seconds(0.6), r), 'bandpass', 4600, 900, 1.4);
    const x = new Float32Array(seconds(1.2));
    x.set(envelope(up, (t) => t), 0);
    x.set(envelope(down, (t) => 1 - t * 0.85), seconds(0.6));
    return normalize(gate(x, r, 22, 0.5, 1), 0.76);
  },
  // Interference kill: full-band crush collapsing to a thud.
  'interference_kill-v01.wav': () => {
    const r = rng(808);
    let x = mix(
      biquad(noise(seconds(1.8), r), 'bandpass', 2400, 0.8),
      envelope(biquad(noise(seconds(1.8), r), 'highpass', 6200, 0.6), (t) => 1 - t * 0.8),
    );
    crush(x, 5, 3);
    gate(x, r, 18, 0.25, 1);
    envelope(x, (t) => (t < 0.12 ? t / 0.12 : Math.pow(1 - (t - 0.12) / 0.88, 1.6)));
    const thud = envelope(biquad(noise(seconds(0.5), r), 'lowpass', 130, 0.9), (t) => Math.pow(1 - t, 2));
    const out = new Float32Array(x.length);
    out.set(x, 0);
    for (let i = 0; i < thud.length; i++) out[seconds(1.25) + i] += thud[i] * 2.4;
    return normalize(out, 0.85);
  },
};

fs.mkdirSync(OUT, { recursive: true });
for (const [file, render] of Object.entries(RENDER)) {
  const data = wav(render());
  fs.writeFileSync(path.join(OUT, file), data);
  console.log(`wrote ${file} (${(data.length / 1024).toFixed(0)} KB)`);
}
console.log('corruption audio rendered');
