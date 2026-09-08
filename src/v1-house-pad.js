import { Terrain } from './sim/terrain.js';

// An authored terrace under a house that no longer exists.
//
// The opening house sat off to the left of the piste at x=-11, and every
// landmark was vertically anchored from x=0, so a random height feature at
// ~170m could leave it visibly bridging a trench. This gave it a small
// authored terrace and reserved that footprint from generated clutter.
//
// Phase 7 retired the landmark set pieces — bridge, towers, arches, distance
// boards and the house — but only the ART was removed. The terrace was not,
// and it is not inert: it still flattens the surface through heightAt,
// sampleGrid and chunk on every query, and measured against the unpatched
// base it still moves the PLAYABLE CORRIDOR by up to 0.15m around d=170.
// Every run is shaped, slightly, by a building nobody can see.
//
// It stays for now because removing it is a terrain change and the Phase 0
// behaviour snapshot is the right place for that decision to be taken
// deliberately, not as a side effect of a cleanup. The half of this file
// that patched Landmarks IS gone: `Landmarks.prototype._layout` never
// existed after Phase 7, so `baseLayout` was undefined and the override
// could not have run; the entries list it searched was always empty.
const HOUSE = Object.freeze({
  x: -11,
  d: 170,
  innerX: 4.8,
  outerX: 7.2,
  innerD: 3.8,
  outerD: 8.0,
  bodyBottom: 0.5,
});

const smooth01 = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

function axisWeight(delta, inner, outer) {
  const a = Math.abs(delta);
  if (a <= inner) return 1;
  if (a >= outer) return 0;
  return smooth01((outer - a) / Math.max(1e-6, outer - inner));
}

function padWeight(x, d) {
  return axisWeight(x - HOUSE.x, HOUSE.innerX, HOUSE.outerX) *
    axisWeight(d - HOUSE.d, HOUSE.innerD, HOUSE.outerD);
}

function padHeight(terrain) {
  // Ignore cliffs/moguls for the authored foundation elevation while retaining
  // the mountain's normal large-scale grade/rolling identity.
  return terrain.baseHeight(HOUSE.x, HOUSE.d);
}

if (!Terrain.prototype.__v1HouseTerrace) {
  Terrain.prototype.__v1HouseTerrace = true;

  const baseHeightAt = Terrain.prototype.heightAt;
  Terrain.prototype.heightAt = function heightAtV1House(x, d) {
    const h = baseHeightAt.call(this, x, d);
    const w = padWeight(x, d);
    if (w <= 0) return h;
    const target = padHeight(this);
    return h + (target - h) * w;
  };

  const baseSampleGrid = Terrain.prototype.sampleGrid;
  Terrain.prototype.sampleGrid = function sampleGridV1House(x0, x1, nx, d0, d1, nd, out) {
    const result = baseSampleGrid.call(this, x0, x1, nx, d0, d1, nd, out);
    const target = padHeight(this);
    let o = 0;
    for (let iz = 0; iz < nd; iz++) {
      const d = d0 + ((d1 - d0) * iz) / (nd - 1);
      for (let ix = 0; ix < nx; ix++, o++) {
        const x = x0 + ((x1 - x0) * ix) / (nx - 1);
        const w = padWeight(x, d);
        if (w > 0) result[o] += (target - result[o]) * w;
      }
    }
    return result;
  };

  const baseChunk = Terrain.prototype.chunk;
  Terrain.prototype.chunk = function chunkV1House(ci) {
    const chunk = baseChunk.call(this, ci);
    if (chunk.__v1HouseReserved) return chunk;

    const inside = (x, d, pad = 0) =>
      Math.abs(x - HOUSE.x) < HOUSE.outerX + pad &&
      Math.abs(d - HOUSE.d) < HOUSE.outerD + pad;

    chunk.colliders = chunk.colliders.filter((c) => !inside(c.x, c.d, c.r || 0));
    chunk.gates = chunk.gates.filter((g) => !inside(g.x, g.d, g.halfSpan || 0));
    chunk.regions = chunk.regions.filter((r) => !inside(r.x, r.d, Math.max(r.halfX || 0, r.halfD || 0) * 0.25));
    Object.defineProperty(chunk, '__v1HouseReserved', { value: true, enumerable: false });
    return chunk;
  };
}

globalThis.__DASH_V1_HOUSE_PAD = {
  authoredTerrace: true,
  generatedClutterReserved: true,
  landmarkAnchorRetired: true,
  anchorX: HOUSE.x,
  distance: HOUSE.d,
  trueTerrainSurface: true,
  noExtraRaf: true,
};
