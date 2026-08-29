/**
 * Dataworld pass — converts every world set piece into neon line-art.
 *
 * The landmark meshes (bridge, towers, arches, distance boards) are authored
 * alpine props. Rather than re-modelling them, this pass drops each mesh to a
 * near-black body and traces its silhouette with glowing edges — the
 * "error-absorbent" line-art conversion. Meshes appear lazily as their code
 * paths stream them in, so the pass sweeps the scene on a slow cadence and
 * tags what it has already converted.
 *
 * Presentation only: no sim reads, no gameplay writes.
 */

import * as THREE from 'three';

const _wp = new THREE.Vector3();

// A small palette instead of one cyan: set pieces pick a hue by position so
// the skyline reads varied, never monochrome. No red — the Redline's alone.
const EDGE_COLORS = [0x35c8e8, 0x9a6cf0, 0x2fd8a0, 0xe8c76a];
const EDGE_OPACITY = 0.55;
const BODY_DARKEN = 0.16;   // fraction of the original colour that survives
const SWEEP_EVERY = 1.6;    // seconds between scene sweeps

export class DataworldPass {
  constructor(scene, skipRoots = []) {
    this.scene = scene;
    this.skipRoots = skipRoots.filter(Boolean);
    this.t = SWEEP_EVERY; // convert on the first update
    this.edgeMats = EDGE_COLORS.map((color) => new THREE.LineBasicMaterial({
      color, transparent: true, opacity: EDGE_OPACITY,
      depthWrite: false,
    }));
  }

  _skip(obj) {
    for (const root of this.skipRoots) {
      if (root.getObjectById?.(obj.id)) return true;
    }
    return false;
  }

  _convert(obj) {
    const m = obj.material;
    if (!m || obj.userData.__p4Dataworld) return;
    obj.userData.__p4Dataworld = true;

    // Emissive/basic materials are already lights (word plates, corruption,
    // eyes) — leave them alone. Everything lit becomes a dark body.
    if (m.isMeshBasicMaterial || m.isLineBasicMaterial || m.isPointsMaterial) return;
    if (m.name === 'rc8-terrain') return; // the track has its own grid shader
    if (this._skip(obj)) return;

    // Materials are shared across meshes — darken each one exactly once.
    if (!m.userData.__p4Darkened) {
      m.userData.__p4Darkened = true;
      if (m.color) {
        const c = m.color;
        c.setRGB(c.r * BODY_DARKEN, c.g * BODY_DARKEN, c.b * BODY_DARKEN);
      }
      if ('roughness' in m) m.roughness = Math.min(m.roughness ?? 0.8, 0.6);
    }

    // Instanced meshes share geometry across instances; a single edge overlay
    // cannot follow them, so they keep the dark body only.
    if (obj.isInstancedMesh || !obj.geometry) return;

    try {
      const edges = new THREE.EdgesGeometry(obj.geometry, 28);
      // Deterministic hue pick from world position, so a set piece keeps its
      // colour frame to frame and siblings differ.
      obj.getWorldPosition(_wp);
      const pick = Math.abs(Math.floor(_wp.x * 0.13) + Math.floor(_wp.z * 0.07)) % this.edgeMats.length;
      const line = new THREE.LineSegments(edges, this.edgeMats[pick]);
      line.userData.__p4Dataworld = true;
      line.renderOrder = 4;
      obj.add(line);
    } catch { /* exotic geometry — dark body is enough */ }
  }

  /** Flow (Phase 9): set-piece line art brightens with the chain. */
  setFlow(factor) {
    const op = EDGE_OPACITY * (0.62 + 0.38 * Math.min(1.6, factor));
    for (const m of this.edgeMats) m.opacity = op;
  }

  update(dt) {
    this.t += dt;
    if (this.t < SWEEP_EVERY) return;
    this.t = 0;
    this.scene.traverse((obj) => {
      if (obj.isMesh || obj.isInstancedMesh) this._convert(obj);
    });
  }
}
