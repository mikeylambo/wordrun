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
import { CurveLog } from '../src/meta/curve.js';
import { DailyManager, goalsFor } from '../src/meta/daily.js';
import { buildStatsExport, formatStatsExport, EXPORT_VERSION } from '../src/meta/export.js';
import { ObjectiveQueue, queueFor, POOL, LIVE_SLOTS, rewardFor } from '../src/meta/objectives.js';
import { buildReview } from '../src/meta/review.js';
import { DEFINITIONS, defineWord } from '../src/words/definitions.js';
import { TIERS } from '../src/words/wordlist.js';
import { isBlocked } from '../src/words/family-blocklist.js';
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
  // pace and sweep collectNear the way sim.step does each step.
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
  // Phase H2: the DAILY route repairs hearts on a clean streak too. Phase H
  // measured the no-repair route as a two-commission budget nobody at 85 %
  // could finish, on any difficulty; that was never the intended bar.
  check('exactly two rule sets, and both repair a heart on a clean streak',
    Object.keys(M.RULES).length === 2 &&
    M.RULES.endless.HEART_REPAIR === true && M.RULES.standard.HEART_REPAIR === true);

  const sim = new Sim(999);
  sim.start(999, null, { mode: 'standard', difficulty: 'easy' });
  check('sim.start carries the rules and the difficulty pace',
    sim.mode === 'standard' && sim.rules.HEART_REPAIR === true && sim.rules.GATES === 100 &&
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

  // Phase 0: the heart / bell / streak-repair logic was dissolved out of the
  // old rc5.js runtime patch into sim.step() itself, so these checks point at
  // sim/sim.js now — its real home. (The refactor-snapshot gate proves the
  // relocation was behaviour-preserving; these keep the RULE legible in source.)
  const simSrc = fs.readFileSync('src/sim/sim.js', 'utf8');
  const bells = fs.readFileSync('src/design/bells.js', 'utf8');
  check('heart repair is a rule the sim reads from the mode, not a constant',
    simSrc.includes("this.rules?.HEART_REPAIR !== false"));
  // Phase 23: what repairs a heart moved off the bells and onto the verb.
  // The bell drip paid ~4.7 hearts per kilometre with no player input, so a
  // 70% run lost 23 hearts and got all 23 back — ENDLESS could not be lost
  // by misreading, which is exactly why it had no stakes.
  check('bells no longer repair hearts — they pay meter and currency only',
    !simSrc.includes('bellCharge++') && !/BELLS_PER_HEART/.test(simSrc + bells) &&
    simSrc.includes('boostMeter + HEARTS.POWER_PER_BELL'));
  check('a clean reading streak is what brings a heart back',
    simSrc.includes('this.wordGates.streak') && simSrc.includes('STREAK_REPAIR_BY_HEARTS') &&
    simSrc.includes("t: 'heart_restore'"));
  // The ladder shortens under pressure: a flat threshold put a 14x cliff
  // between a 70% reader and an 85% one, because the repair rate crosses the
  // loss rate at about 80% accuracy and nothing either side is close.
  const { HEARTS } = await import('../src/design/bells.js');
  check('and the way back is shorter the closer you are to the end',
    HEARTS.STREAK_REPAIR_BY_HEARTS[1] < HEARTS.STREAK_REPAIR_BY_HEARTS[2],
    `${HEARTS.STREAK_REPAIR_BY_HEARTS[1]} clean reads on the last heart, `
    + `${HEARTS.STREAK_REPAIR_BY_HEARTS[2]} otherwise`);

  const storage = fs.readFileSync('src/storage/storage.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  check('bests, ghosts and run counts are stored per mode/difficulty variant',
    storage.includes("vkey('score', seed)") && storage.includes("vkey('ghost', seed)") &&
    storage.includes("vkey('runs', seed)") && main.includes('syncVariant()'));
  // Phase 25: the best is a score, and it moved off the 'best' key rather
  // than changing that key's meaning — a stored 2,417 metres reading back as
  // a 2,417 score would tell a returning player they had got worse.
  check('the best score does not reuse the retired distance key',
    !storage.includes("vkey('best', seed)") && !storage.includes("'best.all'") &&
    storage.includes("'score.all'"));
  check('the legacy default keeps its keys (pre-mode bests survive)',
    storage.includes("`${type}.${seed}${VARIANT ? `.${VARIANT}` : ''}`") &&
    main.includes("? '' : `${runMode}.${effectiveDifficulty()}`"));
  check('the title exposes both choices and persists them',
    main.includes('setModePref') && main.includes('setDifficultyPref') &&
    fs.readFileSync('index.html', 'utf8').includes('id="difficultyRow"'));
}

// ── Music (Phase J): the stem engine is retired; the full track is the score ──
head('MUSIC — one score: the full track and its beat clock, no stem engine');
{
  check('the four-stem engine is gone, files and folder',
    !fs.existsSync('src/audio/stems.js') && !fs.existsSync('public/audio/stems'));
  const audioSrc = fs.readFileSync('src/audio/audio.js', 'utf8');
  check('the audio engine no longer builds or drives stems',
    !/StemMix|this\.stems|stemLevels|musicTrackLive/.test(audioSrc) &&
    !/musicTrackLive/.test(fs.readFileSync('src/main.js', 'utf8')));
  check('the full track ships and the beat clock is what the run reacts to',
    fs.existsSync('public/audio/music/into-the-night.mp3') &&
    fs.existsSync('src/music-track.js') && fs.existsSync('src/render/music-response.js') &&
    fs.readFileSync('src/main.js', 'utf8').includes('musicResponse(clock'));
  check('no dial for a stem bus survives in tuning', !/MUSIC_MAX|STEM/.test(fs.readFileSync('src/TUNING.js', 'utf8')));
}

