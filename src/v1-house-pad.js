import { Terrain } from './sim/terrain.js';
import { Landmarks } from './render/landmarks.js';

// The opening house is intentionally off to the left of the piste. Historically
// every landmark was vertically anchored from x=0, while the house itself sits
// around x=-11. A random height feature at ~170m could therefore leave it
// visibly bridging a trench. Give the opening landmark a small authored terrace
// and reserve that footprint from generated clutter.
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

if (!Landmarks.prototype.__v1HouseTerrace) {
  Landmarks.prototype.__v1HouseTerrace = true;
  const baseLayout = Landmarks.prototype._layout;

  Landmarks.prototype._layout = function layoutV1House(entry) {
    if (entry?.def?.id !== 'house') return baseLayout.call(this, entry);

    const { def, group } = entry;
    // The house body's lowest visible face is already +0.5m in local space.
    // Lower only this landmark anchor so the timber actually meets the terrace.
    group.position.set(0, padHeight(this.terrain) - HOUSE.bodyBottom, -def.d);
    entry.laidOut = true;
  };
}

// If the module arrives after an initial title-frame layout, force the existing
// instance to pick up the authored anchor on its next update.
const existing = globalThis.__RENDER?.landmarks;
if (existing?.entries) {
  const house = existing.entries.find((e) => e.def?.id === 'house');
  if (house) house.laidOut = false;
}

globalThis.__DESCENT_V1_HOUSE_PAD = {
  authoredTerrace: true,
  generatedClutterReserved: true,
  anchorX: HOUSE.x,
  distance: HOUSE.d,
  trueTerrainSurface: true,
  noExtraRaf: true,
};
