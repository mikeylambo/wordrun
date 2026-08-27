import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { Terrain } from '../src/sim/terrain.js';
import { BellField, BELL_LINES } from '../src/design/bells.js';
import { airBeat } from '../src/design/air-beats.js';
import { CHASE, applyReleaseTuning } from '../src/design/release-tuning.js';

applyReleaseTuning(TUNING);

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nDESCENT — RC7 clarity & payoff verification');
const seed = 1057066883;
const terrain = new Terrain(seed);
const field = new BellField(seed, terrain);

check('the first bell invitation arrives in the opening seconds', BELL_LINES.START <= 130,
  `first line base ${BELL_LINES.START}m`);
check('bell strings are frequent enough to prevent empty ski-only stretches', BELL_LINES.SPACING <= 310,
  `${BELL_LINES.SPACING}m nominal spacing`);

let minCount = Infinity;
const visible = [];
for (let i = 0; i < 60; i++) {
  const line = field._line(i);
  minCount = Math.min(minCount, line.length);
  visible.push(...line);
}
visible.sort((a, b) => a.d - b.d);
let maxGap = 0;
for (let i = 1; i < visible.length; i++) maxGap = Math.max(maxGap, visible[i].d - visible[i - 1].d);
check('safety correction does not erase whole collectible strings', minCount >= 5,
  `smallest of first 60 lines has ${minCount} bells`);
check('no long bell desert appears through an expert-distance sample', maxGap < 365,
  `largest visible-bell gap ${maxGap.toFixed(0)}m`);

let unsafe = 0;
for (const bell of visible.slice(0, 180)) {
  for (const c of terrain.collidersNear(bell.d, 5, 13)) {
    if (Math.abs(bell.x - c.x) < (c.r || 0.7) + 2.75) { unsafe++; break; }
  }
}
check('continuous bells remain honest around solid hazards', unsafe === 0, `${unsafe} unsafe invitations`);

const firstAir = airBeat(seed, 0);
check('the opening 30 seconds contains an authored Big Air beat', firstAir.d < 560,
  `first launch @ ${firstAir.d.toFixed(0)}m`);
check('the first Hunt waits long enough to learn the toy but not long enough to go quiet',
  CHASE.FIRST_HUNT_MIN >= 12 && CHASE.FIRST_HUNT_MAX <= 20,
  `${CHASE.FIRST_HUNT_MIN}-${CHASE.FIRST_HUNT_MAX}s`);
check('catch sequence holds long enough to read as a kill cam', TUNING.BEAST.KILL_CAM_TIME >= 2,
  `${TUNING.BEAST.KILL_CAM_TIME.toFixed(2)}s`);

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const pause = fs.readFileSync(new URL('../src/ui/pause.js', import.meta.url), 'utf8');
const onboarding = fs.readFileSync(new URL('../src/ui/onboarding.js', import.meta.url), 'utf8');
const storage = fs.readFileSync(new URL('../src/storage/storage.js', import.meta.url), 'utf8');

// V1 preserves the RC7 one-screen clarity goal while deliberately withholding
// the Beast reveal. The card teaches the controllable arcade loop and hearts;
// threat identity is discovered in play rather than disclosed in instructions.
check('first-run onboarding explains the V1 arcade loop without spoiling the threat',
  onboarding.includes('SKI AS FAR AS YOU CAN') && onboarding.includes('BELLS') &&
  onboarding.includes('AIR AND TRICKS FILL GO') && onboarding.includes('OBSTACLES COST A HEART') &&
  !onboarding.includes('THE BEAST ENDS THE RUN'));
check('BEST RUN ghost can be toggled before play and in Pause',
  onboarding.includes('BEST RUN') && pause.includes('BEST RUN') && main.includes('ghostEnabled ? Storage.loadGhost'));
check('ghost preference and versioned onboarding completion persist locally',
  storage.includes('ghostEnabled()') && storage.includes('onboardingSeen(') &&
  storage.includes('setGhostEnabled(') && storage.includes('setOnboardingSeen('));
check('audio and pause controls occupy separate top-right slots',
  pause.includes('#mute{right:15px!important;top:calc(env(safe-area-inset-top,0px) + 61px)!important}') &&
  pause.includes('right:15px;top:calc(env(safe-area-inset-top,0px) + 15px)'));
check('death flow still has explicit AGAIN and MENU actions',
  main.includes("getElementById('deathAgain')") && main.includes("getElementById('deathMenu')"));

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
