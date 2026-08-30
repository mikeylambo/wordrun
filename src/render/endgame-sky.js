/**
 * Late-run sky, weather and completion presentation.
 *
 * Runs inside Stage.followLight(), which already executes once per rendered
 * frame. No second animation loop is introduced.
 */
import * as THREE from 'three';
import { MOUNTAIN_BANDS, bandBlend } from './art-direction.js';
import { ENDGAME, overrunPrestige } from '../design/endgame.js';
import { Storage } from '../storage/storage.js';

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

function lateWeather(distance, seed = 1) {
  if (distance < 28500 || distance > 44750) return 0;
  const len = 1050;
  const seg = Math.floor((distance - 28500) / len);
  if ((hash32(seed, seg) & 3) !== 0) return 0;
  const local = ((distance - 28500) - seg * len) / len;
  const enter = smooth(0.18, 0.36, local);
  const leave = 1 - smooth(0.64, 0.84, local);
  return clamp(enter * leave * 0.92);
}

function makeStars() {
  let s = 0x5eedc0de;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const pts = [];
  for (let i = 0; i < 520; i++) {
    const z = -(75 + rand() * 100);
    const x = (rand() * 2 - 1) * 145;
    const y = 14 + rand() * 112;
    pts.push(x, y, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe9f5ff,
    size: 0.48,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

function makeDust() {
  let s = 0xd1a0d5;
  const rand = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 0x100000000;
  };
  const pts = [];
  for (let i = 0; i < 180; i++) {
    pts.push((rand() * 2 - 1) * 34, -4 + rand() * 38, -(8 + rand() * 74));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff7dd,
    size: 0.18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

function makeDisc(radius, color) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), mat);
  mesh.frustumCulled = false;
  return mesh;
}

function ensureOverlay(id, background, z = 1) {
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement('div');
  el.id = id;
  Object.assign(el.style, {
    position: 'absolute',
    inset: '0',
    zIndex: String(z),
    pointerEvents: 'none',
    opacity: '0',
    background,
    transition: 'opacity .18s linear',
  });
  document.getElementById('app')?.appendChild(el);
  return el;
}

class EscapeOverlay {
  constructor() {
    const style = document.createElement('style');
    style.id = 'rc97-ending-style';
    style.textContent = `
      #rc97Ending{position:absolute;inset:0;z-index:92;display:none;align-items:center;justify-content:center;
        padding:24px;color:#f7fbfd;background:linear-gradient(180deg,rgba(21,31,40,.08),rgba(16,24,31,.58));
        backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);pointer-events:auto}
      #rc97Ending.on{display:flex}
      #rc97Ending .card{width:min(90vw,430px);text-align:center}
      #rc97Ending .eyebrow{font:900 9px/1 ui-monospace,monospace;letter-spacing:.28em;opacity:.7;margin-bottom:12px}
      #rc97Ending h2{font:900 clamp(38px,11vw,68px)/.9 ui-monospace,monospace;letter-spacing:-.04em;margin:0}
      #rc97Ending .distance{margin:16px 0 28px;font:800 14px/1 ui-monospace,monospace;letter-spacing:.24em;opacity:.78}
      #rc97Ending .actions{display:flex;gap:9px;justify-content:center}
      #rc97Ending button{appearance:none;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);
        color:#f6fbfd;padding:13px 16px;min-width:138px;font:900 10px/1 ui-monospace,monospace;letter-spacing:.16em;cursor:pointer}
      #rc97Ending button.primary{background:rgba(246,251,253,.92);color:#16212a}
      @media(max-width:430px){#rc97Ending .actions{flex-direction:column}#rc97Ending button{width:100%}}
    `;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.id = 'rc97Ending';
    this.root.dataset.rc97Ui = '1';
    this.root.innerHTML = `
      <div class="card">
        <h2>PUBLISHED.</h2>
        <div class="distance">50 KM</div>
        <div class="actions">
          <button data-act="finish">FINISH RUN</button>
          <button class="primary" data-act="continue">KEEP GOING</button>
        </div>
      </div>`;
    document.getElementById('app')?.appendChild(this.root);
    this.onFinish = null;
    this.onContinue = null;
    this.root.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'finish') this.onFinish?.();
      if (act === 'continue') this.onContinue?.();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      e.stopImmediatePropagation();
      if (e.code === 'Enter' || e.code === 'Space') this.onContinue?.();
      else if (e.code === 'Escape') this.onFinish?.();
    }, true);
  }

  show() { this.root.classList.add('on'); }
  hide() { this.root.classList.remove('on'); }
  get visible() { return this.root.classList.contains('on'); }
}

