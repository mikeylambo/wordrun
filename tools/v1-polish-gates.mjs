import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const contact = read('src/v1-contact.js');
const polish = read('src/v1-ship-polish.js');
const mobile = read('src/v1-mobile-ui.js');
const input = read('src/input/input.js');
const onboarding = read('src/ui/onboarding.js');
const index = read('index.html');
const audioBridge = read('src/rc9-audio.js');
const finalMix = read('src/v1-final-mix.js');
const approvedMix = read('src/v1-approved-mix.js');
const viewport = read('src/v1-viewport.js');
const manifest = read('public/manifest.webmanifest');
const sw = read('public/sw.js');

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.error(`FAIL ${label}`); }
};

check(contact.includes('const TERRAIN_GRACE = 0.55') && contact.includes('beastsIgnoreTerrainGrace: true'),
  'physical hits get short terrain-only recovery grace');
check(contact.includes('this.__v1TerrainGrace = TERRAIN_GRACE') && contact.includes('TUNING.SIM.DT'),
  'terrain grace is deterministic fixed-step state');
check(contact.includes('baseReset') && contact.includes('__v1AllPhysicalLocks?.clear?.()'),
  'contact locks and recovery grace reset cleanly between runs');

check(polish.includes("id = 'v1BellCharge'") || polish.includes("root.id = 'v1BellCharge'"),
  'HUD exposes persistent five-step bell charge');
check(polish.includes('Bell charge ${charge} of 5') && polish.includes('.v1-bell-pip.on'),
  'bell charge has accessible 0/5-to-4/5 state and visual fill');
check(polish.includes('bellShipPolish') && polish.includes('vol: 0.038'),
  'bell gets an additional bright upper-partial presence lift');

check(polish.includes("assets?.has?.('tree_hit')") && polish.includes("assets?.has?.('rock_hit')"),
  'Beast destruction layers approved organic tree and rock recordings');
check(polish.includes("c.type === FEATURE.GATE") && polish.includes("'highpass'") && polish.includes("'bandpass'"),
  'gate destruction keeps a noise-first multi-impact metal fallback');

check(polish.includes('Input.prototype.__v1GamepadSupport') && polish.includes('navigator.getGamepads'),
  'standard browser gamepad polling is installed on the existing Input path');
check(polish.includes('button(pad, 0)') && polish.includes('button(pad, 7)') && polish.includes('button(pad, 9)'),
  'controller maps A/Cross jump, RT/R2 GO and Start pause');
check(polish.includes('visibleControllerRoot') && polish.includes('focusControllerButton') && polish.includes('PointerEvent'),
  'controller can navigate and activate core game overlays');

check(input.includes('TOUCH_DRAG_RANGE_GROUND = 0.29') && input.includes('TOUCH_DRAG_RANGE_AIR = 0.22'),
  'mobile ground and air gestures use separate analog throws');
check(input.includes('TOUCH_RESPONSE_GROUND = 24.0') && input.includes('TOUCH_RESPONSE_AIR = 34.0'),
  'mobile air tricks respond faster than grounded carving');
check(input.includes('_lastGrounded') && input.includes('_reanchorTouch') && input.includes('grounded !== this._lastGrounded'),
  'held touch re-anchors when takeoff/landing changes gesture context');
check(input.includes('__v1GoButtonHeld') && input.includes('this.extraPointers.size > 0 || this.keyBoost || this.__v1GoButtonHeld'),
  'dedicated GO button and second-finger shortcut share the same input contract');
check(mobile.includes("guide.id = 'v1TouchGuide'"),
  'mobile exposes a contextual gesture frame while the steering thumb is down');
check(mobile.includes("go.id = 'v1MobileGo'"),
  'mobile exposes a dedicated hold-GO control');
check(mobile.includes("jump.id = 'v1MobileJump'") && mobile.includes('input.jump = true'),
  'mobile exposes a dedicated tap-JUMP control independent from steering touch');
check(mobile.includes("#powerHint{display:none!important}"),
  'mobile removes redundant floating GO hint above the labeled meter');
check(mobile.includes("content:'SPIN'") && mobile.includes("content:'FLIP'") && mobile.includes("content:'CARVE'"),
  'gesture overlay communicates carve on snow and spin/flip in air');
check(mobile.includes('Audio.prototype.__v1MobileTouchUi'),
  'mobile presentation updates through the existing audio/presentation chain');
