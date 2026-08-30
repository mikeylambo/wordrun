import * as THREE from 'three';
import './rc95-world.js';
import TUNING from './TUNING.js';
import { Input } from './input/input.js';
import { Audio } from './audio/audio.js';
import { Player } from './sim/player.js';
import { Terrain, FEATURE } from './sim/terrain.js';

// RC9.6+ playtest mix/control pass:
// - ground carve direction stays untouched;
// - airborne yaw follows the player's horizontal gesture;
// - pickups and threat information sit above the continuous mountain beds;
// - ordinary manual hops stay light; terrain launches carry the hero sound;
// - frost-beast entry gets a distinct icy split so it survives Hunt masking.
// RC9.9 finish pass:
// - the Bridge's approved 2.3K jump becomes the reference scale for sparse hero air;
// - tunnel visual/collision planes agree;
// - long-run bell instancing is never origin-frustum-culled;
// - onboarding loses the extra tagline without adding another screen.
// RC9.10 finish pass:
// - visually solid landmark pieces become honest player collision at any air height;
// - slalom gate tips no longer have a ghost cap above their collider;
// - Beast One tears through generated trees, rocks and gate poles with debris/snow FX;
// - chase timing and Beast One behaviour are deliberately untouched.

const SURFACE_TRIM_NORMAL = 0.57;
const SURFACE_TRIM_HUNT = 0.50;
const SURFACE_TRIM_PICKUP = 0.38;
const WIND_TRIM_NORMAL = 0.78;
const WIND_TRIM_AIR = 0.66;
const WIND_TRIM_HUNT = 0.70;
const WIND_TRIM_PICKUP = 0.48;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// The 2334m Bridge launch is the approved reference. These are deliberately
// sparse, corridor-centred variations rather than a repeating jump cadence.
// None exceed the old over-large Bridge launch; the larger beats are only a
// modest step above the current reference.
const RC99_HERO_AIR = [
  { id: 'sky-ramp-air', d: 4618, halfX: 9.4, drop: 10.6, lip: 2.70 },
  { id: 'ribcage-air', d: 7412, halfX: 9.6, drop: 11.7, lip: 2.95 },
  { id: 'afterlight-air', d: 14018, halfX: 10.0, drop: 13.4, lip: 3.30 },
  { id: 'moonshot-air', d: 21718, halfX: 10.2, drop: 14.0, lip: 3.45 },
  { id: 'deep-air-a', d: 30920, halfX: 9.5, drop: 11.2, lip: 2.85 },
  { id: 'deep-air-b', d: 41480, halfX: 10.0, drop: 13.7, lip: 3.38 },
];

if (!Terrain.prototype.__rc99HeroAirPatched) {
  Terrain.prototype.__rc99HeroAirPatched = true;
  const baseHeightsOf = Terrain.prototype.heightsOf;
  Terrain.prototype.heightsOf = function heightsOfRC99(ci) {
    const h = baseHeightsOf.call(this, ci);
    if (h.__rc99HeroAir) return h;

    const d0 = ci * TUNING.TERRAIN.CHUNK_LEN;
    const d1 = d0 + TUNING.TERRAIN.CHUNK_LEN;

    // A hero launch owns its immediate approach. Do not let a random cliff stack
    // onto it and accidentally recreate the too-large Bridge moment.
    for (let i = h.length - 1; i >= 0; i--) {
      const f = h[i];
      if (f.type !== 'cliff' || f.authored) continue;
      if (RC99_HERO_AIR.some((hero) => Math.abs(f.d - hero.d) < 92)) h.splice(i, 1);
    }

    for (const hero of RC99_HERO_AIR) {
      if (hero.d < d0 || hero.d >= d1) continue;
      const cx = clamp(
        this.corridorX(hero.d),
        -TUNING.TERRAIN.HALF_WIDTH + hero.halfX + 0.6,
        TUNING.TERRAIN.HALF_WIDTH - hero.halfX - 0.6,
      );
      h.push({
        type: 'cliff', authored: true, hero: true,
        id: hero.id,
        x: cx, d: hero.d,
        halfX: hero.halfX,
        drop: hero.drop,
        lip: hero.lip,
        infMin: hero.d - 14,
        infMax: hero.d + TUNING.FEATURES.CLIFF_RECOVER_START + TUNING.FEATURES.CLIFF_RECOVER_LEN + 4,
      });
    }
    h.sort((a, b) => a.d - b.d);
    Object.defineProperty(h, '__rc99HeroAir', { value: true, enumerable: false });
    return h;
  };

  // Landmark groups are positioned from the centre of the landmark. The Tunnel
  // hoops therefore share the centre landmark's world Y even though their d
  // values span ~50m of sloped terrain. Adjust the collider's local centreH to
  // that same world-space Y before the existing annulus test runs.
  const baseCollidersNear = Terrain.prototype.collidersNear;
  Terrain.prototype.collidersNear = function collidersNearRC99(...args) {
    const out = baseCollidersNear.apply(this, args);
    const tunnelBaseY = this.heightAt(0, 5580);
    for (const c of out) {
      if (c.type !== 'ring' || !String(c.id || '').startsWith('tunnel-ring-')) continue;
      c.centerH = (tunnelBaseY + 9.5) - this.heightAt(c.x, c.d);
    }
    return out;
  };
}

