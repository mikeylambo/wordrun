/**
 * DICTION DASH — entry point. Deterministic game, expressive presentation.
 */

import TUNING from './TUNING.js';
import { Sim, PHASE, emptyInput } from './sim/sim.js';
import { makeGate, wordSeedFor } from './sim/word-gates.js';
import { dailySeed, dailySeedString, hashString } from './sim/rng.js';
import { parseChallenge, buildChallengeLink } from './meta/challenge.js';
import { Stage } from './render/scene.js';
import { TerrainMesh } from './render/terrain-mesh.js';
import { Props } from './render/props.js';
import { PlayerActor, BeastActor, GhostActor } from './render/actors.js';
import { CameraRig } from './render/camera-rig.js';
import { Spray } from './render/fx.js';
import { Landmarks } from './render/landmarks.js';
import { WordGateActors, plateFontReady } from './render/word-gates.js';
import { DataworldPass } from './render/dataworld.js';
import { StreakBurst } from './render/streak-burst.js';
import { WindStreaks, TrackPylons } from './render/speed-fantasy.js';
import { BellRenderer } from './render/bells.js';
import { HEARTS } from './design/bells.js';
import { flowFactor, flowGlow, flowLevel } from './render/flow-curve.js';
import { ACCESS, initAccess, buildAccessPanel } from './ui/access.js';
import { applyMaterialPass } from './render/material-pass.js';
import { Audio } from './audio/audio.js';
import { MusicTrack } from './music-track.js';
import { musicResponse } from './render/music-response.js';
import { Input } from './input/input.js';
import { Storage } from './storage/storage.js';
import { StatsManager, localStorageAdapter } from './meta/stats.js';
import { NemesisLedger } from './meta/nemesis.js';
import { CurveLog } from './meta/curve.js';
import { buildCurveScreen } from './ui/curve-screen.js';
import { DailyManager } from './meta/daily.js';
import { buildStatsExport, formatStatsExport } from './meta/export.js';
import { ObjectiveQueue } from './meta/objectives.js';
import { buildReview } from './meta/review.js';
import { UI } from './ui/ui.js';
// Phase 5: the shop, pause and onboarding panels are code-split behind dynamic
// import() — none is needed for the first frame, so keeping them out of the
// main chunk shortens time-to-interactive on the low-end devices Playables
// gets played on. They are preloaded right after the title paints (so they are
// ready before any interaction) and every call site is guarded, so nothing
// breaks in the window before a chunk lands. See loadPanels() below.

const canvas = document.getElementById('gl');
const stage = new Stage(canvas);
const ui = new UI();
const audio = new Audio();
const music = new MusicTrack();
music.load();
let musicState = { pulse: 0, accent: 0, shimmer: 0, drive: 0, calm: false, section: null };
const input = new Input(canvas);

// Challenge links (Phase 14): a ?draft= URL drops this player into someone
// else's exact run — seed, rules and word lane all pinned by the query.
// The daily seed keeps owning the meta layer (goals, streak) either way.
const CHALLENGE = parseChallenge(location.search);
const DAILY_SEED = dailySeed();
const SEED = CHALLENGE ? hashString(CHALLENGE.seedString) : DAILY_SEED;
const SEED_STRING = CHALLENGE ? CHALLENGE.seedString : dailySeedString();
const sim = new Sim(SEED);
const terrainMesh = new TerrainMesh(stage.scene, sim.terrain);
const props = new Props(stage.scene, sim.terrain);
const landmarks = new Landmarks(stage.scene, sim.terrain);
const playerActor = new PlayerActor(stage.scene);
const beastActor = new BeastActor(stage.scene);
const ghostActor = new GhostActor(stage.scene);
const rig = new CameraRig(stage.camera);
const spray = new Spray(stage.scene);
const wordGateActors = new WordGateActors(stage.scene, sim);
const materialPass = applyMaterialPass(stage.scene, terrainMesh, { playerActor, beastActor });
const dataworld = new DataworldPass(stage.scene, [playerActor.root, ghostActor.root]);
const streakBurst = new StreakBurst(stage.scene);
// Speed-fantasy layers: wind lines live on the camera (which must be in
// the scene graph for its children to render), pylons flank the track.
stage.scene.add(stage.camera);
const windStreaks = new WindStreaks(stage.camera);
const trackPylons = new TrackPylons(stage.scene, sim.terrain);
// The bells the runner collects. The sim owns the field and the pickup
// (sim.bells); this only draws it. Created after the material pass so its
// baked-in gold emissive is left alone by the pass's material sweep.
const bellRenderer = new BellRenderer(stage.scene, sim.terrain, sim.bells);

const simInput = emptyInput();
// Code-split panel handles (Phase 5) — declared before the first loadShop()
// call in setup so it never touches a `let` in its temporal dead zone.
let shopUI = null, pauseUI = null, onboarding = null;
let _shopP = null, _pauseP = null, _onboardP = null;
let running = false;
let paused = false;
let topSpeed = 0;
let sprayAcc = 0;
let flowChain = 0; // smoothed chain for the flow channel: eased up, snapped down
let deathShownAt = 0;
let shotUrl = null;
let shotTaken = false;
let ghostEnabled = Storage.ghostEnabled();

// ── Mode + difficulty (Phase 10) ─────────────────────────────────────────
// Two rule sets (ENDLESS repairs hearts by bells; STANDARD is three hits,
// ever) × three reading difficulties (word-tier curve + Redline pace).
// Bests, ghosts and run counts are stored per variant so an EASY run can
// never claim the STANDARD board; the default combo keeps legacy keys.
let runMode = TUNING.MODES.RULES[Storage.modePref()] ? Storage.modePref() : 'endless';
let runDifficulty = TUNING.MODES.DIFFICULTY[Storage.difficultyPref()]
  ? Storage.difficultyPref() : 'normal';
// A challenge pins the rules: same track under different rules is a
// different run, so the chips are forced and locked for the visit.
if (CHALLENGE) {
  runMode = CHALLENGE.mode;
  runDifficulty = CHALLENGE.difficulty;
}

function syncVariant() {
  Storage.setVariant(runMode === 'endless' && runDifficulty === 'normal'
    ? '' : `${runMode}.${runDifficulty}`);
}
syncVariant();

