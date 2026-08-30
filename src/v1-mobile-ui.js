import './v1-haptics.js';
import './v1-share.js';
import TUNING from './TUNING.js';
import { Audio } from './audio/audio.js';
import { ACCESS } from './ui/access.js';

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function touchCapable() {
  if (typeof navigator === 'undefined' || typeof matchMedia !== 'function') return false;
  return (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer:coarse)').matches;
}

let ui = null;

function ensureMobileUi() {
  if (ui || typeof document === 'undefined' || !touchCapable()) return ui;
  const app = document.getElementById('app');
  if (!app) return null;

  const style = document.createElement('style');
  style.id = 'v1-mobile-control-style';
  style.textContent = `
    /* Phase 16: the floating hint used to be hidden on touch because the
       button "already explained GO". It didn't — a 76px circle labelled GO
       taught nobody what GO was for. The hint is back on touch, but only
       while the dash is still unlearned; once the player has dashed once
       the class never returns and the screen is clean again. */
    #powerHint:not(.teaching){display:none!important}

    /* DICTION DASH: the one gesture is the tap — the confirm verb. The old
       carve/spin/flip drag guide taught steering that no longer exists, so
       the touch ring is now a simple REAL declaration marker at the thumb. */
    #v1TouchGuide{position:fixed;inset:0;z-index:61;pointer-events:none;opacity:0;transition:opacity .10s ease;color:rgba(244,250,253,.82)}
    #v1TouchGuide.on{opacity:1}
    #v1TouchFrame{position:absolute;left:0;top:0;width:84px;height:84px;transform:translate(-50%,-50%);border:1px solid rgba(103,216,255,.46);border-radius:50%;box-shadow:0 0 20px rgba(103,216,255,.20),inset 0 0 14px rgba(103,216,255,.10)}
    #v1TouchDot{position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;background:rgba(248,252,254,.85);box-shadow:0 0 12px rgba(163,232,255,.5);transform:translate(-50%,-50%)}
    .v1TouchLabel{position:absolute;font:900 9px/1 ui-monospace,monospace;letter-spacing:.18em;text-shadow:0 1px 5px rgba(7,12,16,.45);white-space:nowrap}
    #v1TouchX{left:50%;top:calc(50% + 26px);transform:translateX(-50%)}
    #v1TouchX::after{content:'REAL'}

    .v1MobileAction{position:fixed;z-index:67;border:0;border-radius:50%;padding:0;display:none;place-items:center;pointer-events:auto;touch-action:none;color:#f7fcff;-webkit-tap-highlight-color:transparent;transition:opacity .12s ease,transform .08s ease,box-shadow .12s ease}
    .v1MobileAction::before{content:'';position:absolute;inset:5px;border-radius:50%;background:rgba(14,22,28,.64);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
    .v1MobileAction span{position:relative;z-index:1;font:900 12px/1 ui-monospace,monospace;letter-spacing:.12em;margin-right:-.12em}
    .v1MobileAction.running{display:grid}
    .v1MobileAction:focus{outline:none}

    #v1MobileDash{right:max(18px,calc(env(safe-area-inset-right,0px) + 12px));bottom:max(20px,calc(env(safe-area-inset-bottom,0px) + 16px));width:76px;height:76px;background:conic-gradient(rgba(103,216,255,.92) var(--dash-angle,0deg),rgba(238,248,252,.14) var(--dash-angle,0deg));box-shadow:0 4px 20px rgba(4,9,13,.18)}
    #v1MobileDash span{font-size:11px;letter-spacing:.10em;margin-right:-.10em}
    #v1MobileDash.empty{opacity:.30}
    /* Charged is the state that has to carry the whole mechanic. The old
       armed style sat at 0.78 opacity with a 24px glow — dimmer than the
       REAL button beside it, for the button that does the exciting thing.
       Now it is full-strength with a lit rim; the ready class adds a pulse
       while the dash is unlearned, and REDUCED FLASH withholds it. */
    #v1MobileDash.armed{opacity:1;box-shadow:0 0 30px rgba(103,216,255,.42),0 4px 20px rgba(4,9,13,.18)}
    #v1MobileDash.armed::before{border-color:rgba(140,230,255,.7);background:rgba(12,30,40,.68)}
    #v1MobileDash.ready{animation:dashButtonReady 1.15s ease-in-out infinite}
    @keyframes dashButtonReady{0%,100%{box-shadow:0 0 22px rgba(103,216,255,.32),0 4px 20px rgba(4,9,13,.18);transform:scale(1)}50%{box-shadow:0 0 44px rgba(103,216,255,.78),0 4px 20px rgba(4,9,13,.22);transform:scale(1.045)}}
    #v1MobileDash.held{opacity:1;transform:scale(.95);animation:none;box-shadow:0 0 40px rgba(103,216,255,.72),0 4px 20px rgba(4,9,13,.22)}

    #v1MobileJump{right:max(106px,calc(env(safe-area-inset-right,0px) + 100px));bottom:max(26px,calc(env(safe-area-inset-bottom,0px) + 22px));width:64px;height:64px;background:rgba(238,248,252,.16);box-shadow:0 4px 18px rgba(4,9,13,.14);opacity:.74}
    #v1MobileJump::before{background:rgba(17,26,33,.58)}
    #v1MobileJump.held{opacity:1;transform:scale(.93);box-shadow:0 0 24px rgba(255,255,255,.18),0 4px 18px rgba(4,9,13,.18)}
    #v1MobileJump.air{opacity:.30}

    @media (orientation:landscape) and (max-height:560px){
      .v1MobileVitals{translate:0 12px}
    }
    @media (orientation:landscape) and (max-height:500px){
      #v1MobileDash{width:66px;height:66px;right:max(15px,calc(env(safe-area-inset-right,0px) + 10px));bottom:max(14px,calc(env(safe-area-inset-bottom,0px) + 10px))}
      #v1MobileDash span{font-size:10px;letter-spacing:.06em}
      #v1MobileJump{width:56px;height:56px;right:max(90px,calc(env(safe-area-inset-right,0px) + 84px));bottom:max(19px,calc(env(safe-area-inset-bottom,0px) + 15px))}
      #v1MobileJump span{font-size:10px}
      #v1TouchFrame{width:76px;height:76px}
    }
  `;
  document.head.appendChild(style);

  const guide = document.createElement('div');
  guide.id = 'v1TouchGuide';
  guide.innerHTML = `
    <div id="v1TouchFrame">
      <div id="v1TouchDot"></div>
      <div id="v1TouchX" class="v1TouchLabel"></div>
    </div>`;
  app.appendChild(guide);

  const jump = document.createElement('button');
  jump.id = 'v1MobileJump';
  jump.className = 'v1MobileAction';
  jump.type = 'button';
  jump.setAttribute('aria-label', 'Confirm the word is real');
  jump.innerHTML = '<span>REAL</span>';
  app.appendChild(jump);

  const go = document.createElement('button');
  go.id = 'v1MobileDash';
  go.className = 'v1MobileAction';
  go.type = 'button';
  go.setAttribute('aria-label', 'Hold DASH for a burst of speed');
  go.innerHTML = '<span>DASH</span>';
  app.appendChild(go);

  let jumpPointer = null;
  const jumpDown = (e) => {
    if (jumpPointer !== null) return;
    jumpPointer = e.pointerId;
    jump.setPointerCapture?.(e.pointerId);
    jump.classList.add('held');
    const input = globalThis.__INPUT;
    const player = globalThis.__SIM?.player;
    if (input) {
      input.jump = true;
      if (!input._firedFirst) {
        input._firedFirst = true;
        input.onFirstGesture?.();
      }
    }
    e.preventDefault();
    e.stopPropagation();
  };
  const jumpUp = (e) => {
    if (jumpPointer !== null && e.pointerId !== jumpPointer) return;
    jumpPointer = null;
    jump.classList.remove('held');
    e?.preventDefault?.();
    e?.stopPropagation?.();
  };
  jump.addEventListener('pointerdown', jumpDown, { passive: false });
  jump.addEventListener('pointerup', jumpUp, { passive: false });
  jump.addEventListener('pointercancel', jumpUp, { passive: false });
  jump.addEventListener('lostpointercapture', jumpUp, { passive: false });

  let heldPointer = null;
  const hold = (e) => {
    if (heldPointer !== null) return;
    heldPointer = e.pointerId;
    go.setPointerCapture?.(e.pointerId);
    const input = globalThis.__INPUT;
    if (input) {
      input.__v1DashButtonHeld = true;
      if (!input._firedFirst) {
        input._firedFirst = true;
        input.onFirstGesture?.();
      }
    }
    e.preventDefault();
    e.stopPropagation();
  };
  const release = (e) => {
    if (heldPointer !== null && e.pointerId !== heldPointer) return;
    heldPointer = null;
    const input = globalThis.__INPUT;
    if (input) input.__v1DashButtonHeld = false;
    e?.preventDefault?.();
    e?.stopPropagation?.();
  };
  go.addEventListener('pointerdown', hold, { passive: false });
  go.addEventListener('pointerup', release, { passive: false });
  go.addEventListener('pointercancel', release, { passive: false });
  go.addEventListener('lostpointercapture', release, { passive: false });
  window.addEventListener('blur', () => {
    jumpPointer = null;
    heldPointer = null;
    jump.classList.remove('held');
    const input = globalThis.__INPUT;
    if (input) input.__v1DashButtonHeld = false;
  });

  ui = {
    guide,
    frame: guide.querySelector('#v1TouchFrame'),
    jump,
    go,
  };
  return ui;
}

