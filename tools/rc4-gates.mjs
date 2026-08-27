import TUNING from '../src/TUNING.js';
import { Beast, CHASE_MODE } from '../src/sim/beast.js';
import { LANDMARKS } from '../src/design/landmarks.js';
import { MOUNTAIN_BANDS } from '../src/render/art-direction.js';

let passed = 0;
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function fakePlayer() {
  return { x: 0, d: 0, speed: 32, overdrive: false };
}

function runBeast(seed, seconds, driver = null) {
  const b = new Beast(seed);
  const p = fakePlayer();
  const dt = TUNING.SIM.DT;
  const frames = Math.floor(seconds / dt);
  let firstHunt = null;
  let huntsSeen = 0;
  let reliefSeen = 0;
  let sideSeen = 0;
  let prevMode = b.mode;
  let worstClose = 0;
  let previousGap = b.gap;

  for (let i = 0; i < frames && !b.killed; i++) {
    if (driver) driver({ b, p, i, dt });
    p.d += p.speed * dt;
    b.step(dt, p);

    const close = Math.max(0, (previousGap - b.gap) / dt);
    worstClose = Math.max(worstClose, close);
    previousGap = b.gap;

    if (b.mode !== prevMode) {
      if (b.mode === CHASE_MODE.HUNT) {
        huntsSeen++;
        if (firstHunt == null) firstHunt = i * dt;
        if (b.attackKind === 'side') sideSeen++;
      }
      if (b.mode === CHASE_MODE.RELIEF) reliefSeen++;
      prevMode = b.mode;
    }
  }

  return { b, p, firstHunt, huntsSeen, reliefSeen, sideSeen, worstClose };
}

console.log('\nDESCENT — RC4 contract verification');

check('air opportunities are materially more common than the original slice',
  TUNING.FEATURES.CLIFF_CHANCE >= 0.30 && TUNING.FEATURES.MOGUL_CHANCE >= 0.65,
  `cliff=${TUNING.FEATURES.CLIFF_CHANCE}, mogul=${TUNING.FEATURES.MOGUL_CHANCE}`);

const lastLandmark = LANDMARKS[LANDMARKS.length - 1];
const lastBand = MOUNTAIN_BANDS[MOUNTAIN_BANDS.length - 1];
check('authored scenery continues well beyond an 8K test run',
  lastLandmark.d >= 14000 && lastBand.start >= 13000,
  `last landmark ${lastLandmark.name} @ ${lastLandmark.d}m, last band ${lastBand.name} @ ${lastBand.start}m`);
check('long-run mountain has enough distinct visual beats',
  LANDMARKS.length >= 14 && MOUNTAIN_BANDS.length >= 8,
  `${LANDMARKS.length} landmarks, ${MOUNTAIN_BANDS.length} visual bands`);

const a = runBeast(1057066883, 180);
const b = runBeast(1057066883, 180);
check('chase rhythm is deterministic for a daily seed',
  a.b.hunts === b.b.hunts && a.b.escapes === b.b.escapes &&
  Math.abs(a.b.gap - b.b.gap) < 1e-9 && Math.abs(a.b.x - b.b.x) < 1e-9,
  `${a.b.hunts} hunts / ${a.b.escapes} escapes`);

check('the beast is present immediately instead of waiting for a fixed ambush distance',
  new Beast(7).gap <= TUNING.BEAST.MAX_GAP && new Beast(7).gap < 100,
  `start gap ${new Beast(7).gap.toFixed(1)}m`);

check('first real attack arrives early enough to keep the run alive',
  a.firstHunt != null && a.firstHunt >= 12 && a.firstHunt <= 28,
  `first hunt ${a.firstHunt?.toFixed(1)}s`);
check('a normal three-minute run cycles through pressure and relief repeatedly',
  a.huntsSeen >= 4 && a.reliefSeen >= 3,
  `${a.huntsSeen} hunts, ${a.reliefSeen} relief windows`);

const allowedClose = TUNING.BEAST.CLOSE_RATE * 1.32 + TUNING.BEAST.LUNGE_RATE + 1.0;
check('hunt transitions never teleport the beast forward',
  a.worstClose <= allowedClose,
  `worst close ${a.worstClose.toFixed(2)} m/s, allowed ${allowedClose.toFixed(2)}`);

const long = runBeast(0xdecafbad, 600);
check('side-intercept attacks appear as one chase variation, not a one-time scripted reveal',
  long.sideSeen >= 1,
  `${long.sideSeen} side hunts across ${long.huntsSeen} hunts`);
check('a clean fast line is not mathematically sentenced to die at one distance',
  !long.b.killed && long.p.d > 15000,
  `still skiing at ${Math.floor(long.p.d)}m`);

const stunt = new Beast(123);
const sp = fakePlayer();
stunt._startHunt(sp);
stunt.gap = 26;
const before = stunt.gap;
const pushed = stunt.stuntShove(14);
check('a clean authored stunt can end an active hunt immediately',
  pushed > 14 && stunt.mode === CHASE_MODE.RELIEF && stunt.gap > before,
  `${before.toFixed(1)}m -> ${stunt.gap.toFixed(1)}m, mode=${stunt.mode}`);

const go = new Beast(321);
const gp = fakePlayer();
go._startHunt(gp);
go.gap = 42;
gp.overdrive = true;
for (let i = 0; i < 180 && go.mode === CHASE_MODE.HUNT; i++) {
  gp.d += gp.speed * TUNING.SIM.DT;
  go.step(TUNING.SIM.DT, gp);
}
check('GO can beat an attack and produce relief rather than merely slow the timer',
  go.mode === CHASE_MODE.RELIEF && go.gap >= 60,
  `mode=${go.mode}, gap=${go.gap.toFixed(1)}m`);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
