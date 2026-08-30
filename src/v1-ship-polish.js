import TUNING from './TUNING.js';
import { FEATURE } from './sim/terrain.js';
import { Input } from './input/input.js';
import { Audio } from './audio/audio.js';

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const PAD_DEADZONE = 0.18;

function gamepad() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  const pads = navigator.getGamepads();
  for (const p of pads) if (p?.connected) return p;
  return null;
}

function button(pad, index) {
  const b = pad?.buttons?.[index];
  if (!b) return 0;
  return Math.max(b.pressed ? 1 : 0, Number.isFinite(b.value) ? b.value : 0);
}

function axis(v) {
  const n = Number.isFinite(v) ? v : 0;
  const a = Math.abs(n);
  if (a <= PAD_DEADZONE) return 0;
  return Math.sign(n) * clamp((a - PAD_DEADZONE) / (1 - PAD_DEADZONE));
}

function padAxes(pad) {
  const lx = axis(pad?.axes?.[0]);
  const ly = axis(pad?.axes?.[1]);
  const dx = button(pad, 15) - button(pad, 14);
  const dy = button(pad, 13) - button(pad, 12);
  return {
    x: Math.abs(lx) > 0.01 ? lx : dx,
    y: Math.abs(ly) > 0.01 ? ly : dy,
  };
}

function fireFirstGesture(input) {
  if (!input || input._firedFirst) return;
  input._firedFirst = true;
  input.onFirstGesture?.();
}

// Standard controller gameplay mapping:
// LS / D-pad = carve; LS vertical = flip in air; A/Cross = jump;
// RT/R2 or RB/R1 = GO. Pointer/keyboard keep priority when actively used.
if (!Input.prototype.__v1GamepadSupport) {
  Input.prototype.__v1GamepadSupport = true;
  const baseUpdate = Input.prototype.update;

  Input.prototype.update = function updateV1Gamepad(dt, grounded) {
    const out = baseUpdate.call(this, dt, grounded);
    if (!this.enabled || this.script) return out;

    const pad = gamepad();
    if (!pad) {
      this.__v1PadJumpDown = false;
      return out;
    }

    const a = button(pad, 0) > 0.5;
    const boost = button(pad, 7) > 0.34 || button(pad, 5) > 0.5;
    const axes = padAxes(pad);
    const active = a || boost || Math.abs(axes.x) > 0.02 || Math.abs(axes.y) > 0.02;
    if (active) fireFirstGesture(this);

    const pointerActive = this.primaryId !== null;
    const keyboardActive = this.keyLeft || this.keyRight || this.keyUp || this.keyDown ||
      Math.abs(this.keyX) > 0.02 || Math.abs(this.keyY) > 0.02;

    if (!pointerActive && !keyboardActive) {
      this.carve = clamp(axes.x, -1, 1);
      this.flip = clamp(axes.y, -1, 1);
      this.dragging = Math.abs(axes.x) > 0.02 || Math.abs(axes.y) > 0.02;
    }
    this.boostHeld = this.boostHeld || boost;

    if (!a) this.__v1PadConsumedConfirmUntilRelease = false;
    if (a && !this.__v1PadJumpDown && !this.__v1PadConsumedConfirmUntilRelease) this.jump = true;
    this.__v1PadJumpDown = a;
    return out;
  };
}

function dispatchKey(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
}

function activate(el) {
  if (!el) return;
  try {
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: -99 }));
  } catch {
    el.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
  }
}

const controllerUi = {
  confirm: false,
  cancel: false,
  pause: false,
  navUp: false,
  navDown: false,
  focusRoot: null,
  focusIndex: -1,
};

function visibleControllerRoot() {
  const ending = document.getElementById('rc97Ending');
  if (ending?.classList.contains('on')) return ending;
  const pause = document.getElementById('rc2Pause');
  if (pause?.classList.contains('on')) return pause;
  const onboarding = document.getElementById('rc7Onboarding');
  if (onboarding?.classList.contains('on')) return onboarding;
  const death = document.getElementById('deathScreen');
  if (death?.classList.contains('on')) return death;
  return null;
}

function controllerButtons(root) {
  return root ? [...root.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null) : [];
}