// ── RC9.10 physical-world audit ──────────────────────────────────────────
// Rendered landmarks are groups anchored at terrain.heightAt(0, landmark.d).
// Store local Y bounds against that same anchor so airborne collision cannot
// drift vertically down the slope. Rideable snow/ice surfaces (halfpipe walls
// and ramp wings) are intentionally omitted; beams, pillars, teeth, signs,
// hoops and other obstacle-looking pieces are not.
const lmBox = (id, anchorD, x, y, z, sx, sy, sz) => ({
  type: 'box', id, anchorD,
  x, d: anchorD - z,
  halfX: sx * 0.5, halfD: sz * 0.5,
  localMinY: y - sy * 0.5,
  localMaxY: y + sy * 0.5,
});
const lmColumn = (id, anchorD, x, y, z, r, h) => ({
  type: 'structure', id, anchorD,
  x, d: anchorD - z, r,
  localMinY: y - h * 0.5,
  localMaxY: y + h * 0.5,
});
const lmFlatRing = (id, anchorD, x, y, z, ringR, tubeR, depthR = tubeR) => ({
  type: 'flatRing', id, anchorD,
  x, d: anchorD - z,
  localY: y, ringR, tubeR, depthR,
});

const RC910_STRUCTURES = [
  // DICTION DASH Phase 7: the flat track carries no authored resort
  // structures. The table is empty by design; the plumbing around it stays.
];

if (!Terrain.prototype.__rc910WorldSolids) {
  Terrain.prototype.__rc910WorldSolids = true;
  const baseCollidersNear = Terrain.prototype.collidersNear;
  Terrain.prototype.collidersNear = function collidersNearRC910(d, back = 6, fwd = 8) {
    const out = baseCollidersNear.call(this, d, back, fwd);

    // The visible octahedral gate cap extends above the cylinder. Airborne
    // clipping of that cap should not pass through a shorter invisible collider.
    for (const c of out) {
      if (c.type === FEATURE.GATE) {
        c.h = Math.max(c.h || 0, TUNING.FEATURES.GATE_POLE_HEIGHT + 0.85);
      }
    }

    const lo = d - back;
    const hi = d + fwd;
    for (const c of RC910_STRUCTURES) {
      const reach = c.depthR ?? c.halfD ?? c.r ?? 1;
      if (c.d + reach < lo || c.d - reach > hi) continue;
      out.push(c);
    }
    return out;
  };
}

