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
  'HUD exposes a persistent charge widget beside the hearts');
// Phase 23: these pips counted bells toward the automatic heart repair that
// no longer exists. They now show the CLEAN READING STREAK — the thing that
// actually stands between a player and their next heart, and the one the
// playtest said a run gave no indication of at all.
check(polish.includes('sim.wordGates?.streak') &&
  polish.includes('STREAK_REPAIR_BY_HEARTS') && !polish.includes('sim.bellCharge'),
  'the charge widget reads the clean streak, not the retired bell charge');
check(polish.includes('Clean streak ${charge} of ${need} to the next heart') &&
  polish.includes('.v1-bell-pip.on'),
  'it names the streak and the target it is counting to, for a screen reader');
check(polish.includes("root.style.opacity = full ? '0.25' : '1'"),
  'and stands down when hearts are already full');
check(polish.includes('bellShipPolish') && polish.includes('vol: 0.038'),
  'bell gets an additional bright upper-partial presence lift');

// Phase 15/16: the tree and rock recordings are gone with the rest of the
// unreachable inherited Foley, so what has to hold now is that this path
// needs no assets at all.
check(!polish.includes("assets?.has?.('tree_hit')") && !polish.includes("assets?.has?.('rock_hit')"),
  'destruction audio reaches for no retired recording');
check(polish.includes("c.type === FEATURE.GATE") && polish.includes("'highpass'") && polish.includes("'bandpass'"),
  'gate destruction keeps a noise-first multi-impact metal fallback');

check(polish.includes('Input.prototype.__v1GamepadSupport') && polish.includes('navigator.getGamepads'),
  'standard browser gamepad polling is installed on the existing Input path');
check(polish.includes('button(pad, 0)') && polish.includes('button(pad, 7)') && polish.includes('button(pad, 9)'),
  'controller maps A/Cross jump, RT/R2 DASH and Start pause');
check(polish.includes('visibleControllerRoot') && polish.includes('focusControllerButton') && polish.includes('PointerEvent'),
  'controller can navigate and activate core game overlays');

// ── Phase 8: run-start warm-up (the profiled stutter stays fixed) ────────
const mainSrc = read('src/main.js');
const audioSrc = read('src/audio/audio.js');
check(mainSrc.includes('function warmStart()') && mainSrc.includes('initTexture') &&
  mainSrc.includes('compileAsync'),
  'title idle pre-compiles shaders and pre-uploads canvas textures');
// Phase A turned the single preview plate into a lookahead row, so the warm
// has to cover the whole row rather than a fixed second plate — a cold
// lookahead plate rasters and uploads on the start frame exactly like the
// armed one did before Phase 8.1 fixed it.
check(mainSrc.includes('wordGateActors.current.paint(makeGate(nextWordSeed, 0, prof).shown') &&
  mainSrc.includes('wordGateActors.ahead.forEach') &&
  mainSrc.includes('...wordGateActors.ahead, wordGateActors.fx') &&
  mainSrc.includes('function warmStart()') && mainSrc.includes('warmPlates();'),
  "every plate the first frame draws is painted before BEGIN RUN (cache-hit at start)");
check(audioSrc.includes('prewarm()') && audioSrc.includes('this.prewarm();') &&
  !audioSrc.includes('if (!Ctx) return;\n    const ctx = new Ctx();\n\n    this.ready'),
  'audio graph builds suspended at load; the gesture only resumes it');

// ── Phase 8.5: speed fantasy is keyed to the FULL floor→ceiling range ────
const rigSrc = read('src/render/camera-rig.js');
const actorsSrc = read('src/render/actors.js');
const audioMix = read('src/audio/audio.js');
const speedFx = read('src/render/speed-fantasy.js');
check(rigSrc.includes('(p.speed - R.FLOOR) / (R.CEILING - R.FLOOR)') &&
  rigSrc.includes('HEIGHT_SPEED_DROP') && rigSrc.includes('LOOK_SPEED_AHEAD'),
  'camera speed feel spans the whole RUN range: closer-lower-wider, not boom-back');