// Meta layer (ported from the SLU shell's Layer-1 managers): lifetime
// stats, daily goals and the play streak, over one storage adapter.
const metaAdapter = localStorageAdapter();
const metaStats = new StatsManager(metaAdapter);
// The per-word ledger rides the same adapter seam as the stats.
const nemesis = new NemesisLedger(metaAdapter);
const curve = new CurveLog(metaAdapter);
buildCurveScreen(() => ({ series: curve.series(14), beaten: nemesis.beatenWords() }));
const metaDaily = new DailyManager(metaAdapter);

// Which controls this player has ever used. The in-run coach teaches a control
// until it has been used once and then never mentions it again, so these are
// write-once flags rather than counters — see UI._updateCoach.
function pushLessons() {
  ui.setLessons({
    confirm: metaStats.get('usedConfirm', 0) > 0,
    reject: metaStats.get('usedReject', 0) > 0,
    dash: metaStats.get('usedDash', 0) > 0,
  });
}
function learn(which) {
  const key = `used${which}`;
  if (metaStats.get(key, 0) > 0) return;
  metaStats.increment(key);
  pushLessons();
}
const metaObjectives = new ObjectiveQueue(metaAdapter);
globalThis.__META = { stats: metaStats, daily: metaDaily, objectives: metaObjectives };

// Accessibility (Phase 11): load persisted options before the warm-start
// pre-paints plates, so the readable-type/palette choice is baked in.
initAccess();
// The settings panel freezes the run while it is open (playtest: the game
// carried on behind it, so checking a setting cost you hearts). This is a
// quiet freeze, not pauseGame — that would raise the pause menu on top of
// the panel. Input is released so a held DASH does not survive the panel.
let accessFroze = false;
buildAccessPanel({
  onOpen: () => {
    if (!running || sim.phase !== PHASE.RUNNING || paused) return;
    accessFroze = true;
    paused = true;
    input.enabled = false;
    input.releaseAll();
  },
  onClose: () => {
    if (!accessFroze) return;
    accessFroze = false;
    paused = false;
    input.enabled = true;
    input.releaseAll();
  },
});

document.addEventListener('dictiondash:dash-ready', () => audio.dashReady());

// The DASH teaching beat (Phase 16) runs until the player has used the
// mechanic once — ever, not per run. __DASH_LEARNED lets the mobile
// button read the same state without importing the UI.
let dashLearned = Storage.dashLearned();
globalThis.__DASH_LEARNED = dashLearned;
ui.setDashLearned(dashLearned);

ui.setChallenge(CHALLENGE);
ui.setSeed(SEED_STRING, Storage.bestFor(SEED), Storage.runsToday(SEED));
pushLessons();
ui.setDaily(metaDaily.status(DAILY_SEED));
ui.showTitle(true);
input.onFirstGesture = () => audio.start();

// Cosmetics (Phase 14): apply the equipped runner-light palette and hang
// the ◆ shop off the title. Cosmetic only — the semantic grammar is
// ACCESS's and the Redline's.
function applyCosmetic() {
  const id = Storage.equippedCosmetic();
  const c = TUNING.META.COSMETICS.find((x) => x.id === id) || TUNING.META.COSMETICS[0];
  playerActor.setPalette(c);
}
applyCosmetic();
loadShop(); // code-split; constructs the ◆ shop + title balance chip on load

// Challenge visits hide the rule chips (pinned by the link) and offer the
// way home. DAILY RUN is the approved name for the seeded daily.
if (CHALLENGE) {
  const rows = document.getElementById('modeRows');
  if (rows) rows.style.display = 'none';
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'modeChip';
  exit.id = 'exitChallenge';
  exit.textContent = 'BACK TO DAILY RUN';
  exit.addEventListener('click', (e) => {
    e.stopPropagation();
    location.href = location.pathname;
  });
  document.getElementById('titleGoals')?.appendChild(exit);
}

// The curve screen's way in. A chip beside the goals rather than a new
// surface: it is a place to look, not a thing to be named.
{
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'modeChip';
  btn.id = 'openCurve';
  btn.textContent = 'YOUR READING';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.uiTap();
    // Opening the screen is acknowledging what is new: mark the current
    // retired count as seen so the dot clears, then refresh it.
    metaStats.set('curveSeenRetired', nemesis.retiredCount);
    updateCurveBadge();
    document.dispatchEvent(new CustomEvent('dictiondash:show-curve'));
  });
  document.getElementById('titleGoals')?.appendChild(btn);
  updateCurveBadge();
}

// The badge (Phase 1.4): a single dot on YOUR READING when there is something
// new since it was last opened. Measured by the lifetime retired count, so it
// survives sessions and needs no in-session flag; opening the screen marks the
// current count seen and clears it. It is an indicator, not a number — no
// notification-bait count on the title.
function updateCurveBadge() {
  const el = document.getElementById('openCurve');
  if (!el) return;
  el.classList.toggle('hasNews', nemesis.retiredCount > metaStats.get('curveSeenRetired', 0));
}

// ── Run-start warm-up (Phase 8) ───────────────────────────────────────────
// Profiling the BEGIN RUN hitch found three first-use costs landing on one
// frame: shader compilation for every material hidden on the title screen
// (plates, corruption, bursts), the first canvas→GPU texture uploads, and
// the AudioContext graph build. All three are paid here instead, while the
// title idles — two rAFs in so the first title paint is never blocked.
function warmStart() {
  audio.prewarm();

  // Paint the plates with the NEXT run's actual first two words (knowable
  // from the salted seed + difficulty) so the first in-run paint is a
  // cache hit — no canvas raster, no texture upload on the start frame.
  warmPlates();
  wordGateActors.fx.paint('ready', 'right');
  for (const plate of [wordGateActors.current, ...wordGateActors.ahead, wordGateActors.fx]) {
    stage.renderer.initTexture(plate.tex);
  }
  if (beastActor.tearTex && beastActor.fieldTex) {
    stage.renderer.initTexture(beastActor.tearTex.tex);
    stage.renderer.initTexture(beastActor.fieldTex.tex);
  }

  // Compile every material already in the graph, hidden ones included.
  const compiled = stage.renderer.compileAsync?.(stage.scene, stage.camera);
  if (compiled?.catch) compiled.catch(() => stage.renderer.compile(stage.scene, stage.camera));
  else stage.renderer.compile(stage.scene, stage.camera);
}
// Warm once the plate face is actually loadable, so the pre-painted plates
// bake in the shipped typeface rather than the fallback — capped, because a
// font that never resolves must not hold the warm-up hostage.
requestAnimationFrame(() => requestAnimationFrame(() => {
  const go = () => { try { warmStart(); } catch { /* warm-up is best-effort */ } };
  Promise.race([plateFontReady, new Promise((r) => setTimeout(r, 700))]).then(go, go);
}));