export function updateMobileTouchUi(player) {
  const refs = ensureMobileUi();
  if (!refs) return;

  const sim = globalThis.__SIM;
  const input = globalThis.__INPUT;
  const vitals = globalThis.__RC5?.hud?.vitals;
  vitals?.classList?.add('v1MobileVitals');
  const running = sim?.phase === 'running';
  const meter = player?.boostMeter || 0;
  const fill = clamp(meter / TUNING.BOOST.METER_MAX);
  const armed = meter >= TUNING.BOOST.MIN_ACTIVATE;
  const held = !!input?.__v1DashButtonHeld;
  // While the dash is unlearned the button pulses; once used, never again.
  const learned = !!globalThis.__DASH_LEARNED;

  refs.go.classList.toggle('running', running);
  refs.go.classList.toggle('empty', !armed);
  refs.go.classList.toggle('armed', armed && !held);
  refs.go.classList.toggle('held', running && held);
  refs.go.classList.toggle('ready', armed && !held && !learned && !ACCESS.reducedFlash);
  refs.go.style.setProperty('--dash-angle', `${Math.round(fill * 360)}deg`);
  refs.go.setAttribute('aria-valuetext', `${Math.round(fill * 100)} percent dash charge`);

  refs.jump.classList.toggle('running', running);
  refs.jump.classList.toggle('air', !!player?.airborne);

  if (!running && input) input.__v1DashButtonHeld = false;

  // The ring marks where the thumb declared REAL — feedback only, no drag
  // semantics: steering is retired and every tap is the confirm verb.
  const touching = running && !!input?.primaryTouch && input.primaryId !== null;
  refs.guide.classList.toggle('on', touching);
  if (!touching) return;

  const ox = input.origin?.x || 0;
  const oy = input.origin?.y || 0;
  refs.frame.style.left = `${ox}px`;
  refs.frame.style.top = `${oy}px`;
}

// Run from the existing audio/presentation update chain. No second RAF, timer or
// simulation loop is introduced for the mobile overlay.
if (!Audio.prototype.__v1MobileTouchUi) {
  Audio.prototype.__v1MobileTouchUi = true;
  const baseUpdate = Audio.prototype.update;
  Audio.prototype.update = function updateV1MobileUi(dt, player, ...rest) {
    const out = baseUpdate.call(this, dt, player, ...rest);
    updateMobileTouchUi(player);
    return out;
  };
}

globalThis.__DASH_MOBILE_UI = {
  version: '1.3-dictiondash',
  tapVerbTouchRing: true,        // replaces the retired carve/spin/flip guide
  dedicatedJumpButton: true,     // the REAL button (confirm verb)
  flickJumpShortcutPreserved: true,
  dedicatedDashButton: true,
  secondFingerShortcutPreserved: true,
  dashTeachingHint: true,
  landscapeVitalsSpacing: true,
  noExtraRaf: true,
};
