/**
 * Track mesh — DICTION DASH Phase 7. A flat ribbon winding through the dark.
 *
 * The streaming chunk-slot architecture survives from the mountain mesh
 * (same reset/update/pump/flush interface, same material slot handoff to
 * the rc8 grid shader), but each chunk is now a ribbon strip laid along the
 * track's authored centerline: rows every few metres, vertices spread
 * across TUNING.RUN.TRACK_HALF_W, banked slightly into the turn. A `lane`
 * attribute (-1 left edge → 0 centre → 1 right edge) feeds the shader's edge
 * rails AND its lane stripes — the grid is drawn in track space, so it stays
 * square to the ribbon through every turn. A
 * `surface` attribute stays for compatibility with the shipped shader.
 *
 * Vertex colours flow from the band table exactly as before, so the mood
 * arc keeps painting the world.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { MOUNTAIN_BANDS, bandBlend } from './art-direction.js';

const T = TUNING.TERRAIN;
const R = TUNING.RUN;

const SEGS_Z = 24;         // rows per 60m chunk (2.5m spacing)
const SEGS_X = 8;          // vertices across the ribbon
const ROW_VERTS = SEGS_X + 1;
const ROWS = SEGS_Z + 1;
const VERT_COUNT = ROWS * ROW_VERTS;
const BANK = 0.35;         // metres of edge lift into a full-rate turn

const BAND_COLORS = MOUNTAIN_BANDS.map((b) => ({
  start: b.start,
  snow: new THREE.Color(b.snow),
  crest: new THREE.Color(b.crest),
  shade: new THREE.Color(b.shade),
}));

const rowSnow = new THREE.Color();
const rowCrest = new THREE.Color();
const rowShade = new THREE.Color();

function bandColorsAt(distance) {
  const mix = bandBlend(distance);
  const a = BAND_COLORS[mix.from];
  const b = BAND_COLORS[mix.to];
  rowSnow.copy(a.snow).lerp(b.snow, mix.t);
  rowCrest.copy(a.crest).lerp(b.crest, mix.t);
  rowShade.copy(a.shade).lerp(b.shade, mix.t);
}

export class TerrainMesh {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, metalness: 0, flatShading: false,
    });
    this.slots = [];
    const total = T.CHUNKS_AHEAD + T.CHUNKS_BEHIND + 1;
    for (let i = 0; i < total; i++) this.slots.push(this._makeSlot());
    this.dirty = [];
  }

  _makeSlot() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute('surface', new THREE.BufferAttribute(new Float32Array(VERT_COUNT), 1));
    g.setAttribute('lane', new THREE.BufferAttribute(new Float32Array(VERT_COUNT), 1));

    const index = [];
    for (let r = 0; r < SEGS_Z; r++) {
      for (let c = 0; c < SEGS_X; c++) {
        const a = r * ROW_VERTS + c;
        const b = a + 1;
        const d = a + ROW_VERTS;
        const e = d + 1;
        index.push(a, b, d, b, e, d);
      }
    }
    g.setIndex(index);

    const mesh = new THREE.Mesh(g, this.material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, geo: g, ci: null, row: 0 };
  }

  _buildSlot(slot, ci) {
    slot.ci = ci;
    slot.row = 0;
    const pos = slot.geo.attributes.position.array;
    const nor = slot.geo.attributes.normal.array;
    const col = slot.geo.attributes.color.array;
    const lane = slot.geo.attributes.lane.array;
    const d0 = ci * T.CHUNK_LEN;

    for (let r = 0; r < ROWS; r++) {
      const d = d0 + (r / SEGS_Z) * T.CHUNK_LEN;
      const cx = this.terrain.corridorX(d);
      const slope = this.terrain.corridorSlope ? this.terrain.corridorSlope(d) : 0;
      bandColorsAt(d);
      for (let c = 0; c < ROW_VERTS; c++) {
        const u = (c / SEGS_X) * 2 - 1; // -1 .. 1 across the ribbon
        const i = r * ROW_VERTS + c;
        const x = cx + u * R.TRACK_HALF_W;
        // Bank the ribbon gently into the turn: outer edge lifts.
        const y = -u * slope * BANK * R.TRACK_HALF_W * 0.5;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = -d;
        nor[i * 3] = 0; nor[i * 3 + 1] = 1; nor[i * 3 + 2] = 0;

        const edge = Math.abs(u);
        const tint = edge > 0.85 ? rowCrest : edge > 0.5 ? rowShade : rowSnow;
        col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b;
        // SIGNED, -1..1. The shader takes abs() for the edge rails and uses
        // the sign for the lane stripes, which have to know which side of the
        // centreline they are on to run parallel to the rails.
        lane[i] = u;
      }
    }

    slot.geo.attributes.position.needsUpdate = true;
    slot.geo.attributes.normal.needsUpdate = true;
    slot.geo.attributes.color.needsUpdate = true;
    slot.geo.attributes.lane.needsUpdate = true;
    slot.geo.computeBoundingSphere?.();
    slot.mesh.visible = true;
  }

  update(playerD) {
    const centerCi = Math.floor(playerD / T.CHUNK_LEN);
    const base = centerCi - T.CHUNKS_BEHIND;
    const want = new Set();
    for (let i = 0; i < this.slots.length; i++) want.add(base + i);

    for (const s of this.slots) {
      if (s.ci !== null && !want.has(s.ci)) { s.ci = null; s.mesh.visible = false; }
    }
    for (const ci of want) {
      if (this.slots.some((s) => s.ci === ci)) continue;
      const slot = this.slots.find((s) => s.ci === null);
      if (!slot) break;
      this.dirty.push([slot, ci]);
      slot.ci = ci; // claim now so one chunk is never queued twice
    }
  }

  /** Build at most one queued chunk per frame — same budget idea as before. */
  pump() {
    const job = this.dirty.shift();
    if (job) this._buildSlot(job[0], job[1]);
  }

  flush() {
    while (this.dirty.length) {
      const [slot, ci] = this.dirty.shift();
      this._buildSlot(slot, ci);
    }
  }

  reset() {
    this.dirty.length = 0;
    for (const s of this.slots) { s.ci = null; s.row = 0; s.mesh.visible = false; }
  }

  dispose() {
    for (const s of this.slots) s.geo.dispose();
    this.material.dispose();
  }
}
