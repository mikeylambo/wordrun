import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { Sim } from '../src/sim/sim.js';
import { airBeat } from '../src/design/air-beats.js';
import { BellField, HEARTS } from '../src/design/bells.js';
import { LANDMARKS, DISTANCE_MARKERS } from '../src/design/landmarks.js';
import { CHASE } from '../src/design/release-tuning.js';

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

console.log('\nDESCENT — RC6 contract verification');
const seed = 1057066883;

const beats = Array.from({ length: 28 }, (_, i) => airBeat(seed, i));
let minSpacing = Infinity;
let maxSpacing = 0;
for (let i = 1; i < beats.length; i++) {
  const s = beats[i].d - beats[i - 1].d;
  minSpacing = Math.min(minSpacing, s);
  maxSpacing = Math.max(maxSpacing, s);
}
check('authored Big Air keeps arriving about every 550-750m',
  minSpacing >= 530 && maxSpacing <= 750,
  `${minSpacing.toFixed(0)}-${maxSpacing.toFixed(0)}m spacing`);
check('authored Big Air continues well beyond a 15K run', beats.at(-1).d > 17000,
  `beat 27 @ ${beats.at(-1).d.toFixed(0)}m`);
check('deep Big Air gets materially larger', beats.at(-1).drop > beats[0].drop + 3,
  `${beats[0].drop.toFixed(1)}m -> ${beats.at(-1).drop.toFixed(1)}m drop`);

const sim = new Sim(seed).start(seed, null, 0);
const terrain = sim.terrain;
let authored = 0;
for (const b of beats.slice(0, 10)) {
  const ci = Math.floor(b.d / TUNING.TERRAIN.CHUNK_LEN);
  if (terrain.heightsOf(ci).some((f) => f.authored && f.id === b.id)) authored++;
}
check('Big Air beats are real collision-surface cliffs, not decoration', authored === 10,
  `${authored}/10 authored launches found in physics`);

// Renderer fast path and physics must remain the same even with HALFPIPE/THROAT shaping.
let worst = 0;
for (const centre of [1810, 3020]) {
  const nx = 9, nd = 9;
  const out = new Float64Array(nx * nd);
  terrain.sampleGrid(-17, 17, nx, centre - 60, centre + 60, nd, out);
  let o = 0;
  for (let iz = 0; iz < nd; iz++) {
    const d = centre - 60 + (120 * iz) / (nd - 1);
    for (let ix = 0; ix < nx; ix++) {
      const x = -17 + (34 * ix) / (nx - 1);
      worst = Math.max(worst, Math.abs(out[o++] - terrain.heightAt(x, d)));
    }
  }
}
check('playable landmark shaping stays identical in render and physics', worst < 1e-9,
  `worst delta ${worst.toExponential(2)}`);

const pipeSide = terrain.heightAt(16, 1810) - terrain.heightAt(0, 1810);
check('HALFPIPE has real rideable side walls', pipeSide > 2.2, `${pipeSide.toFixed(2)}m side rise`);
check('BLACK GLASS is actually slick', terrain.isIce(0, 11020) === true, 'ice response active');
const throatGrade = terrain.gradeMul(3020);
const outsideGrade = (terrain.gradeMul(2700) + terrain.gradeMul(3340)) / 2;
check('THE THROAT materially changes speed pressure', throatGrade > outsideGrade * 1.04,
  `${throatGrade.toFixed(2)}x vs nearby ${outsideGrade.toFixed(2)}x grade`);

const field = new BellField(seed, terrain);
const bellSample = field.around(0, 0, 5000);
check('some bell strings explicitly lead into authored air', bellSample.some((b) => b.airBeat),
  `${bellSample.filter((b) => b.airBeat).length} air-line bells in first 5K`);
check('bells have a tiny immediate GO reward without becoming currency', HEARTS.POWER_PER_BELL > 0 && HEARTS.POWER_PER_BELL <= 1.5,
  `${HEARTS.POWER_PER_BELL} power per bell`);