function startRun() {
  audio.start();
  music.attach(audio);
  music.play();
  // The placeholder stem synth is the fallback score; a real track replaces
  // it rather than playing underneath it.
  audio.musicTrackLive = true;
  const ghostData = ghostEnabled ? Storage.loadGhost(SEED) : null;
  const runs = Storage.runsToday(SEED);

  // Words are salted per attempt: run N of the day reads fresh vocabulary
  // on the same authored track. Mode/difficulty come from the title chips.
  // A challenge pins the salt instead — its gauntlet IS the challenge.
  // ENDLESS re-rolls the vocabulary each attempt — it is practice, and the
  // same words twice teaches memory rather than reading. The DAILY RUN pins
  // the salt so every player on a given day reads the identical route; a
  // challenge pins it too, because its gauntlet IS the challenge.
  currentSalt = CHALLENGE ? CHALLENGE.salt
    : runMode === 'standard' ? 0
    : runs + 1;
  continuesUsed = 0;
  continueScoreLost = 0;
  runContinued = false;
  retiredThisRun = [];
  tierTally = {};
  sim.start(SEED, ghostData, {
    wordSalt: currentSalt,
    mode: runMode,
    difficulty: runDifficulty,
    // ENDLESS only — sim.start refuses it on a route, which is where the
    // rule lives rather than here.
    nemesisLane: (index) => nemesis.substituteFor(index),
  });
  terrainMesh.terrain = sim.terrain;
  props.terrain = sim.terrain;
  landmarks.terrain = sim.terrain;

  terrainMesh.reset();
  terrainMesh.update(0);
  terrainMesh.flush();
  props.reset();
  props.update(0, true);
  bellRenderer.reset(sim.terrain);
  landmarks.reset();
  landmarks.update(0);

  rig.reset();
  beastActor.reset();
  spray.clear();
  wordGateActors.reset();
  streakBurst.reset();
  ui.clearDread();
  ui.clearRun();
  shotUrl = null;
  shotTaken = false;
  topSpeed = 0;
  sprayAcc = 0;
  flowChain = 0;
  paused = false;
  running = true;
  input.enabled = true;
  input.releaseAll();

  onboarding?.hide();
  pauseUI?.setPaused(false);
  pauseUI?.setButton(true);
  ui.showTitle(false);
  ui.showDeath(false);
  ui.showHud(true);
  Storage.bumpRuns(SEED);
}

// ── The priced continue (Phase 14) ───────────────────────────────────────
// Death first passes through a short offer: buy the run back for ◆, cost
// doubling with each continue in the same run. A continued run keeps its
// distance, bells and goal credit but never sets BEST TODAY and never
// saves a ghost — the boards stay unassisted, which matters now that a
// run can be a challenge someone else must chase.
let currentSalt = 1;
let continuesUsed = 0;
let runContinued = false;
// The last finished run's banked score, after any continue penalty. Read by
// the results card, the challenge link and the stats export, which all run
// outside onDead().
let lastRunScore = 0;
let retiredThisRun = [];
let tierTally = {};
let lastRunScoreLost = 0;
// What the continues took off the live score this run, kept so the death card
// can still say "−N · 2 CONTINUES" now that the cut happens during the run.
let continueScoreLost = 0;
let offerActive = false;
let offerTimer = null;
const CONT = TUNING.META.CONTINUE;
const continueOfferEl = document.getElementById('continueOffer');
const continueBuy = document.getElementById('continueBuy');
const continuePass = document.getElementById('continuePass');
const continueBalance = document.getElementById('continueBalance');

const continueCost = () =>
  Math.floor(CONT.BASE_COST * Math.pow(CONT.COST_GROWTH, continuesUsed));

function onDead() {
  if (offerActive) return;
  running = false;
  paused = false;
  input.enabled = false;
  pauseUI?.setPaused(false);
  pauseUI?.setButton(false);
  const cost = continueCost();
  if (continueOfferEl && metaStats.get('currency', 0) >= cost) {
    showContinueOffer(cost);
    return;
  }
  finalizeRun();
}

function showContinueOffer(cost) {
  offerActive = true;
  continueBuy.textContent = `CONTINUE ◆${cost}`;
  continueBalance.textContent = `BALANCE ◆ ${Math.floor(metaStats.get('currency', 0))}`;
  continueOfferEl.classList.add('on');
  const bar = continueOfferEl.querySelector('#continueTimer i');
  const t0 = performance.now();
  bar.style.transform = 'scaleX(1)';
  offerTimer = setInterval(() => {
    const left = 1 - (performance.now() - t0) / (CONT.OFFER_SECONDS * 1000);
    if (left <= 0) declineContinue();
    else bar.style.transform = `scaleX(${left.toFixed(3)})`;
  }, 50);
}

function hideContinueOffer() {
  offerActive = false;
  if (offerTimer) { clearInterval(offerTimer); offerTimer = null; }
  continueOfferEl?.classList.remove('on');
}

function declineContinue() {
  hideContinueOffer();
  finalizeRun();
}

function buyContinue() {
  const cost = continueCost();
  if (metaStats.get('currency', 0) < cost) { declineContinue(); return; }
  hideContinueOffer();
  metaStats.increment('currency', -cost);
  continuesUsed++;
  runContinued = true;
  // Playtest: the cut used to be applied once, at the recap, so the HUD went
  // on counting from the full total for the whole rest of the run and the
  // number only fell after it was too late to feel like a price. Take it here,
  // off the live score, the instant the continue is bought — the player watches
  // it go, and everything earned afterwards accrues on the reduced base.
  const beforeCut = sim.player.score;
  sim.player.score = Math.floor(sim.player.score * TUNING.SCORE.CONTINUE_KEEP);
  continueScoreLost += beforeCut - sim.player.score;
  ui.flashScoreCut(beforeCut - sim.player.score);
  shopUI?.sync();
  reviveRun();
}

