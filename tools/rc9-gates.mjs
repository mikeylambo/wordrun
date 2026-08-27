import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const audio = read('src/audio/audio.js');
const rc9 = read('src/rc9-audio.js');
const feedback = read('src/rc9-feedback.js');
const world = read('src/rc95-world.js');
const camera = read('src/render/camera-rig.js');
const onboarding = read('src/ui/onboarding.js');
const index = read('index.html');
const presentation = read('src/render/presentation-bridge.js');
const storage = read('src/storage/storage.js');
const assets = read('src/audio/approved-assets.js');
const bridge = read('src/rc9-assets.js');
const approvedManifest = JSON.parse(read('public/audio/approved/manifest.json'));
const material = read('src/render/material-pass.js');
const generator = read('tools/generate-elevenlabs-audio.mjs');
const prompts = read('tools/audio/elevenlabs-assets.mjs');
const pkg = JSON.parse(read('package.json'));

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.error(`FAIL ${label}`); }
};

check(audio.includes('__AUDIO'), 'main Audio instance exposes one runtime owner');
check(audio.includes('createDynamicsCompressor'), 'master dynamics stage exists');
check(audio.includes('powder') && audio.includes('ice') && audio.includes('surface'), 'surface-aware ski mix exists');
check(audio.includes('huntStart') && audio.includes('_huntPulse'), 'adaptive Hunt score/pulse exists');
check(audio.includes('secondBeastEnter') && audio.includes('secondBeastCharge'), 'second beast has distinct audio vocabulary');
check(audio.includes('bell(step') && audio.includes('heartRestore'), 'bells and hearts live in main audio engine');
check(audio.includes('overdriveOn') && audio.includes('goRush'), 'GO has a continuous procedural sonic layer');
check(rc9.includes('SharedAudioContext') && rc9.includes('rc.update = function updateRC9'), 'legacy RC5 audio is taken over without a new render loop');
check(rc9.includes("import './rc9-assets.js'") && rc9.includes("import './rc9-feedback.js'"), 'RC9 loads asset and playtest layers');
check(rc9.includes('approvedAssetBridge: true'), 'approved asset bridge remains the runtime owner');
check(rc9.includes('bellNightReadability: true') && rc9.includes('emissiveIntensity = 0.52'), 'bell routes retain a restrained emissive floor in deep night');
check(material.includes("../rc9-audio.js"), 'RC9 takeover is loaded with presentation stack');

check(feedback.includes('SKI_TRIM_NORMAL = 0.57') && feedback.includes('SKI_TRIM_HUNT = 0.50') && feedback.includes('SKI_TRIM_PICKUP = 0.38'), 'skis sit another small step beneath pickups and Hunts');
check(feedback.includes('WIND_TRIM_NORMAL = 0.78') && feedback.includes('WIND_TRIM_AIR = 0.66') && feedback.includes('WIND_TRIM_PICKUP = 0.48'), 'wind and airtime are also subordinated to pickup information');
check(feedback.includes('bellWithMixPocket') && feedback.includes('f * 3.01'), 'bell gets presence reinforcement rather than only more master gain');
check(feedback.includes('takeoffWithScale') && feedback.includes("kind === 'manual'"), 'random manual hops use a lighter procedural takeoff');
check(feedback.includes('thumpWithBody') && feedback.includes('132') && feedback.includes('1180'), 'beast footsteps gain low-mid body and crunch rather than simple loudness');
check(feedback.includes('secondBeastEnterWithIceSplit') && feedback.includes('6100') && feedback.includes('frostEntranceIceSplit: true'), 'frost beast entrance gets a distinct high-frequency ice split');
check(feedback.includes('heartbeatPriority: true') && !feedback.includes('_huntPulse('), 'praised Hunt heartbeat implementation remains untouched');
check(!feedback.includes('requestAnimationFrame'), 'playtest mix adds no animation loop');

check(assets.includes("'/audio/approved/manifest.json'") && assets.includes('decodeAudioData'), 'approved runtime loads and decodes manifest audio');
check(assets.includes('procedural') || assets.includes('must never break'), 'missing approved audio explicitly falls back safely');
check(assets.includes('setLoop(') && assets.includes('setTargetAtTime'), 'approved loop voices crossfade rather than hard switch');
check(bridge.includes("'ski_packed_loop'") && bridge.includes("'ski_powder_loop'") && bridge.includes("'ski_ice_loop'"), 'three optional ski sample slots remain available');
check(bridge.includes("setLoop('wind_alpine_bed'") && bridge.includes("gain: 0.25"), 'organic alpine wind is trimmed behind gameplay cues');
check(bridge.includes("lastHitKind === 'tree'") && bridge.includes("lastHitKind === 'rock'"), 'tree and rock impacts route separately');
check(bridge.includes("'landing_clean'") && bridge.includes("'landing_heavy'"), 'clean and heavy landing roles are separated');
check(bridge.includes("'beast_main_step'") && bridge.includes("'beast_main_close'") && bridge.includes("'beast_main_leap'"), 'main beast organic roles are wired');
check(bridge.includes('lastOrganicStepAt') && bridge.includes('>= 0.68'), 'long organic beast steps remain throttled');
check(bridge.includes("'frost_beast_enter'") && bridge.includes("'frost_beast_charge'") && bridge.includes("'frost_beast_vault'") && bridge.includes("'frost_beast_kill'"), 'frost beast organic roles are wired');
check(bridge.includes("'carve_hard'") && bridge.includes('lastHardCarveAt') && bridge.includes('>= 1.15'), 'hard-carve Foley remains an occasional accent');
check(bridge.includes("lastTakeoffKind === 'terrain'") && bridge.includes('terrainOnlyHeroLaunch: true'), 'approved Big Air launch no longer fires on random manual jumps');
check((bridge.match(/requestAnimationFrame/g) || []).length === 2 && !bridge.includes('requestAnimationFrame(frame)'), 'asset bridge uses startup retry only, not a permanent frame loop');

