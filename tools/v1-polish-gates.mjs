import fs from 'node:fs';
import { viewPlayer, viewBeast } from '../src/render/view-pose.js';

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

// RC6.2: the streak widget is DELETED, and its four checks retire with it
// rather than being kept alive against a rewritten target. What they were
// protecting — that a run says how close the next heart is, and says nothing
// when the row is full — is now protected where the answer is drawn: inside
// the hearts themselves (see the RC6.2 block at the end of this file).
check(!polish.includes('v1BellCharge') && !polish.includes('v1-bell-pip'),
  'the separate streak widget is gone from the ship-polish layer, not merely hidden');
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
// was a wind by another name. Phase J retired the stem engine too; going
// faster is still audible because the full track's beat clock is mapped from
// the run's intensity term, which is keyed to speed. Scored, never blown.
check(mainSrc.includes('musicResponse(clock') &&
  /0\.45 \* \(\(p\.speed - TUNING\.RUN\.FLOOR\)/.test(mainSrc) && !/this\.stems/.test(audioMix),
  'speed reaches the ear through the beat clock of the score, not a noise bed and not a stem bus');
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
// Phase 0: the hearts HUD was folded out of the deleted rc5.js into ui.js
// (built there, appended to the #vitalsSlot flow) with its CSS in index.html.
const uiSrc = read('src/ui/ui.js');
const html = read('index.html');
check(html.includes('id="vitalsSlot"') && uiSrc.includes("$('vitalsSlot')"),
  'the hearts live in the HUD column, not at a guessed offset');
check(!/#vitals\{[^}]*position:absolute/.test(html),
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
// Playtest x3 ("the Redline is still loud"): this layer owns the live level —
// it re-writes the threat bus every frame, so the cut has to live HERE or it
// is silently overwritten. Both layers must agree, and neither may creep back.
check(finalMix.includes('TUNING.AUDIO.ROAR_MAX = 0.20') &&
  finalMix.includes('this.bus.threat.gain, 0.55 + roar * 0.05') &&
  audioSrc.includes('run ? (kill ? 0.20 : 0.55) : 0'),
  'the Redline sits under the mix at both layers, still rising as it closes');
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

// ── Playtest pass: four things a player reported and what stops them ──────
{
  // Every check in this block reads CODE, not prose. The recurring failure in
  // this repo is a guard that trips on the comment explaining it, so strip the
  // comments first and search what actually runs.
  const codeOf = (path) => read(path)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  // 1. "The wind sound came back as the Redline approached."
  //    It had. Phase 27's note said every sustained noise bed was gone; what it
  //    removed were the SPEED-keyed ones, and the two PURSUIT-keyed beds — a
  //    wandering bandpass on white noise and a highpassed hiss on corruption —
  //    were left running. Held broadband noise is wind to an ear whatever the
  //    filter is called, so the rule is about SUSTAIN, not about naming: a
  //    voice may be fired as a transient, never assigned and held open.
  const audioCode = codeOf('src/audio/audio.js');
  const heldNoise = [...audioCode.matchAll(/this\.(\w+)\s*=\s*this\._noiseVoice\(/g)]
    .map((m) => m[1]);
  check(heldNoise.length === 0,
    `no sustained broadband voice is held open on any bus${heldNoise.length ? ` — found ${heldNoise.join(', ')}` : ''}`);
  check(/this\.roar\s*=\s*this\._buzzVoice\(/.test(audioCode) &&
    /_buzzVoice\([\s\S]{0,600}createOscillator\(\)/.test(audioCode),
    'the pursuit voice is tonal — oscillators through a filter, not noise through one');
  check(/corruptionIntensity\(/.test(audioCode) && /_crackleT/.test(audioCode) &&
    /_burst\([\s\S]{0,200}this\.bus\.threat/.test(audioCode),
    'the corruption still drives the far layer, fired as crackle rather than held as a bed');

  // 2. "Lines aren't fully connected on our road."
  //    The grid took both axes from world space while the rails followed the
  //    ribbon, so on a bend they were in two coordinate systems and could not
  //    meet. The across-axis is the lane attribute now.
  const gridCode = codeOf('src/render/material-pass.js');
  const cell = gridCode.slice(gridCode.indexOf('p4Cell'), gridCode.indexOf('p4Rail'));
  check(/vec2\(\s*p4Across\s*,\s*vP4World\.z\s*\)/.test(cell) && !/vP4World\.xz/.test(cell),
    'the road grid is drawn in track space, so every stripe runs parallel to the rails');
  check(/p4Line \*= 1\.0 - smoothstep\([\d.]+, [\d.]+, abs\(vP4Lane\)\)/.test(gridCode),
    'and stops at the rail rather than running on past the edge of the road');
  check(/lane\[i\] = u;/.test(codeOf('src/render/terrain-mesh.js')) &&
    /abs\(vP4Lane\)/.test(gridCode),
    'the lane attribute is signed so the stripes know which side they are on');

  // 3. "The poles aren't attached to anything." They took the generator's x and
  //    the terrain height there — a point off the side of the only visible
  //    ground in the scene. Phase 0.2 then found the fix had landed in code
  //    that draws nothing (props.js sees an empty collider list) and removed
  //    that placement path outright; the stanchions in speed-fantasy.js are
  //    the only posts, and THEY stand on the ribbon edge.
  const propCode = codeOf('src/render/props.js');
  const pylonCode = codeOf('src/render/speed-fantasy.js');
  check(!/this\.pole\b/.test(propCode) && !/c\.type === FEATURE\.GATE/.test(propCode),
    'props.js places no verge posts — the dead path is gone, not duplicated');
  check(/corridorX\(/.test(pylonCode) && /R\.TRACK_HALF_W/.test(pylonCode),
    'the one set of posts stands on the ribbon edge, the same line the rail and the grid end on');

  // 4. "Score doesn't cut in-game after choosing a continue, only on the end
  //    screen." The multiplier was applied once, at the recap, so the HUD kept
  //    counting from the full total and the price was invisible until it was
  //    too late to feel like one.
  const mainCode = codeOf('src/main.js');
  const buy = mainCode.slice(mainCode.indexOf('function buyContinue'),
    mainCode.indexOf('function reviveRun'));
  check(/sim\.player\.score = Math\.floor\(sim\.player\.score \* TUNING\.SCORE\.CONTINUE_KEEP\)/.test(buy),
    'the continue takes its cut off the live score, the moment it is bought');
  check(!/Math\.pow\(TUNING\.SCORE\.CONTINUE_KEEP/.test(mainCode),
    'and the recap does not charge for it a second time');
  check(/continueScoreLost \+= /.test(buy) &&
    /lastRunScoreLost = \(earned - finalScore\) \+ continueScoreLost/.test(mainCode),
    'the death card still reports the full amount the continues cost');
  check(/flashScoreCut\(/.test(codeOf('src/ui/ui.js')),
    'and the drop is shown happening, so it does not read as a glitch in the counter');
}

// ── Debugging pass: three reports, three root causes ─────────────────────
{
  const TUNING = (await import('../src/TUNING.js')).default;
  const { Sim, emptyInput } = await import('../src/sim/sim.js');
  const { Terrain } = await import('../src/sim/terrain.js');
  const B = TUNING.BOOST, R = TUNING.RUN;

  const codeOf = (path) => read(path)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  // 1. "Space bar not working." It fired the dash for exactly one frame.
  //    Phase C made the dash an EDGE (dashEdge latches for one frame, then
  //    consumeJump clears it) but _overdrive was never converted from the HOLD
  //    model: it ended the moment `want` went false. The button and the F key
  //    only worked because they happen to be holds. A full charge is spent
  //    whole now, so all three controls behave identically.
  {
    const dashRun = (holdFrames) => {
      const sim = new Sim(4242); sim.start(4242);
      sim.player.boostMeter = B.METER_MAX;
      let on = 0;
      for (let f = 0; f < 600; f++) {
        sim.advance(1 / 60, { ...emptyInput(), boostHeld: f < holdFrames });
        if (sim.player.overdrive) on += 1 / 60;
        else if (on > 0) break;
      }
      return on;
    };
    const tap = dashRun(1), held = dashRun(99999);
    check(Math.abs(tap - held) < 1e-6 && tap > 1,
      `a tapped dash lasts as long as a held one (${tap.toFixed(2)}s both) — the edge is a real control`);
    check(Math.abs(tap - B.METER_MAX / B.DRAIN_RATE) < 0.05,
      `and it runs the meter out rather than the key (${tap.toFixed(2)}s vs ${(B.METER_MAX / B.DRAIN_RATE).toFixed(2)}s of charge)`);
    const playerCode = codeOf('src/sim/player.js');
    const od = playerCode.slice(playerCode.indexOf('_overdrive('), playerCode.indexOf('step(dt, input'));
    check(/if \(this\.boostMeter <= 0\)/.test(od) && !/!want \|\|/.test(od),
      'releasing the control cannot cancel a dash that has already been paid for');
  }

  // 2. "Some lines out of place, when the rest of them fit the road."
  //    Two separate offenders, both about NOT following the ribbon.
  {
    // (a) The runner's ink trail was the only thing drawn on the ground with
    //     fog off, and it recorded the whole run, so its far end stayed at
    //     full additive brightness while the road under it faded away.
    const actorCode = codeOf('src/render/actors.js');
    const trail = actorCode.slice(actorCode.indexOf('this.tracks = new THREE.LineSegments'));
    check(/fog: true/.test(trail.slice(0, 300)),
      'the runner trail takes the same fog as the road it is drawn on');
    const segs = Number(/const TRACK_SEGMENTS = (\d+)/.exec(actorCode)?.[1]);
    check(segs > 0 && segs <= 80,
      `and it is a tail, not a transcript of the run (${segs} segments)`);

    // (b) The gate ground line is the one road marking drawn separately from
    //     the ribbon mesh, so it is the one that has to be told about the
    //     bank. Phase L: the terrain owns ONE surface function now —
    //     crossSlopeAt combines the segment roll and the turn-lean — and the
    //     mesh, the line and the plates all read it, so nothing can drift.
    const meshCode = read('src/render/terrain-mesh.js');
    const gateCode = codeOf('src/render/word-gates.js');
    check(meshCode.includes('this.terrain.heightAt(x, d)') &&
      meshCode.includes('crossSlopeAt') && !/const BANK = /.test(meshCode),
      'the ribbon samples the terrain\'s one surface function, no local bank constant');
    check(gateCode.includes('terrain.crossSlopeAt ? terrain.crossSlopeAt(d) : 0') &&
      !/const EDGE_BANK = /.test(gateCode),
      'the gate ground line reads the same cross-slope, not a hand-synced copy');
    check(/rollAt\(terrain, g\.d\)/.test(gateCode) && /rollAt\(terrain, n\.d\)/.test(gateCode),
      'and every plate drawn — armed and lookahead — is given that roll');
    // The error a hand-synced constant would re-open, at this track's worst bend.
    const t = new Terrain(4242);
    const edgeBank = TUNING.TERRAIN.ROUTE.EDGE_BANK;
    let worst = 0;
    for (let d = 0; d < 3000; d += 1) {
      worst = Math.max(worst, Math.abs(t.corridorSlope(d)) * edgeBank * R.TRACK_HALF_W * 0.5);
    }
    check(worst > 0.2,
      `flat, that line missed the road by up to ${worst.toFixed(2)}m at the rail — which is why it reads the surface`);
  }

  // 3. "L/R works but we have no player onboarding to teach them that."
  //    There was teaching; it only ran when runsToday === 0, which for anyone
  //    past their first sitting is never. And no line in the game named the
  //    dash control at all.
  {
    const uiCode = codeOf('src/ui/ui.js');
    const coach = uiCode.slice(uiCode.indexOf('_updateCoach('), uiCode.indexOf('update(dt, sim, running'));
    check(/setLessons\(/.test(uiCode) && /L\.confirm/.test(coach) && /L\.reject/.test(coach),
      'the control lessons run until the player has used the control, not until tomorrow');
    check(!/!this\._firstRun\) \{\s*this\.coach/.test(coach),
      'and are no longer gated on it being the first run of the day');
    check(/L\.dash/.test(coach) && /TO DASH|TAP DASH/.test(coach),
      'the game names the dash control at the moment the bar is full — it never did before');
    const mainCode = codeOf('src/main.js');
    check(/learn\('Confirm'\)/.test(mainCode) && /learn\('Reject'\)/.test(mainCode) &&
      /learn\('Dash'\)/.test(mainCode),
      'and each lesson is retired where its action is actually performed');
    // Phase R: the compression hold joins the set — taught to a player who
    // is already reading cleanly, retired on the first successful raise.
    check(/L\.bar/.test(coach) && /RAISE THE BAR/.test(coach) &&
      /p\.compressionLevel === 0 && p\.chain >= 4/.test(coach),
      'the compression hold is taught, and only to a player mid-flow');
    check(/if \(p\.compressionLevel > 0\) learn\('Bar'\)/.test(mainCode) &&
      /bar: metaStats\.get\('usedBar', 0\) > 0/.test(mainCode),
      'and it retires on the level actually moving, persisted like the rest');
  }
}

// ── Playtest fixes: the answer pair, and panels that own the screen ────────
{
  // REAL and FAKE are one pair of verbs, and they sit level: same height,
  // mirrored sides, in portrait and landscape both. (Playtest: FAKE sat at
  // DASH's height and read as a different kind of button.)
  // RC-5: the pair is still level, on the single low row they now share
  // with DASH between them.
  const portraitJump = mobile.match(/#v1MobileJump\{[^}]*bottom:max\(22px/);
  const portraitFake = mobile.match(/#v1MobileFake\{[^}]*bottom:max\(22px/);
  const landscape = mobile.slice(mobile.indexOf('max-height:500px'));
  check(!!portraitJump && !!portraitFake &&
    /#v1MobileJump\{[^}]*bottom:max\(17px/.test(landscape) &&
    /#v1MobileFake\{[^}]*bottom:max\(17px/.test(landscape),
    'REAL and FAKE sit level — one answer pair, both orientations');

  // An open overlay panel owns the whole screen: both sheets sit above the
  // pause button (81) and mute (80), so the pause-under-the-panel route to
  // the overlapping-text title screen cannot be walked.
  const accessSrc = read('src/ui/access.js');
  const shopSrc = read('src/ui/shop.js');
  const pauseSrc = read('src/ui/pause.js');
  check(/#accessPanel\{[^}]*z-index:90/.test(accessSrc) &&
    /#shopPanel\{[^}]*z-index:90/.test(shopSrc) &&
    /#rc2PauseBtn\{[^}]*z-index:81/.test(pauseSrc),
    'open panels sit above the pause button — nothing behind them is tappable');

  // The shop freezes a live run exactly like the settings panel does, and
  // no panel survives the trip back to the title.
  const mainSrc = read('src/main.js');
  check(shopSrc.includes('onOpen?.()') && shopSrc.includes('onClose?.()') &&
    mainSrc.includes('onOpen: freezeForPanel, onClose: unfreezeForPanel,\n    });') &&
    /const accessUI = buildAccessPanel\(\{\n  onOpen: freezeForPanel, onClose: unfreezeForPanel,/.test(mainSrc),
    'the shop quiet-freezes a live run, through the same hooks as settings');
  check(mainSrc.includes("accessUI?.panel.classList.remove('on')") &&
    mainSrc.includes("shopUI?.panel.classList.remove('on')") &&
    mainSrc.indexOf('panelFroze = false;\n  launchPending = false;\n  launch.cancel();\n  accessUI') > mainSrc.indexOf('function quitToTitle'),
    'quitting to the title closes every overlay panel and clears the freeze');
}

// ── Phase E3: the runner's states — posture as a pure function of sim state ──
{
  const actors = read('src/render/actors.js');
  check(/const econ = Math\.max\(0, Math\.min\(1, \(\(this\.flow \?\? 1\) - 1\.25\) \/ 0\.5\)\)/.test(actors) &&
    actors.includes('(1 - econ * 0.25)') && actors.includes('(1 - econ * 0.5)'),
    'high flow reads as economy — less bob, tighter swing, mastery as ease');
  check(actors.includes("(p.overdrive ? 0.09 : 0)") &&
    actors.includes("(p.overdrive ? 0.14 : 0)") && actors.includes('swingMul: (p.overdrive ? 0.85 : 1)'),
    'the dash drops the body and drives it — the spend is visible in the spine');
  check(actors.includes('nerve * 0.035') && actors.includes('nerve * 0.08'),
    'the Redline close pulls the figure into a crouch, not just a faster blink');
  check(actors.includes('(p.staggerT / TUNING.PLAYER.STAGGER_TIME) * 0.3'),
    'the stumble is one pitch forward that recovers with the stagger');
  check(!/p\.(speed|d|x|y|chain)\s*=/.test(actors),
    'and the actor never writes a sim field — posture reads, forward motion is the sim\'s');
  const ghostCall = actors.slice(actors.lastIndexOf('poseRunner('));
  check(/poseRunner\(this, this\._phase, speedN, false, dt\)/.test(ghostCall),
    'the ghost strides exactly as it always has — no style, no states');
}

// ── Phase R: 120 Hz — the fixed-step sim presented through one lerped pose ──
{
  const player = { x: 2, y: 1, d: 100, heading: 0.2, chain: 7, overdrive: true, speed: 48 };
  const prev = { x: 0, y: 0, d: 99, heading: 0, beastGap: 30, beastX: 4 };
  const beast = { gap: 28, x: 6 };

  const mid = viewPlayer(player, prev, 0.5);
  check(mid.x === 1 && mid.y === 0.5 && mid.d === 99.5 && Math.abs(mid.heading - 0.1) < 1e-12,
    'the view pose is the exact midpoint at alpha 0.5 — continuous fields lerp');
  check(mid.chain === 7 && mid.overdrive === true && mid.speed === 48,
    'discrete state falls through untouched — nothing is invented between steps');
  check(player.x === 2 && player.d === 100 && !Object.hasOwn(player, 'viewPrev'),
    'the view never writes back into the sim');
  check(viewPlayer(player, prev, 1) === player && viewPlayer(player, null, 0.5) === player,
    'at a step boundary (or with no captured pose) the view IS the live state');
  const bMid = viewBeast(beast, prev, 0.5);
  check(bMid.gap === 29 && bMid.x === 5,
    'the Redline gap and lane interpolate with the runner, never against');

  const simCode = read('src/sim/sim.js');
  const mainCode = read('src/main.js');
  check(simCode.includes('this._capturePrev();\n      this.step(input)') &&
    simCode.includes('this.viewPrev = null'),
    'the sim captures the pre-step pose passively and clears it between runs');
  check(mainCode.includes('alpha = sim.advance(dt, simInput)') &&
    mainCode.includes('const pv = viewPlayer(p, sim.viewPrev, alpha)'),
    'the render frame consumes the alpha advance() always returned');
  check(mainCode.includes('playerActor.update(pv,') &&
    mainCode.includes('stage.followLight(pv.x, pv.y, -pv.d)') &&
    mainCode.includes('rig.update(dt, pv,'),
    'the runner, the camera and the light all draw the interpolated pose');
}

// ── N1: the answer moment — buffer acknowledgment + stronger tells ────────
{
  const plateSrc = read('src/render/word-gates.js');
  const simGates = read('src/sim/word-gates.js');
  const mainCode = read('src/main.js');
  const audioCode = read('src/audio/audio.js');
  check(simGates.includes("events?.push({ t: 'word_held'") &&
    simGates.includes('this.heldIndex = g.index'),
    'the sim buffers a dead-zone answer instead of swallowing it');
  check(plateSrc.includes("'held-real'") && plateSrc.includes("'held-fake'") &&
    plateSrc.includes('wg.heldIndex === g.index'),
    'the plate shows the held answer on the side the player pressed');
  check(/held\b[\s\S]{0,600}fillText\(text, cx, cy\)/.test(plateSrc),
    'the held mark never touches the word itself — legibility outranks it');
  check(mainCode.includes("case 'word_held': audio.wordHeld(") &&
    audioCode.includes('wordHeld(real)'),
    'the buffered answer is acknowledged in audio, panned to its side');
  check(mainCode.includes('editorialWorld.typesetSnap(early)') &&
    read('src/render/editorial-world.js').includes('if (ACCESS.reducedFlash) return;'),
    'each correct read typesets into the page, and REDUCED FLASH skips it');
  check(/audio\.slip\(\);[\s\S]{0,400}ui\.drain\(\);/.test(mainCode),
    'a missed real borrows the drain — the slip is no longer weightless');
}

// ── N3: the runner's silhouette — a deliberate figure, not a mannequin ────
{
  const actors = read('src/render/actors.js');
  check(!actors.includes('BoxGeometry'),
    'no box primitive survives in the runner — the mannequin cannot creep back');
  check(/CylinderGeometry\(thick \* 0\.40, thick \* 0\.14/.test(actors),
    'the limbs are calligraphic strokes, tapering almost to a point');
  check(actors.includes('const crest = new THREE.Mesh') &&
    /crest\.rotation\.x = 1\.15/.test(actors),
    'the head carries the one identity mark — the crest swept back off the crown');
  check(actors.includes('function poseRunner(r, phase, speedN, airborne, dt, style = {})') &&
    actors.includes('hips, chest, head, halo, pool, tail'),
    'the rig contract is untouched — every E3 posture and the ghost pose identically');
}

// ── N4: the bookends — the authored launch and the FINISH arrival ─────────
{
  const launch = read('src/render/launch-sequence.js');
  const mainCode = read('src/main.js');
  const audioCode = read('src/audio/audio.js');
  check(!/\bsim\.|__SIM/.test(launch),
    'the launch is presentation only — it cannot read or write the sim');
  check(launch.includes('pointer-events:none') &&
    launch.includes('ACCESS.reducedFlash'),
    'the launch never blocks input, and REDUCED FLASH gets one smooth fade');
  check(launch.includes('ACCESS.dangerCss'),
    'the slash wears the LIVE danger accent — colour-vision modes carry through');
  check(launch.includes('this.strokes = [') &&
    (launch.match(/\{ top: \d+, angle: -\d+/g) || []).length >= 8 &&
    new Set((launch.match(/angle: (-\d+)/g) || [])).size >= 7 &&
    launch.includes("from: 'r'") &&
    launch.includes('this.bloom = document.createElement'),
    'the arrival is a full-frame storm: 8+ strokes, 7+ angles, cuts from both sides');
  check(mainCode.includes('launch.begin(') &&
    mainCode.includes('launch.update(dt)') &&
    mainCode.includes('launch.cancel()'),
    'explicit integration: startRun begins it, the frame loop drives it, quitToTitle clears it');
  check(mainCode.includes("case 'route_finished':") &&
    /route_finished':[\s\S]{0,300}finishArrival\(\);[\s\S]{0,200}pulseInk\(\);[\s\S]{0,200}settle\(\);/.test(mainCode),
    'the hundredth gate is an arrival: breath, ink swell, camera stillness');
  check(audioCode.includes('launch(quick = false)') && audioCode.includes('finishArrival()'),
    'both bookend sounds exist in the one audio system');
}

// ── Visibility pass: the bells' halo and the answer vignette ─────────────
{
  const bells = read('src/render/bells.js');
  const uiCode = read('src/ui/ui.js');
  const mainCode = read('src/main.js');
  const plate = read('src/render/word-gates.js');
  check(bells.includes('AdditiveBlending') && bells.includes('this.halo = new THREE.InstancedMesh'),
    'every bell wears an additive halo — visible in the darkest band');
  check(uiCode.includes('answerFlash(ok)') &&
    uiCode.includes('if (ACCESS.reducedFlash) return;') &&
    uiCode.includes('ok ? ACCESS.right : ACCESS.wrong'),
    'the answer vignette is RF-skipped and wears the semantic pair, colour-vision aware');
  check(/if \(e\.answered\) \{[\s\S]{0,700}ui\.answerFlash\(true\)/.test(mainCode) &&
    mainCode.includes('ui.answerFlash(false);'),
    'the verdict wash fires for acted answers and both wrong reads — never a passive pass');
  check(/state === 'right' \|\| state === 'wrong'[\s\S]{0,400}globalAlpha = 0\.2/.test(plate),
    'the verdict plate fills with its own colour under the glyphs');
}

// ── The answer edge has exactly three writers: tap, button, key ──────────
{
  const inputSrc = read('src/input/input.js');
  // Exactly three writers: the tap zone, the keyboard pair, and the test
  // harness's scripted input. The legacy flick — a MOVEMENT writing the
  // answer edge — is gone and must stay gone.
  const writers = (inputSrc.match(/this\.jump = true/g) || []).length;
  check(writers === 3 && !inputSrc.includes('dy < -SWIPE_PX') &&
    inputSrc.includes('Nothing else may ever write the answer edge'),
    'no gesture but a tap or a key writes the answer — the flick ghost is gone');
}

// ── PD-1: guided onboarding — two surfaces, one instruction at a time ────
{
  const guidedSrc = read('src/ui/guided.js');
  const uiCode = read('src/ui/ui.js');
  const mainCode = read('src/main.js');
  const accessCode = read('src/ui/access.js');
  const onboardingCode = read('src/ui/onboarding.js');
  check(!/\bsim\.|__SIM/.test(guidedSrc) && guidedSrc.includes('pointer-events:none'),
    'the TEACH surface is presentation only and never blocks input');
  // RC-2 playtest: partial yielding still let a tip show at the bottom AND
  // the middle. While TEACH is active the coach line says nothing at all.
  check(guidedSrc.includes('!veilUp && !hintUp') &&
    /if \(this\._stopActive\) \{\s*\n\s*this\.coach\.classList\.remove\('on'\);\s*\n\s*return;/.test(uiCode),
    'one instruction at a time: the band yields to the launch and the dash hint, and the coach is silent through a stop');
  check(accessCode.includes("chipRow('GUIDED TIPS'") &&
    accessCode.includes('guidedTips: ACCESS.guidedTips') &&
    accessCode.includes('saved.guidedTips !== false'),
    'GUIDED TIPS is a persisted chip, default ON');
  check(mainCode.includes('chart: chartForRun()') &&
    mainCode.includes("CHART: chartForRun()") &&
    /return ACCESS\.guidedTips && !stopsDone\(\) \? 'guided' : 'endless';/.test(mainCode),
    'the guided chart reaches the run and the warm plates through one predicate, ENDLESS only');
  // RC-2 playtest: the condensed "essence" first-open card made the fresh
  // open WORSE — the full six-rule sheet is the one card, everywhere, and
  // the condensed mode must stay deleted.
  check(!onboardingCode.includes("classList.add('condensed')") &&
    !onboardingCode.includes('.condensed') &&
    (onboardingCode.match(/<div class="rule">/g) || []).length === 6,
    'one HOW TO PLAY card — the full six-rule sheet on fresh open and in the pause menu alike');
}

// ── PD-2: the continuous journey ─────────────────────────────────────────
{
  const launchSrc = read('src/render/launch-sequence.js');
  const mainCode = read('src/main.js');
  const uiCode = read('src/ui/ui.js');
  const htmlCode = read('index.html');
  const audioCode = read('src/audio/audio.js');
  check(launchSrc.includes('begin({ quick = false, onBlack = null } = {})') &&
    launchSrc.includes("const dur = q ? 1.0 : DUR") &&
    launchSrc.includes('if (q && !s.main) continue;'),
    'a retry gets the one-second cut — dip, one slash, reveal; the menu keeps the full arrival');
  check(mainCode.includes('const fromTitle = sim.phase === PHASE.TITLE;') &&
    mainCode.includes('launch.begin({ quick: !fromTitle, onBlack: buildRunInTheDark })') &&
    mainCode.includes('audio.launch(!fromTitle)') &&
    audioCode.includes('launch(quick = false)'),
    'the retry cut is chosen from the phase the run started from, audio matched');
  check(mainCode.includes("querySelector('#accessPanel.on, #shopPanel.on, #curveScreen.on')"),
    'one modal rule: no run can start under ANY open sheet');
  check(mainCode.includes('correct: wg.correctCount') &&
    uiCode.includes("const read = (this._runCorrect || 0) + (this._runWrong || 0);"),
    "the scorecard's accuracy is THIS run's, not the lifetime ledger's");
  check(uiCode.includes('TO BEST'),
    'a run short of the best names its gap — the AGAIN tap gets a target');
  check(htmlCode.includes('#accessPanel.on,#shopPanel.on,#curveScreen.on,#rc2Pause.on{animation:panelIn'),
    'every overlay sheet enters with the same soft motion');
  // 1.0-RC scoring-comprehension audit: one line, chain-gated, no more.
  check(mainCode.includes('bestChain: sim.player.bestChain,') &&
    uiCode.includes('BEST CHAIN ${this._bestChain}') &&
    uiCode.includes('(this._bestChain || 0) >= 2'),
    "the score's dominant cause is named on the card — one line, only when a chain stood");
}

// ── PD-3: the settings sheet reads like one ──────────────────────────────
{
  const accessCode = read('src/ui/access.js');
  const mainCode = read('src/main.js');
  check(accessCode.includes("<h3>SETTINGS</h3>") &&
    accessCode.includes("section('GAME')") &&
    accessCode.includes("section('VISUAL')") &&
    accessCode.includes("section('AUDIO')"),
    'the sheet is three plain groups — GAME, VISUAL, AUDIO — not a junk drawer');
  check(accessCode.includes("chipRow('BEST RUN'") &&
    accessCode.includes("chipRow('MUSIC'") && accessCode.includes("chipRow('SFX'") &&
    mainCode.includes('getGhost: () => ghostEnabled') &&
    mainCode.includes('getMuted: () => audio.muted'),
    'the ghost and the audio mix reach the sheet through hooks — state stays where it lives');
  check(accessCode.includes("actionRow('HOW TO PLAY'") &&
    !/chipRow\('HOW TO/.test(accessCode) &&
    accessCode.indexOf("actionRow('HOW TO PLAY'") < accessCode.indexOf("chipRow('GUIDED TIPS'"),
    'HOW TO PLAY is an action at the head of the sheet, never buried among the toggles');
  check(accessCode.includes('overflow-y:auto'),
    'the grown sheet scrolls instead of clipping on a short phone');
}

// ── RC-2: the results card is five moments; the analysis is a fold ───────
// On-device playtest: ~15 pieces of information competed with the score.
// The default card is score → celebration → goals → misses → play again;
// nothing is deleted — the run shape, the queue, the stat bar and the share
// row are intact behind one MORE STATS tap.
{
  const uiCode = read('src/ui/ui.js');
  const mainCode = read('src/main.js');
  const htmlCode = read('index.html');
  check(uiCode.includes('<div id="deepStats" hidden>'),
    'every card opens folded — the deep stats render hidden');
  // RC6: THE RUN was promoted onto the card (it is one of the five things a
  // high-score moment shows) and the queue left for PROFILE. The stat bar —
  // the analysis — is still a fold, which is the rule this check exists for.
  check(uiCode.includes('core.push(\'<div class="recapHead">THE RUN</div>\')') &&
    !uiCode.includes('recapHead">OBJECTIVES') &&
    /deep\.push\(`<div class="statBar four">/.test(uiCode),
    'the analysis stays behind the fold; THE RUN is on the card and the queue is not');
  const curveCode = read('src/ui/curve-screen.js');
  check(curveCode.includes('goalCheck') && curveCode.includes('GOALS TODAY') &&
    curveCode.includes('#curveScreen .goalCheck i{') && !uiCode.includes('goalCheck'),
    "today's goals are a big ✓/○ checklist — in PROFILE, where progression is read");
  check(!uiCode.includes('class="rewardLine"') &&
    curveCode.includes('cBank') && mainCode.includes("currency: metaStats.get('currency', 0)"),
    'the ◆ takings are banked in PROFILE, not tallied over the score just set');
  check(mainCode.includes("e.target.closest('#moreStats')") &&
    uiCode.includes('id="moreStats"'),
    'MORE STATS is a real fold: the card renders the button, main.js works the hinge');
  check(htmlCode.includes('#deathScreen #shotBtns{display:none}') &&
    htmlCode.includes('#deathScreen.deepOpen #shotBtns{display:flex}'),
    'the share row is a footnote to the analysis — hidden until the card is expanded');
  check(uiCode.includes('READS MAKE THE SCORE'),
    'a zero-score run names the cause under the 0, not the distance to the best');
  check(uiCode.includes("this.deathScreen.classList.remove('deepOpen')"),
    'the fold closes between runs — MORE STATS is a per-card choice');
}

// ── RC7: the three stops — the run itself is the tutorial ────────────────
// RC3's study stop, promoted: a real PAUSE at the arm edge instead of a
// position pin, three of them (first real word, first fake, first full dash
// charge), each shown once for a life. Guided ENDLESS only; toggleable; the
// DAILY never stops.
{
  const simCode = read('src/sim/sim.js');
  const stopsSrc = read('src/sim/teach-stops.js');
  const guidedSrc = read('src/ui/guided.js');
  const mainCode = read('src/main.js');
  const uiCode = read('src/ui/ui.js');
  const mobileSrc = read('src/v1-mobile-ui.js');
  const launchSrc = read('src/render/launch-sequence.js');

  check(launchSrc.includes('z-index:70'),
    'black means black: the arrival veil covers every piece of in-run chrome');
  check(index.includes('#coach{top:57%') && index.includes('#powerHint{top:57%'),
    'all tutorial text speaks from the one mid-screen teach band');

  // The freeze is a pause, and it is the FIRST thing a step does.
  check(/step\(input\) \{[\s\S]{0,1200}?if \(this\.teach\.active\) \{[\s\S]{0,200}?if \(!this\.teach\.tryRelease\(input, dt\)\) return;/.test(simCode) &&
    simCode.indexOf('this.teach.active') < simCode.indexOf('this.steps++'),
    'a stop returns before ANYTHING advances — the clock, the pursuit and the player all hold');
  // Two independent guards, and BOTH must hold: the chart (a stop can only
  // exist in a guided opening, which the DAILY can never be) and the chip.
  check(stopsSrc.includes("wg.profile?.CHART !== 'guided'") &&
    stopsSrc.includes('if (!this.enabled || this.active) return null;') &&
    mainCode.includes("return ACCESS.guidedTips && !stopsDone() ? 'guided' : 'endless';"),
    'the stops exist only in a guided ENDLESS opening, behind the GUIDED TIPS switch');
  check(mainCode.includes("learn(`Stop${e.which[0].toUpperCase()}${e.which.slice(1)}`)") &&
    mainCode.includes("metaStats.get('usedStopFake', 0) > 0"),
    'a stop is persisted the instant it is SHOWN — the fake stop is not owed a second chance');
  check(uiCode.includes('setStopActive(on)') &&
    /if \(this\._stopActive\) \{\s*\n\s*this\.coach\.classList\.remove\('on'\);\s*\n\s*return;/.test(uiCode) &&
    uiCode.includes('const stopsTeach = !!this._guidedActive;'),
    'the coach is silent through a stop and yields the fundamentals while the stops teach them');
  // Both of these were live bugs, found by driving the stops in a browser.
  check(/if \(this\._stopActive && this\.powerHint\) \{[\s\S]{0,200}remove\('on', 'spending', 'teaching'\)/.test(uiCode),
    'the DASH READY hint stands down for the dash stop — a stopped frame carries one line, not two');
  check(mainCode.includes('sim.teach.enabled = !!ACCESS.guidedTips;') &&
    mainCode.includes("enabled: !!ACCESS.guidedTips,") &&
    !/sim\.teach\.enabled = stopsOn/.test(mainCode),
    'the switch is the chip alone: marking a stop shown cannot silence the stop still on screen');
  check(mobileSrc.includes('.v1MobileAction.teachRing{') &&
    index.includes('#app.rf .v1MobileAction.teachRing{animation:none}') &&
    mainCode.includes("appEl.classList.toggle('rf', !!ACCESS.reducedFlash);"),
    'REDUCED FLASH keeps the stop, the line and the ring, and drops the ring pulse');
  check(!read('src/sim/word-gates.js').includes('studyStop') &&
    !read('src/TUNING.js').includes('STUDY_STOP_M') &&
    !guidedSrc.includes('READ THE WORD'),
    "RC3's position pin is gone, not left beside its replacement");

  // ── The copy names a control that EXISTS in that modality, and no other ──
  const { stopLine, stopRing, MODALITY } = await import('../src/ui/teach-copy.js');
  // What each modality can actually be told to press, per input/input.js.
  const CONTROLS = {
    touch: { has: ['TAP REAL', 'TAP FAKE', 'HOLD DASH'], hasNot: ['→', '←', 'SPACE', ' A', 'RT'] },
    key: { has: ['→', '←', 'PRESS SPACE'], hasNot: ['TAP', 'HOLD DASH', 'RT'] },
    pad: { has: ['A', 'HOLD RT'], hasNot: ['TAP', '→', '←', 'SPACE'] },
  };
  let copyOk = true;
  const copyDetail = [];
  for (const m of Object.values(MODALITY)) {
    for (const which of ['real', 'fake', 'dash']) {
      const line = stopLine(which, m);
      if (!line) { copyOk = false; copyDetail.push(`${m}/${which}: empty`); continue; }
      // Nothing may name a control from another modality.
      for (const bad of CONTROLS[m].hasNot) {
        if (line.includes(bad)) { copyOk = false; copyDetail.push(`${m}/${which} names "${bad}"`); }
      }
      // The ring only exists where there is an on-screen control to ring.
      const ring = stopRing(which, m);
      if (m === MODALITY.TOUCH ? !ring : !!ring) {
        copyOk = false; copyDetail.push(`${m}/${which} ring=${ring}`);
      }
    }
  }
  check(copyOk, `every stop line names a control of its own modality and no other${copyDetail.length ? ` — ${copyDetail.join('; ')}` : ''}`);
  // The pad genuinely has no reject binding (input.js binds button 0 and the
  // triggers only), so its fake line names the pass and nothing else.
  check(stopLine('fake', MODALITY.PAD) === 'MISSPELLED · LET IT PASS' &&
    !read('src/v1-ship-polish.js').includes('this.reject = true'),
    'the pad line invents no button: the gamepad layer binds no reject, so it names the pass');

  // ── Behavioural: all three stops, headless and deterministic ────────────
  const { Sim, emptyInput } = await import('../src/sim/sim.js');
  const guided = () => {
    const sim = new Sim(4242);
    sim.start(4242, null, { mode: 'endless', difficulty: 'normal', wordSalt: 1, chart: 'guided' });
    sim.teach.enabled = true;
    return sim;
  };
  const idle = emptyInput();
  const sim = guided();
  // 1 — the first REAL word arms and the world stops, without limit.
  for (let i = 0; i < 60 * 60; i++) sim.step(idle);
  const g0 = sim.wordGates.current();
  const frozen = { d: sim.player.d, t: sim.time, gap: sim.beast.gap, steps: sim.steps };
  check(sim.teach.active === 'real' && g0.real === true && !g0.resolved &&
    sim.wordGates.armed(sim.player.d),
    'the first REAL word arms and the run stops there, armed, for as long as it takes');
  for (let i = 0; i < 60 * 10; i++) sim.step(idle);
  check(sim.player.d === frozen.d && sim.time === frozen.t && sim.beast.gap === frozen.gap &&
    sim.steps === frozen.steps,
    'a stop is a PAUSE: ten more seconds of frames move the clock, the runner and the pursuit not at all');
  // The freeze is not priced: the answer lands at the arm edge it stopped on.
  const armEdge = g0.d - sim.player.d;
  const tap = emptyInput(); tap.confirm = true;
  sim.step(tap);
  check(g0.resolved && g0.correct === true &&
    Math.abs(g0.answerDistance - armEdge) < 1e-9 && g0.answerLatency === 0,
    `the answer is timed at the instant the stop began — ${g0.answerDistance.toFixed(1)}m out, latency 0`);
  // 2 — the first FAKE word arms; two seconds of nothing is the right answer.
  let sawFake = false;
  for (let i = 0; i < 60 * 120 && !sawFake; i++) { sim.step(idle); sawFake = sim.teach.active === 'fake'; }
  const gf = sim.wordGates.current();
  check(sawFake && gf.real === false && !gf.resolved,
    'the first FAKE word arms and the run stops again, on the other verb');
  let released = 0;
  for (let i = 0; i < 60 * 4; i++) { sim.step(idle); if (!sim.teach.active) { released = i; break; } }
  check(released > 0 && released <= 60 * 2 + 2,
    `letting it pass releases the fake stop on its own — ${(released / 60).toFixed(2)}s`);
  // 3 — the first full DASH charge.
  let sawDash = false;
  for (let i = 0; i < 60 * 600 && !sawDash; i++) {
    const g = sim.wordGates.current();
    const armed = sim.wordGates.armed(sim.player.d);
    const inp = emptyInput();
    if (armed && !sim.teach.active) { if (g.real) inp.confirm = true; else inp.reject = true; }
    sim.step(inp);
    sawDash = sim.teach.active === 'dash';
  }
  check(sawDash && sim.player.boostMeter >= 100 && !sim.player.overdrive,
    'the first full DASH charge stops the run too — the third and last stop');
  const dashIn = emptyInput(); dashIn.boostHeld = true;
  sim.step(dashIn);
  check(!sim.teach.active, 'the dash releases it');
  check(sim.teach.firedThisRun.real && sim.teach.firedThisRun.fake && sim.teach.firedThisRun.dash,
    'three stops, and the run has no more to give');

  // Each fires ONCE: a run that has seen them all never stops again.
  const seen = guided();
  seen.teach.learned = { real: true, fake: true, dash: true };
  let anyStop = false;
  for (let i = 0; i < 60 * 240 && !anyStop; i++) {
    const g = seen.wordGates.current();
    const inp = emptyInput();
    if (seen.wordGates.armed(seen.player.d)) { if (g.real) inp.confirm = true; else inp.reject = true; }
    seen.step(inp);
    if (seen.teach.active) anyStop = true;
  }
  check(!anyStop && seen.wordGates.next > 6,
    'a returning profile — all three learned — is never stopped again');

  // The DAILY never stops, and plain ENDLESS never stops.
  for (const [label, opts] of [['the DAILY RUN', { mode: 'standard', difficulty: 'normal' }],
    ['plain ENDLESS', { mode: 'endless', difficulty: 'normal', wordSalt: 1 }]]) {
    const s2 = new Sim(4242);
    s2.start(4242, null, opts);
    s2.teach.enabled = true;   // even switched ON, the chart refuses
    let stopped = false;
    for (let i = 0; i < 60 * 90 && !stopped; i++) { s2.step(idle); stopped = !!s2.teach.active; }
    check(!stopped && s2.wordGates.next > 0, `${label} never stops, even with the stops enabled`);
  }
}

// ── RC-4: THE ORDER — menu, black, the storm, then gameplay ──────────────
// Reported three times. The world used to be swapped at begin() with the veil
// fading in ON TOP, so a player watched ~0.8s of gameplay before the black and
// the menu was already gone. The run is now BUILT IN THE DARK.
{
  const mainCode = read('src/main.js');
  const launchSrc = read('src/render/launch-sequence.js');
  const accessCode = read('src/ui/access.js');
  const shopCode = read('src/ui/shop.js');

  const startBody = mainCode.slice(
    mainCode.indexOf('function startRun() {'),
    mainCode.indexOf('function buildRunInTheDark()'));
  check(startBody.includes('launch.begin(') &&
    !/sim\.start\(|ui\.showTitle\(false\)|ui\.showHud\(true\)|running = true/.test(startBody),
    'startRun only starts the fade — it never swaps the world or the screens');
  check(/function buildRunInTheDark\(\)[\s\S]{0,4000}ui\.showTitle\(false\);[\s\S]{0,200}ui\.showHud\(true\);/.test(mainCode) &&
    /function buildRunInTheDark\(\)[\s\S]{0,3000}sim\.start\(/.test(mainCode),
    'the run — sim, world, HUD, the title going out — is built inside the black frame');
  check(launchSrc.includes('this.el.style.background = `${VEIL}1)`;\n      this._black();') &&
    launchSrc.includes('_black() {') && launchSrc.includes('if (this._blackFired) return;'),
    'the swap fires exactly once, on the first SOLID frame — never before');
  check(launchSrc.includes('this._onBlack = null;\n    this._blackFired = false;\n  }') &&
    mainCode.includes('launchPending = false;\n  launch.cancel();'),
    'quitting drops the pending run with the veil — a cancelled arrival starts nothing');
  check(mainCode.includes('if (launchPending) return;') &&
    mainCode.includes('offerActive || launchPending) return;'),
    'no second run can start during the fade');
  check(/ACCESS\.reducedFlash\) \{[\s\S]{0,400}this\._black\(\);/.test(launchSrc),
    'REDUCED FLASH takes the world at once — it never stages a dip to black');
  check(mainCode.includes('launch.snapToBlack()') && launchSrc.includes('snapToBlack() { this._black(); }'),
    'the scripted harness still starts a run synchronously');

  // The sheets the playtest could read gameplay through.
  const opaque = (css) => css.includes('background:#05080c;') && !/background:rgba\(4,7,10,\.82\)/.test(css);
  check(opaque(accessCode) && opaque(shopCode),
    'SETTINGS and the SHOP are opaque — no gameplay reads through a menu');
}

// ── RC-5: the run screen carries the run, and nothing else ───────────────
{
  const html = read('index.html');
  const uiCode = read('src/ui/ui.js');
  const audioCode = read('src/audio/audio.js');
  const accessCode = read('src/ui/access.js');
  const mainCode = read('src/main.js');
  const mobileCode = read('src/v1-mobile-ui.js');
  const musicCode = read('src/music-track.js');

  check(html.includes('<div id="best" hidden>') && html.includes('#best[hidden]{display:none}'),
    'the run HUD carries ONE score — BEST lives in PROFILE and the card');
  // Three legacy layers each re-asserted this caption after ui.js cleared
  // it, which is why it survived the first removal. None of them may again.
  const captionWriters = ['src/ui/ui.js', 'src/rc97-endgame.js', 'src/v1-finalize.js',
    'src/render/endgame-sky.js'].map(read).join('\n');
  check(!/titleHint[^\n]*'DAILY RUN'/.test(captionWriters) &&
    !/title\.textContent = [^\n]*'DAILY RUN'/.test(captionWriters) &&
    !/const want = [^\n]*'DAILY RUN'/.test(captionWriters) &&
    html.includes('data-mode="standard">DAILY RUN<'),
    'no caption under the wordmark, from ANY layer — the chip that selects the mode names it');

  // The score and the rest of the mix part company.
  check(audioCode.includes('music: this._bus(1)') &&
    musicCode.includes('connect(audio.bus.music)'),
    'the score rides its own bus, so it can be silenced without the world');
  check(audioCode.includes('setMusicMuted(m)') && audioCode.includes('setSfxMuted(m)') &&
    audioCode.includes('this.muted || this.sfxMuted') &&
    /threat\.gain, this\.sfxMuted \? 0/.test(audioCode),
    'SFX OFF silences the one-shots AND the continuous beds — no sound survives in one place');
  check(accessCode.includes('musicOff: ACCESS.musicOff') &&
    accessCode.includes('saved.musicOff === true') &&
    accessCode.includes('saved.sfxOff === true') &&
    mainCode.includes('audio.setMusicMuted(ACCESS.musicOff)'),
    'the mix is persisted and applied at boot, not just while the sheet is open');

  // The coach keeps only what a player cannot proceed without.
  // Live code only — the comment above the change still quotes the retired
  // lines, which is the record of what was removed and why.
  const liveUi = uiCode.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  check(!/text = .*ANSWERING EARLY/.test(liveUi) &&
    !/text = .*CLEAN READS CHARGE/.test(liveUi) &&
    !liveUi.includes('_showedChargeLesson') && !liveUi.includes('_firstRun'),
    'the economy asides are gone — the coach teaches controls, never commentary');
  check(uiCode.includes('TAP RIGHT IF THE WORD IS REAL') &&
    uiCode.includes('THE BAR IS FULL'),
    'the control lessons remain, each still retiring on the action it teaches');

  // One tell per mechanic, one row of controls.
  check(/@media \(pointer:coarse\)\{[\s\S]{0,220}#meterWrap,#meterLabel \.mLabel,#meterLabel i\{display:none\}/.test(html) &&
    mobileCode.includes('--dash-angle'),
    "the bottom charge bar is gone where the DASH ring exists — one tell per mechanic");
  // RC6.2: the marks sit with the meter (the two things the player SETS) and
  // survive where the bar itself is hidden, because they are not the charge.
  check(html.includes('<span class="mLabel">DASH</span><i></i><b id="barLevel"></b>') &&
    html.includes('#barLevel{') && html.includes('#barLevel.set{opacity:1}'),
    'the bar marks ride with the DASH meter and show only once a bar is set');
  check(/#v1MobileDash\{left:50%;margin-left:-38px/.test(mobileCode) &&
    /#v1MobileDash\{width:66px;height:66px;left:50%;right:auto;margin-left:-33px/.test(mobileCode),
    'DASH is centred between the answers in both orientations, and stays centred when it shrinks');
}

// ── RC6: the cabinet loop ────────────────────────────────────────────────
{
  const mainCode = read('src/main.js');
  const attractSrc = read('src/render/attract.js');
  const accessCode = read('src/ui/access.js');
  const shopCode = read('src/ui/shop.js');
  const html = read('index.html');
  const storageSrc = read('src/storage/storage.js');

  // 1. The DASH READY hint speaks from the teach band, with the other two.
  check(html.includes('#powerHint{top:57%;') && html.includes('#coach{top:57%'),
    'all three in-run tutorial surfaces speak from the one teach band');

  // 2. BEGIN RUN starts the run — no card between a first-timer and the game.
  check(!/loadOnboarding\(\)\.then\(\(o\) => o\.show\(\)\)/.test(mainCode) &&
    !storageSrc.includes('onboardingSeen') &&
    read('src/ui/onboarding.js').includes('showHelp()'),
    'the first tap starts the run; the six-rule sheet is a reference, never pushed');

  // 3. Attract mode — presentation over the existing pieces, and reversible.
  check(attractSrc.includes('IDLE_SECONDS = 10') &&
    !/sim\.step\(|sim\.advance\(|wordGates|beast/.test(attractSrc),
    'attract is presentation: ten idle seconds, and it never steps the sim');
  check(attractSrc.includes('this._rest = { d: p.d, x: p.x, y: p.y, score: p.score };') &&
    /exit\(\) \{[\s\S]{0,600}p\.d = this\._rest\.d/.test(attractSrc),
    'attract restores the resting pose it found — the title it returns to is the one it left');
  check(attractSrc.includes('if (g.yanking || g.done)') &&
    attractSrc.includes('MIN_REPLAY_SECONDS'),
    'the replay never plays the death yank backwards, and a too-short ghost shows the empty road');
  check(mainCode.includes('if (attract.active) { attract.exit(); return; }') &&
    (mainCode.match(/attract\.exit\(\); return;/g) || []).length === 2,
    'any touch AND any key end the attract loop, and neither starts a run by surprise');
  check(/attract\.update\([\s\S]{0,400}sim\.phase === PHASE\.TITLE && !running[\s\S]{0,300}accessPanel\.on/.test(mainCode),
    'attract only ever runs on a title with nothing else on it');

  // 4. The card is the high-score moment; progression is read in PROFILE.
  check(mainCode.includes('daily: metaDaily.status(DAILY_SEED)') &&
    mainCode.includes('objectives: metaObjectives.status()'),
    'PROFILE is fed the goals and the queue that left the card');

  // 5. One ⚙ and PROFILE. Everything else is inside it.
  check(accessCode.includes("btn.textContent = '⚙'") &&
    html.includes('#mute{display:none!important') &&
    shopCode.includes('#shopBtn{display:none!important') &&
    accessCode.includes("actionRow('◆ 0'") &&
    shopCode.includes("document.addEventListener('dictiondash:show-shop'"),
    'the title carries one ⚙ and PROFILE — sound, type and the bank all live inside it');
}

// ── RC6.2: the HUD as one instrument ─────────────────────────────────────
{
  const uiCode = read('src/ui/ui.js');
  const html = read('index.html');
  const polishSrc = read('src/v1-ship-polish.js');

  check(uiCode.includes("createElementNS('http://www.w3.org/2000/svg', 'svg')") &&
    uiCode.includes('const HEART_PATH =') && !uiCode.includes("h.textContent = '♥'"),
    'the hearts are drawn shapes, not a font glyph that changes per platform');
  check(html.includes('.heartPip{width:22px;height:22px') &&
    html.includes('.heartPip .hFill{fill:#ec98d7') &&
    html.includes('.heartPip .hLine{fill:none;stroke:'),
    'stroke and fill, at a fixed 22px, in the rose that clears the reserved hues');
  // The rule the retired widget existed to serve, now held where it is drawn.
  check(uiCode.includes('setHearts(n, restored = false, streakFrac = 0)') &&
    /const filling = i === n \? Math\.max\(0, Math\.min\(1, streakFrac\)\) : 0;/.test(uiCode) &&
    uiCode.includes("rect.setAttribute('height'"),
    'the NEXT empty heart fills as the clean streak climbs — nowhere else, and no rectangle outside its outline');
  check(uiCode.includes('HEARTS.STREAK_REPAIR_BY_HEARTS[n] ?? HEARTS.STREAK_REPAIR_DEFAULT') &&
    /const frac = !live \|\| full \|\| need <= 0 \? 0/.test(uiCode),
    'it reads the same repair ladder the sim repairs from, and a full row shows nothing');
  check(uiCode.includes("this.vitals.setAttribute('aria-label'") &&
    uiCode.includes('clean streak ${streak % need} of ${need}'),
    'the streak still has a screen-reader line — the widget went, the information did not');
  check(!polishSrc.includes('ensureBellChargeHud'),
    'nothing calls the retired widget');
}

console.log(`\nV1 polish gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