/** Put the run back on its feet: hearts full, the Redline pushed out to
 *  its starting gap, speed at a survivable pad over its pace. The word
 *  gauntlet, distance, bells and ledger all carry on untouched. */
function reviveRun() {
  const p = sim.player;
  p.dead = false;
  p.staggerT = 0;
  sim.hearts = sim.maxHearts;
  sim.bellCharge = 0;
  sim.deathCause = null;
  sim.beast.killed = false;
  sim.beast.killT = 0;
  sim.beast.gap = TUNING.BEAST.START_GAP;
  sim.beast.lunge = 'idle';
  sim.beast.lungeT = 0;
  const R = TUNING.RUN;
  p.speed = Math.max(R.FLOOR, Math.min(R.CEILING, sim.beast.pace + CONT.REVIVE_SPEED_PAD));
  sim.phase = PHASE.RUNNING;
  sim.killTimer = 0;
  sim.killSource = null;
  beastActor.reset();
  shotUrl = null;
  shotTaken = false;
  running = true;
  paused = false;
  input.enabled = true;
  input.releaseAll();
  pauseUI?.setButton(true);
  ui.showDeath(false);
  ui.showHud(true);
  audio.resume();
}

continueBuy?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.uiTap();
  buyContinue();
});
continuePass?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.uiTap();
  declineContinue();
});

function finalizeRun() {
  running = false;
  paused = false;
  input.enabled = false;
  pauseUI?.setPaused(false);
  pauseUI?.setButton(false);

  const distance = sim.distance;
  // What the run actually banks. Assistance costs score, compounding per
  // continue; an unassisted run keeps every point it earned.
  const earned = sim.score;
  // STANDARD only: dying short of the finish keeps a reduced share. A run that
  // reached the finish is not a failure and keeps everything.
  const failedRoute = runMode === 'standard' && !sim.escaped;
  const failKeep = failedRoute ? TUNING.SCORE.STANDARD_FAIL_KEEP : 1;
  // CONTINUE_KEEP is NOT applied here: buyContinue() already took it off the
  // live score, once per continue, so compounding it again at the recap would
  // charge for every continue twice.
  const finalScore = Math.floor(earned * failKeep);
  lastRunScore = finalScore;
  lastRunScoreLost = (earned - finalScore) + continueScoreLost;
  // Unassisted runs own the boards: a continued run reports its distance
  // but cannot set the best or leave a ghost (see CONTINUE tuning note).
  const isPb = runContinued ? false : Storage.setBestFor(SEED, finalScore);
  if (!runContinued) {
    sim.recorder.finish(sim.player);
    Storage.saveGhostIfBest(SEED, sim.recorder.serialize({ seed: SEED, distance }));
  }

  // Meta layer: lifetime ledger, daily goals and the streak, then the
  // learning recap — every wrong read shows its true spelling.
  const wg = sim.wordGates;
  metaStats.increment('runs');
  metaStats.increment('metres', Math.floor(distance));
  metaStats.increment('correct', wg.correctCount);
  metaStats.increment('wrong', wg.wrongCount);
  metaStats.increment('falseTaps', wg.falseTaps);
  metaStats.increment('missedReals', wg.missedReals);
  // Phase B: how fast the reading was, not just how right. Milliseconds, so
  // the lifetime average survives as an integer ledger.
  const avgReadMs = wg.readCount > 0 ? Math.round((wg.latencySum / wg.readCount) * 1000) : 0;
  const bestReadMs = wg.bestLatency != null ? Math.round(wg.bestLatency * 1000) : 0;
  if (wg.readCount > 0) {
    metaStats.increment('readMsTotal', avgReadMs * wg.readCount);
    metaStats.increment('reads', wg.readCount);
    if (bestReadMs > 0) metaStats.min?.('bestReadMs', bestReadMs);
  }
  metaStats.max('bestChain', sim.player.bestChain);
  metaStats.max('bestDistance', Math.floor(distance));
  metaStats.max('bestScore', finalScore);
  // The personal curve: what this run says about the reading, not the score.
  curve.addRun({
    perTier: tierTally, avgReadMs, reads: wg.readCount,
    retired: retiredThisRun.length,
  });
  // Bells bank the spendable balance (Phase 8): a bare number, no name.
  const banked = (sim.bellsCollected || 0) * TUNING.META.CURRENCY_PER_BELL;
  if (banked > 0) metaStats.increment('currency', banked);
  const dailyCard = metaDaily.recordRun(DAILY_SEED, {
    distance, bestChain: sim.player.bestChain, correct: wg.correctCount,
  });
  // The rotating queue (Phase 21). Only the three LIVE objectives are judged
  // against this run — anything still in the queue gets no credit for a run
  // that would have satisfied it, so one exceptional run cannot front-load
  // months of progression. Rewards are currency, which is the cosmetic path;
  // nothing here touches gameplay power.
  const objectives = metaObjectives.recordRun({
    distance,
    wrong: wg.wrongCount,
    falseTaps: wg.falseTaps,
    correct: wg.correctCount,
    bestChain: sim.player.bestChain,
    bells: sim.bellsCollected || 0,
    streak: dailyCard.streak,
    dashMeterSpent: sim.player.boostSpent,
  });
  if (objectives.reward > 0) metaStats.increment('currency', objectives.reward);

  ui.setDaily(metaDaily.status(DAILY_SEED));
  shopUI?.sync();

  ui.renderDeath({
    distance,
    score: finalScore,
    scoreLost: lastRunScoreLost,
    continuesUsed,
    failedRoute,
    avgReadMs,
    seconds: sim.time,
    retired: retiredThisRun,
    gates: wg.next,
    routeGates: sim.rules?.GATES | 0,
    best: Storage.bestFor(SEED),
    isPb,
    shotUrl,
    recap: wg.misses,
    daily: dailyCard,
    objectives,
    // Replay review (Phase 21): the ghost recorder has sampled this run's
    // position and clock all along for the racing feature. Differentiating
    // that track recovers the speed curve, and the recap's misses already
    // know where they happened — no new data, a second read of the old.
    review: buildReview({ samples: sim.recorder.samples, misses: wg.misses }),
    lifetime: metaStats.snapshot(),
    continued: runContinued,
    challengeResult: CHALLENGE
      ? { goal: CHALLENGE.goal, beaten: CHALLENGE.goal > 0 && finalScore > CHALLENGE.goal }
      : null,
  });
  ui.showHud(false);
  ui.showDeath(true);
  deathShownAt = performance.now();

  // Re-warm the plates for the NEXT attempt's fresh words while the death
  // card idles, keeping the AGAIN tap as hitch-free as the first BEGIN RUN.
  warmPlates();
}