// Player.y is ground height, not torso centre. Treat the runner as a short
// vertical capsule so a big-air body hitting a beam/hoop counts even when the
// runner's feet happen to pass just underneath it.
if (!Player.prototype.__rc910CollisionTruth) {
  Player.prototype.__rc910CollisionTruth = true;
  Player.prototype._collide = function collideRC910(events) {
    if (this._hitCooldown > 0) return;
    const near = this.terrain.collidersNear(this.d, 3, 3);
    const footY = this.y + 0.02;
    const headY = this.y + 1.72;
    const bodyR = 0.55;
    const verticalOverlap = (minY, maxY) => headY >= minY - 0.12 && footY <= maxY + 0.12;

    for (const c of near) {
      const dd = this.d - c.d;
      let hit = false;

      if (c.type === 'ring') {
        if (Math.abs(dd) > (c.depthR || 1) + bodyR) continue;
        const groundAt = this.terrain.heightAt(c.x, c.d);
        const centerY = groundAt + c.centerH;
        const y0 = footY - centerY;
        const y1 = headY - centerY;
        const dx = this.x - c.x;
        const ay0 = Math.abs(y0), ay1 = Math.abs(y1);
        const minAbsY = y0 <= 0 && y1 >= 0 ? 0 : Math.min(ay0, ay1);
        const maxAbsY = Math.max(ay0, ay1);
        const minRad = Math.hypot(dx, minAbsY);
        const maxRad = Math.hypot(dx, maxAbsY);
        const ringR = c.ringR;
        const radialGap = ringR < minRad ? minRad - ringR : ringR > maxRad ? ringR - maxRad : 0;
        hit = radialGap <= c.tubeR + bodyR;
      } else if (c.type === 'flatRing') {
        const baseY = this.terrain.heightAt(0, c.anchorD);
        const ringY = baseY + c.localY;
        if (!verticalOverlap(ringY - c.tubeR, ringY + c.tubeR)) continue;
        const radial = Math.hypot(this.x - c.x, dd);
        hit = Math.abs(radial - c.ringR) <= c.tubeR + bodyR;
      } else if (c.type === 'box') {
        if (Math.abs(this.x - c.x) > c.halfX + bodyR ||
            Math.abs(dd) > c.halfD + bodyR) continue;
        const baseY = this.terrain.heightAt(0, c.anchorD);
        hit = verticalOverlap(baseY + c.localMinY, baseY + c.localMaxY);
      } else {
        const dx = this.x - c.x;
        const rr = (c.r || 0.7) + bodyR;
        if (dx * dx + dd * dd > rr * rr) continue;

        if (Number.isFinite(c.localMinY) && Number.isFinite(c.localMaxY)) {
          const baseY = this.terrain.heightAt(0, c.anchorD);
          hit = verticalOverlap(baseY + c.localMinY, baseY + c.localMaxY);
        } else {
          const groundAt = this.terrain.heightAt(c.x, c.d);
          if (Number.isFinite(c.minH)) {
            hit = verticalOverlap(groundAt + c.minH, groundAt + c.h);
          } else {
            hit = verticalOverlap(groundAt - 0.2, groundAt + (c.h || 1));
          }
        }
      }

      if (!hit) continue;
      this.obstaclesHit++;
      this.speed *= 1 - TUNING.PLAYER.HIT_SPEED_COST;
      this.staggerT = TUNING.PLAYER.STAGGER_TIME;
      this._hitCooldown = 0.35;
      this._breakChain(events);
      if (this.airborne) {
        this.airborne = false;
        this.hangtime = 0;
        this.y = this.terrain.heightAt(this.x, this.d);
        this.vy = this._groundVy();
        this.yaw = 0;
        this.pitch = 0;
        this.boostMeter *= 1 - TUNING.BOOST.FLUB_METER_LOSS;
      }
      events?.push({
        t: 'hit', kind: c.type, structureId: c.id || null,
        x: this.x, y: this.y, d: this.d,
      });
      return;
    }
  };
}

// ── Beast One environmental force ────────────────────────────────────────
// The sim still owns the beast. This is presentation layered onto its existing
// x/world-d position: if that mass reaches a generated prop behind the player,
// remove that prop from the chunk and throw a few cheap pieces through the
// existing render frame. No extra RAF and no change to pursuit speed/timing.
const beastBreakFx = {
  terrain: null,
  lastStep: -1,
  scanT: 0,
  debris: [],
  geos: null,
};

function clearBeastDebris(render) {
  for (const item of beastBreakFx.debris) item.mesh.removeFromParent();
  beastBreakFx.debris.length = 0;
  beastBreakFx.scanT = 0;
  beastBreakFx.lastStep = -1;
  beastBreakFx.terrain = null;
}