check(actorsSrc.includes('(p.speed - R.FLOOR) / (R.CEILING - R.FLOOR)') &&
  actorsSrc.includes('this.tail.material.opacity'),
  'runner cadence spans the range and the comet tail rides the top of it');
// Phase 27: no audio voice rides speed any more — every noise bed that did
// was a wind by another name. The music stems still take speed and chain, so
// going faster is still audible; it is scored rather than blown.
check(audioMix.includes('speed: p.effSpeed ?? p.speed') && audioMix.includes('streak: p.chain'),
  'speed reaches the ear through the music stems, not a noise bed');
check(mainSrc.includes('new WindStreaks(stage.camera)') &&
  mainSrc.includes('new TrackPylons(stage.scene') &&
  speedFx.includes('AdditiveBlending'),
  'wind streaks ride the camera and pylons flank the track');

check(input.includes('TOUCH_DRAG_RANGE_GROUND = 0.29') && input.includes('TOUCH_DRAG_RANGE_AIR = 0.22'),
  'mobile ground and air gestures use separate analog throws');
check(input.includes('TOUCH_RESPONSE_GROUND = 24.0') && input.includes('TOUCH_RESPONSE_AIR = 34.0'),
  'mobile air tricks respond faster than grounded carving');
check(input.includes('_lastGrounded') && input.includes('_reanchorTouch') && input.includes('grounded !== this._lastGrounded'),
  'held touch re-anchors when takeoff/landing changes gesture context');
// Phase C: the second-finger hold is gone. The dash is an edge — Space or
// both zones at once — and the on-screen button still holds, because a held
// control gains nothing by becoming a tap. All three reach one flag.
check(input.includes('__v1DashButtonHeld') &&
  input.includes('this.dashEdge || this.keyBoost || this.__v1DashButtonHeld'),
  'the on-screen button, the key and the two-zone edge share one dash flag');
check(!input.includes('GO_HOLD_MS') && input.includes('TAP_MS') && !input.includes('BOTH_ZONE_MS'),
  'a tap is a reading and nothing else — the dash is a button or a key');
// Playtest: REAL sat beside DASH and crowded one thumb; FAKE did not exist at
// all, so half the verb was invisible on the device it is played on.
check(mobile.includes("id = 'v1MobileFake'") && mobile.includes("<span>FAKE</span>") &&
  mobile.includes('input.reject = true'),
  'the fake answer has a control on the device that has no keyboard');
check(/#v1MobileJump\{right:max\(18px/.test(mobile) && /#v1MobileFake\{left:max\(18px/.test(mobile),
  'REAL stacks above DASH on the right; FAKE mirrors the left zone');
check(mobile.includes("guide.id = 'v1TouchGuide'"),
  'mobile exposes a touch ring while the thumb is down');
check(mobile.includes("go.id = 'v1MobileDash'"),
  'mobile exposes a dedicated hold-DASH control');
check(mobile.includes("jump.id = 'v1MobileJump'") && mobile.includes('input.jump = true'),
  'mobile exposes a dedicated tap-JUMP control independent from steering touch');
// Phase 16 reversed this one deliberately. The hint used to be hidden on
// touch because the button "already explained GO"; it plainly did not, so
// the hint now shows on touch while the dash is unlearned and disappears
// for good the moment the player uses it.
check(mobile.includes("#powerHint:not(.teaching){display:none!important}"),
  'mobile shows the floating dash hint only while the mechanic is unlearned');
check(mobile.includes("content:'REAL'") &&
  !mobile.includes("content:'SPIN'") && !mobile.includes("content:'FLIP'") && !mobile.includes("content:'CARVE'"),
  'touch ring teaches the confirm verb; retired carve/spin/flip labels are gone');
check(mobile.includes('Audio.prototype.__v1MobileTouchUi'),
  'mobile presentation updates through the existing audio/presentation chain');
// Phase 24 rewrote this card from a controls list into teaching: sentences
// with the control set as a highlighted key inside them. The contract that
// matters is unchanged — the confirm verb and the DASH are both taught by
// name, and the touch build names the on-screen button rather than a key
// nobody on a phone has.
// Phase C teaches two zones rather than one verb, and names the control set
// each device actually has.
check(onboarding.includes("touch ? 'TAP RIGHT' : '\u2192'") &&
  onboarding.includes("touch ? 'TAP LEFT' : '\u2190'") &&
  onboarding.includes('if the word is spelled correctly'),
  'onboarding teaches both zones rather than requiring discovery');