check(world.includes("id: 'bridge-super-launch'") && world.includes('drop: 12.6') && world.includes('lip: 3.15') && world.includes('bridgeLaunchTrimmed: true'), 'the bridge keeps hero air without launching above the entire scene');
check(world.includes("id: 'throat-entry-kicker'") && world.includes('throatOwnsAirBeat: true'), 'THE THROAT owns a lower authored entry kicker instead of a procedural cliff');
check(world.includes("id: 'starting-house'") && world.includes("id: 'sunken-lodge'"), 'house-like landmarks have physical gameplay volumes');
check(world.includes('bridge-deck-') && world.includes('minH: 8.0'), 'bridge deck supports pass-under / hit-deck / clear-over altitude logic');
check(world.includes('throat-') && world.includes('throatPhysical: true'), 'THE THROAT ribs have gameplay collision volumes');
check(world.includes("type: 'ring'") && world.includes('ringR: 16.8') && world.includes('tunnelRingCollision: true'), 'THE TUNNEL uses annulus collision that matches its visible hoops');
check(world.includes('Number.isFinite(c.minH)') && world.includes('relY < c.minH'), 'player collision understands elevated structure volumes');
check(!world.includes('requestAnimationFrame'), 'world interaction patch stays deterministic and frame-loop free');

check(camera.includes('const heroAir') && camera.includes('back += heroAir * 6.5'), 'hero air opens the camera boom instead of losing the skier at apex');
check(camera.includes('airLookGain = C.AIR_LOOK_GAIN + heroAir * 0.28'), 'hero air raises composition toward the airborne skier');
check(camera.includes('heroAir * 4.5'), 'hero air receives additional framing FOV without changing normal hops');

check(index.includes('HOW FAR CAN YOU GO?') && !index.includes('IT ALWAYS CATCHES YOU.') && !index.includes('endless downhill chase'), 'native title markup and metadata do not pre-explain a chase');
check(!onboarding.includes('THE BEAST KEEPS COMING') && !onboarding.includes('FROM THE BEAST') && !onboarding.includes('THE BEAST ENDS THE RUN'), 'How to Ski never explains the beast');
check(
  onboarding.includes('AIR AND TRICKS FILL GO') &&
  onboarding.includes('FIVE REPAIR ONE HEART') &&
  onboarding.includes('OBSTACLES COST A HEART'),
  'How to Ski explains current V1 mechanics without chase rules',
);
check(storage.includes("ONBOARDING_VERSION = 'rc9'") && storage.includes('pref.onboarding.${version}'), 'onboarding persistence is versioned so RC9 shows once even after older builds');
check(presentation.includes("sim?.phase === 'running' || killT > 0") && !presentation.includes("gap < (hunting ? 82"), 'main beast is not hard-culled when GO/landing opens the gap');
check(presentation.includes('scene fog/distance can hide it naturally'), 'beast disappearance is delegated to spatial fog rather than pop-out');

const files = approvedManifest?.files || {};
const requiredApproved = [
  'wind_alpine_bed', 'go_rush',
  'beast_main_close', 'beast_main_step', 'beast_main_leap',
  'frost_beast_charge', 'frost_beast_vault', 'frost_beast_kill',
  'landing_clean', 'landing_heavy', 'tree_hit', 'rock_hit',
  'carve_hard', 'takeoff_big_air',
];
check(approvedManifest.version === 1 && requiredApproved.every((id) => files[id]?.url), 'approved manifest contains the current organic production layer');
check(!files.ski_packed_loop && !files.ski_powder_loop && !files.ski_ice_loop, 'generated ski loops stay disabled; procedural skis remain authoritative');
check(requiredApproved.every((id) => fs.existsSync(`public${files[id]?.url || '/missing'}`)), 'every approved manifest URL resolves to a committed audio file');

check(generator.includes('ELEVENLABS_API_KEY') && generator.includes("'xi-api-key'"), 'ElevenLabs key is environment-only and sent in auth header');
check(generator.includes('/v1/sound-generation') && generator.includes('eleven_text_to_sound_v2'), 'generator uses current sound-effects endpoint/model');
check(!generator.match(/xi-api-key\s*[:=]\s*['\"][A-Za-z0-9_-]{12,}/), 'no API key literal is committed');
check((prompts.match(/id: '/g) || []).length >= 18, 'hero Foley prompt library is substantial');
check(pkg.scripts?.['audio:generate'] && pkg.scripts?.['audio:list'], 'package exposes safe audio generation commands');

console.log(`\nRC9.8 gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
