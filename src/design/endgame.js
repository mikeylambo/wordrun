/**
 * DICTION DASH endgame rules.
 *
 * The canonical run is one continuous 30 km. At 30,000 m the chase is actually
 * escapable: the Redline stops at the world-space point where the player
 * crossed the threshold (sim/finish.js). Everything after that is score
 * attack, not a restarted chase.
 */

export const ENDGAME = {
  DEEP_START: 15000,
  HIGH_NIGHT: 25000,
  FALSE_DAWN: 28000,
  FIRST_LIGHT: 29200,
  ESCAPE_DISTANCE: 30000,
  // The last stand (Phase E). When the Redline arrives, the run does not end
  // yet: everything freezes and one word is put up. Read it and the gap is
  // pushed back out; miss it, or let it cross, and the run ends exactly as it
  // would have. Once per run — not per continue, not per heart — so it is a
  // moment rather than a mechanic to farm.
  LAST_STAND_RECOVER_M: 40,
  MORNING: 31500,
  GLORY_DISTANCE: 50000,
  HALO_DISTANCE: 75000,
  CROWN_DISTANCE: 100000,
};

// Phase 7 removed the mountain, and with it FINAL_MOUNTAIN — the late-run
// geography pass (thinned clutter, THE EMPTY, a Last Forest of pines at
// 25.5–27.5 km, THE BREAK air beat). Nothing spawns on the flat track, so the
// only thing that pass still did was plant seventy pine trees beside the
// page in the last forest stretch; it is gone rather than kept as scenery
// from another game. The late run's arc is the sky's (render/endgame-sky.js).

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function endgamePhase(distance) {
  const d = Math.max(0, distance || 0);
  if (d >= ENDGAME.CROWN_DISTANCE) return 'crown';
  if (d >= ENDGAME.HALO_DISTANCE) return 'halo';
  if (d >= ENDGAME.GLORY_DISTANCE) return 'glory';
  if (d >= ENDGAME.MORNING) return 'morning';
  if (d >= ENDGAME.ESCAPE_DISTANCE) return 'dawn';
  if (d >= ENDGAME.FIRST_LIGHT) return 'first-light';
  if (d >= ENDGAME.FALSE_DAWN) return 'false-dawn';
  if (d >= ENDGAME.HIGH_NIGHT) return 'high-night';
  if (d >= ENDGAME.DEEP_START) return 'deep-mountain';
  return 'normal';
}

export function overrunPrestige(distance) {
  const d = Math.max(0, distance || 0);
  return {
    glory: clamp((d - (ENDGAME.GLORY_DISTANCE - 1000)) / 2000),
    halo: clamp((d - (ENDGAME.HALO_DISTANCE - 1200)) / 2400),
    crown: clamp((d - (ENDGAME.CROWN_DISTANCE - 1600)) / 3200),
  };
}

export default ENDGAME;
