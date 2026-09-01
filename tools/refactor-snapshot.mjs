/**
 * Phase 0 acceptance gate — the pure-refactor proof.
 *
 * Phase 0.1 relocated hearts, bell collection and the streak-repair ladder out
 * of the runtime monkey-patch in the deleted rc5.js and into sim.step() itself.
 * The one thing that must NOT change is how the game plays. This gate scripts a
 * handful of deterministic runs and records the exact trajectory of everything
 * that logic touches — hearts after every step, bells collected, the death
 * cause, the final score, and the count of each life event.
 *
 * The golden fixture (refactor-snapshot.golden.json) was captured against the
 * pre-refactor build, with rc5's step algorithm replicated verbatim (see
 * `git show` of that commit, or run with `--emit --replica`). This gate replays
 * the identical scripts through the NATIVE sim and asserts byte-identical
 * output. A green run here is the acceptance criterion for 0.1–0.3: the
 * archaeology moved code, it did not move behaviour.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { BellField, HEARTS } from '../src/design/bells.js';
import TUNING from '../src/TUNING.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, 'refactor-snapshot.golden.json');
const args = process.argv.slice(2);
const EMIT = args.includes('--emit');
const REPLICA = args.includes('--replica');

// ── rc5's step algorithm, verbatim (only used to mint the golden) ────────────
// This mirrors patchSim(sim, field).stepRC6 from the deleted src/rc5.js exactly.
// It runs AFTER the base sim.step, the same way the runtime patch wrapped it.
function replicaAttach(sim) {
  const field = new BellField(sim.seed, sim.terrain);
  const resetRunState = () => {
    sim.maxHearts = HEARTS.MAX;
    sim.hearts = HEARTS.MAX;
    sim.bellCharge = 0;
    sim._lastCleanStreak = 0;
    sim.bellsCollected = 0;
    sim.deathCause = null;
    field.reset(sim.seed, sim.terrain);
  };
  resetRunState();
  const baseStart = sim.start.bind(sim);
  sim.start = function startReplica(...a) { const o = baseStart(...a); resetRunState(); return o; };
  const baseStep = sim.step.bind(sim);
  sim.step = function stepReplica(input) {
    const wasRunning = this.phase === 'running';
    const beforeHits = this.player.obstaclesHit;
    baseStep(input);
    if (!wasRunning) return;
    if (this.phase === 'kill') { this.deathCause = 'redlined'; return; }
    if (this.phase !== 'running') return;
    const hits = this.player.obstaclesHit - beforeHits;
    if (hits > 0) {
      this.hearts = Math.max(0, this.hearts - hits);
      this.events.push({ t: 'heart_lost', hearts: this.hearts });
      if (this.hearts <= 0) {
        this.player.dead = true;
        this.deathCause = 'wipeout';
        this.recorder.finish(this.player);
        this.phase = 'dead';
        this.events.push({ t: 'wipeout' });
        return;
      }
    }
    const heartRepair = this.rules?.HEART_REPAIR !== false;
    const picked = field.collectNear(this.player);
    for (const bell of picked) {
      this.bellsCollected++;
      this.player.boostMeter = Math.min(TUNING.BOOST.METER_MAX,
        this.player.boostMeter + HEARTS.POWER_PER_BELL);
      this.events.push({ t: 'bell', id: bell.id, x: bell.x, d: bell.d,
        charge: this.bellsCollected, power: HEARTS.POWER_PER_BELL });
    }
    const streak = this.wordGates.streak;
    const need = HEARTS.STREAK_REPAIR_BY_HEARTS[this.hearts] ?? HEARTS.STREAK_REPAIR_DEFAULT;
    if (heartRepair && streak > 0 && streak !== this._lastCleanStreak &&
        streak % need === 0 && this.hearts < this.maxHearts) {
      this.hearts++;
      this.events.push({ t: 'heart_restore', hearts: this.hearts, streak });
    }
    this._lastCleanStreak = streak;
  };
}

// ── Deterministic input policies (factories — one stateful stepper per run) ──
// `confirmAll` taps REAL at every armed word (so it taps fakes wrong — hearts
// fall — and confirms reals — the streak builds). `answerTrue` reads correctly
// (confirm reals, reject fakes) for a long clean run. `repairProbe` reads
// correctly EXCEPT it deliberately taps the first fake it meets (dropping one
// heart), then reads clean — the one script that drives the streak-repair
// ladder, the most delicate piece being relocated.
const policies = {
  confirmAll: () => (sim, input) => {
    const g = sim.wordGates.current();
    input.confirm = sim.wordGates.armed(sim.player.d) && !g.confirmed;
    input.reject = false;
  },
  answerTrue: () => (sim, input) => {
    const g = sim.wordGates.current();
    const armed = sim.wordGates.armed(sim.player.d) && !g.confirmed;
    input.confirm = armed && !!g.real;
    input.reject = armed && !g.real;
  },
  repairProbe: () => {
    let droppedOne = false;
    return (sim, input) => {
      const g = sim.wordGates.current();
      const armed = sim.wordGates.armed(sim.player.d) && !g.confirmed;
      if (armed && !g.real && !droppedOne) { droppedOne = true; input.confirm = true; return; }
      input.confirm = armed && !!g.real;
      input.reject = armed && !g.real;
    };
  },
};

function runScript({ seed, mode, difficulty, policy, maxSteps, pinGap }) {
  const sim = new Sim(seed);
  if (REPLICA) replicaAttach(sim);
  sim.start(seed, null, { mode, difficulty });
  const input = emptyInput();
  const counts = { heart_lost: 0, heart_restore: 0, bell: 0, wipeout: 0, word_correct: 0, word_wrong: 0 };
  const heartsTrace = [];
  const step = policies[policy]();
  for (let i = 0; i < maxSteps && sim.phase === PHASE.RUNNING; i++) {
    if (pinGap != null) sim.beast.gap = pinGap; // keep the Redline off the ledger under test
    input.confirm = false; input.reject = false;
    step(sim, input);
    sim.step(input);
    heartsTrace.push(sim.hearts ?? -1);
    for (const e of sim.events) if (e.t in counts) counts[e.t]++;
    sim.events.length = 0;
  }
  return {
    seed, mode, difficulty, policy,
    steps: sim.steps,
    phase: sim.phase,
    hearts: sim.hearts ?? null,
    maxHearts: sim.maxHearts ?? null,
    bellsCollected: sim.bellsCollected ?? null,
    deathCause: sim.deathCause ?? null,
    score: sim.score,
    obstaclesHit: sim.player.obstaclesHit,
    correctCount: sim.wordGates.correctCount,
    wrongCount: sim.wordGates.wrongCount,
    counts,
    heartsHash: crypto.createHash('sha1').update(heartsTrace.join(',')).digest('hex').slice(0, 16),
  };
}

const SCRIPTS = [
  { seed: 999, mode: 'standard', difficulty: 'normal', policy: 'confirmAll', maxSteps: 60 * 120, pinGap: 80 },
  { seed: 12345, mode: 'endless', difficulty: 'normal', policy: 'confirmAll', maxSteps: 60 * 120, pinGap: 80 },
  { seed: 8675309, mode: 'endless', difficulty: 'hard', policy: 'answerTrue', maxSteps: 60 * 200, pinGap: 80 },
  { seed: 42, mode: 'endless', difficulty: 'easy', policy: 'answerTrue', maxSteps: 60 * 120, pinGap: null },
  { seed: 8675309, mode: 'endless', difficulty: 'normal', policy: 'repairProbe', maxSteps: 60 * 200, pinGap: 80 },
];

const result = SCRIPTS.map(runScript);

if (EMIT) {
  fs.writeFileSync(GOLDEN, JSON.stringify(result, null, 2) + '\n');
  console.log(`Wrote ${GOLDEN} (${REPLICA ? 'replica' : 'native'})`);
  process.exit(0);
}

// Gate mode: native trajectory must equal the golden captured pre-refactor.
if (!fs.existsSync(GOLDEN)) {
  console.error('SNAPSHOT — golden fixture missing; run with --emit --replica first');
  process.exit(1);
}
const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
let fail = 0;
const out = ['\nSNAPSHOT — before/after gameplay is identical (Phase 0 acceptance)'];

// sim.debug() must not throw. The old rc5 patch read this.beast.modeT /
// modeDuration, fields the live Beast never had, so window.__DEBUG() threw on
// every call. Dissolving the patch dropped them; this makes sure they never
// creep back into the payload.
{
  const sim = new Sim(999);
  sim.start(999);
  const input = emptyInput();
  for (let i = 0; i < 400 && sim.phase === PHASE.RUNNING; i++) sim.step(input);
  let threw = null;
  try { sim.debug(); sim.state(); } catch (e) { threw = e.message; }
  if (threw) fail++;
  out.push(`  ${threw ? 'FAIL' : 'PASS'}  sim.debug() / sim.state() do not throw`
    + (threw ? ` — ${threw}` : ''));
  const d = sim.debug();
  const clean = !('huntTime' in d) && !('huntDuration' in d);
  if (!clean) fail++;
  out.push(`  ${clean ? 'PASS' : 'FAIL'}  debug payload carries no retired hunt fields`);
}

for (let i = 0; i < golden.length; i++) {
  const a = JSON.stringify(golden[i]);
  const b = JSON.stringify(result[i]);
  const ok = a === b;
  if (!ok) fail++;
  const g = golden[i];
  out.push(`  ${ok ? 'PASS' : 'FAIL'}  ${g.mode}/${g.difficulty} ${g.policy} seed ${g.seed} — `
    + `hearts ${g.hearts} bells ${g.bellsCollected} ${g.deathCause ?? 'alive'} score ${g.score}`);
  if (!ok) {
    out.push(`        golden: ${a}`);
    out.push(`        native: ${b}`);
  }
}
console.log(out.join('\n'));
const total = golden.length + 2; // + the two debug/state no-throw checks
console.log(`\nSnapshot gate: ${total - fail} passed, ${fail} failed`);
if (fail) process.exit(1);
