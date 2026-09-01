/**
 * Instanced mountain props.
 *
 * Collision stays deterministic; presentation gets enough per-instance variation
 * that the mountain does not read as repeated Christmas-tree / frosted-rock stamps.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';
import { PALETTE } from './palette.js';
import { FEATURE } from '../sim/terrain.js';
import { MOUNTAIN_BANDS, bandBlend, bandIndex } from './art-direction.js';
import { SURFACES, applySurface } from './surface-textures.js';

const T = TUNING.TERRAIN;
const F = TUNING.FEATURES;
const R = TUNING.RUN;
// Must match BANK in terrain-mesh.js — the ribbon's edge lift into a turn, so
// a post planted on that edge sits on it rather than through it.
const EDGE_BANK = 0.35;
const CHUNKS = T.CHUNKS_AHEAD + T.CHUNKS_BEHIND + 1;

const CAP_TREE = CHUNKS * (F.TREE_COUNT[1] + 2) * 2;
const CAP_ROCK = CHUNKS * (F.ROCK_COUNT[1] + 2);
const CAP_POLE = CHUNKS * 6;

const m4 = new THREE.Matrix4();
const mSnow = new THREE.Matrix4();
const q = new THREE.Quaternion();
const qTilt = new THREE.Quaternion();
const vPos = new THREE.Vector3();
const vSnowPos = new THREE.Vector3();
const vScale = new THREE.Vector3();
const vSnowScale = new THREE.Vector3();
const axisY = new THREE.Vector3(0, 1, 0);
const axisZ = new THREE.Vector3(0, 0, 1);
const mixColor = new THREE.Color();
const tintColor = new THREE.Color();

const fract = (v) => v - Math.floor(v);

function surfaceMat(color, role, roughness, metalness = 0) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true, dithering: true });
  const surf = role === 'snow' ? SURFACES.snow :
    role === 'bark' ? SURFACES.bark : role === 'rock' ? SURFACES.rock : SURFACES.metal;
  applySurface(m, surf, { roughness, metalness });
  m.name = `descent-${role}`;
  return m;
}

export class Props {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    scene.add(this.group);

    const pineGeo = new THREE.ConeGeometry(1.75, 5.2, 7, 1);
    pineGeo.translate(0, 2.6, 0);
    const pineSnowGeo = new THREE.ConeGeometry(1.48, 2.05, 7, 1);
    pineSnowGeo.translate(0, 4.05, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.34, 1.7, 6);
    trunkGeo.translate(0, 0.85, 0);
    const rockGeo = new THREE.IcosahedronGeometry(1.0, 0);
    const rockSnowGeo = new THREE.SphereGeometry(0.88, 7, 4);
    rockSnowGeo.scale(1, 0.18, 0.82);
    rockSnowGeo.translate(0, 0.82, 0);
    const poleGeo = new THREE.CylinderGeometry(
      F.GATE_POLE_RADIUS, F.GATE_POLE_RADIUS, F.GATE_POLE_HEIGHT, 7
    );
    poleGeo.translate(0, F.GATE_POLE_HEIGHT / 2, 0);
    const tipGeo = new THREE.OctahedronGeometry(0.5, 0);
    tipGeo.translate(0, F.GATE_POLE_HEIGHT + 0.35, 0);

    this.mats = {
      pine: surfaceMat(PALETTE.PINE, 'bark', 0.9, 0),
      trunk: surfaceMat(PALETTE.TRUNK, 'bark', 0.92, 0),
      rock: surfaceMat(PALETTE.ROCK, 'rock', 0.89, 0.005),
      snow: surfaceMat(PALETTE.SNOW_CREST, 'snow', 0.92, 0),
      pole: surfaceMat(PALETTE.GATE_POLE, 'metal', 0.5, 0.2),
      tip: surfaceMat(PALETTE.GATE_TIP, 'metal', 0.42, 0.16),
    };

    this.pine = this._inst(pineGeo, this.mats.pine, CAP_TREE);
    this.pineSnow = this._inst(pineSnowGeo, this.mats.snow, CAP_TREE);
    this.trunk = this._inst(trunkGeo, this.mats.trunk, CAP_TREE);
    this.rock = this._inst(rockGeo, this.mats.rock, CAP_ROCK);
    this.rockSnow = this._inst(rockSnowGeo, this.mats.snow, CAP_ROCK);
    this.pole = this._inst(poleGeo, this.mats.pole, CAP_POLE);
    this.tip = this._inst(tipGeo, this.mats.tip, CAP_POLE);

    this.baseCi = null;
  }

  _inst(geo, mat, cap) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    this.group.add(m);
    return m;
  }

  _setMood(playerD) {
    const mix = bandBlend(playerD);
    const a = MOUNTAIN_BANDS[mix.from];
    const b = MOUNTAIN_BANDS[mix.to];

    this.mats.pine.color.setHex(a.pine).lerp(mixColor.setHex(b.pine), mix.t);
    this.mats.trunk.color.setHex(a.rockDark).lerp(mixColor.setHex(b.rockDark), mix.t);
    this.mats.rock.color.setHex(a.rock).lerp(mixColor.setHex(b.rock), mix.t);
    this.mats.snow.color.setHex(a.crest).lerp(mixColor.setHex(b.crest), mix.t);

    const depth = Math.min(1, playerD / 3200);
    this.mats.pole.color.setHex(PALETTE.GATE_POLE).lerp(mixColor.setHex(0x39434c), depth * 0.7);
    this.mats.tip.color.setHex(PALETTE.GATE_TIP).lerp(mixColor.setHex(0x9bb5c3), depth * 0.55);
  }

  update(playerD, force = false) {
    const base = Math.floor(playerD / T.CHUNK_LEN) - T.CHUNKS_BEHIND;
    if (base === this.baseCi && !force) return;
    this.baseCi = base;
    this._setMood(playerD);

    let nTree = 0, nTreeSnow = 0, nRock = 0, nRockSnow = 0, nPole = 0;

    for (let i = 0; i < CHUNKS; i++) {
      const chunk = this.terrain.chunk(base + i);
      for (const c of chunk.colliders) {
        const y = this.terrain.heightAt(c.x, c.d);
        vPos.set(c.x, y, -c.d);
        const depthBand = bandIndex(c.d);

        if (c.type === FEATURE.TREE && nTree < CAP_TREE) {
          const j = Math.sin(c.x * 12.9898 + c.d * 78.233) * 43758.5453;
          const f = fract(j);
          const f2 = fract(Math.sin(c.x * 31.77 + c.d * 9.17) * 13579.2468);
          const yaw = f * Math.PI * 2;
          const s = 0.78 + fract(j * 7) * 0.62;
          q.setFromAxisAngle(axisY, yaw);

          if (depthBand <= 1) vScale.set(s, s * (0.86 + (s - 0.78) * 0.38), s);
          else if (depthBand === 2) vScale.set(s * 0.64, s * 1.35, s * 0.64);
          else vScale.set(s * 0.42, s * 1.72, s * 0.42);

          // Even early resort trees lean a little. Deeper trees become much
          // more wind-beaten, which breaks the repeated upright-cone rhythm.
          const leanMax = depthBand <= 1 ? 0.11 : depthBand === 2 ? 0.23 : 0.38;
          qTilt.setFromAxisAngle(axisZ, (f2 - 0.5) * leanMax);
          q.multiply(qTilt);

          m4.compose(vPos, q, vScale);
          this.pine.setMatrixAt(nTree, m4);
          this.trunk.setMatrixAt(nTree, m4);

          const tint = 0.86 + f2 * 0.24;
          tintColor.setRGB(tint * 0.97, tint, tint * 0.98);
          this.pine.setColorAt(nTree, tintColor);
          this.trunk.setColorAt(nTree, tintColor.setRGB(tint * 0.94, tint * 0.96, tint));

          // Snow is common, not uniform. Some trees are bare, and the cap size
          // varies enough to stop every tree from wearing the same white hat.
          const snowChance = depthBand >= 3 ? 0.58 : depthBand === 2 ? 0.72 : 0.78;
          if (f2 < snowChance && nTreeSnow < CAP_TREE) {
            const capW = 0.55 + fract(j * 13.1) * 0.42;
            const capH = 0.72 + fract(j * 19.7) * 0.28;
            vSnowScale.set(vScale.x * capW, vScale.y * capH, vScale.z * capW);
            vSnowPos.copy(vPos);
            vSnowPos.x += (f - 0.5) * 0.12;
            mSnow.compose(vSnowPos, q, vSnowScale);
            this.pineSnow.setMatrixAt(nTreeSnow++, mSnow);
          }
          nTree++;
        } else if (c.type === FEATURE.ROCK && nRock < CAP_ROCK) {
          const j = Math.sin(c.x * 39.3468 + c.d * 11.135) * 24634.6345;
          const f = fract(j);
          const f2 = fract(Math.sin(c.x * 17.41 + c.d * 44.93) * 97531.642);
          q.setFromAxisAngle(axisY, f * Math.PI * 2);

          if (depthBand < 2) vScale.set(c.r * (0.86 + f2 * 0.32), c.r * (0.48 + f * 0.48), c.r * (0.78 + f2 * 0.34));
          else if (depthBand === 2) vScale.set(c.r * (0.68 + f * 0.38), c.r * (0.92 + f2 * 0.98), c.r * (0.62 + f * 0.26));
          else vScale.set(c.r * (0.45 + f * 0.30), c.r * (1.15 + f2 * 1.45), c.r * (0.50 + f * 0.22));

          vPos.y = y + c.r * 0.22;
          m4.compose(vPos, q, vScale);
          this.rock.setMatrixAt(nRock, m4);

          const tint = 0.82 + f2 * 0.30;
          tintColor.setRGB(tint * 0.94, tint * 0.99, Math.min(1.15, tint * 1.05));
          this.rock.setColorAt(nRock, tintColor);

          const snowChance = depthBand >= 3 ? 0.38 : 0.62;
          if (f < snowChance && nRockSnow < CAP_ROCK) {
            const capW = 0.58 + f2 * 0.42;
            vSnowScale.set(vScale.x * capW, vScale.y * (0.42 + f * 0.30), vScale.z * (0.62 + f2 * 0.32));
            vSnowPos.copy(vPos);
            vSnowPos.x += (f2 - 0.5) * 0.22;
            mSnow.compose(vSnowPos, q, vSnowScale);
            this.rockSnow.setMatrixAt(nRockSnow++, mSnow);
          }
          nRock++;
        } else if (c.type === FEATURE.GATE && nPole < CAP_POLE) {
          // Playtest: "the poles aren't attached to anything". They weren't —
          // they took the generator's own x and the terrain height there,
          // which for a verge post is a point somewhere off the side of a
          // ribbon that is the only visible ground in the scene, so each one
          // stood on nothing. Snap them to the ribbon's own edge, on the side
          // they were generated, at the banked height that edge actually sits
          // at. They now rise off the rail — which is also where the etched
          // grid stops — so the road has one continuous boundary instead of
          // three things that nearly agree.
          const cx = this.terrain.corridorX(c.d);
          const side = c.x >= cx ? 1 : -1;
          const slope = this.terrain.corridorSlope ? this.terrain.corridorSlope(c.d) : 0;
          vPos.set(cx + side * R.TRACK_HALF_W,
            -side * slope * EDGE_BANK * R.TRACK_HALF_W * 0.5, -c.d);
          q.identity();
          vScale.set(1, 1, 1);
          m4.compose(vPos, q, vScale);
          this.pole.setMatrixAt(nPole, m4);
          this.tip.setMatrixAt(nPole, m4);
          nPole++;
        }
      }
    }

    this.pine.count = nTree; this.trunk.count = nTree; this.pineSnow.count = nTreeSnow;
    this.rock.count = nRock; this.rockSnow.count = nRockSnow;
    this.pole.count = nPole; this.tip.count = nPole;
    for (const m of [this.pine, this.pineSnow, this.trunk, this.rock, this.rockSnow, this.pole, this.tip]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  reset() { this.baseCi = null; }

  dispose() {
    const meshes = [this.pine, this.pineSnow, this.trunk, this.rock, this.rockSnow, this.pole, this.tip];
    const disposedMaterials = new Set();
    for (const m of meshes) {
      m.geometry.dispose();
      if (!disposedMaterials.has(m.material)) {
        m.material.dispose();
        disposedMaterials.add(m.material);
      }
    }
  }
}
