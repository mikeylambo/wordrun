import * as THREE from 'three';
import TUNING from './TUNING.js';
import { BellField, HEARTS } from './design/bells.js';

function tinyAudio() {
  let ctx = null;
  const muted = () => document.getElementById('mute')?.textContent === '×';
  const ensure = () => {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    return ctx;
  };
  window.addEventListener('pointerdown', ensure, { capture: true });
  window.addEventListener('keydown', ensure, { capture: true });

  const tone = (freq, dur = 0.13, vol = 0.08, type = 'sine', delay = 0) => {
    const c = ensure();
    if (!c || muted()) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  };

  return {
    bell(step = 0) {
      const scale = [0, 2, 4, 7, 9];
      const f = 740 * Math.pow(2, scale[step % scale.length] / 12);
      tone(f, 0.14, 0.065, 'sine');
      tone(f * 2.01, 0.09, 0.02, 'triangle', 0.01);
    },
    heartLost() {
      tone(145, 0.24, 0.11, 'triangle');
      tone(92, 0.32, 0.08, 'sine', 0.04);
    },
    heartRestore() {
      tone(520, 0.18, 0.07, 'sine');
      tone(660, 0.20, 0.07, 'sine', 0.05);
      tone(880, 0.24, 0.08, 'sine', 0.10);
    },
    huntStart(side = 0, kind = 'rear') {
      tone(side < 0 ? 118 : side > 0 ? 132 : 124, 0.34, 0.095, 'sawtooth');
      tone(58, 0.46, 0.085, 'sine', 0.06);
      if (kind === 'leap') tone(245, 0.22, 0.055, 'triangle', 0.14);
    },
    huntEnd() { tone(330, 0.24, 0.04, 'triangle'); },
  };
}

class BellRenderer {
  constructor(scene, terrain, field) {
    this.terrain = terrain;
    this.field = field;
    this.max = 56;
    this.lastT = -Infinity;
    this.lastD = -Infinity;
    this.dummy = new THREE.Object3D();

    const gold = new THREE.MeshStandardMaterial({
      color: 0xd8aa42, roughness: 0.38, metalness: 0.48, flatShading: true,
    });
    const darkGold = new THREE.MeshStandardMaterial({
      color: 0x8b6424, roughness: 0.5, metalness: 0.32, flatShading: true,
    });
    this.body = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.34, 0.52, 6, 1, false), gold, this.max
    );
    this.clapper = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 5, 3), darkGold, this.max
    );
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clapper.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.body, this.clapper);
  }

  reset(terrain = this.terrain) {
    this.terrain = terrain;
    this.field.setTerrain(terrain);
    this.body.count = 0;
    this.clapper.count = 0;
    this.lastT = -Infinity;
    this.lastD = -Infinity;
  }

  update(distance, t) {
    if (t - this.lastT < 0.05 && Math.abs(distance - this.lastD) < 7) return;
    this.lastT = t;
    this.lastD = distance;

    const bells = this.field.around(distance, 35, 360).slice(0, this.max);
    let n = 0;
    for (const bell of bells) {
      const bob = Math.sin(t * 2.6 + bell.phase) * 0.065;
      const y = this.terrain.heightAt(bell.x, bell.d) + 1.5 + bob;
      this.dummy.position.set(bell.x, y, -bell.d);
      this.dummy.rotation.set(0, t + bell.phase, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.body.setMatrixAt(n, this.dummy.matrix);
      this.dummy.position.y = y - 0.31;
      this.dummy.updateMatrix();
      this.clapper.setMatrixAt(n, this.dummy.matrix);
      n++;
    }
    this.body.count = n;
    this.clapper.count = n;
    this.body.instanceMatrix.needsUpdate = true;
    this.clapper.instanceMatrix.needsUpdate = true;
  }
}

