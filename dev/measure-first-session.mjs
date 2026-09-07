/**
 * RC11.3 — the first 90 seconds, as a brand-new player receives them.
 *
 * Priority 3 of the publishability pass asks whether seven things arrive
 * inside the first minute and a half without a README: what a real/fake
 * judgment is, what mistakes cost, why the Redline is approaching, what a
 * clean streak buys, what DASH does, what HOLDING it does, and what success
 * looks like.
 *
 * This drives the SIM headlessly — the teach stops live in src/sim, so no
 * renderer is needed and 90 seconds of play costs a second of wall clock —
 * with a cold profile and a human reading pause on every armed word, and
 * prints when each teaching beat fires and what it says in each modality.
 *
 *   node dev/measure-first-session.mjs
 */
import TUNING from '../src/TUNING.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { STOP } from '../src/sim/teach-stops.js';
import { stopLine, confirmLesson, rejectLesson, barLesson, dashReadyLine, MODALITY }
  from '../src/ui/teach-copy.js';
import { hashString, dailySeedString } from '../src/sim/rng.js';

const DT = TUNING.SIM.DT;
const READ_DELAY = 0.55;          // a human pause before answering
const SECONDS = 90;
const MISTAKE_ON_READ = 12;       // the one fake this player taps, to price a mistake

const sim = new Sim(hashString(dailySeedString()) >>> 0);
// THE GUIDED CHART is what a genuinely new player gets: main.js `chartForRun`
// returns 'guided' while GUIDED TIPS is on and the three stops are unlearned,
// and `TeachStops.evaluate` refuses to fire on any other chart. A probe that
// starts in 'endless' sees no teaching at all and would report a game with no
// tutorial — which is the wrong answer, loudly.
sim.start(undefined, null, { mode: 'endless', chart: 'guided' });
sim.teach.enabled = true;
sim.teach.learned = { real: false, fake: false, dash: false };
if (sim.wordGates.profile?.CHART !== 'guided') {
  console.error(`the guided chart did not take (CHART=${sim.wordGates.profile?.CHART}) — ` +
    'the stops cannot fire and this measurement would be meaningless.');
  process.exit(1);
}

const input = emptyInput();
const beats = [];
const note = (t, what) => beats.push({ t: +t.toFixed(1), what });
let armedSince = null;
let madeMistake = false;
const answered = new Set();
let lastStop = null, lastChain = 0, lastHearts = sim.hearts, sawDashReady = false;
let firstBarChance = null;

for (let f = 0; f < SECONDS / DT && sim.phase === PHASE.RUNNING; f++) {
  const t = f * DT;
  const wg = sim.wordGates;
  const g = wg.current();
  const armed = wg.armed(sim.player.d);
  input.confirm = false;
  if (armed && !g.resolved && !answered.has(g.index)) {
    if (armedSince === null) armedSince = t;
    if (t - armedSince >= READ_DELAY) {
      answered.add(g.index);
      // A new player gets one wrong. Without a mistake in the timeline the
      // probe cannot see what a mistake COSTS, and would report the game as
      // never teaching it — which is the probe's silence, not the game's.
      const blunder = !madeMistake && answered.size >= MISTAKE_ON_READ && !g.real;
      if (blunder) madeMistake = true;
      input.confirm = blunder ? true : g.real;
      armedSince = null;
    }
  } else if (!armed) armedSince = null;
  // Dash the moment the game says it is ready, the way a new player would.
  input.boostHeld = sim.player.boostMeter >= TUNING.BOOST.MIN_ACTIVATE && !sim.player.overdrive;
  if (input.boostHeld && !sawDashReady) { sawDashReady = true; note(t, 'DASH becomes available'); }
  sim.step(input);

  const stop = sim.teach.active;
  if (stop !== lastStop) {
    if (stop) note(t, `STOP "${stop}" — ${stopLine(stop, MODALITY.TOUCH)}`);
    lastStop = stop;
  }
  if (sim.hearts !== lastHearts) {
    note(t, sim.hearts < lastHearts
      ? `HEART SPENT on a wrong read (${sim.hearts} left)`
      : `HEART RETURNED by a clean streak (${sim.hearts} back)`);
    lastHearts = sim.hearts;
  }
  if (sim.player.chain >= 4 && lastChain < 4) note(t, 'chain reaches 4 — the bar lesson becomes eligible');
  if (sim.player.chain > lastChain) lastChain = sim.player.chain;
  if (firstBarChance === null && sim.player.chain >= 4 && sim.player.compressionLevel === 0) firstBarChance = t;
}

const wg = sim.wordGates;
console.log(`FIRST ${SECONDS} SECONDS — a cold profile, every real word answered after ${READ_DELAY}s\n`);
for (const b of beats) console.log(`  ${String(b.t).padStart(5)}s  ${b.what}`);
console.log(`\n  after ${SECONDS}s: ${wg.correctCount} read right, ${wg.wrongCount} wrong, ` +
  `${sim.hearts} hearts, best chain ${sim.player.bestChain}, ` +
  `${Math.round(sim.player.d)} m, Redline ${Math.round(sim.beast.gap)} m back`);

console.log('\nTHE SEVEN THINGS, AND WHERE THE FIRST 90 SECONDS TEACHES THEM');
const taught = [
  ['a real/fake judgment', beats.find((b) => /STOP "real"/.test(b.what)),
    'the REAL stop freezes the frame on the first real word'],
  ['what mistakes cost', beats.find((b) => /HEART SPENT/.test(b.what)),
    'a heart leaves the row, the frame drains, and the speed drops'],
  ['why the Redline is approaching', null,
    'NOTHING NAMES IT — the pursuit is visual only; no stop, coach rung or HUD label mentions it'],
  ['what a clean streak buys', beats.find((b) => /HEART RETURNED/.test(b.what))
    || beats.find((b) => /chain reaches 4/.test(b.what)),
    'the chain climbs, the world brightens, and a clean streak hands a heart back'],
  ['what DASH does', beats.find((b) => /DASH becomes available/.test(b.what)),
    `the DASH stop and "${dashReadyLine(MODALITY.TOUCH)}"`],
  ['what HOLDING DASH does', beats.find((b) => /bar lesson/.test(b.what)),
    `the coach line "${barLesson(MODALITY.TOUCH)}"`],
  ['what success looks like', null,
    'the score, BEST TODAY and the results card — none of which appear until the run ends'],
];
for (const [what, beat, how] of taught) {
  const when = beat ? `${beat.t}s` : '—';
  console.log(`  ${when.padStart(6)}  ${what.padEnd(30)} ${how}`);
}
