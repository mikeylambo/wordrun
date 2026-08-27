import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { CHASE, applyReleaseTuning } from '../src/design/release-tuning.js';
import { BellField, HEARTS, BELL_LINES } from '../src/design/bells.js';
import { LANDMARKS } from '../src/design/landmarks.js';
import { Terrain } from '../src/sim/terrain.js';

applyReleaseTuning(TUNING);

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

console.log('\nDESCENT — RC5.1 contract verification');

check('environmental damage uses a tiny three-heart life pool', HEARTS.MAX === 3, `${HEARTS.MAX} hearts`);
check('bells heal on a deliberately learnable five-pickup cadence', HEARTS.BELLS_PER_HEART === 5, `${HEARTS.BELLS_PER_HEART} bells`);

const seed = 1057066883;
const terrainA = new Terrain(seed);
const terrainB = new Terrain(seed);
const a = new BellField(seed, terrainA);
const b = new BellField(seed, terrainB);
const aa = a.around(0, 0, 2200).slice(0, 28);
const bb = b.around(0, 0, 2200).slice(0, 28);
check('bell lines remain deterministic even after hazard avoidance',
  JSON.stringify(aa) === JSON.stringify(bb) && aa.length >= 20,
  `${aa.length} compared pickups`);

let unsafe = 0;
for (const bell of aa) {
  const near = terrainA.collidersNear(bell.d, 7, BELL_LINES.LOOK_AHEAD);
  const blocked = near.some((c) => {
    const dd = c.d - bell.d;
    if (dd < -5 || dd > BELL_LINES.LOOK_AHEAD) return false;
    return Math.abs(bell.x - c.x) < (c.r || 0.7) + BELL_LINES.HAZARD_PAD - 0.01;
  });
  if (blocked) unsafe++;
}
check('bells never deliberately route the player through a nearby solid hazard',
  unsafe === 0, `${unsafe}/${aa.length} unsafe route suggestions`);
check('bell paths stay away from the powder-bank exploit zone',
  aa.every((bell) => Math.abs(bell.x) <= BELL_LINES.SAFE_HALF_WIDTH + 1e-9),
  `max safe x ±${BELL_LINES.SAFE_HALF_WIDTH}m`);

const deepBells = a.around(15000, 0, 1000);
check('collectible lines continue beyond a 15K expert run', deepBells.length >= 7,
  `${deepBells.length} visible bells between 15K and 16K`);

let collected = 0;
for (const bell of aa.slice(0, HEARTS.BELLS_PER_HEART)) {
  collected += a.collectNear({ x: bell.x, d: bell.d }).length;
}
check('bell pickup geometry remains reachable after safety correction', collected >= HEARTS.BELLS_PER_HEART,
  `${collected} pickups collected`);

check('Hunts are full scenes, not punctuation', CHASE.HUNT_MIN >= 20 && CHASE.HUNT_MAX >= 28,
  `${CHASE.HUNT_MIN}-${CHASE.HUNT_MAX}s base Hunt`);
check('recovery windows stay short enough to avoid long empty skiing', CHASE.RELIEF_MAX <= 10,
  `${CHASE.RELIEF_MIN}-${CHASE.RELIEF_MAX}s relief`);
check('deep Hunt target gets genuinely threatening', CHASE.HUNT_GAP_DEEP <= 12,
  `${CHASE.HUNT_GAP_DEEP}m target`);
check('the beast closes harder than it opens in RC5', TUNING.BEAST.CLOSE_RATE > TUNING.BEAST.OPEN_RATE,
  `${TUNING.BEAST.CLOSE_RATE} close vs ${TUNING.BEAST.OPEN_RATE} open`);

check('Big Air is materially denser than the original slice',
  TUNING.FEATURES.CLIFF_CHANCE >= 0.40 && TUNING.FEATURES.MOGUL_CHANCE >= 0.75,
  `cliff=${TUNING.FEATURES.CLIFF_CHANCE}, mogul=${TUNING.FEATURES.MOGUL_CHANCE}`);
check('Big Air has enough physical lip/drop to read at speed',
  TUNING.FEATURES.CLIFF_LIP_H >= 1.3 && TUNING.FEATURES.CLIFF_DROP[1] >= 11,
  `lip=${TUNING.FEATURES.CLIFF_LIP_H}m, max drop=${TUNING.FEATURES.CLIFF_DROP[1]}m`);

const rc5Source = fs.readFileSync(new URL('../src/rc5.js', import.meta.url), 'utf8');
check('RC5 no longer owns a second permanent animation loop',
  !/function\s+frame\s*\([^)]*\)[\s\S]*requestAnimationFrame\(frame\)/.test(rc5Source),
  'RC5 piggybacks on Stage.render');
check('bell renderer is throttled instead of rebuilding matrices every frame',
  rc5Source.includes('t - this.lastT < 0.05'), '20hz collectible visual refresh');
check('the Flow chain readout is removed from the release HUD',
  rc5Source.includes('#pitchName,#styleWord,#courage,#chain'), 'chain hidden');

const last = LANDMARKS[LANDMARKS.length - 1];
check('authored mountain still carries visual progression beyond the test horizon', last.d >= 14000,
  `${last.name} @ ${last.d}m`);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