class RC6Hud {
  constructor(sim) {
    this.sim = sim;
    this.threatT = 0;

    const style = document.createElement('style');
    style.id = 'rc6-ui-style';
    style.textContent = `
      #chain,#titleScreen .eyebrow{display:none!important}
      #rc5Vitals{position:absolute;z-index:25;left:18px;top:calc(var(--safe-t) + 60px);display:flex;gap:9px;pointer-events:none;transition:opacity .18s ease}
      .rc5-heart{font:600 30px/1 var(--face);color:#d62d24;text-shadow:0 1px 0 rgba(255,255,255,.42),0 2px 8px rgba(60,0,0,.18);opacity:.97;transition:opacity .18s ease,transform .18s ease}
      .rc5-heart.empty{opacity:.14;transform:scale(.82)}
      #rc5Vitals.pulse .rc5-heart:not(.empty){animation:rc5Heart .38s ease}
      @keyframes rc5Heart{0%{transform:scale(1)}35%{transform:scale(1.26)}100%{transform:scale(1)}}
      #rc5HuntWeather{position:absolute;inset:0;z-index:7;pointer-events:none;opacity:0;transition:opacity .55s ease;background:linear-gradient(102deg,transparent 0 20%,rgba(224,238,246,.045) 34%,transparent 48% 72%,rgba(224,238,246,.025) 84%,transparent 100%)}
      #rc5HuntWeather.on{opacity:.3}
      #rc5Threat{position:absolute;z-index:27;left:50%;top:54%;width:34px;height:34px;margin-left:-17px;pointer-events:none;opacity:0;filter:drop-shadow(0 2px 5px rgba(0,0,0,.38));transform:translateY(12px) scale(.72)}
      #rc5Threat.on{animation:rc5Threat .82s cubic-bezier(.2,.85,.2,1)}
      #rc5Threat.left svg{transform:rotate(-78deg)}
      #rc5Threat.right svg{transform:rotate(78deg)}
      #rc5Threat.leap svg{transform:rotate(180deg) scale(.92)}
      #rc5Threat svg{width:100%;height:100%}
      @keyframes rc5Threat{0%{opacity:0;transform:translateY(15px) scale(.55)}20%{opacity:1;transform:translateY(0) scale(1.12)}58%{opacity:1;transform:translateY(-3px) scale(.94)}100%{opacity:0;transform:translateY(-9px) scale(.8)}}
    `;
    document.head.appendChild(style);

    const app = document.getElementById('app') || document.body;
    this.vitals = document.createElement('div');
    this.vitals.id = 'rc5Vitals';
    this.vitals.setAttribute('aria-label', 'Health');
    this.hearts = [];
    for (let i = 0; i < HEARTS.MAX; i++) {
      const h = document.createElement('span');
      h.className = 'rc5-heart';
      h.textContent = '♥';
      this.vitals.appendChild(h);
      this.hearts.push(h);
    }
    app.appendChild(this.vitals);

    this.weather = document.createElement('div');
    this.weather.id = 'rc5HuntWeather';
    app.appendChild(this.weather);

    this.threat = document.createElement('div');
    this.threat.id = 'rc5Threat';
    this.threat.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28 13 22 14 16 25 10 14 4 13Z" fill="#ff3a2f" stroke="rgba(255,255,255,.8)" stroke-width="1.1"/></svg>`;
    app.appendChild(this.threat);
  }

  setHearts(n, restored = false) {
    this.hearts.forEach((h, i) => h.classList.toggle('empty', i >= n));
    if (restored) {
      this.vitals.classList.remove('pulse');
      void this.vitals.offsetWidth;
      this.vitals.classList.add('pulse');
    }
  }

  threatCue(side, kind) {
    this.threat.className = '';
    void this.threat.offsetWidth;
    this.threat.classList.add('on');
    if (kind === 'side') this.threat.classList.add(side < 0 ? 'left' : 'right');
    if (kind === 'leap') this.threat.classList.add('leap');
    this.threatT = 0.85;
  }

  update(dt) {
    const hunt = this.sim.phase === 'running' && this.sim.beast.mode === 'hunt';
    this.weather.classList.toggle('on', hunt);
    this.vitals.style.opacity = this.sim.phase === 'running' ? '1' : '0';
    if (this.threatT > 0) this.threatT = Math.max(0, this.threatT - dt);

    const death = document.getElementById('deathScreen');
    if (death?.classList.contains('on') && this.sim.deathCause === 'wipeout') {
      const tag = document.getElementById('deathTag');
      if (tag) tag.textContent = 'REDACTED'; // one death word, whatever kills you
    }
  }
}