let unsafe = 0;
for (const bell of bellSample.slice(0, 60)) {
  for (const c of terrain.collidersNear(bell.d, 5, 13)) {
    if (Math.abs(bell.x - c.x) < (c.r || 0.7) + 2.75) { unsafe++; break; }
  }
}
check('bell invitations stay clear of solid hazards', unsafe === 0, `${unsafe} unsafe of ${Math.min(60, bellSample.length)}`);

// Wall experiment: during a committed Hunt, a stopped skier must be physically caught.
const wall = new Sim(seed).start(seed, null, 0);
wall.player.d = 2200;
wall.player.speed = TUNING.PLAYER.SPEED_FLOOR;
wall.player.airborne = false;
wall.beast.mode = 'hunt';
wall.beast.modeT = 0;
wall.beast.modeDuration = 30;
wall.beast.attackKind = 'rear';
wall.beast.gap = 42;
for (let i = 0; i < 240 && !wall.beast.killed; i++) wall.beast.step(TUNING.SIM.DT, wall.player);
check('the wall experiment ends decisively instead of parking the beast nearby', wall.beast.killed,
  `gap ${wall.beast.gap.toFixed(2)}m after ${(wall.beast.t).toFixed(2)}s`);

// Mid-air contact is allowed, but only after a visible pounce state is armed.
const air = new Sim(seed + 1).start(seed + 1, null, 0);
air.player.d = 2400;
air.player.speed = 20;
air.player.airborne = true;
air.player.y = air.terrain.heightAt(air.player.x, air.player.d) + 8;
air.beast.mode = 'hunt';
air.beast.modeT = 0;
air.beast.modeDuration = 30;
air.beast.attackKind = 'rear';
air.beast.gap = TUNING.BEAST.KILL_GAP - 0.1;
air.beast.step(TUNING.SIM.DT, air.player);
const armedBeforeKill = !air.beast.killed && air.beast.airPounce && air.beast.lunge === 'tell';
for (let i = 0; i < 120 && !air.beast.killed; i++) air.beast.step(TUNING.SIM.DT, air.player);
check('airborne contact telegraphs a pounce before it can kill', armedBeforeKill,
  `pounce=${air.beast.airPounce}, first state tell`);
check('the telegraphed pounce can still end an airborne run', air.beast.killed && air.beast.killAir,
  `killed=${air.beast.killed}, killAir=${air.beast.killAir}`);

const attackKinds = new Set();
for (let s = seed; s < seed + 32; s++) {
  const x = new Sim(s).start(s, null, 0);
  x.player.d = 9000;
  x.beast._startHunt(x.player);
  attackKinds.add(x.beast.attackKind);
}
check('the one beast has rear, side and leap choreographies',
  ['rear', 'side', 'leap'].every((k) => attackKinds.has(k)), [...attackKinds].join(', '));

check('expert difficulty keeps scaling into the teens', CHASE.DEEP_DISTANCE >= 18000,
  `full depth @ ${CHASE.DEEP_DISTANCE}m`);
check('expert geography now continues past 20K', LANDMARKS.at(-1).d >= 21000,
  `${LANDMARKS.at(-1).name} @ ${LANDMARKS.at(-1).d}m`);
check('physical 5K milestone markers exist in the world plan',
  [5000, 10000, 15000, 20000].every((d) => DISTANCE_MARKERS.includes(d)),
  DISTANCE_MARKERS.slice(0, 4).join(', '));

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const rcRuntime = fs.readFileSync(new URL('../src/rc5.js', import.meta.url), 'utf8');
check('death screen offers both AGAIN and MENU', html.includes('id="deathAgain"') && html.includes('id="deathMenu"'));
check('death photograph no longer stamps a duplicate giant distance', !main.includes('fillText(`${metres}M`'));
check('RC runtime still owns no second permanent animation loop',
  !/function\s+frame\s*\([^)]*\)\s*\{[\s\S]*requestAnimationFrame\(frame\)/.test(rcRuntime),
  'single main game frame');

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