// ── Board policy (Phase J): the rules exist before the boards do ─────────
head('BOARD POLICY — DAILY on NORMAL only, ENDLESS per difficulty, no continues');
{
  const P = TUNING.META.BOARD_POLICY;
  check('the policy is a tuning constant with the four decided rules',
    P && P.DAILY_DIFFICULTY === 'normal' && P.ENDLESS_PER_DIFFICULTY === true &&
    P.CONTINUE_ELIGIBLE === false && P.GOALS_ANY_DIFFICULTY === true);
  const main = fs.readFileSync('src/main.js', 'utf8');
  check('the DAILY chip forces the board difficulty and locks the row, with no copy',
    main.includes("runMode === 'standard' ? BOARD.DAILY_DIFFICULTY : runDifficulty") &&
    main.includes("b.classList.toggle('locked', locked)") &&
    main.includes("if (runMode === 'standard') return; // locked") &&
    fs.readFileSync('index.html', 'utf8').includes('.modeChip.locked{'));
  check('a best is recorded only when the run is board-eligible',
    main.includes("const boardEligible = !runContinued &&") &&
    main.includes("const isPb = boardEligible ? Storage.setBestFor(SEED, finalScore) : false;") &&
    main.includes("if (boardEligible) {"));
  check('the sim, the plates and the links all run the effective difficulty',
    main.includes("difficulty: effectiveDifficulty(),") &&
    main.includes("TUNING.MODES.DIFFICULTY[effectiveDifficulty()]") && !/difficulty: runDifficulty,/.test(main));
  check('daily goals still record on every difficulty',
    /metaDaily\.recordRun\(DAILY_SEED/.test(main) && !/boardEligible[\s\S]{0,200}metaDaily\.recordRun/.test(main));
}

// ── RC10.7: boards, built dark ───────────────────────────────────────────
head('BOARDS — decided, gated, and reaching nothing');
{
  const B = await import('../src/meta/boards.js');
  const POLICY = TUNING.META.BOARD_POLICY;

  // The board key IS the policy, serialised — and the policy is already law.
  {
    const daily = (d, day = '2026-09-06', continued = false) =>
      B.boardKeyFor({ mode: 'standard', difficulty: d, day, continued });
    check('the DAILY RUN records on its one board difficulty and no other',
      daily(POLICY.DAILY_DIFFICULTY) === `daily:2026-09-06:${POLICY.DAILY_DIFFICULTY}` &&
      daily('easy') === null && daily('hard') === null,
      'a challenge link can pin another difficulty; that run keeps its score, not a place');
    check('and only inside its own day, because that is what makes it comparable',
      daily(POLICY.DAILY_DIFFICULTY, 'yesterday') === null &&
      daily(POLICY.DAILY_DIFFICULTY, '') === null,
      'everyone that day read the identical hundred words and nobody else ever will');
    check('ENDLESS keeps a board per difficulty',
      B.boardKeyFor({ mode: 'endless', difficulty: 'hard' }) === 'endless:hard' &&
      B.boardKeyFor({ mode: 'endless', difficulty: 'easy' }) === 'endless:easy' &&
      POLICY.ENDLESS_PER_DIFFICULTY === true);
    check('a continued run belongs on no board at all',
      B.boardKeyFor({ mode: 'endless', difficulty: 'hard', continued: true }) === null &&
      daily(POLICY.DAILY_DIFFICULTY, '2026-09-06', true) === null &&
      POLICY.CONTINUE_ELIGIBLE === false,
      'the same rule the local best already respects, in one place');
  }

  // Names: shape only. Content is the server's job, against the family list.
  check('a name is trimmed, bounded and printable',
    B.cleanName('  Mike  ') === 'Mike' && B.cleanName('a b') === 'a b' &&
    B.cleanName('') === null && B.cleanName('   ') === null &&
    B.cleanName('x'.repeat(B.NAME.MAX + 1)) === null &&
    B.cleanName('a\u0000b') === null && B.cleanName('a\u202Eb') === null,
    'no control characters and no direction marks — nothing that rewrites its own row');

  // A submission is a claim, and it is refused here before it can be made.
  {
    const run = { mode: 'endless', difficulty: 'hard', name: 'Mike', score: 1234,
      seedString: 'S', distance: 900, gates: 14, seconds: 60 };
    const ok = B.submissionFor(run);
    check('a submission carries the evidence its score will be priced against',
      ok.board === 'endless:hard' && ok.name === 'Mike' && ok.score === 1234 &&
      ok.distance === 900 && ok.gates === 14 && ok.seconds === 60,
      'it travels so the server can CHECK it, not so the server can believe it');
    check('and no board, no name or no score means no submission',
      B.submissionFor({ ...run, name: '' }) === null &&
      B.submissionFor({ ...run, continued: true }) === null &&
      B.submissionFor({ ...run, score: -1 }) === null &&
      B.submissionFor({ ...run, score: 'lots' }) === null);
  }

  // DARK. The shipped build configures nothing, so nothing can be sent.
  {
    const dark = new B.Boards({});
    check('with no endpoint there is no board, and submitting is a no-op',
      dark.enabled === false &&
      await dark.submit({ mode: 'endless', difficulty: 'hard', name: 'Mike', score: 10 }) === null &&
      await dark.top('endless:hard') === null,
      'nothing in the shipped build sets an endpoint or a key');
    const main = fs.readFileSync('src/main.js', 'utf8');
    check('and the game constructs it dark, with the offer behind the same eligibility rule',
      main.includes('const boards = new Boards({});') &&
      main.includes('if (boardEligible && boards.enabled) {'),
      'a board is a bonus and may never be able to fail the game that fed it');
  }

  // With a transport injected it works — and a failing board is not a failure.
  {
    const sent = [];
    const fake = {
      submit: async (p) => { sent.push(p); return { ok: true }; },
      top: async () => [{ name: 'A', score: 9 }],
    };
    const live = new B.Boards({}, fake);
    const res = await live.submit({ mode: 'endless', difficulty: 'hard',
      name: 'Mike', score: 77, distance: 100, gates: 2, seconds: 10 });
    check('an injected transport is used, and only for eligible runs',
      live.enabled === true && res.ok === true && sent.length === 1 &&
      sent[0].board === 'endless:hard' &&
      await live.submit({ mode: 'endless', difficulty: 'hard', name: '', score: 1 }) === null &&
      sent.length === 1);
    const angry = new B.Boards({}, {
      submit: async () => { throw new Error('502'); },
      top: async () => { throw new Error('502'); },
    });
    check('and a board that fails returns nothing rather than throwing into the run',
      await angry.submit({ mode: 'endless', difficulty: 'hard', name: 'M', score: 1 }) === null &&
      await angry.top('endless:hard') === null && angry.error === '502');
  }

  // THE CARVE-OUT. The one module that can make a request is not in the boot
  // graph: it is reached by dynamic import from open(), and nothing else
  // mentions it at all.
  {
    const boardsSrc = fs.readFileSync('src/meta/boards.js', 'utf8');
    const transport = fs.readFileSync('src/net/board-transport.js', 'utf8');
    const srcFiles = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.js')) srcFiles.push(full);
      }
    };
    walk('src');
    const importers = srcFiles.filter((f) =>
      f !== 'src/net/board-transport.js' &&
      /^\s*import[^\n]*board-transport/m.test(fs.readFileSync(f, 'utf8')));
    check('nothing imports the transport at module scope — it is a dynamic import, alone',
      importers.length === 0 &&
      boardsSrc.includes("await import('../net/board-transport.js')") &&
      (boardsSrc.match(/board-transport/g) || []).length === 1,
      `${srcFiles.length} source files, ${importers.length} static importers`);
    // Prose does not count: sim/ghost.js has described this seam since Phase 2.
    const code = (f) => fs.readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    const SHIPPED_ASSETS = [
      'src/music-track.js',            // the score and its map
      'src/audio/high-layer.js',       // the optional layer beside it
      'src/audio/approved-assets.js',  // the sound manifest and its files
      'src/main.js',                   // the share image, as a blob it made
      'src/v1-share.js',               // likewise
    ];
    const fetchers = srcFiles.filter((f) => /\bfetch\(/.test(code(f)));
    check('and it is the only file that reaches anything but a shipped asset',
      /\bfetch\(/.test(transport) &&
      fetchers.every((f) => f === 'src/net/board-transport.js' || SHIPPED_ASSETS.includes(f)),
      `${fetchers.length} files fetch at all, and the rest read same-origin files ` +
      'that ship inside the build or blobs the page made itself');
    check('the client never inserts — the only way a row appears is the function',
      transport.includes('/rpc/submit_score') &&
      !/method: 'POST'[\s\S]{0,160}\/scores\?/.test(transport),
      'the anon key ships in the bundle and is public by construction');
  }

  // The schema is the other half, and it is written down rather than implied.
  {
    const sqlRaw = fs.readFileSync('db/schema.sql', 'utf8');
    const sql = sqlRaw.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    check('the schema grants NO write to anyone, and says so by omission',
      /alter table diction_dash\.scores enable row level security/.test(sql) &&
      /for select using \(true\)/.test(sql) &&
      !/for insert/i.test(sql) && !/for update/i.test(sql) &&
      !/grant (insert|update|delete|all)/i.test(sql),
      'their absence is the rule');
    check("the one way in is a security-definer function with the game's own bounds",
      /security definer/.test(sql) && /submit_score\(p jsonb\)/.test(sql) &&
      sql.includes('64.0 * greatest(v_seconds, 0)') && sql.includes('/ 55.0') &&
      /blocked_words/.test(sql),
      `the ${TUNING.RUN.CEILING} m/s ceiling and the ` +
      `${TUNING.WORDS.ARM_DISTANCE_M} m arm distance, as arithmetic a claim must survive`);
    check('one project, a schema per game, and no claim it cannot keep',
      /create schema if not exists diction_dash/.test(sql) &&
      /Read isolation between games is NOT claimed/.test(sqlRaw) &&
      /unique \(board, player\)/.test(sql),
      'leaderboard rows are published data; a game holding anything private gets its own project');
  }
}

// ── RC10.5: the rival travels in the link ────────────────────────────────
head('RIVAL — a challenge that is an opponent rather than a number');
{
  const GL = await import('../src/meta/ghost-link.js');
  const { GHOST_LINK } = GL;
  const { parseChallenge, buildChallengeLink, CHALLENGE_GHOST } =
    await import('../src/meta/challenge.js');

  // The alphabet, written out because btoa is DOM and Buffer is node.
  {
    let ok = true;
    for (let n = 0; n <= 12 && ok; n++) {
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = (i * 37 + n * 11) & 0xff;
      const back = GL.decodeBytes(GL.encodeBytes(bytes));
      ok = back && back.length === n && bytes.every((b, i) => back[i] === b);
    }
    // Every byte value, in one pass, so no lane of the 6-bit packing is missed.
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all[i] = i;
    const rt = GL.decodeBytes(GL.encodeBytes(all));
    check('base64url round-trips exactly, at every length and every byte',
      ok && rt.length === 256 && all.every((b, i) => rt[i] === b),
      'no padding, no DOM, no Buffer — a link is not a MIME body');
    check('and anything outside the alphabet is refused rather than guessed',
      GL.decodeBytes('abc!def') === null && GL.decodeBytes('a b') === null);
  }

  // A synthetic run, from the recorder's own format: 10 Hz quintuples,
  // accelerating from the floor toward the ceiling.
  const synth = (seconds) => {
    const s = [];
    let d = 0;
    for (let i = 0; i <= seconds * 10; i++) {
      const t = i / 10;
      const v = Math.min(TUNING.RUN.CEILING, TUNING.RUN.FLOOR + t * 0.4);
      d += v / 10;
      s.push(Math.round(t * 100), 0, 0, Math.round(d * 10), 0);
    }
    return { s, d };
  };
  {
    const { s, d } = synth(100);
    const bytes = GL.trackFromSamples(s);
    const chars = GL.encodeBytes(bytes).length;
    const rebuilt = GL.trackDistance(bytes);
    check('a 100-second run becomes a few hundred characters',
      bytes.length === 100 * GL.LINK_HZ && chars <= 280,
      `${s.length / 5} samples -> ${bytes.length} bytes -> ${chars} characters`);
    check('and the distance survives the squeeze',
      Math.abs(rebuilt - d) / d < 0.005,
      `${d.toFixed(0)}m recorded, ${rebuilt}m rebuilt — ` +
      `${(100 * Math.abs(rebuilt - d) / d).toFixed(3)}% off`);
  }

  // The cap. A ten-minute run must not produce a link nobody can send.
  {
    const { s } = synth(600);
    const bytes = GL.trackFromSamples(s);
    const chars = GL.encodeBytes(bytes).length;
    check('a very long run is truncated, never dropped and never unbounded',
      bytes.length === GL.LINK_MAX_SAMPLES && chars <= GHOST_LINK.MAX_CHARS &&
      chars <= CHALLENGE_GHOST.MAX_CHARS,
      `600s of running -> ${chars} characters, cap ${CHALLENGE_GHOST.MAX_CHARS} ` +
      `(the rival simply stops being ahead of you at ${GL.LINK_MAX_SECONDS}s)`);
    // And the ceiling fits in a byte, which is why one byte is enough.
    check('the speed byte covers the whole lived band, with room above it',
      255 * GL.LINK_SPEED_STEP > TUNING.RUN.CEILING &&
      GL.LINK_SPEED_STEP < 0.5,
      `0..${(255 * GL.LINK_SPEED_STEP).toFixed(2)} m/s against a ${TUNING.RUN.CEILING} ceiling, ` +
      `${(GL.LINK_SPEED_STEP * 100 / GL.LINK_HZ).toFixed(0)} cm of position per step`);
    // A wire format may not be derived from a dial: links outlive tuning.
    check('and the format is written down, not computed from the tuning',
      !/LINK_SPEED_STEP\s*=\s*[^;]*TUNING/.test(fs.readFileSync('src/meta/ghost-link.js', 'utf8')),
      'a moved ceiling would silently re-scale every rival already out in the world');
  }

  // Rebuilding: the receiver integrates against THEIR road, and the road is
  // the same road because the seed authored it.
  {
    const { s, d } = synth(40);
    const bytes = GL.trackFromSamples(s);
    const asked = [];
    const ghost = GL.expandTrack(bytes, (dd) => { asked.push(dd); return { x: dd * 0.01, y: 3 }; });
    const STRIDE = 5;
    const n = ghost.s.length / STRIDE;
    let monotonic = true, lastD = -1, lastT = -1;
    for (let i = 0; i < n; i++) {
      const t = ghost.s[i * STRIDE], dv = ghost.s[i * STRIDE + 3];
      if (dv < lastD || t <= lastT) monotonic = false;
      lastD = dv; lastT = t;
    }
    check('the rebuilt ghost is a real ghost: rising time, rising distance, no gaps',
      n === bytes.length + 1 && monotonic && ghost.v === 1 && ghost.hz === GL.LINK_HZ &&
      Math.abs(ghost.distance - d) / d < 0.01,
      `${n} samples, ${ghost.distance}m against ${d.toFixed(0)}m run`);
    check('and x and y come from the RECEIVER\'s terrain, never from the link',
      asked.length === n && ghost.s[1] === 0 && ghost.s[2] === 30 &&
      !/[xy]\s*:/.test(GL.encodeBytes(bytes)),
      'the track is auto-followed, so lateral and height are functions of distance');
  }

  // The link itself.
  {
    const { s } = synth(60);
    const ghost = GL.encodeBytes(GL.trackFromSamples(s));
    const link = buildChallengeLink('https://x/', {
      seedString: 'ABC', mode: 'endless', difficulty: 'hard', salt: 3, goal: 12345, bar: 2, ghost,
    });
    const back = parseChallenge(new URL(link).search);
    check('the rival survives the round trip with the coordinates',
      back.ghost === ghost && back.goal === 12345 && back.bar === 2 &&
      back.difficulty === 'hard' && back.salt === 3,
      `${link.length} characters end to end`);
    check('a malformed or over-long rival is dropped, and the challenge still opens',
      parseChallenge(`?draft=A&g=${'x'.repeat(CHALLENGE_GHOST.MAX_CHARS + 1)}`).ghost === null &&
      parseChallenge('?draft=A&g=has spaces').ghost === null &&
      parseChallenge('?draft=A&g=%21%21%21').ghost === null &&
      parseChallenge('?draft=A&score=99').goal === 99,
      'a link that cannot carry the rival is still a perfectly good challenge');
    check('and the rival is the LAST key, so a truncated link loses it first',
      link.indexOf('g=') > link.indexOf('score=') && link.indexOf('g=') > link.indexOf('draft='),
      'a chat client that cuts the tail takes the opponent, not the road');
  }

  // Wiring, and the one rule about which ghost a player gets.
  {
    const main = fs.readFileSync('src/main.js', 'utf8');
    const gl = fs.readFileSync('src/meta/ghost-link.js', 'utf8');
    check('a challenge rival beats the local best, and BEST RUN off beats both',
      main.includes('function ghostForRun()') &&
      main.includes('if (!ghostEnabled) return null;') &&
      main.indexOf('CHALLENGE?.ghost') < main.indexOf('return Storage.loadGhost(SEED);') &&
      main.includes('const ghostData = ghostForRun();'),
      'the rival is why the link was opened; the switch is about ghosts, not about whose');
    check('the run just played travels with the link it builds',
      main.includes('lastRunGhost = encodeBytes(trackFromSamples(sim.recorder.samples));') &&
      main.includes('ghost: lastRunGhost,'),
      'the recorder already had the samples — this only resamples them small');
    check('nothing about the rival reaches the network',
      !/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(gl) &&
      !/import .*storage/i.test(gl),
      'the link IS the data, exactly as it was before a rival rode in it');
  }
}

// ── RC10.3: the words you have actually learned ──────────────────────────
head('MASTERY — the ledger\'s work, finally visible and honestly counted');
{
  const { MasteryLedger } = await import('../src/meta/mastery.js');
  const { NemesisLedger } = await import('../src/meta/nemesis.js');

  const mem = () => { const m = {}; return { get: (k) => m[k], set: (k, v) => { m[k] = v; } }; };

  // The definition, driven end to end against the REAL nemesis ledger: a word
  // counts once it is read right and not owed a repeat; missing it takes it
  // back; beating it through the ledger's three clean reads returns it.
  {
    const store = mem();
    const nem = new NemesisLedger(store);
    const mas = new MasteryLedger(store, (w) => (nem.history(w)?.m || 0) > 0);
    nem.record('receive', true, 0);
    check('a clean word is learned on the first correct read',
      mas.mark('receive') === true && mas.count === 1 && mas.has('receive'));
    check('and it is only NEW once — the same word never counts twice',
      mas.mark('receive') === false && mas.count === 1);

    nem.record('receive', false, 1);      // missed: the ledger now owes it
    mas.unmark('receive');
    check('missing it takes it back — a word being practised is not a word learned',
      mas.count === 0 && !mas.has('receive'));
    check('and it cannot be re-learned while the ledger is still owed it',
      mas.mark('receive') === false && mas.count === 0,
      'the two systems agree by construction: one owns "practising", one owns "done"');

    // Three clean reads retire it, and the third one is also the read that
    // earns it back — which is why main.js marks AFTER recording.
    nem.record('receive', true, 2);
    nem.record('receive', true, 3);
    const outcome = nem.record('receive', true, 4);
    check('the read that retires a word is the read that learns it',
      outcome === 'retired' && !nem.history('receive') &&
      mas.mark('receive') === true && mas.count === 1);
  }

  // It survives storage, and it is bounded by the bank rather than by time.
  {
    const store = mem();
    const a = new MasteryLedger(store);
    for (const w of ['alpha', 'beta', 'gamma']) a.mark(w);
    const b = new MasteryLedger(store);
    check('the ledger survives a round-trip through the same adapter seam',
      b.count === 3 && b.has('beta') && b.words().join(',') === 'alpha,beta,gamma');
    check('and it stores WORDS, not positions in a list this game appends to',
      typeof store.get('mastery').words === 'string' &&
      !/\d/.test(store.get('mastery').words),
      'RC9.6 put 103 words into the middle of four tiers; an index would have moved under them');
  }

  // The per-tier readout the profile draws.
  {
    const store = mem();
    const m = new MasteryLedger(store);
    m.mark('one'); m.mark('two'); m.mark('four');
    const tiers = m.byTier([['one', 'two', 'three'], ['four', 'five']]);
    check('the tier breakdown counts only what is in each tier',
      tiers[0].known === 2 && tiers[0].total === 3 &&
      tiers[1].known === 1 && tiers[1].total === 2);
  }

  // The number is honest about the player it is describing: a run that never
  // misses still learns, which `retiredCount` could never say.
  {
    const store = mem();
    const nem = new NemesisLedger(store);
    const mas = new MasteryLedger(store, (w) => (nem.history(w)?.m || 0) > 0);
    for (const w of ['alpha', 'beta', 'gamma', 'delta']) { nem.record(w, true, 0); mas.mark(w); }
    check('a player who never misses has still learned something',
      nem.retiredCount === 0 && mas.count === 4,
      'retiredCount only counts words you got WRONG first — the better you read, the smaller it gets');
  }

  // Wiring: one hook each way, and the surfaces that show it.
  {
    const main = fs.readFileSync('src/main.js', 'utf8');
    const ui = fs.readFileSync('src/ui/ui.js', 'utf8');
    const curve = fs.readFileSync('src/ui/curve-screen.js', 'utf8');
    const html = fs.readFileSync('index.html', 'utf8');
    check('a correct read marks AFTER the nemesis ledger records, a wrong read unmarks',
      main.includes('const outcome = nemesis.record(e.answer, true, e.index);') &&
      main.includes('if (mastery.mark(e.answer)) learnedWords++;') &&
      main.includes('mastery.unmark(e.answer);') &&
      main.indexOf('const outcome = nemesis.record') < main.indexOf('mastery.mark(e.answer)'),
      'a word retiring on THIS read stops being owed on it, and is learned on it too');
    check('the title carries the number, and says nothing until there is something to say',
      ui.includes('setMastery(count = 0)') && ui.includes('WORDS LEARNED') &&
      html.includes('id="titleMastery"') && html.includes('#titleMastery:empty{display:none}') &&
      main.includes('ui.setMastery(mastery.count);'),
      'silent on a fresh profile, refreshed on the way back from a run');
    check('PROFILE carries what the number is made of, tier by tier',
      curve.includes('WORDS LEARNED') && curve.includes('mastery.tiers.map') &&
      main.includes('mastery: { total: mastery.count, tiers: mastery.byTier(TIERS) }'),
      '"412 of 10,556" is a fraction nobody can feel; a tier is a shelf filling up');
    check('and the results card reports only a run that actually taught something',
      ui.includes("core.push(row('LEARNED', `+${extras.learnedWords}`))") &&
      ui.includes('extras.learnedWords > 0') && main.includes('learnedWords = 0;'),
      'an ordinary run says nothing, exactly as the standout does');
  }
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
  const rowUi = fs.readFileSync('src/ui/review-row.js', 'utf8');
  check('the review panel teaches the real spelling on a tapped fake',
    ui.includes('_missedRow(x.answer, x.shown,') && rowUi.includes('<s class="mFake">'));
  // Phase 19 compressed the sentence into the row's label. RC9.1 removed the
  // label too: a row with no struck spelling IS the omission, and the panel
  // no longer needs a heading to say so. The gentle framing is what the gate
  // was really protecting, and that is what it checks now.
  check('an omission is explained without crash language',
    rowUi.includes('slipped past has no fake to contrast') &&
    !/\b(FAILED|WRONG|BAD|MISTAKE)\b/.test(ui + rowUi));
  // RC6: the goals themselves are a checklist in PROFILE; the title keeps
  // only the streak line, which is the one thing a player loses by not playing.
  check('the streak is on the title and the goals are in PROFILE',
    ui.includes('setDaily(') && ui.includes('DAY ${card.streak}') &&
    fs.readFileSync('src/ui/curve-screen.js', 'utf8').includes('goalChip'));

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
  // RC9.2: the link stopped being a button of its own and became half of
  // SHARE, so main publishes the coordinates and v1-share.js performs the act.
  check('the death card offers the link and the title shows the way home',
    main.includes('globalThis.__DASH_CHALLENGE_LINK = () => buildChallengeLink(') &&
    main.includes('BACK TO DAILY RUN') &&
    fs.readFileSync('src/v1-share.js', 'utf8').includes('__DASH_CHALLENGE_LINK?.()'));

  // ── RC9.2: the loop, end to end ────────────────────────────────────────
  // The link carries the bar now, because two runs at different compression
  // levels are not the same dare — the bar moves both the reward line and
  // what counts as an early read.
  const withBar = parseChallenge(new URL(buildChallengeLink('https://e.test/p', {
    seedString: 'r9', mode: 'endless', difficulty: 'normal', salt: 1, goal: 8811, bar: 2,
  })).search);
  check('the link carries the compression bar, and clamps it to the real levels',
    withBar?.bar === 2 && parseChallenge('?draft=a')?.bar === 0 &&
    parseChallenge('?draft=a&bar=99')?.bar === TUNING.WORDS.COMPRESSION_MULT.length - 1 &&
    parseChallenge('?draft=a&bar=-5')?.bar === 0,
    `bar 0..${TUNING.WORDS.COMPRESSION_MULT.length - 1}, read from the tuning that defines them`);
  check('and a challenge run STARTS on that bar without being locked to it',
    main.includes('if (CHALLENGE) sim.player.compressionLevel = CHALLENGE.bar | 0;') &&
    !/CHALLENGE[^\n]*raiseBar|raiseBar[^\n]*CHALLENGE/.test(main),
    'the hold that moves the bar is untouched — a link is a coordinate, not a rule');

  // THE round trip that matters: the link has to reproduce the ROUTE, not
  // merely the query string. Play a run, encode it, decode it, and drive a
  // second sim from the decoded coordinates — every word, every fake and
  // every gate distance has to match, or the dare is not the same road.
  {
    const { Sim, PHASE, emptyInput } = await import('../src/sim/sim.js');
    const { hashString } = await import('../src/sim/rng.js');
    const route = (seedString, opts) => {
      const seed = hashString(seedString);
      const sim = new Sim(seed);
      sim.start(seed, null, opts);
      const input = emptyInput();
      const seen = [];
      for (let i = 0; i < 60 * 240 && sim.phase === PHASE.RUNNING && seen.length < 60; i++) {
        const g = sim.wordGates.current();
        if (g && !g.resolved && sim.wordGates.armed(sim.player.d)) {
          if (seen.length === 0 || seen[seen.length - 1].i !== g.index) {
            // The gate as the player meets it: which spelling is on the
            // plate, which word it is really, whether it is real, and where
            // it sits on the road.
            seen.push({
              i: g.index, s: g.shown, a: g.answer, t: g.tier,
              r: g.real, f: g.family, d: Math.round(g.d * 1000),
            });
          }
          input.confirm = !!g.real;
          input.reject = !g.real;
        } else { input.confirm = false; input.reject = false; }
        sim.step(input);
      }
      return JSON.stringify(seen);
    };
    const coords = {
      seedString: '2026-09-06', mode: 'standard', difficulty: 'hard', salt: 5, goal: 40100, bar: 1,
    };
    const decoded = parseChallenge(
      new URL(buildChallengeLink('https://e.test/p', coords)).search);
    const before = route(coords.seedString,
      { mode: coords.mode, difficulty: coords.difficulty, wordSalt: coords.salt });
    const after = route(decoded.seedString,
      { mode: decoded.mode, difficulty: decoded.difficulty, wordSalt: decoded.salt });
    check('a link round-trips a BYTE-IDENTICAL route, not just its query string',
      before === after && before.length > 200,
      `${JSON.parse(before).length} gates — word, fake, real/fake and arm distance all identical`);
    // And changing ONE coordinate must NOT reproduce it, or the check above
    // is measuring nothing. Both of the coordinates that author a route: the
    // seed names the road, the salt picks the gauntlet of words on it.
    const otherSeed = route('2026-09-07',
      { mode: coords.mode, difficulty: coords.difficulty, wordSalt: coords.salt });
    const otherSalt = route(coords.seedString,
      { mode: coords.mode, difficulty: coords.difficulty, wordSalt: coords.salt + 1 });
    check('and a different seed or salt is a different gauntlet',
      otherSeed !== before && otherSalt !== before,
      'the round-trip check is measuring the route, not the loop');
  }

  // The HUD figure is a challenge-run thing and nothing else.
  const uiSrc = fs.readFileSync('src/ui/ui.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  check('the score to beat appears on a challenge run and nowhere else',
    /const goal = this\._challenge\?\.goal \| 0;/.test(uiSrc) &&
    /const show = goal > 0 && running;/.test(uiSrc) &&
    html.includes('#distTarget{display:none') && html.includes('#distTarget.on{display:block}') &&
    /this\.distTarget\?\.classList\.remove\('on', 'passed'\)/.test(uiSrc),
    'no challenge, no goal, or no run in progress — the row is display:none and carries no text');
  check('and it turns the semantic right-read colour the moment it is passed',
    /const passed = sc > goal;/.test(uiSrc) &&
    html.includes('#distTarget.passed{color:var(--sem-right'),
    'the same pair the review marks with, so it reads in every colour-vision mode');

  // The title's caption has ONE owner. Three other files used to re-assert it
  // — a runtime patch on UI.prototype.setSeed, v1-finalize's consolidation
  // pass, and the endgame sky's per-frame sync — and between them they kept
  // overwriting ui.setSeed's own line with copy that still said metres for a
  // figure that has been a score since Phase 25. That is the exact failure
  // mode CLAUDE.md's one-file rule exists to prevent, so it is gated.
  const owners = ['src/v1-finalize.js', 'src/rc97-endgame.js', 'src/render/endgame-sky.js']
    .filter((f) => /titleHint[^\n]*textContent\s*=|textContent = globalThis\.__CHALLENGE/
      .test(fs.readFileSync(f, 'utf8')));
  check('the title caption is written in exactly one file',
    owners.length === 0 && /this\.titleHint\.textContent = '';/.test(uiSrc),
    owners.length ? `${owners.join(', ')} still write it` : 'ui/ui.js setSeed, and nothing else');
  check('and no file patches UI.prototype.setSeed at runtime to re-assert it',
    !fs.readFileSync('src/rc97-endgame.js', 'utf8').includes('UI.prototype.setSeed ='),
    'the patch existed only to overwrite the line it was fighting');

  // ── RC9.4: the DAILY explained, and a demo with something to say ───────
  check('the DAILY RUN says what it is, once, in three facts',
    /\$\{gates\} WORDS · SAME FOR EVERYONE · NEW EACH DAY/.test(uiSrc) &&
    /gates: TUNING\.MODES\.RULES\.standard\.GATES/.test(main),
    `${TUNING.MODES.RULES.standard.GATES} WORDS — read from the rules, so a route of another length cannot leave the copy lying`);
  check('and only while the chip is selected, and only until one is finished',
    /const show = selected && !learned && gates > 0;/.test(uiSrc) &&
    /selected: runMode === 'standard'/.test(main) &&
    /learned: metaStats\.get\('usedDaily', 0\) > 0/.test(main) &&
    /if \(runMode === 'standard'\) learn\('Daily'\);/.test(main),
    'persisted on the same ledger as every other lesson, and retired by the action it describes');
  check('the note is retired by a FINISHED daily run, not by starting one',
    main.indexOf("if (runMode === 'standard') learn('Daily');") >
      main.indexOf('metaDaily.recordRun(DAILY_SEED'),
    'a run abandoned on the title has not taught anybody what the mode is');

  // The attract caption: two states, and every figure already on the card.
  check('the attract loop says what today\'s route is worth, or that it is unrun',
    /DAILY · YOUR BEST \$\{Math\.floor\(best\)\.toLocaleString\('en-US'\)\}/.test(uiSrc) &&
    uiSrc.includes("'DAILY · NOT YET RUN'") &&
    /· DAY \$\{streak\}/.test(uiSrc),
    'DAILY · YOUR BEST 404,815 · DAY 4, or DAILY · NOT YET RUN — no third state');
  check('and both figures come from the daily card, not from new bookkeeping',
    /best: dailyBest\(\), streak: metaDaily\.status\(DAILY_SEED\)\.streak/.test(main) &&
    /function dailyBest\(\)[\s\S]{0,420}Storage\.setVariant\(held\)/.test(main),
    'and dailyBest borrows the DAILY variant for the read and puts the player\'s back');
  check('the caption is only up while the demo is',
    /ui\.setAttractLine\(attract\.active/.test(main) &&
    main.includes('if (attract.active) { attract.exit(); return; }'),
    'any touch and any key still end the loop, exactly as before');
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
    main.includes('const boardEligible = !runContinued &&') &&
    main.includes('const isPb = boardEligible ? Storage.setBestFor(SEED, finalScore) : false;') &&
    main.includes('if (boardEligible) {'));
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


// ── Rotating objective queue (Phase 21) ─────────────────────────────────────
head('OBJECTIVES — three live, drawn from a pool, no retroactive credit');
{
  const MONSTER = {
    distance: 12000, wrong: 0, falseTaps: 0, correct: 200, bestChain: 40,
    bells: 300, streak: 40, dashMeterSpent: 2000,
  };

  check('the pool is bigger than the live window', POOL.length > LIVE_SLOTS,
    `${POOL.length} shapes, ${LIVE_SLOTS} live`);
  check('every shape declares a rising ladder',
    POOL.every((p) => p.steps.length > 1 &&
      p.steps.every((t, i) => i === 0 || t > p.steps[i - 1])));
  check('every shape reads only from the run result the game already tracks',
    POOL.every((p) => typeof p.met === 'function' && typeof p.progress === 'function'));

  const q = queueFor(12345);
  check('the queue is pure from the seed — same seed, same list',
    JSON.stringify(queueFor(12345)) === JSON.stringify(q));
  check('two players do not walk an identical list',
    JSON.stringify(queueFor(999)) !== JSON.stringify(q));
  check('it ramps rung by rung across the pool, not shape by shape',
    q.slice(0, POOL.length).every((e) => e.rung === 0) &&
    new Set(q.slice(0, POOL.length).map((e) => e.id)).size === POOL.length,
    `${q.length} objectives deep`);

  // THE point of the design. One monster run may clear the three live
  // objectives and NOTHING else — the replacements it draws are untouched
  // by it, however far past their targets that run went.
  const a = memoryAdapter();
  const oq = new ObjectiveQueue(a, { seed: 12345 });
  check('exactly three are live', oq.status().live.length === LIVE_SLOTS);
  const first = oq.recordRun(MONSTER);
  check('a monster run clears the live three and no more',
    first.cleared.length === LIVE_SLOTS && first.clearedTotal === LIVE_SLOTS,
    first.cleared.map((c) => c.label).join(', '));
  check('the objectives it drew get no credit for the run that drew them',
    first.live.length === LIVE_SLOTS && first.live.every((l) => l.fresh) &&
    first.live.every((l) => l.progress === 0),
    first.live.map((l) => l.label).join(', '));

  // And the ratchet: the same run again clears only what is live and
  // achievable now, so progression cannot be front-loaded.
  const second = oq.recordRun(MONSTER);
  check('running it again clears only the newly live ones',
    second.clearedTotal <= LIVE_SLOTS * 2 && second.clearedTotal > LIVE_SLOTS,
    `${second.clearedTotal} cleared over two identical monster runs`);

  // A weak run clears nothing but must still report honest progress.
  const b = memoryAdapter();
  const oq2 = new ObjectiveQueue(b, { seed: 12345 });
  const weak = oq2.recordRun({ distance: 400, wrong: 2, falseTaps: 1, correct: 12,
    bestChain: 4, bells: 8, streak: 1, dashMeterSpent: 40 });
  check('a run that clears nothing still shows what it moved',
    weak.cleared.length === 0 && weak.live.some((l) => l.progress > 0) &&
    weak.live.every((l) => !l.fresh));
  check('a broken condition reads as zero progress, not partial',
    weak.live.filter((l) => /CLEAN|NO FAKES/.test(l.label)).every((l) => l.progress === 0),
    'a wrong read zeroes a clean objective rather than part-filling it');

  check('state persists through the adapter', (() => {
    const reload = new ObjectiveQueue(b);
    return JSON.stringify(reload.status().live.map((l) => l.label))
      === JSON.stringify(oq2.status().live.map((l) => l.label));
  })());
  check('the queue seed is per player and never reshuffles underneath them',
    b._db.objectives.seed === 12345 && new ObjectiveQueue(b).state.seed === 12345);

  // Rewards feed the leaderboard's credibility rather than undermining it.
  check('rewards are currency only and rise with depth',
    rewardFor(0) > 0 && rewardFor(30) > rewardFor(0) &&
    !/speed|heart|ceiling|multiplier/i.test(
      fs.readFileSync('src/meta/objectives.js', 'utf8').split('export function rewardFor')[1].slice(0, 200)));
  const mainSrc = fs.readFileSync('src/main.js', 'utf8');
  check('the run pays the reward into the same balance the bells feed',
    mainSrc.includes("metaStats.increment('currency', objectives.reward)"));
  check('the objectives are judged on the run that just ended, once',
    (mainSrc.match(/metaObjectives\.recordRun\(/g) || []).length === 1);
  // RC6: the queue is read in PROFILE now, between runs — the results card
  // is the high-score moment and carries no progression ledger.
  check('PROFILE shows the queue',
    fs.readFileSync('src/ui/curve-screen.js', 'utf8').includes("'<div class=\"cHead\">OBJECTIVES</div>'") &&
    fs.readFileSync('index.html', 'utf8').includes('.objRow'));

  // Standalone, like the word list: liftable into the next game whole.
  const objSrc = fs.readFileSync('src/meta/objectives.js', 'utf8');
  check('the module stays standalone — no sim, render or three imports',
    !/from '\.\.\/(sim|render)\//.test(objSrc) && !/from 'three'/.test(objSrc));
}


// ── Replay review (Phase 21) ────────────────────────────────────────────────
head('REVIEW — the run as a shape, from data already recorded');
{
  // A ghost track: 60 s at a steady 20 m/s, then 60 s at 40 m/s. Format v1
  // quintuples, exactly as GhostRecorder writes them.
  const samples = [];
  let d = 0;
  for (let i = 0; i <= 240; i++) {          // 4 Hz for 60 s
    samples.push(i * 25, 0, 0, Math.round(d * 10), 0);
    d += 20 / 4;
  }
  for (let i = 1; i <= 240; i++) {
    samples.push(6000 + i * 25, 0, 0, Math.round(d * 10), 0);
    d += 40 / 4;
  }
  const misses = [
    { d: 200, reason: 'picked_fake', shown: 'ablo', answer: 'able' },
    { d: 260, reason: 'picked_fake', shown: 'yyear', answer: 'year' },
    { d: 300, reason: 'missed_real', shown: 'pellet', answer: 'pellet' },
    { d: 3000, reason: 'missed_real', shown: 'ridge', answer: 'ridge' },
  ];
  const r = buildReview({ samples, misses });

  check('the speed curve is recovered from the ghost track alone',
    Math.abs(r.peak - 40) < 1.5, `peak ${r.peak} m/s against a true 40`);
  check('the curve spans the whole run and rises where the run did',
    r.bins.length > 10 && r.bins[0].speed < r.bins[r.bins.length - 1].speed,
    `${r.bins[0].speed} -> ${r.bins[r.bins.length - 1].speed} m/s`);
  check('distance and duration come out of the samples, not a caller',
    Math.abs(r.distance - d + 10) < 20 && Math.abs(r.seconds - 120) < 1,
    `${Math.round(r.distance)} m in ${r.seconds}s`);
  check('every mistake is placed where it happened',
    r.marks.length === 4 && r.marks[0].d === 200 &&
    r.marks[0].kind === 'fake' && r.marks[2].kind === 'real');
  check('the two mistake kinds stay distinguishable on the plot',
    new Set(r.marks.map((m) => m.kind)).size === 2);

  // The claim the chart makes has to be one the data supports.
  check('a real cluster is named as the worst stretch',
    r.worst && r.worst.count === 3 && r.worst.from === 200 && r.worst.to === 300,
    `${r.worst?.from}-${r.worst?.to} M, ${r.worst?.count} missed`);
  check('scattered mistakes are NOT called a stretch',
    buildReview({ samples, misses: [
      { d: 100, reason: 'picked_fake' }, { d: 1500, reason: 'picked_fake' },
      { d: 3000, reason: 'missed_real' },
    ] }).worst === null, 'three misses 1.5 km apart is not a cluster');

  check('a run too short to plot degrades to nothing, not to a crash',
    buildReview({ samples: [0, 0, 0, 0, 0], misses }).bins.length === 0 &&
    buildReview({}).peak === 0);
  check('a mistake with no recorded distance is dropped from the plot, not guessed',
    buildReview({ samples, misses: [{ reason: 'picked_fake', shown: 'x' }] }).marks.length === 0);
  check('it is pure — same samples, same plot',
    JSON.stringify(buildReview({ samples, misses })) === JSON.stringify(r));

  // No new data collection: the recorder was already sampling for the ghost,
  // and the miss record already existed. The only addition is where.
  const wgSrc = fs.readFileSync('src/sim/word-gates.js', 'utf8');
  check('the miss record carries where it happened',
    wgSrc.includes('d: g.d, index: g.index'));
  const mainSrc2 = fs.readFileSync('src/main.js', 'utf8');
  check('the review reads the recorder the ghost already fills',
    mainSrc2.includes('buildReview({ samples: sim.recorder.samples, misses: wg.misses })'));
  const reviewSrc = fs.readFileSync('src/meta/review.js', 'utf8');
  check('the review module stays standalone and collects nothing itself',
    !/from '\.\.\/(sim|render)\//.test(reviewSrc) && !/localStorage|fetch\(/.test(reviewSrc));
  check('the results card draws it',
    fs.readFileSync('src/ui/ui.js', 'utf8').includes("'<div class=\"recapHead\">THE RUN</div>'") &&
    fs.readFileSync('index.html', 'utf8').includes('.runPlot'));
}


// ── Definitions + the FINISH payoff (Phase 21) ───────────────────────────
head('DEFINITIONS — what the word actually means');
{
  const bank = TIERS.flat();
  const covered = bank.filter((w) => defineWord(w));
  const pct = (covered.length / bank.length) * 100;
  check('nearly the whole bank can be explained', pct >= 95,
    `${covered.length}/${bank.length} — ${pct.toFixed(1)}%`);

  // A definition is a plate-sized line on a card read in two seconds. A
  // paragraph is not a definition here even when it is one in a dictionary.
  const longest = Math.max(...covered.map((w) => defineWord(w).length));
  check('every definition fits a results-card line', longest <= 80, `longest ${longest} chars`);
  const withExample = covered.filter((w) => /"|;/.test(defineWord(w)));
  check('usage examples and second clauses are cut, not shipped',
    withExample.length === 0, withExample.slice(0, 3).join(', ') || 'first clause only');
  const domainMarked = covered.filter((w) => /^\(/.test(defineWord(w)));
  check('domain markers are stripped from the front',
    domainMarked.length === 0, domainMarked.slice(0, 3).join(', ') || 'no leading parentheticals');

  // Definitions are player-facing copy and clear the same bar the words do.
  const dirty = covered.filter((w) => {
    const d = defineWord(w);
    return isBlocked(d) || d.split(/[^a-z]+/).some((t) => t && isBlocked(t));
  });
  check('every shipped definition clears the family blocklist',
    dirty.length === 0, dirty.slice(0, 4).join(', ') || `${covered.length} definitions clean`);

  check('an unknown word answers null rather than guessing',
    defineWord('zzzznotaword') === null && defineWord('') === null &&
    defineWord(undefined) === null);
  check('lookup is case-forgiving so no UI plumbing can miss',
    defineWord('ABLE') === defineWord('able') && defineWord('able') !== null);

  // Offline, like everything else. The data is bundled at build time.
  const defSrc = fs.readFileSync('src/words/definitions.js', 'utf8');
  check('the data ships with the build, never fetched',
    !/fetch\(|import\(|XMLHttpRequest/.test(defSrc) && defSrc.includes('export const DEFINITIONS'));
  check('the source it is redistributed from is credited and licensed',
    defSrc.includes('Princeton University') && fs.existsSync('public/WORDNET-LICENSE.txt'));
  check('the generator is a devDependency, never a runtime one', (() => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return !!pkg.devDependencies?.['wordnet-db'] && !pkg.dependencies?.['wordnet-db'];
  })());

  // The teaching moment: a tapped fake teaches the TRUE word, not the
  // misspelling that caught the player out.
  const uiSrc2 = fs.readFileSync('src/ui/ui.js', 'utf8');
  // Phase 24: the definitions moved with the missed words, into the review
  // panel. A tapped fake is still taught by its TRUE spelling — the panel
  // is passed `x.answer` as the word and `x.shown` as the strikethrough —
  // and the panel has room for all of them rather than the card's two.
  check('the review teaches the true word, not the fake',
    uiSrc2.includes('_missedRow(x.answer, x.shown,') &&
    fs.readFileSync('src/ui/review-row.js', 'utf8').includes('defineWord(real)'));
  check('and is not capped at two, now that it has a screen of its own',
    uiSrc2.includes('for (const x of m.tapped)') && uiSrc2.includes('for (const x of m.slipped)'));
}

head('FINISH — the 30 km end is a title card, not a dialog');
{
  const sky = fs.readFileSync('src/render/endgame-sky.js', 'utf8');
  const endgame = fs.readFileSync('src/design/endgame.js', 'utf8');

  // It used to say 50 KM against a 30 km finish, hard-coded. The card now
  // reports the distance actually run.
  check('the distance shown is the one that was run, not a literal',
    !sky.includes('50 KM') && sky.includes('run.distance ?? ENDGAME.ESCAPE_DISTANCE') &&
    endgame.includes('ESCAPE_DISTANCE: 30000'));
  check('the run\'s own numbers are on it',
    sky.includes('READS') && sky.includes('% TRUE') && sky.includes('run.bestChain'));
  check('a missing number is left off rather than shown as zero',
    sky.includes('if (read > 0)') && sky.includes('if (run.bestChain > 0)'));

  check('the name carries the wordmark\'s chromatic echo',
    sky.includes('class="e1"') && sky.includes('class="e2"') && sky.includes('class="e3"') &&
    sky.includes('#67d8ff') && sky.includes('#ff2a1f'));
  check('it is set in the UI face, not the terminal one',
    /#rc97Ending[^`]*var\(--face\)/.test(sky) && !/#rc97Ending[^`]*ui-monospace/.test(sky));

  // Motion is an accessibility surface, and REDUCED FLASH may not cost a
  // player any of the words.
  check('REDUCED FLASH drops the motion and keeps every word',
    sky.includes("classList.toggle('calm', !!ACCESS.reducedFlash)") &&
    sky.includes('#rc97Ending.calm .mark'));
  check('the OS reduced-motion preference is honoured too',
    sky.includes('prefers-reduced-motion:reduce'));
  check('the card is fed from the run that reached it',
    sky.includes('this.ending.show({') && sky.includes('bestChain: sim.player?.bestChain'));
}


// ── Score (Phase 25) ────────────────────────────────────────────────────────
head('SCORE — how well you ran, not how long');
{
  const S = TUNING.SCORE;
  // Phase D retired the metre term entirely. A read is now the only thing
  // that scores, and the chain still multiplies it.
  check('only a read scores, and the chain still multiplies it',
    !('PER_METRE' in S) && S.PER_READ > 0 && Array.isArray(S.TIER_MULT));

  // The whole claim: the same distance is worth more when it is run well.
  // Two sims over identical ground, one holding a chain and one not.
  const runScore = (answerAll) => {
    const sim = new Sim(4242);
    globalThis.__SIM = sim;
    sim.start(4242);
    const input = emptyInput();
    let decided = -1, f = 0;
    while (sim.phase === PHASE.RUNNING && sim.player.d < 900 && f < 60 * 120) {
      const g = sim.wordGates.current();
      input.confirm = false;
      if (answerAll && g && g.index !== decided &&
          sim.wordGates.armed(sim.player.d) && !g.confirmed) {
        decided = g.index;
        input.confirm = !!g.real;
      }
      sim.step(input); f++;
    }
    const r = { score: sim.score, d: sim.player.d };
    globalThis.__SIM = undefined;
    return r;
  };
  const clean = runScore(true);
  const silent = runScore(false);
  // A silent run still scores a little: letting a fake pass IS a correct read
  // and pays the late rate. What it cannot do is compete — the same ground is
  // worth a different order of magnitude when it is actually read.
  check('the same ground scores more when it is read well',
    clean.score > silent.score * 10,
    `${clean.score.toLocaleString()} read well against ${silent.score.toLocaleString()} ` +
    `read not at all — ${(clean.score / Math.max(1, silent.score)).toFixed(0)}x`);

  // Determinism: score has to be replayable, or ghosts and challenge links
  // are comparing different games.
  check('score is deterministic for a seed', runScore(true).score === clean.score);

  const uiSrc3 = fs.readFileSync('src/ui/ui.js', 'utf8');
  const htmlSrc = fs.readFileSync('index.html', 'utf8');
  // The sub-line is mode-aware since the daily became a fixed route: metres
  // in ENDLESS, position on the route in the DAILY RUN, where every finisher
  // covers the same ground and metres therefore say nothing about the player.
  check('the score is the headline and the sub-line answers the mode',
    uiSrc3.includes('this.dist.textContent = sc.toLocaleString') &&
    uiSrc3.includes('`${Math.min(sim.wordGates.next, routeGates)} / ${routeGates}`') &&
    uiSrc3.includes('`${Math.floor(sim.distance)} M`') &&
    htmlSrc.includes('id="distSub"'));
  // Phase Q: the headline no longer prints in renderDeath — it seeds the
  // beat-clock count-up, which lands on exactly this floor(score).
  check('the results card leads with the score, distance in the stat bar',
    uiSrc3.includes("score: Math.floor(score ?? 0)") &&
    uiSrc3.includes("'METRES'"));

  // Distance stays the currency the TASKS speak in — a goal should name a
  // concrete thing to do, not a number that moves with your multiplier.
  check('daily goals and objectives still ask for metres',
    goalsFor(999).some((g) => g.id === 'dist') &&
    POOL.some((p) => p.id === 'dist'));

  const ch = fs.readFileSync('src/meta/challenge.js', 'utf8');
  check('a challenge link carries a score target under its own key',
    ch.includes("goal: 'score'"));
}

// ── Phase 1: the curve screen and the nemesis words earn their presentation ──
head('CURVE — the trend is a series, oldest→newest, gaps never fabricated');
{
  const empty = new CurveLog(memoryAdapter()).series(14);
  check('series returns exactly `days` entries with no history, no tiers invented',
    empty.days === 14 && empty.readMs.length === 14 &&
    empty.readMs.every((v) => v === null) && empty.tiers.length === 0);

  const c = new CurveLog(memoryAdapter());
  c.addRun({ perTier: { 3: { a: 4, c: 3 } }, avgReadMs: 900, reads: 4 });
  const s = c.series(14);
  check('each per-tier accuracy array is exactly `days` long, oldest→newest',
    s.tiers.includes(3) && s.accuracy[3].length === 14 && s.readMs.length === 14);
  check('only today is filled; every earlier day is null, not interpolated',
    s.accuracy[3].slice(0, 13).every((v) => v === null) && s.accuracy[3][13] === 75 &&
    s.readMs[13] === 900 && s.readMs.slice(0, 13).every((v) => v === null),
    `today ${s.accuracy[3][13]}% / ${s.readMs[13]}ms`);
  check('a shorter window is honoured', new CurveLog(memoryAdapter()).series(7).readMs.length === 7);
}

head('NEMESIS — the beaten-word gallery is bounded and survives storage');
{
  const { NemesisLedger, NEMESIS } = await import('../src/meta/nemesis.js');
  const adapter = memoryAdapter();
  const led = new NemesisLedger(adapter);
  const beat = (id) => {
    led.record(id, false, 0);
    for (let i = 0; i < NEMESIS.RETIRE_CLEAN; i++) led.record(id, true, 0);
  };
  beat('able');
  const first = led.beatenWords();
  check('a beaten word enters the gallery with its miss count and a date',
    first.length === 1 && first[0].id === 'able' && first[0].m >= 1 &&
    typeof first[0].at === 'number');

  for (let i = 0; i < NEMESIS.BEATEN_CAP + 10; i++) beat(`w${i}`);
  const full = led.beatenWords();
  check('the gallery is bounded to BEATEN_CAP, newest first',
    full.length === NEMESIS.BEATEN_CAP && full[0].id === `w${NEMESIS.BEATEN_CAP + 10 - 1}`,
    `${full.length} kept, newest ${full[0].id}`);
  check('the lifetime retired tally counts every beating, not just the kept ones',
    led.retiredCount === NEMESIS.BEATEN_CAP + 11, `retired ${led.retiredCount}`);

  const reload = new NemesisLedger(adapter);
  check('the gallery survives a storage round-trip, identical and still bounded',
    reload.beatenWords().length === NEMESIS.BEATEN_CAP &&
    JSON.stringify(reload.beatenWords()) === JSON.stringify(full));
  check('beatenWords() hands back a copy, not the ledger\'s own array',
    (() => { const g = led.beatenWords(); g.push({ id: 'x' }); return led.beatenWords().length === NEMESIS.BEATEN_CAP; })());
}

head('RETIREMENT — the flourish introduces no colour the grammar does not own');
{
  const burst = fs.readFileSync('src/render/streak-burst.js', 'utf8');
  const from = burst.indexOf('fireRetire(');
  const to = burst.indexOf('update(dt, camera)', from);
  const retireBody = burst.slice(from, to);
  check('the retirement burst reuses the reserved escalation palette — no new hex',
    from > 0 && to > from && !/0x[0-9a-f]{6}/i.test(retireBody) && /TIER_COLORS/.test(retireBody),
    'reuses TIER_COLORS (cyan resting tone + reserved violet/gold)');
  // Its own sound, not a gate() variant.
  const audioSrc = fs.readFileSync('src/audio/audio.js', 'utf8');
  check('the retirement cue is its own one-shot in the audio engine',
    /wordRetired\s*\(\)\s*\{/.test(audioSrc) &&
    fs.readFileSync('src/main.js', 'utf8').includes('audio.wordRetired()'));
}

console.log(out.join('\n'));

console.log(`\nMeta gates: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