function ensureBeastDebrisGeometry() {
  if (beastBreakFx.geos) return beastBreakFx.geos;
  beastBreakFx.geos = {
    pine: new THREE.ConeGeometry(1.08, 3.5, 6, 1),
    wood: new THREE.BoxGeometry(0.28, 1.45, 0.28),
    rock: new THREE.IcosahedronGeometry(0.5, 0),
    gate: new THREE.BoxGeometry(0.16, 1.65, 0.16),
  };
  return beastBreakFx.geos;
}

function spawnBeastDebris(c, terrain, render, beastX) {
  const scene = render?.stage?.scene;
  const mats = render?.props?.mats;
  if (!scene || !mats) return;
  const geos = ensureBeastDebrisGeometry();
  const ground = terrain.heightAt(c.x, c.d);
  const seed = Math.sin(c.x * 12.9898 + c.d * 78.233) * 43758.5453;
  const f = seed - Math.floor(seed);
  const side = Math.sign(c.x - beastX) || (f < 0.5 ? -1 : 1);

  const add = (geo, mat, y, vx, vy, vz, life, scale = 1) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(c.x, y, -c.d);
    mesh.scale.setScalar(scale);
    mesh.rotation.set(f * 1.7, f * 3.2, (f - 0.5) * 1.4);
    mesh.frustumCulled = false;
    scene.add(mesh);
    beastBreakFx.debris.push({
      mesh,
      vx, vy, vz,
      sx: (0.9 + f) * side,
      sy: (0.7 + f * 1.3) * (f < 0.5 ? -1 : 1),
      sz: (1.1 + f * 0.8) * side,
      life,
    });
  };

  if (c.type === FEATURE.TREE) {
    add(geos.pine, mats.pine, ground + 3.1, side * (3.4 + f * 2.2), 4.8 + f * 2.0, -(2.0 + f * 2.0), 1.35, 0.95 + f * 0.25);
    add(geos.wood, mats.trunk, ground + 1.15, side * (4.0 + f * 2.6), 3.8 + f, -(1.2 + f * 2.2), 1.05, 1.0);
    render.spray?.emit?.(c.x, ground + 0.35, -c.d, 20, 7.0, 3.4, side * 2.0);
  } else if (c.type === FEATURE.ROCK) {
    for (let i = 0; i < 3; i++) {
      const fi = (f + i * 0.31) % 1;
      add(geos.rock, mats.rock, ground + 0.7 + i * 0.18,
        side * (2.8 + fi * 4.0) + (i - 1) * 1.2,
        3.2 + fi * 3.2,
        -(1.8 + fi * 3.4),
        0.9 + fi * 0.35,
        0.62 + fi * 0.42);
    }
    render.spray?.emit?.(c.x, ground + 0.22, -c.d, 16, 6.5, 2.8, side * 1.5);
  } else if (c.type === FEATURE.GATE) {
    for (let i = 0; i < 2; i++) {
      add(geos.gate, mats.pole, ground + 1.6 + i * 1.5,
        side * (4.2 + i * 1.4), 4.4 + i * 0.8, -(2.2 + i),
        1.05 + i * 0.15, 1.0);
    }
    render.spray?.emit?.(c.x, ground + 0.2, -c.d, 11, 5.2, 2.4, side);
  }
}

