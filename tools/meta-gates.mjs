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
import { buildStatsExport, formatStatsExport, EXPORT_VERSION } from '../src/meta/export.js';
import TUNING from '../src/TUNING.js';
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
  // Phase 19 moved the balance off the results card — it was the fifth
  // item in a five-item stat line nobody could read at a glance — and onto
  // the title's ◆ button, where it is the label of the thing that spends it.
  const shopSrc = fs.readFileSync('src/ui/shop.js', 'utf8');
  check('the balance surfaces as a bare number with an icon, never a name',
    shopSrc.includes('`◆ ${balance()}`') && !/\bCOINS?\b|\bCREDITS?\b|\bGEMS?\b/.test(shopSrc));

  const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
  check('the death card teaches the real spelling on a tapped fake',
    ui.includes('NOT A WORD') && ui.includes('<b>${m.answer}</b>'));
  // Phase 19 compressed the sentence into the row's label. Same teaching,
  // same gentle framing, one line instead of one line per wrong read.
  check('an omission is explained without crash language',
    ui.includes("row('UNCAUGHT'") && !/\b(FAILED|WRONG|BAD|MISTAKE)\b/.test(ui));
  check('the title shows the goal card and the streak',
    ui.includes('setDaily(') && ui.includes('goalChip') && ui.includes('DAY ${card.streak}'));

  // The streak used to be appended to the seed line by the finalize layer.
  // It has its own line now, so what matters is that the finalize layer no
  // longer overwrites the line that carries it.
  const finalize = fs.readFileSync('src/v1-finalize.js', 'utf8');
  check('the streak is surfaced on the title and nothing overwrites it',
    ui.includes('DAY ${card.streak}') && !finalize.includes('titleStreak'));
}

// ── Phase 14: challenge links ────────────────────────────────────────────
head('CHALLENGE — the run as a URL, pure and validated');

{
  const src = fs.readFileSync('src/meta/challenge.js', 'utf8');
  check('the challenge module stays standalone (no sim/render/DOM imports)',
    !/from '\.\.\/(sim|render)\//.test(src) && !src.includes('document.') &&
    !src.includes('window.'));

  const { parseChallenge, buildChallengeLink } = await import('../src/meta/challenge.js');
  const link = buildChallengeLink('https://example.test/play', {
    seedString: '2026-08-30', mode: 'standard', difficulty: 'hard', salt: 3, goal: 2790,
  });
  const back = parseChallenge(new URL(link).search);
  check('a built link parses back to the same run coordinates',
    back && back.seedString === '2026-08-30' && back.mode === 'standard' &&
    back.difficulty === 'hard' && back.salt === 3 && back.goal === 2790,
    JSON.stringify(back));

  const defaults = parseChallenge('?draft=abc');
  check('a bare draft defaults to endless/normal, salt 1, no goal',
    defaults && defaults.mode === 'endless' && defaults.difficulty === 'normal' &&
    defaults.salt === 1 && defaults.goal === 0);
  check('a mangled link degrades instead of breaking',
    parseChallenge('?draft=abc&mode=nope&diff=wild&salt=-4&goal=x')?.salt === 1 &&
    parseChallenge('') === null && parseChallenge('?goal=99') === null &&
    parseChallenge(`?draft=${'x'.repeat(60)}`) === null);
  check('default rules round-trip to the shortest link (no noise params)',
    buildChallengeLink('b', { seedString: 's', mode: 'endless', difficulty: 'normal', salt: 1, goal: 0 })
      === 'b?draft=s');

  const main = fs.readFileSync('src/main.js', 'utf8');
  check('main pins seed, rules AND the word salt from the link',
    main.includes('parseChallenge(location.search)') &&
    main.includes('hashString(CHALLENGE.seedString)') &&
    main.includes('CHALLENGE ? CHALLENGE.salt'));
  check('the meta layer stays on the daily seed during a challenge visit',
    main.includes('metaDaily.recordRun(DAILY_SEED') &&
    !main.includes('metaDaily.recordRun(SEED'));
  check('the death card offers the link and the title shows the way home',
    main.includes('buildChallengeLink(location.origin + location.pathname') &&
    main.includes("BACK TO TODAY'S DRAFT"));
}

// ── Phase 14: the two ◆ sinks ────────────────────────────────────────────
head('ECONOMY — the balance finally spends');

