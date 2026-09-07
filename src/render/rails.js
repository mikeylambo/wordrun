/**
 * RC11 — the rails, as a line rather than a gradient.
 *
 * There were no rails. What the game drew was a smoothstep on the terrain
 * shader's `lane` attribute — `smoothstep(0.8, 0.97, abs(vP4Lane))` — painted
 * flat on the ribbon, so everything a rail is supposed to have was implied by
 * a ramp over a vertex attribute instead of stated anywhere. Measured
 * (`node dev/measure-rails.mjs --before`) that meant a 1.19 m wide band sitting
 * 0.805 m in from the edge at zero height, and — because it lived on the mesh
 * — creasing at the mesh's own 2.5 m rows: 36 mrad of heading change at a
 * single joint, better than two degrees, on every seed.
 *
 * A rail now has the four things it was missing, and every one of them is a
 * number here rather than a consequence of something else:
 *
 *   INSET_M    its stand-off from the ribbon edge, constant, both sides
 *   WIDTH_M    its thickness in WORLD units, constant, both sides
 *   HEIGHT_M   how far it stands above the surface it rides — measured
 *              against the BANKED edge, so the two rails stay symmetric and
 *              the only thing that separates them in world Y is the bank
 *   STEP_M     the sampling step, CHUNK_LEN / (mesh rows x OVERSAMPLE), so
 *              the line is resolved four times finer than the road it edges
 *              and cannot crease where the mesh does
 *
 * The glow is the one thing that is NOT constant in world units, deliberately:
 * its half-width subtends a fixed angle, so a rail carries the same weight at
 * 300 m as at 30. A rail of constant world width would fade to a sub-pixel
 * flicker down the road, which is exactly where a rail is doing its job.
 *
 * Draws, decides nothing: the line is a pure function of the terrain, and the
 * verge stanchions in speed-fantasy.js read `railX` from here rather than
 * carrying a second opinion about where the edge of the road is.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

const R = TUNING.RUN;
const T = TUNING.TERRAIN;

/** The mesh's own row density, mirrored from render/terrain-mesh.js. */
const MESH_ROWS_PER_CHUNK = 24;
const MESH_ROW_M = T.CHUNK_LEN / MESH_ROWS_PER_CHUNK;
/** How much finer than the mesh the rail line is resolved. Four is the floor. */
const OVERSAMPLE = 4;

export const RAIL = Object.freeze({
  INSET_M: 0.25,        // rail centreline, inboard of the ribbon edge
  WIDTH_M: 0.18,        // thickness in world units, identical both sides
  HEIGHT_M: 0.28,       // above the BANKED surface at its own x
  OVERSAMPLE,
  MESH_ROW_M,
  STEP_M: MESH_ROW_M / OVERSAMPLE,
  AHEAD_M: 320,
  BEHIND_M: 20,
  // The glow subtends this half-angle from the eye, clamped so it never
  // collapses to nothing up close or swells into a wall down the road.
  GLOW_HALF_ANGLE: 0.0012,
  GLOW_MIN_M: 0.05,
  GLOW_MAX_M: 0.50,
});

const SAMPLES = Math.round((RAIL.AHEAD_M + RAIL.BEHIND_M) / RAIL.STEP_M) + 1;

/** Where a rail's centreline sits, in world X, at distance `d`. */
export function railX(terrain, d, side) {
  return terrain.corridorX(d) + side * (R.TRACK_HALF_W - RAIL.INSET_M);
}

/** The glow's half-width at a given distance from the eye — constant on screen. */
export function glowHalfWidth(distFromEye) {
  const w = RAIL.GLOW_HALF_ANGLE * Math.max(0, distFromEye);
  return Math.min(RAIL.GLOW_MAX_M, Math.max(RAIL.GLOW_MIN_M, w));
}

/** Two strips of `SAMPLES` rungs each, indexed once and never rebuilt. */
function stripIndex() {
  const idx = [];
  for (let s = 0; s < 2; s++) {
    const base = s * SAMPLES * 2;
    for (let k = 0; k < SAMPLES - 1; k++) {
      const a = base + k * 2, b = a + 1, c = a + 2, e = a + 3;
      idx.push(a, b, c, b, e, c);
    }
  }
  return idx;
}

function makeRibbon(color, opacity, additive) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 2 * 3), 3));
  geo.setIndex(stripIndex());
  geo.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, fog: true,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Rebuilt around the player every frame, so its construction-origin bounds
  // are meaningless — the same reason the bells opt out.
  mesh.frustumCulled = false;
  return mesh;
}

export class TrackRails {
  constructor(scene, terrain) {
    this.terrain = terrain;
    // The rail's own cyan and the halo above it. Both sit at hue ~195°, which
    // is ≥64° clear of every entry in TUNING.META.RESERVED_HUES — checked
    // before the colours were chosen, per the standing rule, and unchanged
    // from the light the painted band was already casting.
    this.core = makeRibbon(0xa8ecff, 0.92, false);
    this.glow = makeRibbon(0x67d8ff, 0.30, true);
    scene.add(this.glow, this.core);
    this.lastD = -Infinity;
  }

  reset(terrain = this.terrain) {
    this.terrain = terrain;
    this.lastD = -Infinity;
  }

  /** Flow (Phase 9): the rails brighten with the reading, like the stanchions. */
  setFlow(factor) {
    this.core.material.opacity = Math.min(1, 0.62 + 0.34 * factor);
    this.glow.material.opacity = Math.min(0.75, 0.18 + 0.34 * factor);
  }

  update(playerD) {
    if (Math.abs(playerD - this.lastD) < RAIL.STEP_M * 0.5) return;
    this.lastD = playerD;
    const t = this.terrain;
    const cPos = this.core.geometry.getAttribute('position');
    const gPos = this.glow.geometry.getAttribute('position');
    const c = cPos.array, g = gPos.array;
    // Snap the strip to the sampling lattice so the line does not shimmer
    // along its own length as the player moves between samples.
    const d0 = Math.floor((playerD - RAIL.BEHIND_M) / RAIL.STEP_M) * RAIL.STEP_M;
    const half = RAIL.WIDTH_M * 0.5;
    let i = 0;
    for (const side of [-1, 1]) {
      for (let k = 0; k < SAMPLES; k++) {
        const d = d0 + k * RAIL.STEP_M;
        const xc = railX(t, d, side);
        const gw = glowHalfWidth(d - playerD);
        for (const [arr, w] of [[c, half], [g, gw]]) {
          const xi = xc - w, xo = xc + w;
          const o = i * 6;
          arr[o] = xi; arr[o + 1] = t.heightAt(xi, d) + RAIL.HEIGHT_M; arr[o + 2] = -d;
          arr[o + 3] = xo; arr[o + 4] = t.heightAt(xo, d) + RAIL.HEIGHT_M; arr[o + 5] = -d;
        }
        i++;
      }
    }
    cPos.needsUpdate = true;
    gPos.needsUpdate = true;
  }
}

export default TrackRails;