export class EndgameSky {
  constructor({ scene, camera, renderer, key, hemi }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.key = key;
    this.hemi = hemi;

    this.celestial = new THREE.Group();
    this.celestial.renderOrder = -20;
    scene.add(this.celestial);

    this.stars = makeStars();
    this.dust = makeDust();
    this.sun = makeDisc(3.8, 0xffd8a2);
    this.moon = makeDisc(2.8, 0xd9efff);
    this.sundogL = makeDisc(1.0, 0xffedc8);
    this.sundogR = makeDisc(1.0, 0xffedc8);

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffedc4, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.halo = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.13, 8, 64), haloMat);
    this.halo.frustumCulled = false;

    this.celestial.add(this.stars, this.dust, this.sun, this.moon, this.halo, this.sundogL, this.sundogR);

    this.horizon = ensureOverlay(
      'rc97Horizon',
      'linear-gradient(180deg,transparent 0 48%,rgba(255,183,126,.08) 69%,rgba(255,210,157,.46) 100%)',
      1
    );
    this.weather = ensureOverlay(
      'rc97Weather',
      'radial-gradient(120% 82% at 50% 42%,rgba(238,244,247,.72),rgba(218,228,233,.92))',
      3
    );

    this.ending = new EscapeOverlay();
    this.escapeSeenAt = 0;
    this.choiceVisible = false;
    this.overrun = false;
    this.lastSavedDistance = 0;
    this.recordFinalized = false;
    this._wrappedAdvance = false;

    this.tmpSky = new THREE.Color();
    this.tmpFog = new THREE.Color();
    this.tmpKey = new THREE.Color();
    this.tmpHemiSky = new THREE.Color();
    this.tmpHemiGround = new THREE.Color();
    this.mixSky = new THREE.Color();
    this.mixFog = new THREE.Color();
    this.mixKey = new THREE.Color();
    this.mixHemiSky = new THREE.Color();
    this.mixHemiGround = new THREE.Color();
    this.white = new THREE.Color(0xd7dfe3);
    this.choiceSpeed = 0;

    this.ending.onContinue = () => this._continue();
    this.ending.onFinish = () => this._finish();
  }

  _bindRuntime() {
    const sim = globalThis.__SIM;
    if (!sim || this._wrappedAdvance) return;
    this._wrappedAdvance = true;
    const baseAdvance = sim.advance.bind(sim);
    sim.advance = (dt, input) => {
      if (this.choiceVisible) return 0;
      return baseAdvance(dt, input);
    };
  }

  _recordBest(finalize = false) {
    const sim = globalThis.__SIM;
    const seed = globalThis.__SEED?.seed ?? sim?.seed;
    if (!sim || seed == null) return;
    Storage.setBestFor(seed, sim.distance);
    const bestEl = document.getElementById('bestVal');
    if (bestEl) bestEl.textContent = `${Math.floor(Storage.bestFor(seed))}M`;

    if (finalize && !this.recordFinalized) {
      this.recordFinalized = true;
      try {
        sim.recorder.finish(sim.player);
        Storage.saveGhostIfBest(seed, sim.recorder.serialize({ seed, distance: sim.distance }));
      } catch { /* best distance still survives if ghost storage is full */ }
    }
  }

  _continue() {
    const input = globalThis.__INPUT;
    const sim = globalThis.__SIM;
    this.choiceVisible = false;
    this.overrun = true;
    this.ending.hide();
    if (sim?.player) sim.player.speed = Math.max(14, this.choiceSpeed || 14);
    if (input) {
      input.enabled = true;
      input.releaseAll?.();
    }
    globalThis.__AUDIO?.resume?.();
    this.lastSavedDistance = globalThis.__SIM?.distance || ENDGAME.ESCAPE_DISTANCE;
  }

  _finish() {
    this._recordBest(true);
    this.choiceVisible = false;
    this.ending.hide();
    globalThis.__QUIT?.();
  }

  _syncEnding(distance) {
    this._bindRuntime();
    const sim = globalThis.__SIM;
    if (!sim) return;

    const title = document.getElementById('titleHint');
    const want = globalThis.__CHALLENGE ? 'CHALLENGE' : "TODAY'S DRAFT";
    if (title && title.textContent !== want) title.textContent = want;

    if (!sim.escaped) {
      if (distance < 100) {
        this.escapeSeenAt = 0;
        this.choiceVisible = false;
        this.overrun = false;
        this.recordFinalized = false;
        this.choiceSpeed = 0;
        this.ending.hide();
      }
      return;
    }

    if (!this.escapeSeenAt) {
      this.escapeSeenAt = performance.now();
      this._recordBest(false);
    }

    if (!this.choiceVisible && !this.overrun && performance.now() - this.escapeSeenAt >= 3600) {
      this.choiceVisible = true;
      const input = globalThis.__INPUT;
      if (sim.player) {
        this.choiceSpeed = sim.player.speed;
        sim.player.speed = 0;
        sim.player.overdrive = false;
      }
      if (input) {
        input.enabled = false;
        input.releaseAll?.();
      }
      // The chase has stopped. Let the ending card arrive in literal silence.
      globalThis.__AUDIO?.suspend?.();
      this.ending.show();
    }

    if (this.overrun && distance - this.lastSavedDistance >= 250) {
      this.lastSavedDistance = distance;
      this._recordBest(false);
    }
  }

  _palette(distance) {
    const mix = bandBlend(distance, 900);
    const a = MOUNTAIN_BANDS[mix.from];
    const b = MOUNTAIN_BANDS[mix.to];
    return { a, b, t: mix.t };
  }

  update(distance, x, y, z) {
    this._syncEnding(distance);

    if (distance < 12000) {
      this.stars.material.opacity = 0;
      this.dust.material.opacity = 0;
      this.sun.material.opacity = 0;
      this.moon.material.opacity = 0;
      this.halo.material.opacity = 0;
      this.sundogL.material.opacity = 0;
      this.sundogR.material.opacity = 0;
      this.horizon.style.opacity = '0';
      this.weather.style.opacity = '0';
      return false;
    }

    const { a, b, t } = this._palette(distance);
    this.tmpSky.setHex(a.sky).lerp(this.mixSky.setHex(b.sky), t);
    this.tmpFog.setHex(a.fog).lerp(this.mixFog.setHex(b.fog), t);
    this.tmpKey.setHex(a.key).lerp(this.mixKey.setHex(b.key), t);
    this.tmpHemiSky.setHex(a.hemiSky).lerp(this.mixHemiSky.setHex(b.hemiSky), t);
    this.tmpHemiGround.setHex(a.hemiGround).lerp(this.mixHemiGround.setHex(b.hemiGround), t);

    const seed = globalThis.__SIM?.seed ?? 1;
    const whiteout = lateWeather(distance, seed);
    if (whiteout > 0) {
      this.tmpSky.lerp(this.white, whiteout * 0.82);
      this.tmpFog.lerp(this.white, whiteout * 0.94);
    }

    this.scene.background.copy(this.tmpSky);
    this.scene.fog.color.copy(this.tmpFog);
    this.key.color.copy(this.tmpKey);
    this.hemi.color.copy(this.tmpHemiSky);
    this.hemi.groundColor.copy(this.tmpHemiGround);

    const fogNear = lerp(a.fogNear, b.fogNear, t);
    const fogFar = lerp(a.fogFar, b.fogFar, t);
    this.scene.fog.near = lerp(fogNear, 14, whiteout);
    this.scene.fog.far = lerp(fogFar, 82, whiteout);

    const nightIn = smooth(16500, 25500, distance);
    const nightOut = 1 - smooth(45500, 51000, distance);
    const night = clamp(nightIn * nightOut);
    const dawn = smooth(45000, 51500, distance);
    const morning = smooth(50000, 56000, distance);
    const sunset = (1 - smooth(14800, 19000, distance)) * smooth(13200, 14200, distance);

    this.key.intensity = lerp(1.02, 0.56, night) + dawn * 0.58;
    this.hemi.intensity = lerp(1.0, 0.72, night) + morning * 0.12;
    this.renderer.toneMappingExposure = 0.96 - night * 0.14 + dawn * 0.23;

    if (night > 0.08) {
      this.key.position.set(x - 62, y + 86, z + 38);
    } else if (dawn > 0.05) {
      this.key.position.set(x + 72, y + 76, z - 26);
    }

    this.celestial.position.copy(this.camera.position);
    this.stars.material.opacity = night * (1 - whiteout) * 0.88;
    this.moon.material.opacity = night * (1 - dawn) * 0.82;
    this.moon.position.set(-72, 54, -152);

    let sunAlpha = sunset * 0.66;
    if (dawn > sunAlpha) sunAlpha = dawn;
    this.sun.material.opacity = clamp(sunAlpha * (1 - whiteout * 0.5));
    if (dawn > 0.02) {
      this.sun.position.set(68, lerp(-7, 34, smooth(45000, 56000, distance)), -148);
    } else {
      this.sun.position.set(-72, lerp(24, -7, smooth(13200, 19000, distance)), -150);
    }

    const warm = clamp(sunset * 0.42 + dawn * 0.74);
    this.horizon.style.opacity = warm.toFixed(3);
    this.weather.style.opacity = (whiteout * 0.44).toFixed(3);

    const prestige = overrunPrestige(distance);
    this.halo.position.copy(this.sun.position);
    this.halo.material.opacity = prestige.halo * 0.48;
    this.halo.rotation.z = distance * 0.00003;

    this.dust.material.opacity = clamp(prestige.halo * 0.38 + prestige.crown * 0.28);
    this.dust.rotation.y = distance * 0.00017;
    this.dust.rotation.z = Math.sin(distance * 0.0004) * 0.04;

    const dogAlpha = prestige.crown * 0.42;
    this.sundogL.material.opacity = dogAlpha;
    this.sundogR.material.opacity = dogAlpha;
    this.sundogL.position.set(this.sun.position.x - 17, this.sun.position.y, this.sun.position.z + 1);
    this.sundogR.position.set(this.sun.position.x + 17, this.sun.position.y, this.sun.position.z + 1);

    globalThis.__DASH_ENDGAME = {
      version: '9.7',
      escaped: !!globalThis.__SIM?.escaped,
      overrun: this.overrun,
      choiceVisible: this.choiceVisible,
      phase: distance >= ENDGAME.CROWN_DISTANCE ? 'crown'
        : distance >= ENDGAME.HALO_DISTANCE ? 'halo'
        : distance >= ENDGAME.ESCAPE_DISTANCE ? 'dawn'
        : distance >= ENDGAME.FALSE_DAWN ? 'false-dawn'
        : 'deep-mountain',
      whiteout: +whiteout.toFixed(3),
    };
    return true;
  }
}

export default EndgameSky;