{
  const T = (await import('../src/TUNING.js')).default;
  const C = T.META.CONTINUE;
  check('the continue is priced and escalates',
    C && C.BASE_COST > 0 && C.COST_GROWTH > 1 && C.OFFER_SECONDS > 0,
    `◆${C?.BASE_COST} ×${C?.COST_GROWTH}`);
  const cos = T.META.COSMETICS;
  check('cosmetics: several palettes, the default free, the rest priced',
    Array.isArray(cos) && cos.length >= 4 && cos[0].id === 'default' &&
    cos[0].cost === 0 && cos.slice(1).every((c) => c.cost > 0),
    cos.map((c) => `${c.label}:${c.cost}`).join(' '));
  // Phase 15: a cosmetic may never wear a hue the game uses to MEAN
  // something. The first cut of this list put GOLD and VIOLET exactly on
  // the streak-burst escalation hues and EMBER within 1 degree of the
  // deuteranopia danger accent; this gate is what stops the next skin
  // from doing it again.
  const hueOf = (hex) => {
    const r = ((hex >> 16) & 0xff) / 255, g = ((hex >> 8) & 0xff) / 255, b = (hex & 0xff) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d === 0) return null; // greyscale carries no hue, so it can't collide
    const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (x * 60 + 360) % 360;
  };
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  const RES = T.META.RESERVED_HUES;
  const collisions = [];
  for (const c of cos) {
    const h = hueOf(c.halo);
    if (h == null) continue;
    for (const r of RES.HUES) {
      const gap = hueGap(h, r.deg);
      if (gap < RES.MIN_SEPARATION_DEG) {
        collisions.push(`${c.label} ${gap.toFixed(0)}deg from ${r.why}`);
      }
    }
  }
  check('no cosmetic wears a hue that already means something',
    collisions.length === 0,
    collisions.join(' | ') ||
      `${cos.length} palettes clear of ${RES.HUES.length} reserved hues by >= ${RES.MIN_SEPARATION_DEG}deg`);

  // The reservation is only worth anything if it still describes the real
  // colours. Pin it to the actual escalation palette and danger accents.
  const burst = fs.readFileSync('src/render/streak-burst.js', 'utf8');
  const burstHexes = [...burst.matchAll(/0x([0-9a-f]{6})/g)].map((m) => parseInt(m[1], 16));
  const burstHues = [...new Set(burstHexes.map(hueOf).filter((h) => h != null))];
  const reserved = RES.HUES.map((r) => r.deg);
  const unreservedBurst = burstHues.filter((h) =>
    // cyan is the world's resting tone, deliberately not reserved
    hueGap(h, 195) > 12 && !reserved.some((r) => hueGap(h, r) <= 3));
  check('every earned escalation hue is actually in the reserved list',
    unreservedBurst.length === 0,
    unreservedBurst.map((h) => `${h.toFixed(0)}deg unreserved`).join(', ') ||
      `burst hues ${burstHues.map((h) => h.toFixed(0)).join('/')} accounted for`);

  const access = fs.readFileSync('src/ui/access.js', 'utf8');
  const dangerHues = [...access.matchAll(/danger:\s*0x([0-9a-f]{6})/g)]
    .map((m) => hueOf(parseInt(m[1], 16)));
  const unreservedDanger = dangerHues.filter((h) =>
    h != null && !reserved.some((r) => hueGap(h, r) <= 3));
  check('every colour-vision danger accent is in the reserved list',
    unreservedDanger.length === 0,
    unreservedDanger.map((h) => `${h.toFixed(0)}deg unreserved`).join(', ') ||
      `${dangerHues.length} danger accents accounted for`);

  const main = fs.readFileSync('src/main.js', 'utf8');
  check('the continue spends the same ledger the bells feed',
    main.includes("metaStats.increment('currency', -cost)"));
  check('a continued run never sets the best and never saves a ghost',
    main.includes('runContinued ? false : Storage.setBestFor') &&
    main.includes('if (!runContinued) {'));
  check('the revive restores hearts and pushes the Redline out, never touches the words',
    main.includes('sim.hearts = sim.maxHearts') &&
    main.includes('sim.beast.gap = TUNING.BEAST.START_GAP') &&
    !/reviveRun[\s\S]{0,900}wordGates\.reset/.test(main));
  check('the offer is a bounded window, then the card proceeds',
    main.includes('CONT.OFFER_SECONDS') && main.includes('declineContinue()'));

  const actors = fs.readFileSync('src/render/actors.js', 'utf8');
  check('the palette tints glow surfaces only — the core stays white',
    actors.includes('setPalette(') && !/setPalette[\s\S]{0,600}coreMat/.test(actors));

  const storage = fs.readFileSync('src/storage/storage.js', 'utf8');
  check('owned/equipped cosmetics persist through prefs',
    storage.includes('cosmeticsOwned') && storage.includes('equippedCosmetic'));

  const shop = fs.readFileSync('src/ui/shop.js', 'utf8');
  check('the shop refuses what the balance cannot cover',
    shop.includes('balance() >= c.cost') && shop.includes('b.disabled = !has'));
}