check(onboarding.includes("touch ? 'DASH' : 'SPACE'") &&
  onboarding.includes('spends a full DASH charge'),
  'the DASH is taught by name, and by the gesture a phone actually has');
check(onboarding.includes('three hearts') && onboarding.includes('in a row</i> to win one back'),
  'and the heart economy is taught, since a wrong read now costs one');
check(index.includes('/src/v1-mobile-ui.js'), 'mobile control presentation is loaded by the release page');

check(viewport.includes('height:100dvh!important') && viewport.includes('#rc2Pause,#rc7Onboarding'),
  'standalone portrait overlays fill the complete dynamic viewport');
check(viewport.includes('safe-area-inset-bottom') && viewport.includes('position:fixed!important'),
  'iOS standalone bottom safe area stays inside the game shell');
check(!viewport.includes('requestAnimationFrame'),
  'viewport shell fix adds no runtime loop');

// Phase 30: the hearts sat at a fixed offset below a headline whose height is
// clamp(38px..66px), so on a wide viewport the score grew straight through
// them. Position them in the HUD column's flow and the collision cannot
// return at any width — measured clear at 390, 430, 768, 1280 and 1670.
const rc5Src = read('src/rc5.js');
const html = read('index.html');
check(html.includes('id="vitalsSlot"') && rc5Src.includes("getElementById('vitalsSlot')"),
  'the hearts live in the HUD column, not at a guessed offset');
check(!/#rc5Vitals\{position:absolute[^}]*top:calc\(var\(--safe-t\) \+ 60px\)/.test(rc5Src),
  'no fixed top offset races the fluid score headline');
check(/#vitalsSlot\{[^}]*margin-top/.test(html),
  'the slot spaces itself from the line above rather than overlapping it');

// Phase 24 removed the wind bed and Phase 27 the glide bed behind it, so both
// reference levels are gone. This asserts each removal is complete rather than
// partial — the failure mode is a voice left audible with no fader, which is
// precisely how the glide bed survived Phase 24 while its name did not.
check(!finalMix.includes('WIND_MAX') && !finalMix.includes('SURFACE_GLIDE') &&
  !finalMix.includes('windMax') && !finalMix.includes('surfaceGlide'),
  'no orphaned reference level for a voice that no longer exists');
check(approvedMix.includes('surface: -5.5') && approvedMix.includes('bells: 4') &&
  approvedMix.includes('heartbeat: 6') && approvedMix.includes('beast: 1') &&
  !approvedMix.includes('wind:'),
  'user-approved live mix is baked as the canonical V1 dB baseline, wind excepted');
const rc9FeedbackSrc = read('src/rc9-feedback.js');
const mixerSrc = read('src/v1-mixer.js');
check(!/this\.wind|this\.air\b|WIND_MAX|AIR_WIND/.test(audioSrc) &&
  !/windTrim|WIND_TRIM/.test(rc9FeedbackSrc) && !/WIND_MAX/.test(mixerSrc),
  'the wind bed is gone everywhere — voice, trim bus, tuning and fader');