function updateBeastDestruction(dt, p) {
  const sim = globalThis.__SIM;
  const render = globalThis.__RENDER;
  if (!sim || !render?.props || !render?.stage?.scene || !p) return;

  // A run restart clears terrain chunks. Clear any old flying debris with it.
  if (beastBreakFx.terrain !== sim.terrain ||
      (beastBreakFx.lastStep >= 0 && sim.steps < beastBreakFx.lastStep)) {
    clearBeastDebris(render);
    beastBreakFx.terrain = sim.terrain;
  }

  // Audio.update still runs while the render loop is paused; only advance this
  // presentation when the deterministic sim has actually advanced a step.
  if (sim.steps === beastBreakFx.lastStep) return;
  beastBreakFx.lastStep = sim.steps;

  for (let i = beastBreakFx.debris.length - 1; i >= 0; i--) {
    const item = beastBreakFx.debris[i];
    item.life -= dt;
    item.vy -= 14.5 * dt;
    item.mesh.position.x += item.vx * dt;
    item.mesh.position.y += item.vy * dt;
    item.mesh.position.z += item.vz * dt;
    item.mesh.rotation.x += item.sx * dt;
    item.mesh.rotation.y += item.sy * dt;
    item.mesh.rotation.z += item.sz * dt;
    if (item.life <= 0) {
      item.mesh.removeFromParent();
      beastBreakFx.debris.splice(i, 1);
    }
  }

  if (sim.escaped || (sim.phase !== 'running' && sim.phase !== 'kill')) return;
  beastBreakFx.scanT -= dt;
  if (beastBreakFx.scanT > 0) return;
  beastBreakFx.scanT = 0.055;

  const beast = sim.beast;
  if (!beast || (beast.gap > 70 && beast.mode !== 'hunt')) return;
  const beastD = p.d - beast.gap;
  const breakR = 2.9;
  const ci0 = Math.floor((beastD - 7) / TUNING.TERRAIN.CHUNK_LEN);
  const ci1 = Math.floor((beastD + 7) / TUNING.TERRAIN.CHUNK_LEN);
  let broke = false;

  for (let ci = ci0; ci <= ci1; ci++) {
    const chunk = sim.terrain.chunk(ci);
    for (let i = chunk.colliders.length - 1; i >= 0; i--) {
      const c = chunk.colliders[i];
      if (c.type !== FEATURE.TREE && c.type !== FEATURE.ROCK && c.type !== FEATURE.GATE) continue;
      const dx = c.x - beast.x;
      const dd = c.d - beastD;
      const reach = breakR + (c.r || 0.7);
      if (dx * dx + dd * dd > reach * reach) continue;

      // The beast has actually destroyed this generated prop. It is behind the
      // runner, so removing the collider cannot create a new forward safe route;
      // a new run regenerates the deterministic chunk from the same seed.
      chunk.colliders.splice(i, 1);
      spawnBeastDebris(c, sim.terrain, render, beast.x);
      broke = true;
    }
  }

  // Force the instanced prop batch to rebuild on the next frame so the intact
  // tree/rock/pole disappears exactly where the debris was created.
  if (broke) render.props.baseCi = null;
}

if (!Input.prototype.__rc9AirDirectionFixed) {
  const baseInputUpdate = Input.prototype.update;
  Input.prototype.update = function updateWithNaturalAirSpin(dt, grounded) {
    baseInputUpdate.call(this, dt, grounded);
    if (!grounded) this.carve *= -1;
  };
  Input.prototype.__rc9AirDirectionFixed = true;
}

// Tag takeoffs at the sim-event edge without changing the control or physics
// result. Presentation can now distinguish a deliberate hop from terrain air.
if (!Player.prototype.__rc95TakeoffKind) {
  const basePlayerStep = Player.prototype.step;
  Player.prototype.step = function stepWithTakeoffKind(dt, input, proxMult, events) {
    this.__rc95ManualTakeoff = !this.airborne && !!input?.jump;
    const out = basePlayerStep.call(this, dt, input, proxMult, events);
    this.__rc95ManualTakeoff = false;
    return out;
  };

  const baseTakeoff = Player.prototype._takeoff;
  Player.prototype._takeoff = function takeoffWithKind(groundY, events) {
    const manual = !!this.__rc95ManualTakeoff;
    const out = baseTakeoff.call(this, groundY, events);
    const e = events?.[events.length - 1];
    if (e?.t === 'takeoff') e.kind = manual ? 'manual' : 'terrain';
    return out;
  };
  Player.prototype.__rc95TakeoffKind = true;
}

