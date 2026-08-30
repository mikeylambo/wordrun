/**
 * Input — one thumb analog movement with explicit mobile action buttons.
 *
 * Grounded:  horizontal drag = analog carve. Released = centred = straight tuck.
 * Airborne:  horizontal drag = spin, vertical drag = flip. Release to align.
 * Jump:      mobile teaches a dedicated JUMP button; upward flick remains a
 *            compatibility/expert shortcut. Desktop uses Space.
 * GO:        mobile has a dedicated hold button; a second finger remains an
 *            expert shortcut. Desktop uses F / Shift; gamepad is layered later.
 *
 * Desktop mirrors all of it: arrows/WASD carve and flip, Space jumps, F holds
 * GO. Mouse drag works too.
 */

import TUNING from '../TUNING.js';

// Ground touch keeps enough throw for precision without feeling damped. Air gets
// its own shorter throw and faster response because a trick window is brief and
// should not require a long thumb excursion after takeoff.
const DESKTOP_DRAG_RANGE_FRAC = 0.22;
const TOUCH_DRAG_RANGE_GROUND = 0.29;
const TOUCH_DRAG_RANGE_AIR = 0.22;
const TOUCH_DEADZONE = 0.040;
const TOUCH_CURVE_GROUND = 1.12;
const TOUCH_CURVE_AIR = 0.96;
const TOUCH_RESPONSE_GROUND = 24.0;
const TOUCH_RESPONSE_AIR = 34.0;
const SWIPE_PX = 42;            // legacy upward flick distance that counts as a jump
const SWIPE_MS = 260;
// DICTION DASH: a quick, small-travel touch is a TAP — the confirm verb. Any
// pointer qualifies, so the steering thumb can stay planted while the other
// thumb answers a word. A second finger only reads as the GO shortcut once
// it has been held past the tap window.
const TAP_MS = 220;
const TAP_PX = 12;
const GO_HOLD_MS = 250;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function shapeTouchAxis(v, curve) {
  const s = Math.sign(v);
  const a = Math.abs(v);
  if (a <= TOUCH_DEADZONE) return 0;
  const n = clamp((a - TOUCH_DEADZONE) / (1 - TOUCH_DEADZONE), 0, 1);
  return s * Math.pow(n, curve);
}

export class Input {
  constructor(target) {
    this.target = target;

    // What the sim consumes.
    this.carve = 0;
    this.flip = 0;
    this.jump = false;
    this.boostHeld = false;
    this.dragging = false;

    this.enabled = true;
    this.onFirstGesture = null;
    this._firedFirst = false;

    // Pointer state
    this.primaryId = null;
    this.primaryTouch = false;
    this.origin = { x: 0, y: 0, t: 0 };
    this.cur = { x: 0, y: 0 };
    this.extraPointers = new Set();
    this.pointerMeta = new Map();
    this._swipeArmed = false;

    // Touch-only filtered axes. These sit in front of the existing player carve
    // response, giving phones precision without changing mouse/gamepad tuning.
    this.touchX = 0;
    this.touchY = 0;
    this._lastGrounded = null;

    // Dedicated mobile GO button sets this directly. It is OR'd with the old
    // second-finger shortcut, keyboard and (later) gamepad mappings.
    this.__v1GoButtonHeld = false;

    // Keyboard axes, ramped so digital keys still feel analog.
    this.keyX = 0; this.keyY = 0;
    this.keyLeft = false; this.keyRight = false;
    this.keyUp = false; this.keyDown = false;
    this.keyBoost = false;

    this._bind();
  }

  get dragRange() {
    return Math.min(window.innerWidth, window.innerHeight) * DESKTOP_DRAG_RANGE_FRAC;
  }

  _rangeForPointer(isTouch, grounded = true) {
    const frac = isTouch
      ? (grounded ? TOUCH_DRAG_RANGE_GROUND : TOUCH_DRAG_RANGE_AIR)
      : DESKTOP_DRAG_RANGE_FRAC;
    return Math.min(window.innerWidth, window.innerHeight) * frac;
  }

  _reanchorTouch({ armSwipe = false } = {}) {
    if (!this.primaryTouch || this.primaryId === null) return;
    this.origin.x = this.cur.x;
    this.origin.y = this.cur.y;
    this.origin.t = performance.now();
    this.touchX = 0;
    this.touchY = 0;
    this._swipeArmed = armSwipe;
  }