/** Pre-paint the next attempt's first two plates (salt + difficulty aware). */
function warmPlates() {
  const d = TUNING.MODES.DIFFICULTY[runDifficulty];
  const prof = { TIER_MIN: d.TIER_MIN, TIER_MAX: d.TIER_MAX, TIER_EVERY_M: d.TIER_EVERY_M };
  const nextWordSeed = wordSeedFor(SEED,
    CHALLENGE ? CHALLENGE.salt : Storage.runsToday(SEED) + 1);
  // Every plate the first frame will draw, warmed here: the lookahead plates
  // raster and upload exactly like the armed one, so leaving them cold would
  // put the Phase 8.1 start-frame hitch straight back.
  wordGateActors.current.paint(makeGate(nextWordSeed, 0, prof).shown, 'idle');
  wordGateActors.ahead.forEach((plate, i) => {
    plate.paint(makeGate(nextWordSeed, i + 1, prof).shown, 'idle');
  });
}

function pauseGame() {
  if (!running || sim.phase !== PHASE.RUNNING || paused) return;
  paused = true;
  input.enabled = false;
  input.releaseAll();
  audio.suspend();
  pauseUI?.setPaused(true);
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  input.enabled = true;
  input.releaseAll();
  audio.resume();
  pauseUI?.setPaused(false);
}

function quitToTitle() {
  paused = false;
  running = false;
  input.enabled = false;
  input.releaseAll();
  sim.phase = PHASE.TITLE;
  pauseUI?.setPaused(false);
  pauseUI?.setButton(false);
  onboarding?.hide();
  ui.showDeath(false);
  ui.showHud(false);
  ui.clearDread();
  ui.clearRun();
  ui.showTitle(true);
  updateCurveBadge(); // a word beaten this session may be new since last open
  audio.suspend();
}

function setGhostEnabled(on) {
  ghostEnabled = !!on;
  Storage.setGhostEnabled(ghostEnabled);
  pauseUI?.setGhost(ghostEnabled);
  onboarding?.setGhost(ghostEnabled);
  if (!ghostEnabled) sim.ghost.load(null);
}

// ── Code-split panels (Phase 5) ───────────────────────────────────────────
// Each loader imports its chunk once (cached promise), constructs the panel,
// and catches it up to the current game state — so a panel that lands mid-run
// is immediately correct rather than a frame behind. Call sites are guarded
// with `?.`, so the window before a chunk resolves is a safe no-op. The state
// they close over is declared up top (near the other run lets) so the first
// loader call during setup does not hit its TDZ.
function loadShop() {
  if (!_shopP) _shopP = import('./ui/shop.js').then(({ buildShopPanel }) => {
    shopUI = buildShopPanel({ stats: metaStats, onEquip: applyCosmetic });
    shopUI.sync();
    return shopUI;
  });
  return _shopP;
}

function loadPause() {
  if (!_pauseP) _pauseP = import('./ui/pause.js').then(({ PauseUI }) => {
    pauseUI = new PauseUI({
      onPause: pauseGame,
      onResume: resumeGame,
      onRestart: startRun,
      onQuit: quitToTitle,
      ghostEnabled,
      onGhostChange: setGhostEnabled,
    });
    // Catch up to wherever the run already is.
    pauseUI.setButton(running && sim.phase === PHASE.RUNNING);
    pauseUI.setPaused(paused);
    return pauseUI;
  });
  return _pauseP;
}

function loadOnboarding() {
  if (!_onboardP) _onboardP = import('./ui/onboarding.js').then(({ OnboardingUI }) => {
    onboarding = new OnboardingUI({
      ghostEnabled,
      onGhostChange: setGhostEnabled,
      onStart: () => {
        Storage.setOnboardingSeen(true);
        audio.uiTap();
        startRun();
      },
    });
    return onboarding;
  });
  return _onboardP;
}

// Preload all three once the title is up. They are off the first-frame path,
// so this shortens time-to-interactive, but firing the fetch now (rather than
// on demand) means they are ready before the player can reach them — and the
// pause/how-to cross-talk (the pause menu dispatches events onboarding listens
// for) needs onboarding present, not just importable.
requestAnimationFrame(() => requestAnimationFrame(() => {
  loadShop(); loadPause(); loadOnboarding();
}));

function onAdvance() {
  if (running || paused || onboarding?.visible || offerActive) return;
  if (sim.phase === PHASE.KILL) return;
  if (sim.phase === PHASE.DEAD && performance.now() - deathShownAt < 350) return;
  audio.uiTap();
  if (sim.phase === PHASE.TITLE && !Storage.onboardingSeen()) {
    // First run ever: show the how-to. It is preloaded, but await the chunk if
    // the tap somehow beats the preload so the screen never silently no-ops.
    loadOnboarding().then((o) => o.show());
    return;
  }
  startRun();
}

window.addEventListener('pointerup', (e) => {
  if (e.target.closest?.('[data-rc2-ui],[data-rc7-ui],button')) return;
  onAdvance();
});
window.addEventListener('keydown', (e) => {
  if (onboarding?.visible) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (sim.phase === PHASE.RUNNING) {
      e.preventDefault();
      paused ? resumeGame() : pauseGame();
    }
    return;
  }
  if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'KeyR') return;
  onAdvance();
});