function patchSim(sim, field) {
  if (sim.__rc5Patched) return;
  sim.__rc5Patched = true;

  const resetRunState = () => {
    sim.maxHearts = HEARTS.MAX;
    sim.hearts = HEARTS.MAX;
    sim.bellCharge = 0;
    sim.bellsCollected = 0;
    sim.deathCause = null;
    field.reset(sim.seed, sim.terrain);
  };
  resetRunState();
  sim.bells = field;

  const start = sim.start.bind(sim);
  sim.start = function startRC6(...args) {
    const out = start(...args);
    resetRunState();
    return out;
  };

  const step = sim.step.bind(sim);
  sim.step = function stepRC6(input) {
    const wasRunning = this.phase === 'running';
    const beforeHits = this.player.obstaclesHit;
    step(input);
    if (!wasRunning) return;

    if (this.phase === 'kill') {
      this.deathCause = 'redlined';
      return;
    }
    if (this.phase !== 'running') return;

    const hits = this.player.obstaclesHit - beforeHits;
    if (hits > 0) {
      this.hearts = Math.max(0, this.hearts - hits);
      this.events.push({ t: 'heart_lost', hearts: this.hearts });
      if (this.hearts <= 0) {
        this.player.dead = true;
        this.deathCause = 'wipeout';
        this.recorder.finish(this.player);
        this.phase = 'dead';
        this.events.push({ t: 'wipeout' });
        return;
      }
    }

    // Phase 10: heart repair is ENDLESS's rule. In STANDARD, three hits
    // are the whole allowance — bells still pay meter and currency, the
    // charge just never counts toward a heart.
    const heartRepair = this.rules?.HEART_REPAIR !== false;
    const picked = field.collectNear(this.player);
    for (const bell of picked) {
      this.bellsCollected++;
      if (heartRepair) this.bellCharge++;
      this.player.boostMeter = Math.min(
        TUNING.BOOST.METER_MAX,
        this.player.boostMeter + HEARTS.POWER_PER_BELL
      );
      this.events.push({
        t: 'bell', id: bell.id, x: bell.x, d: bell.d,
        charge: this.bellCharge, power: HEARTS.POWER_PER_BELL,
      });
      if (heartRepair && this.bellCharge >= HEARTS.BELLS_PER_HEART) {
        this.bellCharge = 0;
        if (this.hearts < this.maxHearts) {
          this.hearts++;
          this.events.push({ t: 'heart_restore', hearts: this.hearts });
        }
      }
    }
  };

  const state = sim.state.bind(sim);
  sim.state = function stateRC6() {
    return {
      ...state(),
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      bellsCollected: this.bellsCollected,
      bellCharge: this.bellCharge,
      chaseMode: this.beast.mode,
      deathCause: this.deathCause,
    };
  };

  const debug = sim.debug.bind(sim);
  sim.debug = function debugRC6() {
    return {
      ...debug(),
      hearts: this.hearts,
      bellsCollected: this.bellsCollected,
      bellCharge: this.bellCharge,
      chaseMode: this.beast.mode,
      huntTime: +this.beast.modeT.toFixed(3),
      huntDuration: +this.beast.modeDuration.toFixed(3),
      deathCause: this.deathCause,
    };
  };
}

function patchStage(stage, sim) {
  if (stage.__rc5Patched) return;
  stage.__rc5Patched = true;
  const follow = stage.followLight.bind(stage);
  const baseKey = stage.key.intensity;
  const baseHemi = stage.hemi.intensity;
  stage.__huntMix = 0;

  stage.followLight = function followLightRC6(x, y, z) {
    follow(x, y, z);
    const on = sim.phase === 'running' && sim.beast.mode === 'hunt' ? 1 : 0;
    this.__huntMix += (on - this.__huntMix) * (on ? 0.05 : 0.038);
    const m = this.__huntMix;
    this.key.intensity = baseKey * (1 - 0.08 * m);
    this.hemi.intensity = baseHemi * (1 - 0.04 * m);
    this.scene.fog.near = Math.max(14, this._fogNear - 1.8 * m);
    this.scene.fog.far = Math.max(85, this._fogFar * (1 - 0.055 * m));
    this.renderer.toneMappingExposure *= 1 - 0.025 * m;
  };
}

function boot() {
  const sim = window.__SIM;
  const render = window.__RENDER;
  if (!sim || !render?.stage) {
    requestAnimationFrame(boot);
    return;
  }
  if (window.__RC5) return;

  const field = new BellField(sim.seed, sim.terrain);
  patchSim(sim, field);
  patchStage(render.stage, sim);

  const bellRenderer = new BellRenderer(render.stage.scene, sim.terrain, field);
  const hud = new RC6Hud(sim);
  const sound = tinyAudio();
  let lastNow = performance.now();
  let lastMode = sim.beast.mode;
  let lastHearts = sim.hearts;
  let lastBells = sim.bellsCollected;

  const system = {
    version: 'RC6',
    bellField: field,
    bellRenderer,
    hud,
    hearts: HEARTS,
    update(now = performance.now()) {
      const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;

      if (bellRenderer.terrain !== sim.terrain) bellRenderer.reset(sim.terrain);
      bellRenderer.update(sim.player.d, now / 1000);
      hud.update(dt);

      if (sim.hearts !== lastHearts) {
        if (sim.hearts < lastHearts) sound.heartLost();
        else {
          sound.heartRestore();
          hud.setHearts(sim.hearts, true);
        }
        lastHearts = sim.hearts;
      }
      hud.setHearts(sim.hearts, false);

      if (sim.bellsCollected > lastBells) {
        const count = sim.bellsCollected - lastBells;
        for (let i = 0; i < count; i++) {
          const step = (lastBells + i) % HEARTS.BELLS_PER_HEART;
          sound.bell(step);
        }
        lastBells = sim.bellsCollected;
      }

      if (sim.beast.mode !== lastMode) {
        if (sim.beast.mode === 'hunt') {
          sound.huntStart(sim.beast.attackKind === 'side' ? sim.beast.side : 0, sim.beast.attackKind);
          hud.threatCue(sim.beast.side, sim.beast.attackKind);
        } else if (lastMode === 'hunt') {
          sound.huntEnd();
        }
        lastMode = sim.beast.mode;
      }
    },
  };

  const stageRender = render.stage.render.bind(render.stage);
  render.stage.render = function renderWithRC6() {
    system.update(performance.now());
    stageRender();
  };

  window.__RC5 = system;
  window.__RC6 = system;
}

requestAnimationFrame(boot);