// ── Run-stats export (Phase 21) ─────────────────────────────────────────────
head('EXPORT — the calibration data path, hand-carried');
{
  const sample = {
    stats: { runs: 12, metres: 9800, correct: 210, wrong: 19, falseTaps: 7,
      missedReals: 12, bestChain: 14, bestDistance: 1830, currency: 46 },
    daily: { streak: 3, playedToday: true },
    run: { distance: 1204, seconds: 74.5, mode: 'endless', difficulty: 'hard',
      correct: 41, wrong: 4, falseTaps: 2, missedReals: 2, bestChain: 11,
      peakSpeed: 47.318, endSpeed: 31.2, dashMeterSpent: 214.6, heartsLeft: 0,
      bells: 9, endGap: 0.4 },
    tuning: TUNING,
    access: { reducedFlash: true, readableType: false, mode: 'deuteranopia' },
    seed: '2026-08-30', at: '2026-08-30T21:00:00.000Z',
  };
  const p = buildStatsExport(sample);

  check('the export is versioned so a pasted blob can be read later',
    p.v === EXPORT_VERSION && typeof p.v === 'number');
  check('it is pure — same input, byte-identical output',
    formatStatsExport(buildStatsExport(sample)) === formatStatsExport(p));
  check('it round-trips as JSON',
    JSON.parse(formatStatsExport(p)).lifetime.runs === 12);

  // The whole point: the numbers are unreadable without the dials that
  // produced them, and the difficulty played picks the Redline's pace.
  check('the dials in force travel with the numbers',
    p.tuning.ceiling === TUNING.RUN.CEILING && p.tuning.floor === TUNING.RUN.FLOOR &&
    p.tuning.meterMax === TUNING.BOOST.METER_MAX &&
    p.tuning.minActivate === TUNING.BOOST.MIN_ACTIVATE);
  check('the Redline pace reported is the one the run was played at',
    p.tuning.redlinePace === TUNING.MODES.DIFFICULTY.hard.REDLINE_PACE,
    `hard -> ${p.tuning.redlinePace}`);
  check('the ceiling question is answerable from the blob',
    p.run.peakSpeed === 47.3 && p.run.endSpeed === 31.2);
  check('the two failure modes stay separate, never averaged',
    p.run.falseTaps === 2 && p.run.missedReals === 2 &&
    p.lifetime.falseTaps === 7 && p.lifetime.missedReals === 12);
  check('accessibility settings travel too — they change perceived difficulty',
    p.access.reducedFlash === true && p.access.colorVision === 'deuteranopia');

  // Privacy: this is a blob a human pastes into a message. Nothing in it may
  // be free text, and no key may carry an identifier.
  const flat = formatStatsExport(p);
  check('nothing player-typed or identifying is in the blob',
    !/name|user|id"|email|uuid|token/i.test(flat), 'keys are counters, dials and settings');
  check('a run-less export (title screen) still builds',
    buildStatsExport({ stats: {}, tuning: TUNING }).run === null);

  // And the wiring: the button exists, and it reaches for the clipboard
  // before the share sheet, with no network either way.
  const html = fs.readFileSync('index.html', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  check('the results card offers the export as a footnote action',
    html.includes('id="copyStats"') && html.includes('>STATS<'));
  // Scoped to the handler: main.js does fetch once, for the screenshot's own
  // object URL, which never leaves the device either. What must be true is
  // that the export path has no transport but the clipboard and the share
  // sheet the player invokes themselves.
  const handler = main.slice(main.indexOf("copyStats?.addEventListener"),
    main.indexOf("ui.saveShot.addEventListener"));
  check('the export never leaves the device on its own',
    handler.includes('navigator.clipboard.writeText(blob)') &&
    handler.includes('navigator.share') &&
    !/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(handler),
    `${handler.length} chars of handler, no transport`);
  check('peak speed is actually recorded during a run',
    fs.readFileSync('src/sim/word-gates.js', 'utf8').includes('player.peakSpeed = player.speed') &&
    fs.readFileSync('src/sim/player.js', 'utf8').includes('this.peakSpeed = R.START_SPEED'));
}

console.log(out.join('\n'));

console.log(`\nMeta gates: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