check(approvedMix.includes('mixerZeroIsApprovedBaseline: true') && approvedMix.includes('__DASH_MIX?.reset?.()'),
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

check(index.includes('rel="manifest"') && index.includes('./manifest.webmanifest?v=4'),
  'release page links the cache-busted PWA manifest');
check(index.includes('rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png?v=4"'),
  'release page exposes a PNG Apple home-screen icon');
check(index.includes("serviceWorker.register('./sw.js')"),
  'release page registers the PWA service worker');
check(manifest.includes('"id": "./"') && manifest.includes('"name": "DICTION DASH"') && manifest.includes('"display": "standalone"'),
  'PWA manifest defines stable standalone DICTION DASH install identity');
check(manifest.includes('/icons/dictiondash-192.png') && manifest.includes('/icons/dictiondash-512.png') && manifest.includes('"type": "image/png"'),
  'PWA manifest exposes PNG 192 and 512 install icons');
check(manifest.includes('/icons/dictiondash-maskable-512.png') && manifest.includes('"purpose": "maskable"'),
  'PWA manifest exposes a PNG maskable safe-area icon');
check(fs.existsSync('public/apple-touch-icon.png') && fs.existsSync('public/icons/dictiondash-512.png'),
  'home-screen PNG assets exist in the release shell');
check(sw.includes("const CACHE = 'dictiondash-v1-shell-1'") && sw.includes("request.mode === 'navigate'"),
  'PWA service worker provides refreshed offline shell and network-first navigation');

check(!polish.includes('requestAnimationFrame'), 'ship-polish layer adds no second RAF');
check(!mobile.includes('requestAnimationFrame'), 'mobile control presentation adds no second RAF');
check(!sw.includes('requestAnimationFrame'), 'PWA layer adds no animation loop');
check(audioBridge.includes("import './v1-ship-polish.js'"), 'ship-polish layer is loaded by the release runtime');


// ── Speed feel (Phase 22) ───────────────────────────────────────────────────
// The camera now sells the top end far harder. Everything here guards the one
// thing that outranks spectacle: the player has to be able to read the word.
{
  const T = (await import('../src/TUNING.js')).default;
  const rig = fs.readFileSync('src/render/camera-rig.js', 'utf8');
  const C = T.CAMERA, B = T.BOOST, R = T.RUN, W = T.WORDS;

  check(C.BACK_SPEED_GAIN < 0,
    'the rig closes in as you accelerate rather than easing out');
  check(C.HEIGHT_SPEED_DROP > 2.5 && C.FOV_SPEED_GAIN > 0.9 && C.LOOK_SPEED_AHEAD > 7,
    'the speed-keyed rig terms are the aggressive ones');

  // The clamp has to be load-bearing, not decorative: prove the stacked
  // terms would exceed it, and that the code actually applies it.
  const stacked = C.FOV + C.FOV_SPEED_GAIN * 20 + C.FOV_BOOST + 2 + B.DASH.KICK_FOV;
  check(stacked > C.FOV_MAX,
    `the stacked lens really would fisheye without the cap (${stacked.toFixed(0)} deg vs cap ${C.FOV_MAX})`);
  check(rig.includes('Math.min(C.FOV_MAX'),
    'and the rig clamps it rather than trusting the numbers to behave');
  check(C.FOV_MAX <= 100, `the cap is inside sane portrait framing (${C.FOV_MAX} deg)`);

  // Motion is an accessibility surface. REDUCED FLASH must damp the rig.
  check(rig.includes('ACCESS.reducedFlash ? C.ACCESS_MOTION_SCALE : 1') &&
    rig.includes('* motion'),
    'REDUCED FLASH damps every speed-keyed camera term');
  check(C.ACCESS_MOTION_SCALE > 0 && C.ACCESS_MOTION_SCALE < 1,
    'and damps rather than disables — the shot is the same, just calmer');

  // The DASH is an event: a full charge, spent whole.
  check(B.MIN_ACTIVATE === B.METER_MAX,
    `the dash fires only on a full charge (${B.MIN_ACTIVATE}/${B.METER_MAX})`);

  // The reading window is ARM_DISTANCE_M / speed, and ARM_DISTANCE_M cannot
  // grow to buy a bigger dash multiplier back: it sits under the minimum gate
  // spacing precisely so only one word is ever in play. That invariant is why
  // the dash got longer and rarer instead of stronger.
  check(W.ARM_DISTANCE_M < W.SPACING_MIN_M,
    `only one word is ever in play (arm ${W.ARM_DISTANCE_M}m < spacing floor ${W.SPACING_MIN_M}m)`);
  const windowAtCeiling = W.ARM_DISTANCE_M / (R.CEILING * B.SPEED_MULT);
  check(B.SPEED_MULT <= 1.4,
    `the dash multiplier stayed put — raising it shrinks the read window`
    + ` (x${B.SPEED_MULT} already gives ${windowAtCeiling.toFixed(2)}s at the ceiling)`);
}

console.log(`\nV1 polish gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