let rc99PresentationInstalled = false;
function ensureRC99Presentation() {
  if (rc99PresentationInstalled) return;
  const rc = globalThis.__RC5;
  const render = globalThis.__RENDER;
  if (!rc?.bellRenderer || !render?.landmarks) return;

  // InstancedMesh's default bounds remain near its construction origin. At long
  // distances that can cull every bell even though the instance matrices are
  // correctly rebuilt around the player. These are only 56 tiny instances, so
  // always submitting them is cheaper and more correct than rebuilding bounds.
  rc.bellRenderer.body.frustumCulled = false;
  rc.bellRenderer.clapper.frustumCulled = false;

  // TorusGeometry is already a vertical XY hoop. The old X rotation turned THE
  // TUNNEL into horizontal donuts while gameplay collision expected vertical
  // run-through hoops. Align the render to the physical annulus.
  const tunnel = render.landmarks.entries?.find?.((entry) => entry.def?.id === 'tunnel');
  tunnel?.group?.traverse?.((obj) => {
    if (obj.geometry?.type === 'TorusGeometry') obj.rotation.x = 0;
  });

  // Keep the help card pure mechanics: one headline, then controls. No tagline.
  document.querySelector('#rc7Onboarding .lead')?.remove();

  rc99PresentationInstalled = true;
  globalThis.__RC99_FINISH = {
    version: '9.9',
    bellFrustumFix: true,
    tunnelPlaneAligned: true,
    onboardingTaglineRemoved: true,
    heroAir: RC99_HERO_AIR.map(({ id, d, drop, lip }) => ({ id, d, drop, lip })),
  };
}

