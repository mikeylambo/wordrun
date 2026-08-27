import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { Terrain } from '../src/sim/terrain.js';
import { Sim, emptyInput, PHASE } from '../src/sim/sim.js';
import { SecondBeast, SECOND_BEAST_RULES } from '../src/sim/second-beast.js';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\nDESCENT — RC8.2/RC9.8 two-beast choreography verification');
const seed = 1057066883;
const dt = TUNING.SIM.DT;

function appearanceSequence(s) {
  const terrain = new Terrain(s);
  const second = new SecondBeast(s);
  const player = { d: 900, x: 0, heading: 0, y: 0, speed: 32, airborne: false };
  const main = { mode: 'hunt', hunts: 0, modeDuration: 30, modeT: 0, gap: 42 };
  const out = [];

  for (let hunt = 1; hunt <= 24; hunt++) {
    player.d = 900 + hunt * 850;
    player.y = terrain.heightAt(player.x, player.d);
    main.hunts = hunt;
    main.mode = 'hunt';
    main.modeDuration = 30;
    main.modeT = 0;
    main.gap = 42;
    second.step(dt, player, main, terrain);

    if (second.armedHunt === hunt) {
      main.modeT = second.triggerAt + 0.02;
      second.step(dt, player, main, terrain);
      if (second.active) {
        out.push({ hunt, kind: second.kind, side: second.side, trigger: +second.triggerAt.toFixed(3) });
        // Finish the staged appearance without consuming extra RNG. The next
        // eligibility decision still respects lastAppearanceHunt.
        second.active = false;
        second.phase = 'idle';
        second.phaseT = 0;
      }
    }

    main.mode = 'relief';
    second.step(dt, player, main, terrain);
  }
  return out;
}

const seqA = appearanceSequence(seed);
const seqB = appearanceSequence(seed);
check('second-beast appearances are deterministic for the mountain seed',
  JSON.stringify(seqA) === JSON.stringify(seqB),
  seqA.map((e) => `${e.hunt}:${e.kind}`).join(', ') || 'none');
check('the second beast is sparse rather than another constant pursuer',
  seqA.length >= 2 && seqA.length <= 9,
  `${seqA.length} appearances across 24 Hunts`);
let minHuntGap = Infinity;
for (let i = 1; i < seqA.length; i++) minHuntGap = Math.min(minHuntGap, seqA[i].hunt - seqA[i - 1].hunt);
check('it never complicates back-to-back Hunts',
  seqA.length < 2 || minHuntGap >= SECOND_BEAST_RULES.MIN_HUNTS_BETWEEN,
  seqA.length < 2 ? 'single appearance' : `minimum Hunt gap ${minHuntGap}`);

const earlyTerrain = new Terrain(seed + 1);
const early = new SecondBeast(seed + 1);
const earlyPlayer = { d: 1200, x: 0, heading: 0, y: earlyTerrain.heightAt(0, 1200), speed: 30, airborne: false };
const earlyMain = { mode: 'hunt', hunts: 4, modeDuration: 30, modeT: 12, gap: 40 };
early.step(dt, earlyPlayer, earlyMain, earlyTerrain);
check('the second beast stays out of the opening learning stretch',
  !early.active && early.armedHunt === 0,
  `minimum distance ${SECOND_BEAST_RULES.MIN_DISTANCE}m`);

const kinds = new Set();
for (let s = seed; s < seed + 24; s++) {
  for (const e of appearanceSequence(s)) kinds.add(e.kind);
}
check('the environmental ambusher uses all four authored approach patterns',
  ['cross', 'vault', 'downhill', 'uphill'].every((kind) => kinds.has(kind)),
  [...kinds].join(', '));

// A warning interval is genuinely non-lethal even if the skier occupies the
// same projected spot. Danger begins only after charge choreography starts.
const tellTerrain = new Terrain(seed + 50);
const tell = new SecondBeast(seed + 50);
const tellPlayer = { d: 3200, x: 0, heading: 0, y: tellTerrain.heightAt(0, 3200), speed: 30, airborne: false };
const tellMain = { mode: 'hunt', hunts: 5, modeDuration: 30, modeT: 7, gap: 45 };
tell._spawn(tellPlayer, tellTerrain, tellMain);
const tellDuration = tell.tellTime;
let safeDuringTell = true;
for (let t = 0; t < tellDuration - 0.08; t += dt) {
  tellPlayer.x = tell.x;
  tellPlayer.d = tell.d;
  tellPlayer.y = tellTerrain.heightAt(tell.x, tell.d) + tell.lift + 0.5;
  tell.step(dt, tellPlayer, tellMain, tellTerrain);
  if (tell.killed) safeDuringTell = false;
}
check('the second beast visibly telegraphs before its path can kill',
  safeDuringTell && !tell.killed && tellDuration >= 0.75,
  `${tellDuration.toFixed(2)}s tell`);

while (tell.phase === 'tell' && !tell.killed) tell.step(dt, tellPlayer, tellMain, tellTerrain);
for (let i = 0; i < 180 && !tell.killed && tell.phase === 'charge'; i++) {
  tellPlayer.x = tell.x;
  tellPlayer.d = tell.d;
  tellPlayer.y = tellTerrain.heightAt(tell.x, tell.d) + tell.lift + 0.5;
  tell.step(dt, tellPlayer, tellMain, tellTerrain);
}
check('committing to the visible crossing line can actually end the run', tell.killed,
  `phase ${tell.phase}`);

