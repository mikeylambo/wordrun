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
// DICTION DASH (Phase C): one primitive — a press with a location. A quick,
// small-travel touch on the RIGHT half says the word is real; the same touch
// on the LEFT half says it is fake. Both halves at once is the DASH.
//
// The 250 ms hold that used to arm the dash is gone. It was a latency tax on
// the game's most important verb: the player had already decided, and the
// game spent a quarter of a second finding out.
const TAP_MS = 220;
// RC9.9: the bar's hold moved off the screen zones and onto the DASH control.
// A press shorter than this dashes ON RELEASE; a press that outlives it raises
// the bar and can no longer dash at all. Comfortably past TAP_MS, so nothing a
// player means as an answer is ever read as a level change.
export const HOLD_MS = 520;

/**
 * What a press of the dash control MEANT, given how long it was held. The one
 * place the two verbs are told apart, exported so the gates can walk the
 * boundary in node rather than inferring it from a regex over this file.
 */
export function dashVerb(heldMs) {
  return heldMs >= HOLD_MS ? 'bar' : 'dash';
}
const TAP_PX = 12;
// Phase C shipped a both-halves-at-once dash and it is gone again after one
// playtest. On a phone the gesture has to compete with the buttons that live
// in both halves, and it was solving a problem the DASH button already solves.
// The dash is Space, the F key, or the button — nothing else.

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
    this.jump = false;          // said REAL (the right zone)
    this.reject = false;        // said FAKE (the left zone)
    this.raiseBar = false;      // a held DASH (or Up): raise the compression bar
    // RC9.9 — the dash control's two verbs. One timer, whatever pressed it:
    // null when nothing is down, else the press's start. `_dashRaised` marks a
    // press that has already spent itself on the bar and may no longer dash.
    this._dashT = null;
    this._dashRaised = false;
    this._padDashDown = false;
    this._scriptBoost = false;  // the headless driver's dash, see `boostHeld`
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
    this.__v1DashButtonHeld = false;

    // Keyboard axes, ramped so digital keys still feel analog.
    this.keyX = 0; this.keyY = 0;
    this.keyLeft = false; this.keyRight = false;
    this.keyUp = false; this.keyDown = false;
    this._btnDown = false;      // the touch DASH button's last polled state

    this._bind();
  }

  /**
   * The dash, as the sim reads it. A GETTER rather than a field copied once a
   * frame, because RC10.1 moved the gamepad out of a runtime patch and into a
   * reader that runs AFTER `update()`: a copy taken mid-frame was already
   * stale by the time the pad set the edge, and `consumeJump()` then destroyed
   * the edge before the sim ever saw it. Derived, the order of the writers
   * stops mattering — which is the only way this class of bug stays fixed.
   */
  get boostHeld() { return this.dashEdge || this._scriptBoost; }

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
        if (dt < TAP_MS && travel < TAP_PX) this._zoneTap(e.pointerId, e.clientX);
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

  /**
   * A tap resolved to a zone. The halves are the whole screen, so there is no
   * target to find and no button to look at — the answer is wherever the thumb
   * already is. The dash is a button or a key, never a screen half.
   */
  _zoneOf(clientX) {
    const w = (this.target?.clientWidth || window.innerWidth || 1);
    return clientX >= w / 2 ? 'right' : 'left';
  }

  /** A press lifted as a tap. One half, one reading. */
  _zoneTap(id, clientX) {
    if (this._zoneOf(clientX) === 'right') this.jump = true; else this.reject = true;
  }

  /**
   * RC9.9 — the DASH control, which now carries both verbs.
   *
   * A press starts a clock. Lift before HOLD_MS and it is a TAP: the dash
   * fires on the RELEASE, because until the press has outlived the hold
   * window the game cannot yet know which verb it is. Keep holding past
   * HOLD_MS and it raises the bar instead, once, and that press can no longer
   * dash however it ends.
   *
   * Firing on release costs the dash up to 520 ms of latency on the frame a
   * player takes their thumb off, and buys the bar a control that is on every
   * device, is on screen, and is already the one thing a new player has been
   * taught to find. The old bar — a held press on the right SCREEN ZONE —
   * asked people to hold a half of the screen whose only other meaning is
   * "this word is real", which is why nobody found it and why the two verbs
   * had to be told apart by a stopwatch on the same pixel.
   *
   * One timer for every source: touch button, Space, F, pad RT. They cannot
   * disagree about what a press means, because there is only one answer.
   */
  _dashDown(now) {
    if (this._dashT != null) return;      // key repeat, or a second source
    this._dashT = now;
    this._dashRaised = false;
  }

  _dashUp(now) {
    if (this._dashT == null) return;
    const held = now - this._dashT;
    this._dashT = null;
    // A press that already bought a level is spent. Anything shorter dashes.
    if (!this._dashRaised && dashVerb(held) === 'dash') this.dashEdge = true;
    this._dashRaised = false;
  }

  /**
   * The dash control's edges, as PUBLIC verbs. RC10.1: the gamepad reader
   * calls these instead of a runtime patch reaching into private state — one
   * machine, one decision about what a press means, and every device arriving
   * at it through a door rather than a window.
   */
  dashPress() { this._dashDown(performance.now()); }
  dashRelease() { this._dashUp(performance.now()); }
  /** The first-gesture unlock, for a device that is not the screen or a key. */
  fireFirstGesture() {
    if (this._firedFirst) return;
    this._firedFirst = true;
    this.onFirstGesture?.();
  }

  /** Called once a frame: the moment a live press crosses the hold window. */
  _pollDashHold(now) {
    if (this._dashT == null || this._dashRaised) return;
    if (dashVerb(now - this._dashT) !== 'bar') return;
    this._dashRaised = true;
    this.raiseBar = true;
  }

  _key(code, down) {
    switch (code) {
      // Phase C: the arrow and WASD pairs are the two zones. They were the
      // steering axis, which the sim has ignored since the track became
      // auto-followed — nothing reads `carve`.
      case 'ArrowRight': case 'KeyD': if (down) this.jump = true; return true;
      case 'ArrowLeft': case 'KeyA': if (down) this.reject = true; return true;
      // ArrowUp stays a keyboard raise. It is not the taught control any more
      // — every modality is taught the held DASH — but it costs nothing, the
      // cabinet's key legend still names it, and a keyboard player who learned
      // it should not find it gone. ArrowDown retires with `lowerBar`: the bar
      // wraps to zero past the top now, so there is nothing to lower.
      case 'ArrowUp': case 'KeyW': if (down) this.raiseBar = true; return true;
      // RC9.9: the dash keys press and release through the one machine, so
      // Space behaves exactly as the button and the pad's RT do.
      case 'Space': case 'KeyF': case 'ShiftLeft': case 'ShiftRight':
        if (down) this._dashDown(performance.now());
        else this._dashUp(performance.now());
        return true;
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
    // A window that loses focus mid-press has not dashed and has not raised.
    this._dashT = null;
    this._dashRaised = false;
    this._padDashDown = false;
    this.keyX = 0; this.keyY = 0;
    this.touchX = 0; this.touchY = 0;
    this.__v1DashButtonHeld = false;
    this._lastGrounded = null;
    this.carve = 0; this.flip = 0; this.jump = false; this.reject = false;
    this.raiseBar = false;
    this._scriptBoost = false; this.dashEdge = false;
  }

  /** Fold pointer + keyboard into the axes the sim reads. Call once per frame. */
  update(dt, grounded) {
    if (!this.enabled) {
      this.carve = 0; this.flip = 0; this.jump = false; this.reject = false;
      this.dashEdge = false; this._scriptBoost = false;
      return;
    }

    // Scripted input for automated verification: drives the game through the
    // exact same path a thumb does, so a test is testing the real thing.
    if (this.script) {
      this.carve = this.script.carve ?? 0;
      this.flip = this.script.flip ?? 0;
      if (this.script.jump) { this.jump = true; this.script.jump = false; }
      this._scriptBoost = !!this.script.boostHeld;
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

      // The legacy upward-flick-to-jump is GONE (mobile playtest, round
      // three: "words preselect and I press nothing"). The flick served the
      // retired jump verb; with jump remapped to the REAL answer, a thumb
      // drifting up 42px — settling, sliding, lifting off — was silently
      // saying REAL, and since the answer buffer that phantom edge was
      // banked for the NEXT word. An answer is a TAP, a button, or a key.
      // Nothing else may ever write the answer edge.
      this._swipeArmed = false;
    } else {
      this.touchX = 0;
      this.touchY = 0;
    }

    // Pointer wins when present, otherwise the keyboard drives.
    this.carve = this.primaryId !== null ? dragX : this.keyX;
    this.flip = this.primaryId !== null ? dragY : this.keyY;
    // RC9.9: the touch button reports itself as a held flag (v1-mobile-ui.js
    // owns that element), so its edges are read here rather than pushed —
    // one frame of latency against a 520 ms window, and no second owner of
    // the button's state.
    const now = performance.now();
    if (this.__v1DashButtonHeld && !this._btnDown) this._dashDown(now);
    else if (!this.__v1DashButtonHeld && this._btnDown) this._dashUp(now);
    this._btnDown = !!this.__v1DashButtonHeld;
    this._pollDashHold(now);
    // The dash is the EDGE and nothing else. A press being held is not a dash
    // being held — it is a bar being raised — and `Player._overdrive` has fired
    // on the rising edge and run itself out on DRAIN_RATE since the debugging
    // pass, so one frame is the whole signal it ever needed. `boostHeld` reads
    // that edge directly (see the getter), so nothing is copied here.
  }

  /** The sim consumes these as edges; call after stepping. */
  consumeJump() {
    this.jump = false; this.reject = false; this.dashEdge = false;
    this.raiseBar = false;
  }
}
