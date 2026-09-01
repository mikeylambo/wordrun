/**
 * DICTION DASH endgame rules.
 *
 * The canonical run is one continuous 30 km descent. At 30,000 m the chase is
 * actually escapable: the main beast stops at the world-space point where the
 * player crossed the threshold and the frost beast withdraws. Everything after
 * that is Overrun — score attack and mountain mastery, not a restarted chase.
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

export const FINAL_MOUNTAIN = {
  EMPTY_START: 23200,
  EMPTY_END: 24750,
  FOREST_START: 25500,
  FOREST_END: 27500,
  FINAL_APPROACH: 28500,
  BREAK_D: 29140,
};

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function hash01(seed, a, b = 0) {
  let x = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  // Bitwise operators return signed int32 values. Normalize after the final XOR
  // so this hash is truly in [0, 1); otherwise every negative value passes any
  // positive keep threshold and sparse endgame regions become far too dense.
  return (x >>> 0) / 0x100000000;
}

function addLastForestTrees(terrain, chunk, ci, TUNING) {
  if (!Array.isArray(chunk.colliders)) return;
  const F = TUNING.FEATURES;
  const T = TUNING.TERRAIN;

  // Three additional edge-biased trees per 60m chunk stay within the existing
  // instancing budget while turning this stretch into an unmistakable forest.
  // The guaranteed corridor and authored landing zones remain sacred.
  for (let i = 0; i < 3; i++) {
    const side = hash01(terrain.seed, ci, 210 + i) < 0.5 ? -1 : 1;
    const d = chunk.d0 + 7 + hash01(terrain.seed, ci, 230 + i) * Math.max(1, T.CHUNK_LEN - 14);
    const x = side * (11.5 + hash01(terrain.seed, ci, 250 + i) * 6.0);
    if (Math.abs(x - terrain.corridorX(d)) < F.CORRIDOR_HALF_W + 2.4) continue;
    if (terrain.inLandingZone?.(x, d)) continue;

    let clash = false;
    for (const c of chunk.colliders) {
      const r = c.r || 0.8;
      if (Math.abs(c.x - x) < r + F.TREE_RADIUS + 2.1 &&
          Math.abs(c.d - d) < r + F.TREE_RADIUS + 2.1) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    chunk.colliders.push({
      type: 'tree', x, d,
      r: F.TREE_RADIUS, h: F.TREE_HEIGHT,
      finalForest: true,
    });
  }
  chunk.colliders.sort((a, b) => a.d - b.d);
}

/**
 * Final-valley / deep-mountain geography pass.
 *
 * This never changes the base height function. It composes the late mountain by
 * thinning random clutter, deliberately densifying Last Forest, and opening the
 * final approach so the ending is authored rather than decided by RNG tree soup.
 */
export function applyEndgameTerrain(Terrain, TUNING) {
  const proto = Terrain?.prototype;
  if (!proto || proto.__descentEndgameTerrain) return;
  proto.__descentEndgameTerrain = true;

  const baseGenerate = proto._generate;
  if (typeof baseGenerate !== 'function') return;

  proto._generate = function generateEndgameChunk(ci) {
    const chunk = baseGenerate.call(this, ci);
    const mid = (ci + 0.5) * TUNING.TERRAIN.CHUNK_LEN;
    let solidKeep = 1;
    let heightKeep = 1;
    let empty = false;
    let lastForest = false;
    let finalApproach = false;

    // Deep Mountain still has occasional unnervingly open faces before the
    // explicitly authored final act begins.
    if (mid >= ENDGAME.DEEP_START && mid < FINAL_MOUNTAIN.EMPTY_START) {
      const segment = Math.floor(mid / 960);
      if (hash01(this.seed, segment, 17) < 0.24) {
        solidKeep = 0.58;
        heightKeep = 0.78;
      }
    }

    // THE EMPTY: negative space is the landmark. Bells remain, but ordinary
    // props, all random slalom gates and random height beats nearly disappear.
    if (mid >= FINAL_MOUNTAIN.EMPTY_START && mid < FINAL_MOUNTAIN.EMPTY_END) {
      empty = true;
      solidKeep = 0.04;
      heightKeep = 0.10;
    }

    // LAST FOREST: remove most random cliffs so the trees and the pursuing beast
    // own the composition, then add a few deterministic edge-biased trees.
    if (mid >= FINAL_MOUNTAIN.FOREST_START && mid < FINAL_MOUNTAIN.FOREST_END) {
      lastForest = true;
      solidKeep = 1;
      heightKeep = 0.30;
    }

    // The final 1.5 km progressively opens after Last Forest. The beast remains
    // lethal until the exact 30,000 m crossing, but no random gate can make the
    // emotional final approach hinge on clipping a stray pole.
    if (mid >= FINAL_MOUNTAIN.FINAL_APPROACH && mid < ENDGAME.ESCAPE_DISTANCE + 650) {
      finalApproach = true;
      const t = clamp((mid - FINAL_MOUNTAIN.FINAL_APPROACH) /
        (ENDGAME.ESCAPE_DISTANCE - FINAL_MOUNTAIN.FINAL_APPROACH));
      solidKeep = Math.min(solidKeep, 0.48 - t * 0.34);
      heightKeep = Math.min(heightKeep, 0.42 - t * 0.28);
    } else if (mid >= ENDGAME.ESCAPE_DISTANCE + 650) {
      // Overrun remains a real run, just with more breathing room.
      solidKeep = Math.min(solidKeep, 0.56);
      heightKeep = Math.min(heightKeep, 0.62);
    }

    if ((solidKeep < 1 || empty || finalApproach) && Array.isArray(chunk.colliders)) {
      chunk.colliders = chunk.colliders.filter((c, i) => {
        if ((empty || finalApproach) && c.type === 'gate') return false;
        if (c.type !== 'tree' && c.type !== 'rock') return true;
        return hash01(this.seed, ci, i + 31) <= solidKeep;
      });
    }
    if ((empty || finalApproach) && Array.isArray(chunk.gates)) chunk.gates.length = 0;

    if (heightKeep < 1 && Array.isArray(chunk.heights)) {
      for (let i = chunk.heights.length - 1; i >= 0; i--) {
        const h = chunk.heights[i];
        if (h.authored || (h.type !== 'cliff' && h.type !== 'mogul')) continue;
        if (hash01(this.seed, ci, i + 73) > heightKeep) chunk.heights.splice(i, 1);
      }
    }

    if (lastForest) addLastForestTrees(this, chunk, ci, TUNING);
    return chunk;
  };
}

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