// The exact same world-space pass can be cleared vertically: collision is 3D,
// not another hidden 2D gap threshold.
const clearTerrain = new Terrain(seed + 80);
const clear = new SecondBeast(seed + 80);
const clearPlayer = { d: 3600, x: 0, heading: 0, y: clearTerrain.heightAt(0, 3600) + 12, speed: 30, airborne: true };
const clearMain = { mode: 'hunt', hunts: 6, modeDuration: 30, modeT: 7, gap: 45 };
clear._spawn(clearPlayer, clearTerrain, clearMain);
while (clear.phase === 'tell') clear.step(dt, clearPlayer, clearMain, clearTerrain);
for (let i = 0; i < 220 && clear.active && !clear.killed; i++) {
  clearPlayer.x = clear.x;
  clearPlayer.d = clear.d;
  clearPlayer.y = clearTerrain.heightAt(clear.x, clear.d) + clear.lift + 11;
  clear.step(dt, clearPlayer, clearMain, clearTerrain);
}
check('a genuinely high line clears the second beast instead of triggering a 2D kill', !clear.killed,
  `kind ${clear.kind}`);

// Once an appearance has begun, ending the main Hunt must not evaporate it.
const persistTerrain = new Terrain(seed + 90);
const persist = new SecondBeast(seed + 90);
const persistPlayer = { d: 5000, x: -8, heading: 0, y: persistTerrain.heightAt(-8, 5000), speed: 34, airborne: false };
const persistMain = { mode: 'hunt', hunts: 8, modeDuration: 30, modeT: 8, gap: 45 };
persist._spawn(persistPlayer, persistTerrain, persistMain);
persistMain.mode = 'relief';
for (let i = 0; i < 20; i++) persist.step(dt, persistPlayer, persistMain, persistTerrain);
check('an entered frost-beast encounter finishes independently of the main Hunt',
  persist.active && (persist.phase === 'tell' || persist.phase === 'charge'),
  `phase ${persist.phase}`);

// A clean miss must exit laterally/distance-wise, never descend below the snow.
const exitTerrain = new Terrain(seed + 95);
const exit = new SecondBeast(seed + 95);
const exitPlayer = { d: 7000, x: 0, heading: 0, y: exitTerrain.heightAt(0, 7000), speed: 34, airborne: false };
const exitMain = { mode: 'hunt', hunts: 9, modeDuration: 30, modeT: 8, gap: 45 };
exit._spawn(exitPlayer, exitTerrain, exitMain);
exit.phase = 'exit';
exit.phaseT = 0;
exit.lift = 0;
let sank = false;
for (let i = 0; i < 120 && exit.active; i++) {
  exit.step(dt, exitPlayer, exitMain, exitTerrain);
  if (exit.lift < -0.01) sank = true;
}
check('a missed frost beast runs out of bounds/fog instead of dissolving into snow', !sank,
  `final lift ${exit.lift.toFixed(2)}`);

// Integrated sim: force one honest close crossing and ensure kill ownership is
// attributed to beast two so the camera can frame the right creature.
const integrated = new Sim(seed + 120).start(seed + 120, null, 0);
integrated.player.d = 3000;
integrated.player.x = 0;
integrated.player.speed = TUNING.PLAYER.SPEED_FLOOR;
integrated.player.airborne = false;
integrated.player.y = integrated.terrain.heightAt(0, 3000);
integrated.beast.mode = 'hunt';
integrated.beast.hunts = 2;
integrated.beast.modeDuration = 30;
integrated.beast.modeT = 8;
integrated.beast.gap = 90;
const forced = integrated.secondBeast;
forced.active = true;
forced.phase = 'charge';
forced.phaseT = 0.4;
forced.kind = 'cross';
forced.side = 1;
forced.chargeTime = 3;
forced.startX = forced.endX = integrated.player.x;
forced.startD = forced.endD = integrated.player.d;
forced.x = integrated.player.x;
forced.d = integrated.player.d;
forced.lift = 0;
integrated.step(emptyInput());
check('a second-beast contact enters the normal kill-cam flow with correct ownership',
  integrated.phase === PHASE.KILL && integrated.killSource === 'second',
  `phase ${integrated.phase}, source ${integrated.killSource}`);

const runtime = fs.readFileSync(new URL('../src/rc82-two-beast.js', import.meta.url), 'utf8');
const actor = fs.readFileSync(new URL('../src/render/second-beast.js', import.meta.url), 'utf8');
const simSource = fs.readFileSync(new URL('../src/sim/sim.js', import.meta.url), 'utf8');
const secondSource = fs.readFileSync(new URL('../src/sim/second-beast.js', import.meta.url), 'utf8');
check('the second beast gets the same player-anchored warning language', runtime.includes('threatCue(second.side'));
check('the kill camera explicitly targets the creature that made contact',
  runtime.includes("sim.killSource === 'second'") && runtime.includes('second.x'));
check('the second creature is visually distinct and its patterns have separate body language',
  actor.includes('0xd9e5e8') && actor.includes('0x38c8e8') && actor.includes("state.kind === 'uphill'"));
check('entered choreography is not cancelled by main-Hunt state changes',
  secondSource.includes('once Beast Two has entered') && !secondSource.includes("this.active && this.phase !== 'exit'"));
check('two-beast presentation adds no second permanent animation loop',
  !/function\s+frame\s*\([^)]*\)\s*\{[\s\S]*requestAnimationFrame\(frame\)/.test(runtime));
check('the headless state exposes second-beast activity for debugging/playtests',
  simSource.includes('secondBeastAppearances') && simSource.includes('killSource'));

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