// Mode/difficulty chips: persist the choice, swap the storage variant,
// refresh the per-variant best and re-warm the next attempt's plates.
function syncModeChips() {
  for (const b of document.querySelectorAll('#modeRow .modeChip')) {
    b.classList.toggle('on', b.dataset.mode === runMode);
  }
  for (const b of document.querySelectorAll('#difficultyRow .modeChip')) {
    b.classList.toggle('on', b.dataset.difficulty === runDifficulty);
  }
}
document.getElementById('modeRows')?.addEventListener('click', (e) => {
  const chip = e.target.closest?.('.modeChip');
  if (!chip || running || CHALLENGE) return;
  e.stopPropagation();
  if (chip.dataset.mode) {
    runMode = chip.dataset.mode;
    Storage.setModePref(runMode);
  } else if (chip.dataset.difficulty) {
    runDifficulty = chip.dataset.difficulty;
    Storage.setDifficultyPref(runDifficulty);
  }
  syncVariant();
  syncModeChips();
  ui.setSeed(SEED_STRING, Storage.bestFor(SEED), Storage.runsToday(SEED));
  pushLessons();
  ui.setDaily(metaDaily.status(DAILY_SEED));
  warmPlates();
  audio.uiTap();
});
syncModeChips();

ui.mute.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.start();
  const m = !audio.muted;
  audio.setMuted(m);
  ui.mute.textContent = m ? '×' : '♪';
});

const deathAgain = document.getElementById('deathAgain');
const deathMenu = document.getElementById('deathMenu');
deathAgain?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.uiTap();
  startRun();
});
deathMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.uiTap();
  quitToTitle();
});

// COPY CHALLENGE LINK (Phase 14): the dead run, encoded. Whoever opens the
// link stands at the start of the same track, same rules, same words, with
// this distance as the target. Clipboard first, the share sheet as the
// mobile fallback — no network either way.
const copyChallenge = document.getElementById('copyChallenge');
copyChallenge?.addEventListener('click', async (e) => {
  e.stopPropagation();
  audio.uiTap();
  const link = buildChallengeLink(location.origin + location.pathname, {
    seedString: SEED_STRING,
    mode: runMode,
    difficulty: runDifficulty,
    salt: currentSalt,
    goal: lastRunScore,
  });
  let ok = false;
  try {
    await navigator.clipboard.writeText(link);
    ok = true;
  } catch { /* clipboard denied — try the share sheet */ }
  if (!ok && navigator.share) {
    try {
      await navigator.share({ url: link, title: 'DICTION DASH' });
      ok = true;
    } catch { /* dismissed */ }
  }
  copyChallenge.textContent = ok ? 'COPIED' : 'COPY BLOCKED';
  setTimeout(() => { copyChallenge.textContent = 'CHALLENGE LINK'; }, 1400);
});

// COPY STATS (Phase 21): the calibration verdicts on the roadmap all want
// numbers from real runs, and the build is deliberately zero-network — there
// is no telemetry path from anyone but this keyboard. This is the manual one:
// the local ledger plus the run just played plus the dials that were in force,
// as a blob a player can paste back. Nothing typed by the player leaves with
// it, and nothing leaves at all unless they choose to paste it.
const copyStats = document.getElementById('copyStats');
copyStats?.addEventListener('click', async (e) => {
  e.stopPropagation();
  audio.uiTap();
  const wg = sim.wordGates;
  const p = sim.player;
  const blob = formatStatsExport(buildStatsExport({
    stats: metaStats.snapshot(),
    daily: metaDaily.status(DAILY_SEED),
    run: {
      score: finalScore,
    scoreLost: lastRunScoreLost,
    continuesUsed,
    failedRoute,
    avgReadMs,
    seconds: sim.time,
    retired: retiredThisRun,
    gates: wg.next,
    routeGates: sim.rules?.GATES | 0, distance: sim.distance, seconds: sim.time,
      mode: runMode, difficulty: runDifficulty, continued: runContinued,
      correct: wg.correctCount, wrong: wg.wrongCount,
      falseTaps: wg.falseTaps, missedReals: wg.missedReals,
      bestChain: p.bestChain, peakSpeed: p.peakSpeed, endSpeed: p.speed,
      dashMeterSpent: p.boostSpent, heartsLeft: sim.hearts,
      bells: sim.bellsCollected, endGap: sim.beast.gap,
    },
    tuning: TUNING,
    access: ACCESS,
    seed: SEED_STRING,
  }));
  let ok = false;
  try { await navigator.clipboard.writeText(blob); ok = true; }
  catch { /* clipboard denied — fall through to the share sheet */ }
  if (!ok && navigator.share) {
    try { await navigator.share({ text: blob, title: 'DICTION DASH stats' }); ok = true; }
    catch { /* dismissed */ }
  }
  copyStats.textContent = ok ? 'COPIED' : 'COPY BLOCKED';
  setTimeout(() => { copyStats.textContent = 'STATS'; }, 1400);
});

// The missed-word review (Phase 24): opened from the results card, closed
// back to it. The card keeps the score; the panel keeps the teaching.
const missedPanel = document.getElementById('missedPanel');
document.getElementById('deathRecap')?.addEventListener('click', (e) => {
  if (!e.target.closest('#missedOpen')) return;
  e.stopPropagation();
  audio.uiTap();
  ui.renderMissedPanel((w) => nemesis.history(w));
  missedPanel?.classList.add('on');
});
document.getElementById('missedClose')?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.uiTap();
  missedPanel?.classList.remove('on');
});
missedPanel?.addEventListener('click', (e) => e.stopPropagation());

ui.saveShot.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!shotUrl) return;
  const name = `dictiondash-${Math.floor(sim.distance)}m-${SEED_STRING}.png`;
  try {
    const blob = await (await fetch(shotUrl)).blob();
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `DICTION DASH — ${Math.floor(sim.distance)}m` });
      return;
    }
  } catch { /* fall through */ }
  const a = document.createElement('a');
  a.href = shotUrl;
  a.download = name;
  a.click();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (running && sim.phase === PHASE.RUNNING) pauseGame();
    else audio.suspend();
    input.releaseAll();
  }
});

