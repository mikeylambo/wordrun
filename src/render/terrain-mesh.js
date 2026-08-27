/**
 * Terrain rendering — a ring of chunk meshes recycled ahead of the camera.
 *
 * Every vertex height comes from the same Terrain.heightAt() the physics uses,
 * so what you see is exactly what you land on. Presentation colour can evolve
 * with distance without ever touching collision or determinism.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { FEATURE } from '../sim/terrain.js';
import { MOUNTAIN_BANDS, bandBlend } from './art-direction.js';

const T = TUNING.TERRAIN;
const SX = T.SEGS_X, SZ = T.SEGS_Z;
const VERTS_X = SX + 1, VERTS_Z = SZ + 1;
const VERT_COUNT = VERTS_X * VERTS_Z;
const MESH_HALF_W = T.HALF_WIDTH + 6;
const ROWS_PER_FRAME = 12;
const SURFACE_UV_SCALE = 0.075;

const c1 = new THREE.Color();
const rowSnow = new THREE.Color();
const rowCrest = new THREE.Color();
const rowShade = new THREE.Color();
const rowPowder = new THREE.Color();
const rowIce = new THREE.Color();

// Convert every band once. THREE.Color#setHex performs colour-management work;
// doing it in the inner vertex loop would reintroduce the streaming hitch the
// existing renderer worked hard to eliminate.
const BAND = MOUNTAIN_BANDS.map((b) => ({
  snow: new THREE.Color(b.snow),
  crest: new THREE.Color(b.crest),
  shade: new THREE.Color(b.shade),
  powder: new THREE.Color(b.powder),
  ice: new THREE.Color(b.ice),
}));

function setRowPalette(distance) {
  const mix = bandBlend(distance);
  const a = BAND[mix.from];
  const b = BAND[mix.to];
  rowSnow.copy(a.snow).lerp(b.snow, mix.t);
  rowCrest.copy(a.crest).lerp(b.crest, mix.t);
  rowShade.copy(a.shade).lerp(b.shade, mix.t);
  rowPowder.copy(a.powder).lerp(b.powder, mix.t);
  rowIce.copy(a.ice).lerp(b.ice, mix.t);
}

export class TerrainMesh {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });

    const total = T.CHUNKS_AHEAD + T.CHUNKS_BEHIND + 1;
    this.slots = [];
    for (let i = 0; i < total; i++) this.slots.push(this._makeSlot());

    this.baseCi = null;
    this.dirty = [];
    this.heights = new Float64Array(VERT_COUNT);
  }

  _makeSlot() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(VERT_COUNT * 2), 2));
    // 0 = snow/powder, 1 = ice. RC8's terrain shader uses this to change
    // roughness/specular response without creating a second terrain mesh.
    g.setAttribute('surface', new THREE.BufferAttribute(new Float32Array(VERT_COUNT), 1));

    const idx = new Uint32Array(SX * SZ * 6);
    let o = 0;
    for (let iz = 0; iz < SZ; iz++) {
      for (let ix = 0; ix < SX; ix++) {
        const a = iz * VERTS_X + ix;
        const b = a + 1;
        const c = a + VERTS_X;
        const d = c + 1;
        idx[o++] = a; idx[o++] = b; idx[o++] = c;
        idx[o++] = b; idx[o++] = d; idx[o++] = c;
      }
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));

    const mesh = new THREE.Mesh(g, this.material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.group.add(mesh);
    return { mesh, geo: g, ci: null, row: 0, ice: [] };
  }

  update(playerD) {
    const ci = Math.floor(playerD / T.CHUNK_LEN);
    const base = ci - T.CHUNKS_BEHIND;
    if (base === this.baseCi) return;
    this.baseCi = base;

    const want = new Set();
    for (let i = 0; i < this.slots.length; i++) want.add(base + i);

    const held = new Set();
    for (const s of this.slots) {
      if (s.ci !== null && want.has(s.ci)) { held.add(s.ci); continue; }
      s.ci = null;
      s.row = 0;
      s.mesh.visible = false;
      const q = this.dirty.indexOf(s);
      if (q >= 0) this.dirty.splice(q, 1);
    }

    for (const target of want) {
      if (held.has(target)) continue;
      const slot = this.slots.find((s) => s.ci === null);
      if (!slot) break;
      slot.ci = target;
      this.dirty.push(slot);
    }
  }

  pump() {
    const slot = this.dirty[0];
    if (!slot) return false;
    const done = this._buildRows(slot, ROWS_PER_FRAME);
    if (done) this.dirty.shift();
    return true;
  }

  flush() {
    while (this.dirty.length) {
      const slot = this.dirty[0];
      while (!this._buildRows(slot, VERTS_Z)) { /* until complete */ }
      this.dirty.shift();
    }
  }

  _build(slot) {
    slot.row = 0;
    while (!this._buildRows(slot, VERTS_Z)) { /* until complete */ }
  }

  _buildRows(slot, maxRows) {
    const terrain = this.terrain;
    const ci = slot.ci;
    const d0 = ci * T.CHUNK_LEN;

    const pos = slot.geo.attributes.position.array;
    const col = slot.geo.attributes.color.array;
    const uv = slot.geo.attributes.uv.array;
    const surface = slot.geo.attributes.surface.array;

    if (!slot.row) {
      slot.ice = [];
      for (let c = ci - 1; c <= ci + 1; c++) {
        for (const r of terrain.chunk(c).regions) {
          if (r.type === FEATURE.ICE) slot.ice.push(r);
        }
      }
      terrain.sampleGrid(
        -MESH_HALF_W, MESH_HALF_W, VERTS_X,
        d0, d0 + T.CHUNK_LEN, VERTS_Z,
        this.heights
      );
      slot.row = 0;
    }
    const ice = slot.ice;
    const rowEnd = Math.min(VERTS_Z, slot.row + maxRows);

    let o = slot.row * VERTS_X * 3;
    let uo = slot.row * VERTS_X * 2;
    let so = slot.row * VERTS_X;
    let hi = slot.row * VERTS_X;
    for (let iz = slot.row; iz < rowEnd; iz++) {
      const d = d0 + (iz / SZ) * T.CHUNK_LEN;
      const fallD = terrain.fallTo(d);
      setRowPalette(d);

      for (let ix = 0; ix < VERTS_X; ix++) {
        const x = -MESH_HALF_W + (ix / SX) * (MESH_HALF_W * 2);
        const y = this.heights[hi++];

        pos[o] = x; pos[o + 1] = y; pos[o + 2] = -d;
        // World-like UVs make the micro surface continuous across recycled
        // chunks instead of restarting the texture at each chunk boundary.
        uv[uo++] = x * SURFACE_UV_SCALE;
        uv[uo++] = d * SURFACE_UV_SCALE;

        const over = Math.abs(x) - T.POWDER_X;
        let onIce = 0;
        for (const r of ice) {
          if (Math.abs(x - r.x) < r.halfX && Math.abs(d - r.d) < r.halfD) {
            const fx = 1 - Math.abs(x - r.x) / r.halfX;
            const fd = 1 - Math.abs(d - r.d) / r.halfD;
            onIce = Math.max(onIce, Math.min(1, Math.min(fx, fd) * 3.2));
          }
        }
        surface[so++] = onIce;

        c1.copy(rowSnow);
        if (over > 0) c1.lerp(rowPowder, Math.min(1, over / 3.5));
        if (onIce > 0) c1.lerp(rowIce, onIce);

        const rel = y + fallD;
        if (rel < 0) c1.lerp(rowShade, Math.min(0.58, -rel * 0.17));
        else if (rel > 0.15) c1.lerp(rowCrest, Math.min(0.52, rel * 0.16));

        col[o] = c1.r; col[o + 1] = c1.g; col[o + 2] = c1.b;
        o += 3;
      }
    }

    slot.row = rowEnd;
    if (rowEnd < VERTS_Z) return false;

    slot.geo.attributes.position.needsUpdate = true;
    slot.geo.attributes.color.needsUpdate = true;
    slot.geo.attributes.uv.needsUpdate = true;
    slot.geo.attributes.surface.needsUpdate = true;
    slot.mesh.visible = true;
    slot.row = 0;
    return true;
  }

  reset() {
    this.baseCi = null;
    this.dirty.length = 0;
    for (const s of this.slots) { s.ci = null; s.row = 0; s.mesh.visible = false; }
  }

  dispose() {
    for (const s of this.slots) s.geo.dispose();
    this.material.dispose();
  }
}
