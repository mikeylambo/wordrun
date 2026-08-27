import './v1-haptics.js';
import './v1-share.js';
import TUNING from './TUNING.js';
import { Audio } from './audio/audio.js';

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
    /* The dedicated action buttons already explain GO on touch devices. The old
       floating GO callout above GO METER is redundant and visually noisy. */
    #powerHint{display:none!important}

    #v1TouchGuide{position:fixed;inset:0;z-index:61;pointer-events:none;opacity:0;transition:opacity .10s ease;color:rgba(244,250,253,.76)}
    #v1TouchGuide.on{opacity:1}
    #v1TouchFrame{position:absolute;left:0;top:0;width:96px;height:96px;transform:translate(-50%,-50%);border:1px solid rgba(238,247,251,.24);border-radius:50%;box-shadow:inset 0 0 0 1px rgba(8,15,20,.12),0 2px 20px rgba(5,10,14,.08)}
    #v1TouchFrame::before,#v1TouchFrame::after{content:'';position:absolute;background:rgba(238,247,251,.20)}
    #v1TouchFrame::before{left:9px;right:9px;top:47px;height:1px}
    #v1TouchFrame::after{top:9px;bottom:9px;left:47px;width:1px;opacity:0;transition:opacity .08s ease}
    #v1TouchGuide.air #v1TouchFrame::after{opacity:1}
    #v1TouchDot{position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;background:rgba(248,252,254,.82);box-shadow:0 0 12px rgba(255,255,255,.32);transform:translate(-50%,-50%)}
    #v1TouchVector{position:absolute;left:50%;top:50%;height:2px;width:0;transform-origin:0 50%;background:linear-gradient(90deg,rgba(246,251,253,.78),rgba(103,216,255,.62));box-shadow:0 0 8px rgba(103,216,255,.22)}
    .v1TouchLabel{position:absolute;font:900 8px/1 ui-monospace,monospace;letter-spacing:.18em;text-shadow:0 1px 5px rgba(7,12,16,.45);white-space:nowrap}
    #v1TouchX{left:50%;top:calc(50% + 18px);transform:translateX(-50%)}
    #v1TouchY{left:calc(50% + 18px);top:50%;transform:translateY(-50%) rotate(90deg);opacity:0;transition:opacity .08s ease}
    #v1TouchGuide.air #v1TouchY{opacity:.82}
    #v1TouchGuide.air #v1TouchX::after{content:'SPIN'}
    #v1TouchGuide:not(.air) #v1TouchX::after{content:'CARVE'}
    #v1TouchY::after{content:'FLIP'}

    .v1MobileAction{position:fixed;z-index:67;border:0;border-radius:50%;padding:0;display:none;place-items:center;pointer-events:auto;touch-action:none;color:#f7fcff;-webkit-tap-highlight-color:transparent;transition:opacity .12s ease,transform .08s ease,box-shadow .12s ease}
    .v1MobileAction::before{content:'';position:absolute;inset:5px;border-radius:50%;background:rgba(14,22,28,.64);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
    .v1MobileAction span{position:relative;z-index:1;font:900 12px/1 ui-monospace,monospace;letter-spacing:.12em;margin-right:-.12em}
    .v1MobileAction.running{display:grid}
    .v1MobileAction:focus{outline:none}

    #v1MobileGo{right:max(18px,calc(env(safe-area-inset-right,0px) + 12px));bottom:max(20px,calc(env(safe-area-inset-bottom,0px) + 16px));width:76px;height:76px;background:conic-gradient(rgba(103,216,255,.92) var(--go-angle,0deg),rgba(238,248,252,.14) var(--go-angle,0deg));box-shadow:0 4px 20px rgba(4,9,13,.18)}
    #v1MobileGo span{font-size:13px;letter-spacing:.14em;margin-right:-.14em}
    #v1MobileGo.empty{opacity:.30}
    #v1MobileGo.armed{opacity:.78;box-shadow:0 0 24px rgba(103,216,255,.22),0 4px 20px rgba(4,9,13,.18)}
    #v1MobileGo.held{opacity:1;transform:scale(.95);box-shadow:0 0 34px rgba(103,216,255,.58),0 4px 20px rgba(4,9,13,.22)}

    #v1MobileJump{right:max(106px,calc(env(safe-area-inset-right,0px) + 100px));bottom:max(26px,calc(env(safe-area-inset-bottom,0px) + 22px));width:64px;height:64px;background:rgba(238,248,252,.16);box-shadow:0 4px 18px rgba(4,9,13,.14);opacity:.74}
    #v1MobileJump::before{background:rgba(17,26,33,.58)}
    #v1MobileJump.held{opacity:1;transform:scale(.93);box-shadow:0 0 24px rgba(255,255,255,.18),0 4px 18px rgba(4,9,13,.18)}
    #v1MobileJump.air{opacity:.30}

    @media (orientation:landscape) and (max-height:560px){
      .v1MobileVitals{translate:0 12px}
    }
    @media (orientation:landscape) and (max-height:500px){
      #v1MobileGo{width:66px;height:66px;right:max(15px,calc(env(safe-area-inset-right,0px) + 10px));bottom:max(14px,calc(env(safe-area-inset-bottom,0px) + 10px))}
      #v1MobileGo span{font-size:11px}
      #v1MobileJump{width:56px;height:56px;right:max(90px,calc(env(safe-area-inset-right,0px) + 84px));bottom:max(19px,calc(env(safe-area-inset-bottom,0px) + 15px))}
      #v1MobileJump span{font-size:10px}
      #v1TouchFrame{width:88px;height:88px}
      #v1TouchFrame::before{top:43px}
      #v1TouchFrame::after{left:43px}
    }
  `;
  document.head.appendChild(style);

  const guide = document.createElement('div');
  guide.id = 'v1TouchGuide';
  guide.innerHTML = `
    <div id="v1TouchFrame">
      <div id="v1TouchDot"></div>
      <div id="v1TouchVector"></div>
      <div id="v1TouchX" class="v1TouchLabel"></div>
      <div id="v1TouchY" class="v1TouchLabel"></div>
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
  go.id = 'v1MobileGo';
  go.className = 'v1MobileAction';
  go.type = 'button';
  go.setAttribute('aria-label', 'Hold GO for a burst of speed');
  go.innerHTML = '<span>GO</span>';
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
      input.__v1GoButtonHeld = true;
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
    if (input) input.__v1GoButtonHeld = false;
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
    if (input) input.__v1GoButtonHeld = false;
  });

  ui = {
    guide,
    frame: guide.querySelector('#v1TouchFrame'),
    vector: guide.querySelector('#v1TouchVector'),
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
  const held = !!input?.__v1GoButtonHeld;

  refs.go.classList.toggle('running', running);
  refs.go.classList.toggle('empty', !armed);
  refs.go.classList.toggle('armed', armed && !held);
  refs.go.classList.toggle('held', running && held);
  refs.go.style.setProperty('--go-angle', `${Math.round(fill * 360)}deg`);
  refs.go.setAttribute('aria-valuetext', `${Math.round(fill * 100)} percent GO`);

  refs.jump.classList.toggle('running', running);
  refs.jump.classList.toggle('air', !!player?.airborne);

  if (!running && input) input.__v1GoButtonHeld = false;

  const touching = running && !!input?.primaryTouch && input.primaryId !== null;
  refs.guide.classList.toggle('on', touching);
  if (!touching) return;

  const airborne = !!player?.airborne;
  refs.guide.classList.toggle('air', airborne);

  const ox = input.origin?.x || 0;
  const oy = input.origin?.y || 0;
  refs.frame.style.left = `${ox}px`;
  refs.frame.style.top = `${oy}px`;

  let dx = (input.cur?.x || ox) - ox;
  let dy = airborne ? (input.cur?.y || oy) - oy : 0;
  const mag = Math.hypot(dx, dy);
  const maxLen = airborne ? 54 : 50;
  const scale = mag > maxLen && mag > 0 ? maxLen / mag : 1;
  dx *= scale;
  dy *= scale;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  refs.vector.style.width = `${len}px`;
  refs.vector.style.transform = `rotate(${angle}deg)`;
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

globalThis.__DESCENT_MOBILE_UI = {
  version: '1.0-rc',
  contextualGestureOverlay: true,
  reanchoredAirGestures: true,
  dedicatedJumpButton: true,
  flickJumpShortcutPreserved: true,
  dedicatedGoButton: true,
  secondFingerShortcutPreserved: true,
  redundantGoHintRemoved: true,
  landscapeVitalsSpacing: true,
  noExtraRaf: true,
};
