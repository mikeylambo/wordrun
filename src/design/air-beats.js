import { makeRng, mixSeed } from '../sim/rng.js';

export const AIR_BEAT_RULES = {
  START: 470,
  SPACING: 640,
  JITTER: 52,
  SIDE_OFFSET: 6.3,
  HALF_X: 4.6,
};

/**
 * A repeating authored launch beat inside the endless procedural mountain.
 * Adjacent beats are always roughly 540-740m apart, so a long run keeps
 * presenting obvious "I am absolutely jumping that" moments without turning
 * the whole piste into a trampoline.
 */
export function airBeat(seed, index) {
  const i = Math.max(0, index | 0);
  const rng = makeRng(mixSeed(seed >>> 0 || 1, 0xa17b + i * 131));
  const d = AIR_BEAT_RULES.START + i * AIR_BEAT_RULES.SPACING +
    rng.range(-AIR_BEAT_RULES.JITTER, AIR_BEAT_RULES.JITTER);
  const depth = Math.min(1, d / 18000);
  return {
    id: `air-${i}`,
    index: i,
    d,
    side: rng.next() < 0.5 ? -1 : 1,
    halfX: AIR_BEAT_RULES.HALF_X + rng.range(-0.45, 0.65),
    lip: 1.48 + depth * 0.72 + rng.range(-0.08, 0.18),
    drop: 8.0 + depth * 5.8 + rng.range(-0.7, 1.15),
  };
}

export function airBeatsBetween(seed, d0, d1) {
  const pad = AIR_BEAT_RULES.JITTER + 10;
  const lo = Math.max(0, Math.floor((d0 - AIR_BEAT_RULES.START - pad) / AIR_BEAT_RULES.SPACING) - 1);
  const hi = Math.max(lo, Math.ceil((d1 - AIR_BEAT_RULES.START + pad) / AIR_BEAT_RULES.SPACING) + 1);
  const out = [];
  for (let i = lo; i <= hi; i++) {
    const beat = airBeat(seed, i);
    if (beat.d >= d0 && beat.d < d1) out.push(beat);
  }
  return out;
}

export function nearestAirBeat(seed, distance, maxDelta = 92) {
  const guess = Math.max(0, Math.round((distance - AIR_BEAT_RULES.START) / AIR_BEAT_RULES.SPACING));
  let best = null;
  for (let i = Math.max(0, guess - 2); i <= guess + 2; i++) {
    const beat = airBeat(seed, i);
    const delta = Math.abs(beat.d - distance);
    if (delta <= maxDelta && (!best || delta < best.delta)) best = { ...beat, delta };
  }
  return best;
}

export default airBeat;