check(onboarding.includes("touch ? 'JUMP' : 'SPACE'") && onboarding.includes('TAP TO JUMP.'),
  'touch onboarding teaches the dedicated JUMP control rather than requiring a flick');
check(onboarding.includes("touch ? 'HOLD GO' : 'F'"),
  'touch onboarding teaches visible HOLD GO rather than requiring discovery of second finger');
check(index.includes('/src/v1-mobile-ui.js'), 'mobile control presentation is loaded by the release page');

check(viewport.includes('height:100dvh!important') && viewport.includes('#rc2Pause,#rc7Onboarding'),
  'standalone portrait overlays fill the complete dynamic viewport');
check(viewport.includes('safe-area-inset-bottom') && viewport.includes('position:fixed!important'),
  'iOS standalone bottom safe area stays inside the game shell');
check(!viewport.includes('requestAnimationFrame'),
  'viewport shell fix adds no runtime loop');

check(finalMix.includes('TUNING.AUDIO.WIND_MAX = 0.285') && finalMix.includes('const PACKED_SNOW_GLIDE = 0.075'),
  'final mix establishes the post-isolation wind and packed-snow reference');
check(approvedMix.includes('wind: -2') && approvedMix.includes('ski: -5.5') &&
  approvedMix.includes('bells: 4') && approvedMix.includes('heartbeat: 6') && approvedMix.includes('beast: 1'),
  'user-approved live mix is baked as the canonical V1 dB baseline');
check(approvedMix.includes('mixerZeroIsApprovedBaseline: true') && approvedMix.includes('__DESCENT_MIX?.reset?.()'),
  'hidden mixer resets to zero around the approved release baseline');
check(finalMix.includes('TUNING.AUDIO.ROAR_MAX = 0.35') && finalMix.includes('roar * 0.055'),
  'final mix gives Beast roar more foreground presence');
check(finalMix.includes('bellV1FinalMix') && finalMix.includes('huntPulseV1FinalMix'),
  'final mix lifts bells and Hunt heartbeat');
check(finalMix.includes('priorityDuck') && finalMix.includes('requestBedDuck'),
  'final mix uses brief priority ducking instead of indiscriminate master gain');
check(!finalMix.includes('requestAnimationFrame') && !approvedMix.includes('requestAnimationFrame'),
  'final and approved audio mix layers add no second RAF');
check(audioBridge.includes("import './v1-viewport.js'") && audioBridge.includes("import './v1-final-mix.js'") &&
  audioBridge.includes("import './v1-approved-mix.js'"),
  'final viewport and approved mix layers are loaded by the release runtime');

check(index.includes('rel="manifest"') && index.includes('./manifest.webmanifest?v=3'),
  'release page links the cache-busted PWA manifest');
check(index.includes('rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png?v=3"'),
  'release page exposes a PNG Apple home-screen icon');
check(index.includes("serviceWorker.register('./sw.js')"),
  'release page registers the PWA service worker');
check(manifest.includes('"id": "./"') && manifest.includes('"name": "WORD RUN"') && manifest.includes('"display": "standalone"'),
  'PWA manifest defines stable standalone WORD RUN install identity');
check(manifest.includes('/icons/wordrun-192.png') && manifest.includes('/icons/wordrun-512.png') && manifest.includes('"type": "image/png"'),
  'PWA manifest exposes PNG 192 and 512 install icons');
check(manifest.includes('/icons/wordrun-maskable-512.png') && manifest.includes('"purpose": "maskable"'),
  'PWA manifest exposes a PNG maskable safe-area icon');
check(fs.existsSync('public/apple-touch-icon.png') && fs.existsSync('public/icons/wordrun-512.png'),
  'home-screen PNG assets exist in the release shell');
check(sw.includes("const CACHE = 'wordrun-v1-shell-1'") && sw.includes("request.mode === 'navigate'"),
  'PWA service worker provides refreshed offline shell and network-first navigation');

check(!polish.includes('requestAnimationFrame'), 'ship-polish layer adds no second RAF');
check(!mobile.includes('requestAnimationFrame'), 'mobile control presentation adds no second RAF');
check(!sw.includes('requestAnimationFrame'), 'PWA layer adds no animation loop');
check(audioBridge.includes("import './v1-ship-polish.js'"), 'ship-polish layer is loaded by the release runtime');

console.log(`\nV1 polish gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