function drainSimEvents() {
  const events = sim.drainEvents();
  if (!events) return;
  for (const e of events) {
    switch (e.t) {
      case 'hit':
        audio.hit();
        spray.emit(e.x, e.y, -e.d, 18, 7, 3.2, 0);
        ui.hitFlash();
        break;
      case 'gate':
        audio.gate();
        if (e.chain > 0) audio.chainLink(e.chain);
        break;
      case 'chain_lost': audio.chainLost(); break;
      // Hearts and bells (Phase 0: driven by sim events now, not a frame-delta
      // poll in the deleted rc5 layer). The heart HUD itself is synced from
      // sim.hearts in ui.update; these are only the sounds.
      case 'heart_lost': audio.heartLost(); break;
      case 'heart_restore': audio.heartRestore(); break;
      case 'bell': audio.bell((((e.charge | 0) - 1) % HEARTS.BELL_TONE_CYCLE + HEARTS.BELL_TONE_CYCLE) % HEARTS.BELL_TONE_CYCLE); break;
      case 'overdrive_on':
        learn('Dash');
        // The DASH lands as one event across three channels (Phase 16):
        // its own sound, a camera punch that decays, and a burst of speed
        // lines. Firing it used to reuse the generic shove and read as
        // nothing in particular — which is how a whole verb went unseen.
        audio.dash();
        rig.dashKick();
        windStreaks.burst();
        ui.dashFired();
        if (!dashLearned) {
          dashLearned = true;
          globalThis.__DASH_LEARNED = true;
          Storage.setDashLearned(true);
        }
        break;
      case 'overdrive_off': audio.overdriveOff(); break;
      case 'last_stand':
        // No label, by design. The world going quiet and the corruption
        // pinned at its worst is the whole announcement.
        audio.lastStand();
        if (music.gain) music.gain.gain.value = 0.10;
        break;
      case 'last_stand_held':
        audio.lastStandEnd(true);
        if (music.gain) music.gain.gain.value = 0.62;
        rig.dashKick(0.7);
        streakBurst.fire({ x: sim.player.x, y: sim.player.y, d: sim.player.d, chain: 8 });
        break;
      case 'last_stand_lost':
        audio.lastStandEnd(false);
        if (music.gain) music.gain.gain.value = 0.62;
        break;
      case 'kill': audio.kill(); break;
      case 'word_confirm': audio.uiTap(); break;
      case 'word_correct': {
        {
          const t = tierTally[e.tier] || (tierTally[e.tier] = { a: 0, c: 0 });
          t.a++; t.c++;
        }
        if (e.answer) {
          const before = nemesis.history(e.answer);
          if (nemesis.record(e.answer, true, e.index) === 'retired' && before?.m > 0) {
            retiredThisRun.push({ word: e.answer, misses: before.m, attempts: before.a });
            // The retirement beat, AT the read (Phase 1) — not a text line two
            // screens later. Its own sound, an escalated burst reusing the
            // reserved escalation palette, a fuller spray and a camera tick.
            // The death-card mention stays, but now it recaps something the
            // player already felt.
            audio.wordRetired();
            streakBurst.fireRetire(e);
            spray.emit(e.x, e.y, -e.d, 34, 5.5, 4.2, 0);
            rig.dashKick(0.5);
          }
        }
        // Phase B: how early the answer landed, 0 at the line and 1 at the
        // arm edge, drives the sound's attack and the camera's tick. Never a
        // word on screen.
        const W = TUNING.WORDS;
        const early = Math.max(0, Math.min(1,
          ((e.latencyMult ?? W.LATE_MULT) - W.LATE_MULT) / (W.EARLY_MULT - W.LATE_MULT)));
        audio.gate(e.chain, early);
        if (early > 0.4) rig.dashKick(0.28 * early);
        if (e.chain > 0) audio.chainLink(e.chain);
        if (e.proxMult > 1.05) audio.courageBank(e.proxMult);
        // The payoff is where the vibrancy lives: sparks scale with the
        // chain, and the burst system escalates hue and reach with it.
        spray.emit(e.x, e.y, -e.d, 14 + Math.min(e.chain, 10) * 3, 4.0, 2.6 + Math.min(e.chain, 10) * 0.25, 0);
        streakBurst.fire(e);
        wordGateActors.onResolve(e);
        break;
      }
      case 'word_wrong': {
        const t = tierTally[e.tier] || (tierTally[e.tier] = { a: 0, c: 0 });
        t.a++;
        nemesis.record(e.answer, false, e.index);
      }
        // The rulebook asymmetry, felt: tapping a fake is the crash (hit
        // sound, red flash, the heart the sim already took). Missing a real
        // word is only a slowdown — a deflating cue, no crash language, so
        // the player learns hearts are never lost by hesitating.
        if (e.hit) {
          // The drain (Phase 9): a wrong tap pulls light and highs out of
          // the world for a beat — no bright crash-flash; loss is darkness.
          audio.hit();
          audio.duck();
          spray.emit(e.x, e.y, -e.d, 18, 7, 3.2, 0);
          ui.drain();
        } else {
          audio.slip();
        }
        wordGateActors.onResolve(e);
        break;
    }
  }
}

let last = performance.now();

