import * as THREE from 'three';
import TUNING from './TUNING.js';
import { Terrain, FEATURE } from './sim/terrain.js';
import { Player } from './sim/player.js';
import { Audio } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Storage } from './storage/storage.js';
import { MOUNTAIN_BANDS, bandBlend } from './render/art-direction.js';
import { EndgameSky } from './render/endgame-sky.js';
import { ENDGAME, FINAL_MOUNTAIN, overrunPrestige } from './design/endgame.js';

// V1 finalization deliberately installs after RC9.10's prototype patches. It
// adds no frame loop: everything rides the existing sim/audio/sky update paths.

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, v) => {
  if (a === b) return v >= b ? 1 : 0;
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

function hash32(seed, n) {
  let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function v1Weather(distance, seed = 1) {
  // Keep the authored final forest / false-dawn approach readable. Weather gets
  // its last volatile beat before THE EMPTY instead of obscuring the finale.
  if (distance < 21000 || distance > 23000) return 0;
  const len = 660;
  const seg = Math.floor((distance - 21000) / len);
  if ((hash32(seed, seg) & 3) !== 0) return 0;
  const local = ((distance - 21000) - seg * len) / len;
  const enter = smooth(0.16, 0.34, local);
  const leave = 1 - smooth(0.64, 0.86, local);
  return clamp(enter * leave * 0.88);
}

function installFinalBreak() {
  if (Terrain.prototype.__v1FinalBreak) return;
  Terrain.prototype.__v1FinalBreak = true;
  const base = Terrain.prototype.heightsOf;

  Terrain.prototype.heightsOf = function heightsOfV1(ci) {
    const h = base.call(this, ci);
    if (h.__v1FinalBreak) return h;
    const d0 = ci * TUNING.TERRAIN.CHUNK_LEN;
    const d1 = d0 + TUNING.TERRAIN.CHUNK_LEN;
    const d = FINAL_MOUNTAIN.BREAK_D;

    if (d >= d0 && d < d1) {
      // THE BREAK is the final authored air beat: essentially Bridge scale, not
      // a new height record. Clear accidental procedural stacking around it.
      for (let i = h.length - 1; i >= 0; i--) {
        const f = h[i];
        if (f.type === FEATURE.CLIFF && !f.authored && Math.abs(f.d - d) < 100) h.splice(i, 1);
      }
      const halfX = 10.0;
      const x = clamp(
        this.corridorX(d),
        -TUNING.TERRAIN.HALF_WIDTH + halfX + 0.6,
        TUNING.TERRAIN.HALF_WIDTH - halfX - 0.6,
      );
      h.push({
        type: FEATURE.CLIFF,
        authored: true,
        hero: true,
        id: 'the-break-air',
        x, d, halfX,
        drop: 12.9,
        lip: 3.18,
        infMin: d - 14,
        infMax: d + TUNING.FEATURES.CLIFF_RECOVER_START + TUNING.FEATURES.CLIFF_RECOVER_LEN + 4,
      });
      h.sort((a, b) => a.d - b.d);
    }

    Object.defineProperty(h, '__v1FinalBreak', { value: true, enumerable: false });
    return h;
  };
}

function colliderLockKey(c) {
  return c?.id ? `id:${c.id}` : null;
}

function colliderStillNearPlayer(player, c) {
  if (!c) return false;
  const dx = Math.abs(player.x - (c.x || 0));
  const dd = Math.abs(player.d - (c.d || 0));
  if (c.type === 'box') {
    return dx <= (c.halfX || 0.5) + 2.0 && dd <= (c.halfD || 0.5) + 2.0;
  }
  if (c.type === 'ring' || c.type === 'flatRing') {
    return dd <= (c.depthR || c.tubeR || 1) + 4.0;
  }
  const reach = (c.r || 0.8) + 3.0;
  return dx <= reach && dd <= reach;
}

function installSingleContactDamage() {
  if (Player.prototype.__v1SingleContactDamage) return;
  Player.prototype.__v1SingleContactDamage = true;
  const baseCollide = Player.prototype._collide;

  Player.prototype._collide = function collideOneHeartPerContact(events) {
    const terrain = this.terrain;
    const locks = this.__v1SolidContactLocks || (this.__v1SolidContactLocks = new Set());
    const original = terrain.collidersNear;
    const hadOwn = Object.prototype.hasOwnProperty.call(terrain, 'collidersNear');
    const vicinity = original.call(terrain, this.d, 8, 8);

    // A structure becomes dangerous again only after the runner has actually
    // cleared its physical neighborhood. Staying inside the house cannot drain
    // another heart when the generic hit cooldown expires.
    for (const key of [...locks]) {
      const live = vicinity.some((c) => colliderLockKey(c) === key && colliderStillNearPlayer(this, c));
      if (!live) locks.delete(key);
    }

    terrain.collidersNear = function collidersNearWithoutLatchedStructure(d, back = 6, fwd = 8) {
      return original.call(this, d, back, fwd).filter((c) => {
        const key = colliderLockKey(c);
        return !key || !locks.has(key);
      });
    };

    const beforeHits = this.obstaclesHit;
    const beforeEvents = events?.length || 0;
    try {
      baseCollide.call(this, events);
    } finally {
      if (hadOwn) terrain.collidersNear = original;
      else delete terrain.collidersNear;
    }

    if (this.obstaclesHit <= beforeHits) return;
    for (let i = (events?.length || 0) - 1; i >= beforeEvents; i--) {
      const e = events[i];
      if (e?.t !== 'hit') continue;
      if (e.structureId) locks.add(`id:${e.structureId}`);
      break;
    }
  };
}

function destructionSnapshot(sim, player) {
  if (!sim || !player || sim.escaped || (sim.phase !== 'running' && sim.phase !== 'kill')) return null;
  const beast = sim.beast;
  if (!beast || (beast.gap > 70 && beast.mode !== 'hunt')) return null;
  const beastD = player.d - beast.gap;
  const ci0 = Math.floor((beastD - 7) / TUNING.TERRAIN.CHUNK_LEN);
  const ci1 = Math.floor((beastD + 7) / TUNING.TERRAIN.CHUNK_LEN);
  const map = new Map();

  for (let ci = ci0; ci <= ci1; ci++) {
    const chunk = sim.terrain.chunk(ci);
    for (const c of chunk.colliders) {
      if (c.type !== FEATURE.TREE && c.type !== FEATURE.ROCK && c.type !== FEATURE.GATE) continue;
      const dx = c.x - beast.x;
      const dd = c.d - beastD;
      const reach = 3.0 + (c.r || 0.7);
      if (dx * dx + dd * dd > reach * reach) continue;
      const key = `${ci}:${c.type}:${c.x.toFixed(3)}:${c.d.toFixed(3)}:${c.gateId ?? ''}:${c.side ?? ''}`;
      map.set(key, { ...c });
    }
  }
  return map;
}

function playBeastBreak(audio, c, beastX, gap) {
  if (!audio?.ready || audio.muted || !audio.ctx) return;
  const pan = clamp((c.x - beastX) / 11, -0.92, 0.92);
  const presence = clamp(1 - (gap || 0) / 90, 0.36, 1);
  const threat = audio.bus?.threat || audio.bus?.surface;

  if (c.type === FEATURE.TREE) {
    audio._tone({ type: 'triangle', f0: 210, f1: 62, dur: 0.24, vol: 0.095 * presence, pan, bus: threat });
    audio._burst(0.13, 0.105 * presence, 1550, 'bandpass', pan, threat, 1.8);
    audio._burst(0.08, 0.040 * presence, 4700, 'highpass', pan, threat, 0.8);
  } else if (c.type === FEATURE.ROCK) {
    audio._tone({ type: 'sine', f0: 118, f1: 39, dur: 0.28, vol: 0.10 * presence, pan, bus: threat });
    audio._burst(0.18, 0.12 * presence, 520, 'lowpass', pan, threat, 0.8);
    audio._burst(0.10, 0.052 * presence, 3300, 'highpass', pan, threat, 0.7);
  } else if (c.type === FEATURE.GATE) {
    audio._tone({ type: 'triangle', f0: 980, f1: 310, dur: 0.24, vol: 0.075 * presence, pan, bus: threat });
    audio._tone({ type: 'sine', f0: 430, f1: 215, dur: 0.31, vol: 0.045 * presence, pan, bus: threat, delay: 0.02 });
    audio._burst(0.08, 0.035 * presence, 5200, 'highpass', pan, threat, 1.0);
  }
}

function installAudioFinish() {
  if (Audio.prototype.__v1FinishAudio) return;
  Audio.prototype.__v1FinishAudio = true;

  // The bell already has a good musical identity; this is a small +presence
  // layer so it reads clearly over the impacts without becoming an alarm.
  const baseBell = Audio.prototype.bell;
  Audio.prototype.bell = function bellV1(step = 0, ...args) {
    const out = baseBell.call(this, step, ...args);
    if (this.ready && !this.muted) {
      const intervals = [0, 4, 7, 11, 14];
      const f = 622.25 * Math.pow(2, intervals[step % intervals.length] / 12);
      this._tone({ type: 'sine', f0: f * 1.5, f1: f * 1.505, dur: 0.15, vol: 0.028, bus: this.bus.ui });
      this._burst(0.055, 0.020, 4200, 'highpass', 0, this.bus.ui, 0.7);
    }
    return out;
  };

  // RC9.10 owns the visual destruction. Compare the beast's immediate collider
  // neighborhood before/after that update and sonify only objects that actually
  // disappeared, so the audio cannot claim destruction that never happened.
  const baseUpdate = Audio.prototype.update;
  Audio.prototype.update = function updateV1(dt, player, ...rest) {
    const sim = globalThis.__SIM;
    const before = destructionSnapshot(sim, player);
    const out = baseUpdate.call(this, dt, player, ...rest);
    if (before?.size) {
      const after = destructionSnapshot(sim, player) || new Map();
      let played = 0;
      const seenTypes = new Set();
      for (const [key, c] of before) {
        if (after.has(key) || seenTypes.has(c.type)) continue;
        seenTypes.add(c.type);
        playBeastBreak(this, c, sim?.beast?.x || 0, sim?.beast?.gap || 0);
        if (++played >= 2) break;
      }
    }
    return out;
  };
}

function syncAllTimeTitle() {
  const seed = globalThis.__SEED?.string;
  const line = document.getElementById('seedLine');
  if (!line || !seed) return;
  // A challenge visit (Phase 14) keeps its own title line — the all-time
  // decoration belongs to the DAILY RUN, not to someone's dare.
  const ch = globalThis.__CHALLENGE;
  if (ch) {
    line.textContent = ch.goal > 0 ? `BEAT ${ch.goal}M` : seed;
    return;
  }
  // Playtest: the date-seed came off the title — DAILY RUN already says
  // what today's course is. 'BEST EVER' stays: it is the all-time number,
  // and the HUD's 'BEST TODAY' is a different one. It is a SCORE (the
  // finish-flow debug pass fixed the units), so no metres suffix.
  const best = Storage.bestAllTime();
  line.textContent = best > 0
    ? `BEST EVER ${Math.floor(best).toLocaleString('en-US')}` : '';
}

function installAllTimeBest() {
  if (Storage.__v1AllTimeTitle) return;
  Storage.__v1AllTimeTitle = true;
  const baseSetBest = Storage.setBestFor.bind(Storage);
  Storage.setBestFor = function setBestForV1(seed, distance) {
    const changed = baseSetBest(seed, distance);
    syncAllTimeTitle();
    return changed;
  };

  // Returning/reloaded builds also get the persisted all-time record without a
  // new menu or progression layer.
  syncAllTimeTitle();
}

function installSkyFinale() {
  if (EndgameSky.prototype.__v1Finale) return;
  EndgameSky.prototype.__v1Finale = true;
  const baseUpdate = EndgameSky.prototype.update;
  const white = new THREE.Color(0xd7dfe3);
  const cSky = new THREE.Color();
  const cFog = new THREE.Color();
  const cKey = new THREE.Color();
  const cHemiSky = new THREE.Color();
  const cHemiGround = new THREE.Color();
  const tmp = new THREE.Color();

  EndgameSky.prototype.update = function updateV1(distance, x, y, z) {
    const out = baseUpdate.call(this, distance, x, y, z);
    const distanceLabel = this.ending?.root?.querySelector?.('.distance');
    if (distanceLabel && distanceLabel.textContent !== '30 KM') distanceLabel.textContent = '30 KM';
    if (distance < 12000) return out;

    const mix = bandBlend(distance, 900);
    const a = MOUNTAIN_BANDS[mix.from];
    const b = MOUNTAIN_BANDS[mix.to];
    cSky.setHex(a.sky).lerp(tmp.setHex(b.sky), mix.t);
    cFog.setHex(a.fog).lerp(tmp.setHex(b.fog), mix.t);
    cKey.setHex(a.key).lerp(tmp.setHex(b.key), mix.t);
    cHemiSky.setHex(a.hemiSky).lerp(tmp.setHex(b.hemiSky), mix.t);
    cHemiGround.setHex(a.hemiGround).lerp(tmp.setHex(b.hemiGround), mix.t);

    const seed = globalThis.__SIM?.seed ?? 1;
    const whiteout = v1Weather(distance, seed);
    if (whiteout > 0) {
      cSky.lerp(white, whiteout * 0.82);
      cFog.lerp(white, whiteout * 0.94);
    }

    this.scene.background.copy(cSky);
    this.scene.fog.color.copy(cFog);
    this.key.color.copy(cKey);
    this.hemi.color.copy(cHemiSky);
    this.hemi.groundColor.copy(cHemiGround);

    const fogNear = lerp(a.fogNear, b.fogNear, mix.t);
    const fogFar = lerp(a.fogFar, b.fogFar, mix.t);
    this.scene.fog.near = lerp(fogNear, 14, whiteout);
    this.scene.fog.far = lerp(fogFar, 82, whiteout);

    const nightIn = smooth(16500, 24000, distance);
    const nightOut = 1 - smooth(27800, 30600, distance);
    const night = clamp(nightIn * nightOut);
    const dawn = smooth(27800, 30400, distance);
    const morning = smooth(30000, 32000, distance);
    const sunset = (1 - smooth(14800, 19000, distance)) * smooth(13200, 14200, distance);

    this.key.intensity = lerp(1.02, 0.56, night) + dawn * 0.58;
    this.hemi.intensity = lerp(1.0, 0.72, night) + morning * 0.12;
    this.renderer.toneMappingExposure = 0.96 - night * 0.14 + dawn * 0.23;

    if (night > 0.08) this.key.position.set(x - 62, y + 86, z + 38);
    else if (dawn > 0.05) this.key.position.set(x + 72, y + 76, z - 26);

    this.celestial.position.copy(this.camera.position);
    this.stars.material.opacity = night * (1 - whiteout) * 0.88;
    this.moon.material.opacity = night * (1 - dawn) * 0.82;
    this.moon.position.set(-72, 54, -152);

    let sunAlpha = sunset * 0.66;
    if (dawn > sunAlpha) sunAlpha = dawn;
    this.sun.material.opacity = clamp(sunAlpha * (1 - whiteout * 0.5));
    if (dawn > 0.02) {
      this.sun.position.set(68, lerp(-7, 34, smooth(27800, 32000, distance)), -148);
    } else {
      this.sun.position.set(-72, lerp(24, -7, smooth(13200, 19000, distance)), -150);
    }

    const prestige = overrunPrestige(distance);
    const warm = clamp(sunset * 0.42 + dawn * 0.74 + prestige.glory * 0.08);
    this.horizon.style.opacity = warm.toFixed(3);
    this.weather.style.opacity = (whiteout * 0.44).toFixed(3);

    // 50K = diamond-dust/glory; 75K = halo; 100K = crown/sundogs.
    this.halo.position.copy(this.sun.position);
    this.halo.material.opacity = prestige.halo * 0.48;
    this.halo.rotation.z = distance * 0.00003;
    this.dust.material.opacity = clamp(prestige.glory * 0.24 + prestige.halo * 0.32 + prestige.crown * 0.24);
    this.dust.rotation.y = distance * 0.00017;
    this.dust.rotation.z = Math.sin(distance * 0.0004) * 0.04;

    const dogAlpha = prestige.crown * 0.42;
    this.sundogL.material.opacity = dogAlpha;
    this.sundogR.material.opacity = dogAlpha;
    this.sundogL.position.set(this.sun.position.x - 17, this.sun.position.y, this.sun.position.z + 1);
    this.sundogR.position.set(this.sun.position.x + 17, this.sun.position.y, this.sun.position.z + 1);

    globalThis.__DASH_ENDGAME = {
      version: '1.0-rc',
      escaped: !!globalThis.__SIM?.escaped,
      overrun: this.overrun,
      choiceVisible: this.choiceVisible,
      phase: distance >= ENDGAME.CROWN_DISTANCE ? 'crown'
        : distance >= ENDGAME.HALO_DISTANCE ? 'halo'
        : distance >= ENDGAME.GLORY_DISTANCE ? 'glory'
        : distance >= ENDGAME.ESCAPE_DISTANCE ? 'dawn'
        : distance >= ENDGAME.FALSE_DAWN ? 'false-dawn'
        : distance >= ENDGAME.HIGH_NIGHT ? 'high-night'
        : 'deep-mountain',
      whiteout: +whiteout.toFixed(3),
    };
    return true;
  };
}

function installUiConsolidation() {
  // Eliminate the remaining player-facing contradictions from older RC source
  // layers without adding another screen or changing the mystery contract.
  const title = document.getElementById('titleHint');
  if (title) title.textContent = globalThis.__CHALLENGE ? 'CHALLENGE' : 'DAILY RUN';
  document.querySelector('#rc7Onboarding .lead')?.remove();
  syncAllTimeTitle();
}

function installV1Finalize() {
  installFinalBreak();
  installSingleContactDamage();
  installAudioFinish();
  installAllTimeBest();
  installSkyFinale();
  installUiConsolidation();

  globalThis.__DASH_V1 = {
    version: '1.0-rc',
    escapeDistance: ENDGAME.ESCAPE_DISTANCE,
    finalBreakD: FINAL_MOUNTAIN.BREAK_D,
    oneHeartPerStructureContact: true,
    bellPresenceLift: true,
    beastDestructionAudio: true,
    allTimeBestVisible: true,
    noExtraRaf: true,
  };
}

// Static imports in rc9-audio evaluate RC9.10 first; the microtask is an extra
// guard so this layer always wraps the final prototype implementations. It runs
// before the first animation frame and adds no recurring work of its own.
if (typeof queueMicrotask === 'function') queueMicrotask(installV1Finalize);
else Promise.resolve().then(installV1Finalize);
