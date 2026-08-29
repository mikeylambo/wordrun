/**
 * Meta-layer gates — the SLU-shell-ported managers (stats, daily goals,
 * play streak) and the learning recap.
 *
 * What this suite owes the game:
 *   - StatsManager keeps the shell contract (get/set/increment/snapshot)
 *     and round-trips through its storage adapter.
 *   - The streak is honest calendar math: same day is idempotent,
 *     consecutive days extend, a missed day resets, and the title can ask
 *     without recording a play.
 *   - The day's goals are pure from the seed (same seed, same card),
 *     bounded, and completion sticks for the day across runs.
 *   - The sim records every wrong read with its truth, capped, so the
 *     results screen can always show the real spelling.
 *   - The meta modules stay standalone (no sim/render/three imports) —
 *     liftable into the next game like the word list.
 */

import fs from 'node:fs';
import { StatsManager, memoryAdapter } from '../src/meta/stats.js';
import { DailyManager, goalsFor } from '../src/meta/daily.js';
import { Sim, PHASE, emptyInput } from '../src/sim/sim.js';
import { makeGate } from '../src/sim/word-gates.js';

let pass = 0;
let fail = 0;
const out = [];
const check = (label, ok, detail = '') => {
  if (ok) { pass++; out.push(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; out.push(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
};
const head = (t) => out.push(`\n${t}`);

// ── StatsManager: the shell contract over an adapter ─────────────────────
head('META — StatsManager (shell Layer-1 port)');

{
  const adapter = memoryAdapter();
  const s = new StatsManager(adapter);
  s.increment('runs');
  s.increment('runs');
  s.increment('metres', 1500);
  s.set('label', 'x');
  s.max('bestChain', 6);
  s.max('bestChain', 4);
  check('increment, set and max behave', s.get('runs') === 2 &&
    s.get('metres') === 1500 && s.get('label', '') === 'x' && s.get('bestChain') === 6);
  check('snapshot is a detached copy', (() => {
    const snap = s.snapshot(); snap.runs = 99; return s.get('runs') === 2;
  })());
  const reloaded = new StatsManager(adapter);
  check('stats round-trip through the storage adapter',
    reloaded.get('runs') === 2 && reloaded.get('bestChain') === 6);
}

// ── DailyManager: calendar streak ────────────────────────────────────────
head('META — play streak is honest calendar math');

{
  const adapter = memoryAdapter();
  let now = '2026-08-25';
  const d = new DailyManager(adapter, { today: () => now });
  const seed = 1234;

  check('no plays yet reads as no streak', d.streak() === 0);
  let card = d.recordRun(seed, { distance: 100 });
  check('first play starts the streak at 1', card.streak === 1);
  card = d.recordRun(seed, { distance: 200 });
  check('a second run the same day does not double-count', card.streak === 1);

  now = '2026-08-26';
  check('the streak survives overnight before the first run', d.streak() === 1);
  card = d.recordRun(seed, { distance: 100 });
  check('a consecutive day extends it', card.streak === 2);

  now = '2026-08-28';
  check('a skipped calendar day reads as broken before playing', d.streak() === 0);
  card = d.recordRun(seed, { distance: 100 });
  check('and the next play restarts at 1', card.streak === 1);

  const reloaded = new DailyManager(adapter, { today: () => now });
  check('the streak round-trips through the adapter', reloaded.streak() === 1);
}

// ── Daily goals: pure, bounded, sticky ───────────────────────────────────
head('META — daily goals derive from the seed');

{
  const a = goalsFor(777001);
  const b = goalsFor(777001);
  check('same seed, same goal card',
    JSON.stringify(a) === JSON.stringify(b), a.map((g) => g.label).join(' · '));

  const seeds = [1, 999, 12345, 8675309, 42, 777001, 20260828];
  const cards = seeds.map((s) => JSON.stringify(goalsFor(s).map((g) => g.target)));
  check('different seeds vary the card', new Set(cards).size > 1);

  let bounded = true;
  for (const s of seeds) {
    const [dist, chain, reads] = goalsFor(s);
    if (dist.target < 800 || dist.target > 1600 || dist.target % 200 !== 0) bounded = false;
    if (chain.target < 5 || chain.target > 8) bounded = false;
    if (reads.target < 15 || reads.target > 30 || reads.target % 5 !== 0) bounded = false;
  }
  check('every goal stays inside its authored bounds', bounded);

  const adapter = memoryAdapter();
  const now = '2026-08-28';
  const d = new DailyManager(adapter, { today: () => now });
  const seed = 999;
  const [dist] = goalsFor(seed);
  let card = d.recordRun(seed, { distance: dist.target + 10, bestChain: 0, correct: 0 });
  check('a run that meets a goal marks it done and reports it once',
    card.goals.find((g) => g.id === 'dist').done && card.newlyDone.includes('dist'));
  card = d.recordRun(seed, { distance: 5, bestChain: 0, correct: 0 });
  check('completion sticks for the day across later runs',
    card.goals.find((g) => g.id === 'dist').done && !card.newlyDone.includes('dist'));
  check('unmet goals stay open', card.goals.some((g) => !g.done));
  check("today's best distance is tracked for the day", card.best === dist.target + 10);
}

// ── The sim's recap ledger ───────────────────────────────────────────────
head('META — the recap always knows the true spelling');

{
  // Silence: every real word slips by; the ledger fills with omissions.
  const sim = new Sim(12345);
  sim.start(12345);
  const input = emptyInput();
  for (let i = 0; i < 60 * 90 && sim.phase === PHASE.RUNNING; i++) {
    sim.beast.gap = 80; // pin the pursuit off; the ledger is under test
    sim.hearts = 3;
    sim.step(input);
  }
  const wg = sim.wordGates;
  check('a silent run records its missed reals in the recap ledger',
    wg.misses.length > 0 && wg.misses.every((m) => m.reason === 'missed_real' && m.real),
    `${wg.misses.length} entries`);
  check('the recap ledger is capped', wg.misses.length <= 12,
    `${wg.misses.length} <= 12`);
}

{
  // Spam: every fake is tapped; each recap entry carries the real spelling.
  const seed = [999, 12345, 42, 777001].find((s) => !makeGate(s, 0).real) ?? 999;
  const sim = new Sim(seed);
  sim.start(seed);
  const input = emptyInput();
  for (let i = 0; i < 60 * 60 && sim.phase === PHASE.RUNNING; i++) {
    sim.beast.gap = 80;
    sim.hearts = 3;
    const g = sim.wordGates.current();
    input.confirm = sim.wordGates.armed(sim.player.d) && !g.confirmed;
    sim.step(input);
  }
  const taps = sim.wordGates.misses.filter((m) => m.reason === 'picked_fake');
  check('every tapped fake in the recap carries its true spelling',
    taps.length > 0 && taps.every((m) => !m.real && typeof m.answer === 'string' && m.answer.length > 0),
    `${taps.length} fakes recorded`);
}

// ── Bells: the currency pickup actually gets picked up ───────────────────
head('META — bells sit on the travel line and feed the balance');

{
  // Phase 8 audit finding, gated so it cannot regress: strings used to be
  // laid in the straight-ribbon frame while the track wound ±15.5m — wired
  // to hearts and meter on paper, uncollectible in play. Every bell must
  // now sit inside the pickup window of the line the runner travels.
  const { BellField, BELL_LINES } = await import('../src/design/bells.js');
  const { Terrain } = await import('../src/sim/terrain.js');
  for (const seed of [999, 12345, 8675309]) {
    const t = new Terrain(seed);
    const f = new BellField(seed, t);
    const bells = f.around(3000, 2900, 2900);
    const worst = Math.max(...bells.map((b) => Math.abs(b.x - t.corridorX(b.d))));
    check(`seed ${seed}: every bell is inside the pickup window of the line`,
      bells.length > 30 && worst <= BELL_LINES.PICKUP_X - 0.5,
      `${bells.length} bells, worst ${worst.toFixed(2)}m off-line (window ${BELL_LINES.PICKUP_X}m)`);
  }

  // And an auto-following runner actually collects them: walk the line at
  // pace and sweep collectNear the way the rc5 layer does each step.
  const t = new Terrain(999);
  const f = new BellField(999, t);
  let collected = 0;
  for (let d = 0; d < 2000; d += 27 / 60) {
    collected += f.collectNear({ d, x: t.corridorX(d) }).length;
  }
  check('a runner simply following the line collects the strings',
    collected >= 30, `${collected} collected over 2km`);
}

// ── Modes (Phase 10): two rule sets × three difficulties ─────────────────
head('MODES — rules, difficulty, and separated boards');

{
  const TUNING = (await import('../src/TUNING.js')).default;
  const M = TUNING.MODES;
  check('exactly two rule sets: ENDLESS repairs hearts, STANDARD never does',
    Object.keys(M.RULES).length === 2 &&
    M.RULES.endless.HEART_REPAIR === true && M.RULES.standard.HEART_REPAIR === false);

  const sim = new Sim(999);
  sim.start(999, null, { mode: 'standard', difficulty: 'easy' });
  check('sim.start carries the rules and the difficulty pace',
    sim.mode === 'standard' && sim.rules.HEART_REPAIR === false &&
    sim.beast.pace === M.DIFFICULTY.easy.REDLINE_PACE,
    `pace ${sim.beast.pace}`);
  sim.start(999);
  check('defaults reproduce the pre-mode game (endless/normal, baseline pace)',
    sim.mode === 'endless' && sim.rules.HEART_REPAIR === true &&
    sim.beast.pace === TUNING.RUN.REDLINE_PACE);

  // The gap must integrate against the DIFFICULTY pace, not the constant.
  const hard = new Sim(999);
  hard.start(999, null, { difficulty: 'hard' });
  const gap0 = hard.beast.gap;
  hard.player.speed = TUNING.RUN.REDLINE_PACE; // baseline pace = 3 under hard's
  for (let i = 0; i < 60; i++) {
    hard.beast.step(1 / 60, hard.player);
    hard.player.speed = TUNING.RUN.REDLINE_PACE;
  }
  const closed = gap0 - hard.beast.gap;
  const expect = M.DIFFICULTY.hard.REDLINE_PACE - TUNING.RUN.REDLINE_PACE;
  check('the Redline hunts at the difficulty pace (gap closes at the pace delta)',
    Math.abs(closed - expect) < 0.05, `closed ${closed.toFixed(2)}m/s vs ${expect}`);

  const rc5 = fs.readFileSync('src/rc5.js', 'utf8');
  check('heart repair is gated on the rules in the bell collector',
    rc5.includes("this.rules?.HEART_REPAIR !== false") &&
    rc5.includes('if (heartRepair) this.bellCharge++'));

  const storage = fs.readFileSync('src/storage/storage.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  check('bests, ghosts and run counts are stored per mode/difficulty variant',
    storage.includes("vkey('best', seed)") && storage.includes("vkey('ghost', seed)") &&
    storage.includes("vkey('runs', seed)") && main.includes('syncVariant()'));
  check('the legacy default keeps its keys (pre-mode bests survive)',
    storage.includes("`${type}.${seed}${VARIANT ? `.${VARIANT}` : ''}`") &&
    main.includes("? '' : `${runMode}.${runDifficulty}`"));
  check('the title exposes both choices and persists them',
    main.includes('setModePref') && main.includes('setDifficultyPref') &&
    fs.readFileSync('index.html', 'utf8').includes('id="difficultyRow"'));
}

// ── Music stems (Phase 12): the reactive engine, gated before the score ──
head('MUSIC — stem levels are a pure function of speed and streak');

{
  const { stemLevels, STEM_LAYERS } = await import('../src/audio/stems.js');
  const TUNING = (await import('../src/TUNING.js')).default;
  const R = TUNING.RUN;

  const a = stemLevels({ speed: 33, streak: 4 });
  const b = stemLevels({ speed: 33, streak: 4 });
  check('identical state yields identical levels (deterministic)',
    JSON.stringify(a) === JSON.stringify(b));
  check('four layers, every level bounded 0..1',
    STEM_LAYERS.length === 4 && STEM_LAYERS.every((l) => {
      const v = stemLevels({ speed: 50, streak: 6 })[l];
      return v >= 0 && v <= 1;
    }));

  const speeds = [R.FLOOR, 24, 32, 40, 48, 56, R.CEILING];
  const drumRamp = speeds.map((speed) => stemLevels({ speed, streak: 0 }).drums);
  check('drums ride the speed curve monotonically floor -> ceiling',
    drumRamp.every((v, i) => i === 0 || v >= drumRamp[i - 1]) &&
    drumRamp[speeds.length - 1] > drumRamp[0] + 0.5,
    drumRamp.map((v) => v.toFixed(2)).join(' -> '));
  check('bass is the ever-present foundation (audible even at the floor)',
    stemLevels({ speed: R.FLOOR, streak: 0 }).bass >= 0.5);

  const leadRamp = [0, 2, 4, 6, 8].map((streak) => stemLevels({ speed: 30, streak }).lead);
  check('lead wakes with the chain and is silent without one',
    leadRamp[0] === 0 && leadRamp.every((v, i) => i === 0 || v >= leadRamp[i - 1]) &&
    leadRamp[4] > 0.8, leadRamp.map((v) => v.toFixed(2)).join(' -> '));

  check('fx is the peak layer: needs BOTH high speed and a deep chain',
    stemLevels({ speed: R.CEILING, streak: 0 }).fx === 0 &&
    stemLevels({ speed: R.FLOOR, streak: 8 }).fx === 0 &&
    stemLevels({ speed: R.CEILING, streak: 8 }).fx > 0.8);

  const src = fs.readFileSync('src/audio/stems.js', 'utf8');
  check('real stems are a file drop, never a code change (loader + fallback)',
    src.includes("audio/stems/${name}.${ext}") && src.includes('placeholderBuffer') &&
    fs.existsSync('public/audio/stems/README.md'));
  check('the stems ride the master chain (mute and the drain duck apply)',
    fs.readFileSync('src/audio/audio.js', 'utf8').includes('new StemMix(ctx, this.master') &&
    fs.readFileSync('src/audio/audio.js', 'utf8').includes('this.stems.update'));
  check('the engine adds no player-facing copy (naming cap untouched)',
    !/textContent|innerHTML|document\./.test(src));
}

// ── Wiring + module independence ─────────────────────────────────────────
head('META — wiring and independence');

{
  const stats = fs.readFileSync('src/meta/stats.js', 'utf8');
  const daily = fs.readFileSync('src/meta/daily.js', 'utf8');
  check('meta modules are standalone (no sim, render or three imports)',
    !/from '\.\.\/(sim|render)\//.test(stats + daily) && !/from 'three'/.test(stats + daily));

  const main = fs.readFileSync('src/main.js', 'utf8');
  check('the run end feeds the ledger, the goals and the recap',
    main.includes('metaStats.increment') && main.includes('metaDaily.recordRun') &&
    main.includes('recap: wg.misses'));
  const TUNING = (await import('../src/TUNING.js')).default;
  check('bells bank a gated currency amount into the persistent ledger',
    TUNING.META.CURRENCY_PER_BELL >= 1 &&
    main.includes("sim.bellsCollected || 0) * TUNING.META.CURRENCY_PER_BELL") &&
    main.includes("metaStats.increment('currency', banked)"));
  const uiSrc = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the balance surfaces as a bare number with an icon, never a name',
    uiSrc.includes('◆ ${lifetime.currency}'));

  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the death card teaches the real spelling on a tapped fake',
    ui.includes('NOT A WORD') && ui.includes('<b>${m.answer}</b>'));
  check('an omission is explained without crash language',
    ui.includes('WAS REAL — IT SLIPPED BY'));
  check('the title shows the goal card and the streak',
    ui.includes('setDaily(') && ui.includes('goalChip') && ui.includes('DAY ${card.streak}'));

  const finalize = fs.readFileSync('src/v1-finalize.js', 'utf8');
  check('the all-time title line carries the streak',
    finalize.includes('DAY ${streak}'));
}

console.log(out.join('\n'));
console.log(`\nMeta gates: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