function tick(dt) {
  const p = sim.player;

  if (!paused && (running || sim.phase === PHASE.KILL)) {
    input.update(dt, !p.airborne);
    simInput.carve = input.carve;
    simInput.flip = input.flip;
    // Phase C: two zones, one primitive. The right half (or the right arrow,
    // or D) says the word is real; the left half (or the left arrow, or A)
    // says it is fake. Saying nothing still says fake. The sim never jumps —
    // the ground stays under the word.
    simInput.confirm = input.jump;
    simInput.reject = input.reject;
    if (simInput.confirm) learn('Confirm');
    if (simInput.reject) learn('Reject');
    simInput.raiseBar = input.raiseBar;
    simInput.lowerBar = input.lowerBar;
    simInput.jump = false;
    simInput.boostHeld = input.boostHeld;
    simInput.dragging = input.dragging;

    sim.advance(dt, simInput);
    input.consumeJump();
    drainSimEvents();
    if (p.speed > topSpeed) topSpeed = p.speed;

    if (running && sim.phase !== PHASE.RUNNING) {
      if (sim.phase === PHASE.DEAD) onDead();
    } else if (!running && sim.phase === PHASE.DEAD) {
      onDead();
    }
    if (running && sim.phase === PHASE.KILL) {
      running = false;
      input.enabled = false;
      pauseUI?.setButton(false);
    }
  }

  terrainMesh.update(p.d);
  terrainMesh.pump();
  props.update(p.d);
  if (bellRenderer.terrain !== sim.terrain) bellRenderer.reset(sim.terrain);
  bellRenderer.update(p.d, performance.now() / 1000);
  landmarks.update(p.d);
  wordGateActors.update(dt, p.d, stage.camera);
  streakBurst.update(paused ? 0 : dt, stage.camera);
  dataworld.update(dt);

  const slope = sim.terrain.normalAt(p.x, p.d);
  playerActor.update(p, slope, dt, sim.beast.gap);
  ghostActor.update(sim.ghost, dt);
  windStreaks.update(paused ? 0 : dt, running ? (p.effSpeed || p.speed) : 0, p.overdrive);
  trackPylons.terrain = sim.terrain;
  trackPylons.update(p.d);

  const beastGroundY = sim.terrain.heightAt(sim.beast.x, p.d - sim.beast.gap);
  const killT = sim.phase === PHASE.KILL || sim.phase === PHASE.DEAD ? sim.killTimer : 0;
  beastActor.update(dt, sim.beast.gap, sim.beast.x, beastGroundY, p.d, killT,
    sim.beast.side, sim.beast.lunge, sim.beast.lungeT);

  if (!paused && running && !p.airborne) {
    const edge = Math.min(1, Math.abs(p.heading) / TUNING.PLAYER.MAX_CARVE);
    const rate = (2 + edge * 46) * (0.35 + Math.min(1, p.speed / TUNING.RUN.CEILING) * 0.65);
    sprayAcc += rate * dt;
    while (sprayAcc >= 1) {
      sprayAcc -= 1;
      spray.emit(p.x, p.y, -p.d, 1, 1.6 + edge * 4,
        0.9 + edge * 2.0, -Math.sign(p.heading) * edge * 3.4);
    }
  }
  spray.update(paused ? 0 : dt);

  const bands = sim.beast.bands();
  const dreadLive = !paused && (running || sim.phase === PHASE.KILL);

  // The flow channel (Phase 9): the chain drives world brilliance through
  // one pure curve — eased upward link by link, snapped down on a loss so
  // the collapse lands with the drain.
  flowChain = p.chain < flowChain
    ? p.chain
    : flowChain + (p.chain - flowChain) * (1 - Math.exp(-3.5 * dt));
  // REDUCED FLASH keeps the earned brightness but kills the marquee pulse.
  const flowF = dreadLive && running
    ? (ACCESS.reducedFlash
      ? flowGlow(flowLevel(flowChain))
      : flowFactor(flowChain, performance.now() / 1000))
    : 1;
  materialPass.terrain.userData.uP9Flow.value = flowF;
  dataworld.setFlow(flowF);
  trackPylons.setFlow(flowF);
  playerActor.flow = flowF;
  // The score's reading of the run. Music modulates, the run decides: the
  // intensity term is the game's, and the mapping may only tint it.
  const clock = music.update(performance.now());
  musicState = musicResponse(clock, {
    intensity: Math.max(0, Math.min(1,
      0.45 * ((p.speed - TUNING.RUN.FLOOR) / (TUNING.RUN.CEILING - TUNING.RUN.FLOOR))
      + 0.40 * Math.min(1, (p.chain ?? 0) / 8)
      + (p.overdrive ? 0.15 : 0))),
  }, { reducedFlash: ACCESS.reducedFlash, motionScale: ACCESS.reducedFlash ? TUNING.CAMERA.ACCESS_MOTION_SCALE : 1 });
  rig.music = musicState;
  rig.update(dt, p, sim.beast.gap, dreadLive ? bands.shake : 0, killT, sim.terrain,
    sim.beast.x, sim.beast.side);
  stage.followLight(p.x, p.y, -p.d);
  audio.update(dt, p, bands, dreadLive);
  ui.update(dt, sim, dreadLive);
  stage.render();

  if (!shotTaken && sim.phase === PHASE.KILL &&
      sim.killTimer >= TUNING.BEAST.KILL_WHIP_TIME + 0.24) {
    shotTaken = true;
    try { shotUrl = composeShot(canvas); }
    catch { shotUrl = null; }
  }
}

function composeShot(srcCanvas) {
  const w = 720;
  const h = Math.round((srcCanvas.height / srcCanvas.width) * w);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d');
  g.drawImage(srcCanvas, 0, 0, w, h);
  const grad = g.createLinearGradient(0, h * 0.62, 0, h);
  grad.addColorStop(0, 'rgba(10,14,19,0)');
  grad.addColorStop(1, 'rgba(10,14,19,0.24)');
  g.fillStyle = grad;
  g.fillRect(0, h * 0.62, w, h * 0.38);
  return out.toDataURL('image/png');
}

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  last = now;
  tick(Math.min(rawDt, 0.1));
}
requestAnimationFrame(frame);

window.__STATE = () => sim.state();
window.__DEBUG = () => sim.debug();
window.__SIM = sim;
window.__MUSIC = () => ({
  el: music.el, clock: music.clock, state: musicState, fov: rig.camera.fov,
});
window.__TUNING = TUNING;
window.__UI = ui;
window.__RENDER = {
  stage, terrainMesh, props, landmarks, rig, playerActor, beastActor, ghostActor, spray, materialPass,
  wordGateActors, dataworld, streakBurst, bells: bellRenderer,
};
// The tuning panel, for playtesting where there is no console. A dynamic
// import so it lands in its own chunk: a normal load never fetches it.
if (new URLSearchParams(location.search).get('dev') === '1') {
  import('./dev-panel.js').then((m) => m.mountDevPanel()).catch(() => {});
}

window.__INPUT = input;
window.__START = () => { startRun(); return sim.state(); };
window.__QUIT = () => { quitToTitle(); return { phase: sim.phase }; };
window.__GHOST = (on = ghostEnabled) => { setGhostEnabled(on); return { enabled: ghostEnabled }; };
window.__PAUSE = (on = true) => { on ? pauseGame() : resumeGame(); return { paused }; };
window.__SEED = { seed: SEED, string: SEED_STRING };
window.__CHALLENGE = CHALLENGE;
window.__TICK = (n = 1, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) tick(dt);
  return { phase: sim.phase, running, paused, distance: +sim.distance.toFixed(2) };
};
window.__STEP = (n = 1, cmd = {}) => {
  for (let i = 0; i < n; i++) {
    simInput.carve = cmd.carve ?? 0;
    simInput.flip = cmd.flip ?? 0;
    simInput.jump = !!cmd.jump;
    simInput.confirm = !!cmd.confirm;
    simInput.boostHeld = !!cmd.boostHeld;
    sim.step(simInput);
  }
  return sim.state();
};