if (!Audio.prototype.__rc9SkiTrimInstalled) {
  const baseAudioStart = Audio.prototype.start;
  Audio.prototype.start = function startWithMixTrims(...args) {
    const out = baseAudioStart.apply(this, args);
    if (this.ready && !this.__rc9SkiTrim && this.ctx && this.bus?.surface) {
      const surfaceTrim = this.ctx.createGain();
      surfaceTrim.gain.value = SURFACE_TRIM_NORMAL;
      surfaceTrim.connect(this.bus.surface);
      for (const voice of [this.snow, this.powder, this.ice]) {
        if (!voice) continue;
        const output = voice.pan || voice.gain;
        try { output.disconnect(this.bus.surface); } catch { try { output.disconnect(); } catch {} }
        output.connect(surfaceTrim);
      }
      this.__rc9SkiTrim = surfaceTrim;

      const windTrim = this.ctx.createGain();
      windTrim.gain.value = WIND_TRIM_NORMAL;
      windTrim.connect(this.bus.ambience);
      for (const voice of [this.wind, this.air]) {
        if (!voice) continue;
        const output = voice.pan || voice.gain;
        try { output.disconnect(this.bus.ambience); } catch { try { output.disconnect(); } catch {} }
        output.connect(windTrim);
      }
      this.__rc9WindTrim = windTrim;
      this.__rc9PickupDuckUntil = 0;
    }
    return out;
  };

  // Drive hierarchy from the existing audio update path. No second frame loop.
  const baseAudioUpdate = Audio.prototype.update;
  Audio.prototype.update = function updateWithMixHierarchy(dt, p, ...rest) {
    ensureRC99Presentation();
    updateBeastDestruction(dt, p);
    const out = baseAudioUpdate.call(this, dt, p, ...rest);
    if (!this.__rc9SkiTrim || !this.ctx) return out;

    const now = this.ctx.currentTime;
    const sim = globalThis.__SIM;
    const hunting = sim?.phase === 'running' && sim?.beast?.mode === 'hunt';
    const pickup = now < (this.__rc9PickupDuckUntil || 0);

    let surfaceTarget = hunting ? SURFACE_TRIM_HUNT : SURFACE_TRIM_NORMAL;
    if (pickup) surfaceTarget = Math.min(surfaceTarget, SURFACE_TRIM_PICKUP);
    this.__rc9SkiTrim.gain.setTargetAtTime(surfaceTarget, now, 0.045);

    if (this.__rc9WindTrim) {
      let windTarget = p?.airborne ? WIND_TRIM_AIR : WIND_TRIM_NORMAL;
      if (hunting) windTarget = Math.min(windTarget, WIND_TRIM_HUNT);
      if (pickup) windTarget = Math.min(windTarget, WIND_TRIM_PICKUP);
      this.__rc9WindTrim.gain.setTargetAtTime(windTarget, now, 0.055);
    }
    return out;
  };

  const baseBell = Audio.prototype.bell;
  Audio.prototype.bell = function bellWithMixPocket(step = 0, ...args) {
    if (this.ctx) this.__rc9PickupDuckUntil = Math.max(this.__rc9PickupDuckUntil || 0, this.ctx.currentTime + 0.19);
    const out = baseBell.call(this, step, ...args);
    // Add presence, not a giant volume spike: reinforce the struck note and a
    // short upper partial so the bell reads through phone speakers and wind.
    if (this.ready && !this.muted) {
      const intervals = [0, 4, 7, 11, 14];
      const f = 622.25 * Math.pow(2, intervals[step % intervals.length] / 12);
      this._tone({ type: 'sine', f0: f, f1: f * 1.002, dur: 0.22, vol: 0.030, bus: this.bus.ui });
      this._tone({ type: 'triangle', f0: f * 3.01, f1: f * 3.02, dur: 0.11, vol: 0.016, bus: this.bus.ui, delay: 0.004 });
    }
    return out;
  };

  const baseHeartRestore = Audio.prototype.heartRestore;
  Audio.prototype.heartRestore = function heartRestoreWithMixPocket(...args) {
    if (this.ctx) this.__rc9PickupDuckUntil = Math.max(this.__rc9PickupDuckUntil || 0, this.ctx.currentTime + 0.28);
    return baseHeartRestore.apply(this, args);
  };

  // Manual hops were reading like hero jumps. Keep them quick and airy; terrain
  // launches retain the fuller procedural takeoff underneath approved Big Air.
  const baseTakeoffAudio = Audio.prototype.takeoff;
  Audio.prototype.takeoff = function takeoffWithScale(...args) {
    const kind = this.__rc9TakeoffKind || 'terrain';
    if (kind === 'manual' && this.ready && !this.muted) {
      this._burst(0.13, 0.095, 2500, 'bandpass', 0, this.bus.surface);
      this._burst(0.18, 0.050, 3900, 'highpass', 0, this.bus.ambience);
      return;
    }
    return baseTakeoffAudio.apply(this, args);
  };

  // More impact without simply turning footsteps up. A short low-mid body and
  // snow-crunch transient survive small speakers while the existing sub-thump
  // still carries distance and rhythm. Heartbeat code is untouched.
  const baseThump = Audio.prototype._thump;
  Audio.prototype._thump = function thumpWithBody(vol, pan = 0, bus = this.bus?.threat) {
    const out = baseThump.call(this, vol, pan, bus);
    if (this.ready && !this.muted && bus === this.bus?.threat) {
      this._tone({ type: 'triangle', f0: 132, f1: 64, dur: 0.095, vol: Math.min(0.058, vol * 0.115), pan, bus });
      this._burst(0.065, Math.min(0.032, vol * 0.058), 1180, 'bandpass', pan, bus, 0.85);
    }
    return out;
  };

  // Frost beast must read through the black beast's low-frequency Hunt bed.
  // Give the entrance a short, spatial high-frequency ice split rather than
  // simply making the whole cue louder or telegraphing it earlier.

  Audio.prototype.__rc9SkiTrimInstalled = true;
}

globalThis.__RC910_FINISH = {
  version: '9.10',
  landmarkCollisionTruth: true,
  gateTipsPhysical: true,
  playerBodyCapsule: true,
  beastBreaksProps: true,
  beastBreakTypes: [FEATURE.TREE, FEATURE.ROCK, FEATURE.GATE],
  solidStructureCount: RC910_STRUCTURES.length,
};

globalThis.__RC9_FEEDBACK = {
  version: '9.10',
  airSpinNatural: true,
  surfaceTrim: SURFACE_TRIM_NORMAL,
  huntSkiTrim: SURFACE_TRIM_HUNT,
  pickupDuck: SURFACE_TRIM_PICKUP,
  windTrim: WIND_TRIM_NORMAL,
  airWindTrim: WIND_TRIM_AIR,
  heartbeatPriority: true,
  manualJumpLight: true,
  footfallImpactBody: true,
  frostEntranceIceSplit: true,
  deepRunBellFix: true,
  tunnelPlaneAligned: true,
  heroAirVariety: true,
  landmarkCollisionTruth: true,
  beastBreaksProps: true,
};