function defaultButtonIndex(root, buttons) {
  if (!root || !buttons.length) return -1;
  let preferred = null;
  if (root.id === 'rc97Ending') preferred = root.querySelector('[data-act="continue"]');
  else if (root.id === 'rc2Pause') preferred = root.querySelector('[data-act="resume"]');
  else if (root.id === 'rc7Onboarding') preferred = root.querySelector('[data-act="start"]');
  else if (root.id === 'deathScreen') preferred = document.getElementById('deathAgain');
  const i = preferred ? buttons.indexOf(preferred) : -1;
  return i >= 0 ? i : 0;
}

function focusControllerButton(root, direction = 0) {
  const buttons = controllerButtons(root);
  if (!buttons.length) return null;
  if (controllerUi.focusRoot !== root) {
    controllerUi.focusRoot = root;
    controllerUi.focusIndex = defaultButtonIndex(root, buttons);
  } else if (direction) {
    controllerUi.focusIndex = (controllerUi.focusIndex + direction + buttons.length) % buttons.length;
  }
  const el = buttons[clamp(controllerUi.focusIndex, 0, buttons.length - 1)];
  el?.focus?.({ preventScroll: true });
  return el;
}

function pollControllerUi() {
  const pad = gamepad();
  if (!pad) return;
  const input = globalThis.__INPUT;
  const sim = globalThis.__SIM;
  const root = visibleControllerRoot();
  const axes = padAxes(pad);

  const confirm = button(pad, 0) > 0.5;
  const cancel = button(pad, 1) > 0.5;
  const pause = button(pad, 9) > 0.5;
  const up = button(pad, 12) > 0.5 || axes.y < -0.72;
  const down = button(pad, 13) > 0.5 || axes.y > 0.72;

  if (confirm || cancel || pause || up || down) fireFirstGesture(input);

  if (root) {
    if (up && !controllerUi.navUp) focusControllerButton(root, -1);
    if (down && !controllerUi.navDown) focusControllerButton(root, 1);

    if (confirm && !controllerUi.confirm) {
      const focused = focusControllerButton(root, 0);
      if (input) input.__v1PadConsumedConfirmUntilRelease = true;
      activate(focused);
    }

    if (cancel && !controllerUi.cancel) {
      if (root.id === 'rc97Ending') dispatchKey('Escape');
      else if (root.id === 'rc2Pause') dispatchKey('KeyP');
    }
  } else {
    controllerUi.focusRoot = null;
    controllerUi.focusIndex = -1;
    if (confirm && !controllerUi.confirm && (sim?.phase === 'title' || sim?.phase === 'dead')) {
      if (input) input.__v1PadConsumedConfirmUntilRelease = true;
      dispatchKey('Enter');
    }
  }

  if (pause && !controllerUi.pause && sim?.phase === 'running' && root?.id !== 'rc97Ending') {
    dispatchKey('KeyP');
  }

  controllerUi.confirm = confirm;
  controllerUi.cancel = cancel;
  controllerUi.pause = pause;
  controllerUi.navUp = up;
  controllerUi.navDown = down;
}

