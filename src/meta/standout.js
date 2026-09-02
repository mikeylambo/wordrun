/**
 * The standout line (Phase E4) — every attempt gets a story, but only when
 * it earned one. The run tracks a handful of brilliance ledgers (main.js
 * feeds them from the same events the score already rides) and the results
 * card shows AT MOST ONE, chosen by rarity: the rarest thing you did is the
 * thing worth saying. An ordinary run shows nothing — scarcity is what
 * keeps the line meaning something.
 *
 * SCORE stays the public prestige metric; this is a footnote under it.
 * Labels are functional words, never names — the cap stays at four.
 * Pure: ledgers in, one {k, v} out (or null), so the gate drives every
 * branch in node.
 */

import TUNING from '../TUNING.js';

// Rarity floors. Below these a feat is routine and says nothing.
export const FLOORS = {
  DASH_RUNG: 4,        // the ladder's top rung — one read past the p90 dash
  EARLY_STREAK: 10,    // ten straight answers in the early half of the window
  BURST_10: 25000,     // a ten-read scoring burst worth shouting about
  CLEAN: 25,           // a clean stretch at the first world-band threshold
  AVG_READ_MS: 420,    // sustained decision speed...
  AVG_READ_MIN_N: 20,  // ...over enough answers to mean it
};

const fmt = (n) => Math.floor(n).toLocaleString('en-US');

/** One standout from a run's ledgers, or null for an ordinary run. */
export function pickStandout({ dashRung = 0, earlyStreak = 0, burst10 = 0,
  bestChain = 0, avgReadMs = 0, reads = 0 } = {}) {
  if (dashRung >= FLOORS.DASH_RUNG) {
    const ladder = TUNING.SCORE.DASH_CHAIN_MULT;
    const mult = ladder[Math.min(dashRung, ladder.length - 1)];
    return { k: 'DASH', v: `×${mult}` };
  }
  if (earlyStreak >= FLOORS.EARLY_STREAK) return { k: 'EARLY', v: `×${earlyStreak}` };
  if (burst10 >= FLOORS.BURST_10) return { k: 'BEST 10', v: fmt(burst10) };
  if (bestChain >= FLOORS.CLEAN) return { k: 'CLEAN', v: String(bestChain) };
  if (reads >= FLOORS.AVG_READ_MIN_N && avgReadMs > 0 && avgReadMs <= FLOORS.AVG_READ_MS) {
    return { k: 'AVG READ', v: `${Math.round(avgReadMs)}ms` };
  }
  return null;
}