  _bind() {
    const t = this.target;
    const opt = { passive: false };

    t.addEventListener('pointerdown', (e) => {
      if (!this._firedFirst) { this._firedFirst = true; this.onFirstGesture?.(); }
      t.setPointerCapture?.(e.pointerId);
      this.pointerMeta.set(e.pointerId, {
        x: e.clientX, y: e.clientY, type: e.pointerType || 'mouse',
        downX: e.clientX, downY: e.clientY, downT: performance.now(),
      });
      if (this.primaryId === null) {
        this.primaryId = e.pointerId;
        this.primaryTouch = e.pointerType === 'touch';
        this.origin.x = e.clientX; this.origin.y = e.clientY;
        this.origin.t = performance.now();
        this.cur.x = e.clientX; this.cur.y = e.clientY;
        this.dragging = true;
        this._swipeArmed = true;
        this.touchX = 0;
        this.touchY = 0;
      } else {
        // Second finger remains an expert GO shortcut even though mobile now
        // exposes a dedicated GO button.
        this.extraPointers.add(e.pointerId);
      }
      e.preventDefault();
    }, opt);

    t.addEventListener('pointermove', (e) => {
      const meta = this.pointerMeta.get(e.pointerId);
      if (meta) { meta.x = e.clientX; meta.y = e.clientY; }
      if (e.pointerId !== this.primaryId) return;
      this.cur.x = e.clientX; this.cur.y = e.clientY;
      e.preventDefault();
    }, opt);

    const release = (e) => {
      // Tap = confirm (routed through the jump edge, which DICTION DASH's sim
      // reads as `confirm`). Applies to the primary thumb and to a quick
      // second-finger tap alike.
      const meta = this.pointerMeta.get(e.pointerId);
      if (meta && this.enabled) {
        const dt = performance.now() - meta.downT;
        const travel = Math.hypot(e.clientX - meta.downX, e.clientY - meta.downY);
        if (dt < TAP_MS && travel < TAP_PX) this.jump = true;
      }
      if (e.pointerId === this.primaryId) {
        this.primaryId = null;
        this.primaryTouch = false;
        this.dragging = false;
        this._swipeArmed = false;

        // Promote a still-held second finger to primary using THAT finger's
        // stored location. This prevents a steering snap during GO handoff.
        for (const id of this.extraPointers) {
          const held = this.pointerMeta.get(id);
          this.primaryId = id;
          this.extraPointers.delete(id);
          this.primaryTouch = held?.type === 'touch';
          this.origin.x = this.cur.x = held?.x ?? e.clientX;
          this.origin.y = this.cur.y = held?.y ?? e.clientY;
          this.origin.t = performance.now();
          this.dragging = true;
          this._swipeArmed = false;
          this.touchX = 0;
          this.touchY = 0;
          break;
        }
      } else {
        this.extraPointers.delete(e.pointerId);
      }
      this.pointerMeta.delete(e.pointerId);
    };
    t.addEventListener('pointerup', release, opt);
    t.addEventListener('pointercancel', release, opt);

    window.addEventListener('keydown', (e) => {
      if (!this._firedFirst) { this._firedFirst = true; this.onFirstGesture?.(); }
      if (this._key(e.code, true)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      if (this._key(e.code, false)) e.preventDefault();
    });
    window.addEventListener('blur', () => this.releaseAll());
  }

  _key(code, down) {
    switch (code) {
      case 'ArrowLeft': case 'KeyA': this.keyLeft = down; return true;
      case 'ArrowRight': case 'KeyD': this.keyRight = down; return true;
      case 'ArrowUp': case 'KeyW': this.keyUp = down; return true;
      case 'ArrowDown': case 'KeyS': this.keyDown = down; return true;
      case 'Space': if (down) this.jump = true; return true;
      case 'KeyF': case 'ShiftLeft': case 'ShiftRight': this.keyBoost = down; return true;
      default: return false;
    }
  }

  releaseAll() {
    this.primaryId = null;
    this.primaryTouch = false;
    this.extraPointers.clear();
    this.pointerMeta.clear();
    this.dragging = false;
    this.keyLeft = this.keyRight = this.keyUp = this.keyDown = false;
    this.keyBoost = false;
    this.keyX = 0; this.keyY = 0;
    this.touchX = 0; this.touchY = 0;
    this.__v1GoButtonHeld = false;
    this._lastGrounded = null;
    this.carve = 0; this.flip = 0; this.jump = false; this.boostHeld = false;
  }

  /** Fold pointer + keyboard into the axes the sim reads. Call once per frame. */
  update(dt, grounded) {
    if (!this.enabled) {
      this.carve = 0; this.flip = 0; this.jump = false; this.boostHeld = false;
      return;
    }

    // Scripted input for automated verification: drives the game through the
    // exact same path a thumb does, so a test is testing the real thing.
    if (this.script) {
      this.carve = this.script.carve ?? 0;
      this.flip = this.script.flip ?? 0;
      if (this.script.jump) { this.jump = true; this.script.jump = false; }
      this.boostHeld = !!this.script.boostHeld;
      return;
    }

    // A held thumb gets a fresh local coordinate frame whenever the run context
    // changes. Entering air no longer makes tricks fight the old carve origin;
    // landing likewise starts a clean carve from the thumb's current position.
    if (this._lastGrounded !== null && grounded !== this._lastGrounded) {
      this._reanchorTouch({ armSwipe: false });
    }
    this._lastGrounded = grounded;

    // Keyboard axes ramp toward their targets so they read as analog.
    const kx = (this.keyRight ? 1 : 0) - (this.keyLeft ? 1 : 0);
    const ky = (this.keyDown ? 1 : 0) - (this.keyUp ? 1 : 0);
    const rate = TUNING.PLAYER.CARVE_KEY_RATE * dt;
    this.keyX += clamp(kx - this.keyX, -rate, rate);
    this.keyY += clamp(ky - this.keyY, -rate, rate);
    if (kx === 0 && Math.abs(this.keyX) < rate) this.keyX = 0;
    if (ky === 0 && Math.abs(this.keyY) < rate) this.keyY = 0;

    let dragX = 0, dragY = 0;
    if (this.primaryId !== null) {
      const r = this._rangeForPointer(this.primaryTouch, grounded);
      const rawX = clamp((this.cur.x - this.origin.x) / r, -1, 1);
      const rawY = clamp((this.cur.y - this.origin.y) / r, -1, 1);

      if (this.primaryTouch) {
        const curve = grounded ? TOUCH_CURVE_GROUND : TOUCH_CURVE_AIR;
        const targetX = shapeTouchAxis(rawX, curve);
        const targetY = shapeTouchAxis(rawY, curve);
        const response = grounded ? TOUCH_RESPONSE_GROUND : TOUCH_RESPONSE_AIR;
        const k = 1 - Math.exp(-response * Math.max(0, dt));
        this.touchX += (targetX - this.touchX) * k;
        this.touchY += (targetY - this.touchY) * k;
        dragX = this.touchX;
        dragY = this.touchY;
      } else {
        // Mouse retains the original direct-drag behavior.
        dragX = rawX;
        dragY = rawY;
      }

      // Legacy touch shortcut: upward flick while grounded = jump. The visible
      // JUMP button is the taught/default path, but flick remains for players who
      // prefer chaining JUMP + held GO with the existing two-thumb gesture.
      if (this._swipeArmed && grounded) {
        const dy = this.cur.y - this.origin.y;
        const dtms = performance.now() - this.origin.t;
        if (dy < -SWIPE_PX && dtms < SWIPE_MS) {
          this.jump = true;
          this._swipeArmed = false;
          // Re-origin so the flick does not also read as a full flip input.
          this._reanchorTouch({ armSwipe: false });
          dragX = 0; dragY = 0;
        } else if (dtms >= SWIPE_MS) {
          this._swipeArmed = false;
        }
      }
    } else {
      this.touchX = 0;
      this.touchY = 0;
    }

    // Pointer wins when present, otherwise the keyboard drives.
    this.carve = this.primaryId !== null ? dragX : this.keyX;
    this.flip = this.primaryId !== null ? dragY : this.keyY;
    // A second finger is GO only once it is clearly a hold, not a word tap.
    let extraHeld = false;
    const now = performance.now();
    for (const id of this.extraPointers) {
      const held = this.pointerMeta.get(id);
      if (!held || now - held.downT >= GO_HOLD_MS) { extraHeld = true; break; }
    }
    this.boostHeld = extraHeld || this.keyBoost || this.__v1GoButtonHeld;
  }

  /** The sim consumes jump as an edge; call after stepping. */
  consumeJump() { this.jump = false; }
}