function ensureBellChargeHud() {
  const rc = globalThis.__RC5;
  const sim = globalThis.__SIM;
  const vitals = rc?.hud?.vitals;
  if (!vitals || !sim) return;

  let root = document.getElementById('v1BellCharge');
  if (!root) {
    const style = document.createElement('style');
    style.id = 'v1-bell-charge-style';
    style.textContent = `
      #v1BellCharge{display:flex;align-items:center;gap:4px;margin-left:4px;height:30px;transform:translateY(1px)}
      .v1-bell-pip{width:7px;height:7px;box-sizing:border-box;border:1px solid rgba(232,190,82,.72);background:rgba(216,170,66,.10);transform:rotate(45deg);transition:background .12s ease,box-shadow .12s ease,transform .12s ease}
      .v1-bell-pip.on{background:#e6b949;box-shadow:0 0 7px rgba(238,196,91,.58);transform:rotate(45deg) scale(1.08)}
      #v1BellCharge.complete{animation:v1BellComplete .36s ease}
      @keyframes v1BellComplete{0%{filter:brightness(1)}35%{filter:brightness(1.85)}100%{filter:brightness(1)}}
      #v1BellCharge:focus{outline:none}
    `;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'v1BellCharge';
    root.setAttribute('role', 'img');
    for (let i = 0; i < 5; i++) {
      const pip = document.createElement('span');
      pip.className = 'v1-bell-pip';
      root.appendChild(pip);
    }
    vitals.appendChild(root);
    root.__lastCharge = -1;
    root.__lastBells = sim.bellsCollected || 0;
  }

  const charge = clamp(sim.bellCharge || 0, 0, 4);
  const bells = sim.bellsCollected || 0;
  [...root.children].forEach((p, i) => p.classList.toggle('on', i < charge));
  root.setAttribute('aria-label', `Bell charge ${charge} of 5`);

  if (root.__lastCharge >= 0 && charge === 0 && bells > root.__lastBells && root.__lastCharge >= 4) {
    root.classList.remove('complete');
    void root.offsetWidth;
    root.classList.add('complete');
  }
  root.__lastCharge = charge;
  root.__lastBells = bells;
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

function playOrganicBreak(audio, c, sim) {
  if (!audio?.ready || audio.muted || !audio.ctx) return;
  const player = sim?.player;
  const pan = clamp(((c.x || 0) - (player?.x || 0)) / 10, -0.92, 0.92);
  const presence = clamp(1 - (sim?.beast?.gap || 0) / 100, 0.38, 1);

  // Phase 15/16: the tree and rock recordings this used to reach for went
  // with the rest of the unreachable inherited Foley. Nothing solid spawns
  // in this game (TREE_COUNT and ROCK_COUNT are both [0,0], GATE_CHANCE is
  // 0), so the destruction snapshot that calls this is always empty and
  // none of this can sound at all — the whole path is kept only because it
  // is structurally guarded and costs nothing. What survives is the
  // procedural fallback, which needs no assets.
  if (c.type === FEATURE.GATE) {
    const bus = audio.bus?.threat || audio.bus?.surface;
    audio._burst?.(0.055, 0.080 * presence, 6200, 'highpass', pan, bus, 0.9);
    audio._burst?.(0.12, 0.060 * presence, 1550, 'bandpass', pan, bus, 2.1);
    audio._tone?.({ type: 'triangle', f0: 1180, f1: 410, dur: 0.17, vol: 0.040 * presence, pan, bus });
    audio._tone?.({ type: 'sine', f0: 690, f1: 330, dur: 0.24, vol: 0.026 * presence, pan: clamp(pan + 0.08, -1, 1), bus, delay: 0.055 });
  }
}

if (!Audio.prototype.__v1ShipPolish) {
  Audio.prototype.__v1ShipPolish = true;

  // Make bells carry above the beds with a bright acoustic-looking upper
  // partial rather than simply cranking the whole UI bus.
  const baseBell = Audio.prototype.bell;
  Audio.prototype.bell = function bellShipPolish(step = 0, ...args) {
    const out = baseBell.call(this, step, ...args);
    if (this.ready && !this.muted && this.bus?.ui) {
      const intervals = [0, 4, 7, 11, 14];
      const f = 622.25 * Math.pow(2, intervals[step % intervals.length] / 12);
      this._tone?.({ type: 'sine', f0: f * 2.02, f1: f * 2.015, dur: 0.21, vol: 0.038, bus: this.bus.ui });
      this._tone?.({ type: 'triangle', f0: f * 3.01, f1: f * 2.98, dur: 0.105, vol: 0.014, bus: this.bus.ui, delay: 0.006 });
    }
    return out;
  };

  const baseUpdate = Audio.prototype.update;
  Audio.prototype.update = function updateShipPolish(dt, player, ...rest) {
    pollControllerUi();
    ensureBellChargeHud();

    const sim = globalThis.__SIM;
    const before = destructionSnapshot(sim, player);
    const out = baseUpdate.call(this, dt, player, ...rest);

    if (before?.size) {
      const after = destructionSnapshot(sim, player) || new Map();
      let played = 0;
      for (const [key, c] of before) {
        if (after.has(key)) continue;
        playOrganicBreak(this, c, sim);
        if (++played >= 2) break;
      }
    }
    return out;
  };
}

globalThis.__DASH_SHIP_POLISH = {
  version: '1.0-rc',
  bellChargeHud: true,
  bellShineLift: true,
  organicBeastBreaks: true,
  terrainOnlyRecoveryGrace: true,
  gamepad: {
    standard: true,
    carve: 'left-stick/dpad',
    jump: 'button-0',
    go: 'rt/rb',
    pause: 'start',
    menuNavigation: true,
  },
  noExtraRaf: true,
};
