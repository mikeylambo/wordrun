/**
 * DICTION DASH — entry point. Deterministic game, expressive presentation.
 */

import TUNING from './TUNING.js';
import { Sim, PHASE, emptyInput } from './sim/sim.js';
import { makeGate, wordSeedFor } from './sim/word-gates.js';
import { dailySeed, dailySeedString, hashString } from './sim/rng.js';
import { parseChallenge, buildChallengeLink } from './meta/challenge.js';
import {
  decodeBytes, encodeBytes, expandTrack, trackFromSamples,
} from './meta/ghost-link.js';
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
import { EditorialWorld } from './render/editorial-world.js';
import { Skyline } from './render/skyline.js';
import { LaunchSequence } from './render/launch-sequence.js';
import { AttractMode } from './render/attract.js';
import { GuidedTeach } from './ui/guided.js';
import { KeyLegend, isFramed } from './ui/cabinet.js';
import { modalityFor, stopLine } from './ui/teach-copy.js';
import { breathAt } from './ui/breath.js';
import { PadReader, padConnected } from './input/gamepad.js';
import { ControllerNav } from './ui/controller-nav.js';
import { Judgment } from './ui/judgment.js';
import { BellRenderer } from './render/bells.js';
import { flowFactor, flowGlow, flowLevel } from './render/flow-curve.js';
import { viewPlayer, viewBeast } from './render/view-pose.js';
import { ACCESS, initAccess, buildAccessPanel, toggleFullscreen } from './ui/access.js';
import { applyMaterialPass } from './render/material-pass.js';
import { Audio } from './audio/audio.js';
import { MusicTrack } from './music-track.js';
import { HighLayer } from './audio/high-layer.js';
import { musicResponse } from './render/music-response.js';
import { pickTrack } from './music/setlist.js';
import { Input } from './input/input.js';
import { Storage } from './storage/storage.js';
import { StatsManager, localStorageAdapter } from './meta/stats.js';
import { NemesisLedger } from './meta/nemesis.js';
import { FakeTally } from './meta/fake-tally.js';
import { MasteryLedger } from './meta/mastery.js';
import { Boards, boardKeyFor } from './meta/boards.js';
import { placeFor, insert as insertHiscore } from './meta/hiscore.js';
import { InitialsEntry } from './ui/initials.js';
import { loadDefinitions } from './ui/review-row.js';
import { newlyEarned, medalById } from './meta/medals.js';
import { rankFor } from './ui/results-motion.js';
import { AttractPanels } from './ui/attract-panels.js';
import { TIERS } from './words/wordlist.js';
import { CurveLog } from './meta/curve.js';
import { buildCurveScreen } from './ui/curve-screen.js';
import { DailyManager } from './meta/daily.js';
import { buildStatsExport, formatStatsExport } from './meta/export.js';
import { pickStandout, standoutRank } from './meta/standout.js';
import { MomentCapture } from './render/moment-capture.js';
import { MomentClip } from './ui/moment-clip.js';
import { ObjectiveQueue } from './meta/objectives.js';
import { buildReview } from './meta/review.js';
import { UI } from './ui/ui.js';
import { installShareUi } from './ui/share.js';
import { composeShareCard } from './ui/share-card.js';
import { shareGrid } from './meta/share-grid.js';
import { updateMobileTouchUi } from './ui/touch-controls.js';
import { LIVE_MIX, mountMixPanel } from './audio/live-mix.js';
import { installDevHooks } from './app/dev-hooks.js';
import { ContinueOffer } from './app/continue-offer.js';
import { RunLedger } from './app/run-ledger.js';
import { createSimEventDrain } from './app/sim-events.js';
// Phase 5: the shop, pause and onboarding panels are code-split behind dynamic
// import() — none is needed for the first frame, so keeping them out of the
// main chunk shortens time-to-interactive on the low-end devices Playables
// gets played on. They are preloaded right after the title paints (so they are
// ready before any interaction) and every call site is guarded, so nothing
// breaks in the window before a chunk lands. See loadPanels() below.

const canvas = document.getElementById('gl');
const appEl = document.getElementById('app');
const stage = new Stage(canvas);
const ui = new UI();
const audio = new Audio();
const music = new MusicTrack();
// RC10.6 — which score this session plays. The index only goes up; the
// setlist wraps it, so consecutive sittings walk the list in order rather
// than rolling dice and repeating. With one track it is today's behaviour
// exactly. Read and advanced through Storage directly because the meta
// adapter is built further down and this runs at boot.
const musicPick = pickTrack(Storage.nextMusicIndex());
music.load(musicPick?.id);
// RC9.7: the second layer. One hook re-opened from the retired stem engine —
// it thickens the arrangement while the chain holds the third editorial band
// and thins out when the chain breaks. Same bus, same ducks, no visual.
const highLayer = new HighLayer();
highLayer.load(musicPick?.id);
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
// FINISH is a rule of the played game (sim/finish.js); headless tools leave it off.
sim.endgame = true;
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
// Phase M: the Editorial World — the page geometry beside the track, set
// denser as the run's band rises and struck through as the Redline closes.
const editorialWorld = new EditorialWorld(stage.scene, sim.terrain);
// The key art's city: distant monoliths and roadside lightbox signs.
const skyline = new Skyline(stage.scene, sim.terrain);
const launch = new LaunchSequence();
// RC6: a cabinet is never idle. Ten quiet seconds on the title and the best
// run replays itself down the road behind the wordmark; any touch takes the
// machine back. Presentation only — it drives the same pose the camera has
// always followed and restores what it found (see render/attract.js).
const attract = new AttractMode({
  sim,
  playerActor,
  loadGhost: () => Storage.loadGhost(SEED),
  // RC11.8: the attract raises no HUD. A score, hearts and a dash meter over a
  // road with no word on it are the readouts of a run nobody is having.
  onEnter: () => { ui.showHud(false); },
  onExit: () => { ui.showHud(false); },
});
// RC13.7 — what the cabinet shows over the demo, in turn: the device's two
// top-ten tables (today's DAILY RUN, ENDLESS at the chosen difficulty) and
// the three verbs. Same board keys the results card writes.
const attractPanels = new AttractPanels({
  loadTables: () => {
    const daily = boardKeyFor({ mode: 'standard', difficulty: BOARD.DAILY_DIFFICULTY, day: dailySeedString() });
    const endless = boardKeyFor({ mode: 'endless', difficulty: runDifficulty });
    return [
      { title: 'DAILY RUN · TODAY', rows: Storage.hiscores(daily) },
      { title: `ENDLESS · ${String(runDifficulty).toUpperCase()}`, rows: Storage.hiscores(endless) },
    ];
  },
});
const guided = new GuidedTeach();
const keyLegend = new KeyLegend();

// RC7: the three stops — has this player been SHOWN each of them? Shown, not
// merely performed: the fake stop's correct answer is to do nothing, so a
// player who learns it by letting the word pass must not be stopped again.
// While any remains unshown and GUIDED TIPS is on, an ENDLESS run opens on
// the guided chart and the sim freezes at each first instance (the DAILY
// course is never touched, for anyone).
function stopsDone() {
  return metaStats.get('usedStopReal', 0) > 0 &&
    metaStats.get('usedStopFake', 0) > 0 &&
    // RC7.1: the dash retires on a real HOLD — the same flag an actual dash
    // has always written — not on having been shown the stop. The other two
    // teach an answer that must be given to continue; this one teaches a
    // power, and a power is not learned by being told about it.
    metaStats.get('usedDash', 0) > 0;
}
function chartForRun() {
  if (runMode === 'standard') return 'daily';
  return ACCESS.guidedTips && !stopsDone() ? 'guided' : 'endless';
}
// RC10.1 — the pad, owned here rather than patched into Input at import time.
// One reader writing the same flags a thumb writes, and one navigator driving
// the menus by focusing and activating the real buttons.
const pad = new PadReader();
const controllerNav = new ControllerNav(pad);
// RC11.4 — the judgment word and the chain, at arcade weight. One owner for
// both: ui.js used to write the chain into an element CSS had hidden.
const judgment = new Judgment();
const dashFlareEl = document.getElementById('dashFlare');
const meterLabelEl = document.getElementById('meterLabel');
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
// Phase Q: the flow level the run ENDED on, sampled every running frame
// BEFORE the death-frame snap zeroes flowChain — the results card enters in
// this band, and the world behind it holds the same earned brightness.
let endedFlowLevel = 0;
// E2 punctuation state: the last world band seen (arrival beats fire on the
// rise) and whether the run has been inside the Redline's scream range
// (real daylight opened from there gets the release).
let worldBand = 0;
let inScream = false;
// The run's own tallies (gate trail, PERFECTs, the E4 brilliance ledgers,
// words retired and learned) — src/app/run-ledger.js, reset once per run.
const run = new RunLedger();
// RC9.8: the rolling few seconds, and the rarity of the moment it is frozen
// on. The buffer freezes when a brilliance ledger crosses its floor, so the
// clip on the card is the moment the card is ABOUT.
const moments = new MomentCapture(canvas, ACCESS);
const momentClip = new MomentClip();
momentClip.mount(document.getElementById('momentSlot'));
let frozenRank = 0;
let lastRunGhost = '';   // RC10.5: the run just played, as link-sized speeds
let breathing = false;   // RC9.9: is the held breath currently being written
let deathShownAt = 0;
let shotUrl = null;
let shotTaken = false;
let ghostEnabled = Storage.ghostEnabled();

// ── Mode + difficulty (Phase 10) ─────────────────────────────────────────
// Two rule sets (ENDLESS open-ended, STANDARD the fixed daily route; both
// repair a heart on a clean streak since Phase H2) × three reading
// difficulties (word-tier curve + Redline pace).
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

const BOARD = TUNING.META.BOARD_POLICY;
// Phase J: the DAILY RUN is scored on one difficulty. While the DAILY chip is
// on, the difficulty is forced to it and the row is locked — shown, never
// said. The player's ENDLESS difficulty preference is left untouched.
function effectiveDifficulty() {
  return runMode === 'standard' ? BOARD.DAILY_DIFFICULTY : runDifficulty;
}

function syncVariant() {
  Storage.setVariant(runMode === 'endless' && runDifficulty === 'normal'
    ? '' : `${runMode}.${effectiveDifficulty()}`);
}
syncVariant();


// Meta layer (ported from the SLU shell's Layer-1 managers): lifetime
// stats, daily goals and the play streak, over one storage adapter.
// RC10.7 — boards, dark. No endpoint is configured in the shipped build, so
// `enabled` is false, no surface appears and nothing is ever sent. The module
// exists now so the board key, the eligibility rule and the submission shape
// are decided and gated in one place rather than invented the day a server
// turns up; db/schema.sql is the other half, applied nowhere.
//
// The transport is a DYNAMIC import inside boards.open(), so the one module
// that can make a request is not in the boot graph and a run cannot reach it.
const boards = new Boards({});

const metaAdapter = localStorageAdapter();
const metaStats = new StatsManager(metaAdapter);
// The per-word ledger rides the same adapter seam as the stats.
const nemesis = new NemesisLedger(metaAdapter);
// How often each kind of fake fools this player — exported with STATS.
const fakeTally = new FakeTally(metaAdapter);
// RC10.3 — the words this player has actually learned. A word counts once it
// has been read right and is not currently owed a repeat, so the two systems
// agree by construction: the ledger owns "still practising", this owns "done".
// The predicate is OUTSTANDING MISSES, not "has an entry": the ledger records
// every word it sees, so `history(w)` is true of a word read right the first
// time and would have made mastery uncountable for a good reader. `m > 0` is
// the state that actually means "this one is still being practised".
const mastery = new MasteryLedger(metaAdapter, (w) => (nemesis.history(w)?.m || 0) > 0);
const curve = new CurveLog(metaAdapter);
buildCurveScreen(() => ({
  series: curve.series(14),
  beaten: nemesis.beatenWords(),
  // RC6: what left the results card. PROFILE is where progression is read.
  daily: metaDaily.status(DAILY_SEED),
  objectives: metaObjectives.status(),
  currency: metaStats.get('currency', 0),
  best: Storage.bestFor(SEED),
  // RC10.3: the learning, tier by tier. The bank's own lists go in so the
  // ledger needs to know nothing about how words are grouped.
  mastery: { total: mastery.count, tiers: mastery.byTier(TIERS) },
  medals: Storage.medals(),
}));
const metaDaily = new DailyManager(metaAdapter);

// Which controls this player has ever used. The in-run coach teaches a control
// until it has been used once and then never mentions it again, so these are
// write-once flags rather than counters — see UI._updateCoach.
// RC9.3: the same four flags feed the cabinet's keyboard legend, which dims
// each glyph once its control has been used. One source, so the legend and
// the coach can never disagree about what this player has learned.
let learnedNow = {};
function pushLessons() {
  learnedNow = {
    confirm: metaStats.get('usedConfirm', 0) > 0,
    reject: metaStats.get('usedReject', 0) > 0,
    dash: metaStats.get('usedDash', 0) > 0,
    bar: metaStats.get('usedBar', 0) > 0,
  };
  ui.setLessons(learnedNow);
  // RC9.4: the DAILY RUN's one-line explanation is a lesson like any other —
  // same ledger, same write-once flag, retired by the action it describes.
  ui.setDailyNote({
    selected: runMode === 'standard',
    learned: metaStats.get('usedDaily', 0) > 0,
    gates: TUNING.MODES.RULES.standard.GATES,
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
// The overlay panels (settings AND the shop) freeze the run while open
// (playtest: the game carried on behind them, so checking a setting — or
// buying a runner light — cost you hearts). This is a quiet freeze, not
// pauseGame — that would raise the pause menu on top of the panel. Input is
// released so a held DASH does not survive the panel; input only re-arms if
// the run is actually still live when the panel closes.
let panelFroze = false;
function freezeForPanel() {
  if (!running || sim.phase !== PHASE.RUNNING || paused) return;
  panelFroze = true;
  paused = true;
  input.enabled = false;
  input.releaseAll();
}
function unfreezeForPanel() {
  if (!panelFroze) return;
  panelFroze = false;
  paused = false;
  if (running && sim.phase === PHASE.RUNNING) input.enabled = true;
  input.releaseAll();
}
const accessUI = buildAccessPanel({
  onOpen: freezeForPanel, onClose: unfreezeForPanel,
  // PD-3: the settings sheet's GAME/AUDIO chips reach the state main owns.
  getGhost: () => ghostEnabled,
  setGhost: (on) => setGhostEnabled(on),
  getMuted: () => audio.muted,
  setMuted: (m) => {
    audio.start();
    audio.setMuted(m);
    ui.mute.textContent = m ? '×' : '♪';
  },
  // RC-5: the AUDIO group is a two-line mix now. Both apply live.
  setMusicMuted: (m) => { audio.start(); audio.setMusicMuted(m); },
  setSfxMuted: (m) => { audio.start(); audio.setSfxMuted(m); },
  // RC6: the ◆ balance is a row in the sheet now, not a corner button.
  getBank: () => metaStats.get('currency', 0),
});
// The saved mix applies to the graph as soon as it exists, so a player who
// turned the score off last session does not hear it come back on launch.
audio.setMusicMuted(ACCESS.musicOff);
audio.setSfxMuted(ACCESS.sfxOff);

document.addEventListener('dictiondash:dash-ready', () => audio.dashReady());
// RC13.7 — the coin-op set, fired by the surfaces that own each moment.
document.addEventListener('dictiondash:count-in', (e) => audio.countIn(!!e.detail?.go));
let lastTallyTick = 0;
document.addEventListener('dictiondash:tally-tick', () => {
  const now = performance.now();
  if (now - lastTallyTick > 45) { lastTallyTick = now; audio.tallyTick(); }
});
document.addEventListener('dictiondash:rank', (e) => {
  if (e.detail?.rank) audio.rankStamp(e.detail.rank);
  if (e.detail?.pb) audio.highScore();
});
// RC6: HOW TO PLAY is asked for by event now (the ⚙ sheet, the pause menu).
// Force the chunk in, so an early ask cannot land before the listener does.
document.addEventListener('dictiondash:show-how', () => {
  loadOnboarding().then((o) => o.showHelp());
});

// The DASH teaching beat (Phase 16) runs until the player has used the
// mechanic once — ever, not per run. __DASH_LEARNED lets the mobile
// button read the same state without importing the UI.
let dashLearned = Storage.dashLearned();
globalThis.__DASH_LEARNED = dashLearned;
ui.setDashLearned(dashLearned);

ui.setChallenge(CHALLENGE);
ui.setSeed(SEED_STRING, Storage.bestFor(SEED), Storage.runsToday(SEED), Storage.bestAllTime());
pushLessons();
ui.setDaily(metaDaily.status(DAILY_SEED));
ui.setMastery(mastery.count, nemesis.toughest());
ui.showTitle(true);
input.onFirstGesture = () => audio.start();
// Playtest 10/8: the title was silent until BEGIN RUN. A browser plays no
// sound before the page's first gesture, so the score starts on the FIRST
// tap, click or key anywhere — on the title, which is where that happens.
// Once only; a run started from here simply keeps the score going.
{
  const titleMusic = () => {
    window.removeEventListener('pointerdown', titleMusic, true);
    window.removeEventListener('keydown', titleMusic, true);
    audio.start();
    music.attach(audio);
    if (sim.phase === PHASE.TITLE) music.play();
  };
  window.addEventListener('pointerdown', titleMusic, true);
  window.addEventListener('keydown', titleMusic, true);
}

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
  btn.textContent = 'PROFILE';
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
  // RC6: the title carries the wordmark, BEGIN RUN, the modes and PROFILE.
  // HOW TO PLAY moved inside the one ⚙ sheet (PD-3 put it on the title to
  // keep it out of a settings hunt; the sheet is no longer a hunt — it is
  // two actions and three short groups, and the cabinet wants one way in).
  // The pause menu's entry is unchanged, and both reach the same card.
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

// RC-4: an arrival is covering a run that has not been built yet. A second
// tap during the fade must not start a second run.
let launchPending = false;

function startRun({ instant = false } = {}) {
  if (initials.isOpen) initials.commit();   // RC13.7: R / Enter / AGAIN all keep the score
  initials.close();
  // PD-2: the full arrival plays from the MENU; a retry (AGAIN, the pause
  // menu's restart, a finish-card rerun) gets the one-second cut. The phase
  // is read HERE, while it is still the phase the player tapped from — the
  // run that overwrites it is not built until the black frame.
  //
  // RC-4 — THE ORDER, fixed properly: menu → fade to black → the storm →
  // gameplay. This function now does nothing but start the fade over
  // whatever is on screen; the run itself is BUILT IN THE DARK, on the
  // first solid-black frame (buildRunInTheDark below). Previously the world
  // was swapped here and the veil faded in on top of it, so the player
  // watched ~0.8s of gameplay before the black — the menu had already gone.
  if (launchPending) return;
  const fromTitle = sim.phase === PHASE.TITLE;
  launchPending = true;
  audio.start();
  music.attach(audio);
  music.play();
  highLayer.attach(audio);
  launch.begin({ quick: !fromTitle, instant: instant && !fromTitle, onBlack: buildRunInTheDark });
  audio.launch(!fromTitle);
}

/**
 * RC10.5 — who you are running against.
 *
 * A challenge link may carry the challenger's own run (meta/ghost-link.js), and
 * when it does, THAT is the ghost: it is the reason the link was opened. The
 * local best is what you race on your own road, and a rival is what you race on
 * someone else's dare — offering the wrong one would answer a question nobody
 * asked. The BEST RUN switch still governs both, because a player who has
 * turned ghosts off has said something about ghosts, not about whose.
 *
 * The speeds are integrated against THIS terrain, which is the same terrain
 * the challenger ran: the seed authors the road, so the rebuilt runner stands
 * exactly where they stood.
 */
function ghostForRun() {
  if (!ghostEnabled) return null;
  if (CHALLENGE?.ghost) {
    const bytes = decodeBytes(CHALLENGE.ghost);
    const rival = bytes && expandTrack(bytes,
      (d) => { const x = sim.terrain.corridorX(d); return { x, y: sim.terrain.heightAt(x, d) }; });
    if (rival) return rival;
  }
  return Storage.loadGhost(SEED);
}

function buildRunInTheDark() {
  launchPending = false;
  const ghostData = ghostForRun();
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
  run.reset();
  sim.start(SEED, ghostData, {
    wordSalt: currentSalt,
    mode: runMode,
    difficulty: effectiveDifficulty(),
    chart: chartForRun(), // PD-1: 'guided' opening for a first-timer, ENDLESS only
    // ENDLESS only — sim.start refuses it on a route, which is where the
    // rule lives rather than here.
    nemesisLane: (index) => nemesis.substituteFor(index),
  });
  // RC9.2: a challenge starts on the bar the challenger finished on, so both
  // runs are priced the same way from the first gate. It is a starting point,
  // not a lock — the bar is the one dial that belongs to the player, and the
  // hold that moves it works exactly as it always does.
  if (CHALLENGE) sim.player.compressionLevel = CHALLENGE.bar | 0;
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
  endedFlowLevel = 0;
  editorialWorld.reset(); // the manuscript starts sparse each run
  skyline.reset();
  // N4: the authored launch is ALREADY playing — startRun began it, and this
  // function is its black frame. Presentation only; input never blocks.
  worldBand = 0;
  inScream = false;
  frozenRank = 0;
  ui.resetCoach();   // RC10.8: the bar lesson gets one showing per run
  judgment.reset();  // RC11.4: no judgment or chain carries into a new run
  moments.begin(ACCESS);
  momentClip.hide();
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
// RC9.2: and the bar it was played at. A challenge is only the same dare if
// both runs start on the same compression level, so the link carries it — and
// the honest value to carry is the one the run ENDED on, which is the level
// the score in the link was actually earned under.
let lastRunBar = 0;
// Every resolved gate of this run, by index: 1 right, 0 wrong. The DAILY
// RUN's share text is drawn from it (meta/share-grid.js).
let lastRunGrid = '';
let lastRunScoreLost = 0;
// What the continues took off the live score this run, kept so the death card
// can still say "−N · 2 CONTINUES" now that the cut happens during the run.
let continueScoreLost = 0;
const CONT = TUNING.META.CONTINUE;
// The offer screen itself — src/app/continue-offer.js. The price and what a
// continue does to the run stay here; the offer only asks.
const continueOffer = new ContinueOffer({
  audio,
  onBuy: () => buyContinue(),
  onDecline: () => declineContinue(),
});

const continueCost = () =>
  Math.floor(CONT.BASE_COST * Math.pow(CONT.COST_GROWTH, continuesUsed));

function onDead() {
  if (continueOffer.active) return;
  running = false;
  paused = false;
  input.enabled = false;
  pauseUI?.setPaused(false);
  pauseUI?.setButton(false);
  const cost = continueCost();
  if (continueOffer.available && metaStats.get('currency', 0) >= cost) {
    continueOffer.show(cost, metaStats.get('currency', 0));
    return;
  }
  finalizeRun();
}

// Debug pass: the FINISH choice (the endgame overlay's END RUN button) ends
// the run through the SAME results pipeline as a death — the count-up, the
// recap, the standout, the board write — instead of quitting to the title
// with nothing shown and nothing recorded. No continue offer here: a
// finished route is a completed run, not a death to buy back.
function onFinishRun() {
  if (!running) return;
  running = false;
  paused = false;
  input.enabled = false;
  pauseUI?.setPaused(false);
  pauseUI?.setButton(false);
  finalizeRun();
}

/** The offer was declined or ran out: the card proceeds. */
function declineContinue() {
  finalizeRun();
}

function buyContinue() {
  const cost = continueCost();
  if (metaStats.get('currency', 0) < cost) { continueOffer.decline(); return; }
  continueOffer.hide();
  audio.credit();
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
  lastRunGrid = runMode === 'standard' ? shareGrid({
    trail: run.gateTrail, gates: TUNING.MODES.RULES.standard.GATES, score: finalScore,
    finished: !!sim.escaped || sim.routeFinished, seedString: SEED_STRING,
  }) : '';
  lastRunBar = sim.player.compressionLevel | 0;
  lastRunScoreLost = (earned - finalScore) + continueScoreLost;
  // Unassisted runs own the boards: a continued run reports its distance
  // but cannot set the best or leave a ghost (see CONTINUE tuning note).
  // Phase J: and the DAILY RUN is recorded on its one board difficulty only
  // (a challenge link can pin another; that run keeps its score, not a best).
  const boardEligible = !runContinued &&
    (runMode !== 'standard' || effectiveDifficulty() === BOARD.DAILY_DIFFICULTY);
  // RC10.7: and offer it to a board, if one exists. It does not: `boards` has
  // no endpoint, so this resolves to null without touching the network. The
  // call is here so the eligibility rule has exactly one home — the same
  // `boardEligible` the local best already respects.
  if (boardEligible && boards.enabled) {
    boards.submit({
      mode: runMode,
      difficulty: effectiveDifficulty(),
      continued: runContinued,
      // The DAILY RUN's own date, which is what makes a daily board
      // comparable: everyone that day read the identical hundred words.
      day: dailySeedString(),
      name: Storage.boardName(),
      score: finalScore,
      seedString: SEED_STRING,
      distance,
      gates: wg.readCount,
      seconds: sim.time,
    });
  }
  const isPb = boardEligible ? Storage.setBestFor(SEED, finalScore) : false;
  // RC13.7 — the cabinet's table. Same board key a server would use, so the
  // same runs count; a run that makes the top ten asks for initials.
  hiscoreBoard = boardEligible ? boardKeyFor({ mode: runMode, difficulty: effectiveDifficulty(),
    continued: runContinued, day: dailySeedString() }) : null;
  const hiPlace = hiscoreBoard ? placeFor(Storage.hiscores(hiscoreBoard), finalScore) : 0;
  hiscoreScore = finalScore;
  loadDefinitions();   // RC13.9: warm the review panel's chunk while the card is up
  if (hiPlace) initials.open({ place: hiPlace, initials: Storage.lastInitials() });
  else initials.close();
  if (isPb) ui.setAllTimeBest(Storage.bestAllTime());
  if (boardEligible) {
    sim.recorder.finish(sim.player);
    Storage.saveGhostIfBest(SEED, sim.recorder.serialize({ seed: SEED, distance }));
    // RC10.5: the same run, resampled small enough to travel in a link.
    lastRunGhost = encodeBytes(trackFromSamples(sim.recorder.samples));
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
    perTier: run.tierTally, avgReadMs, reads: wg.readCount,
    retired: run.retiredThisRun.length,
  });
  // Bells bank the spendable balance (Phase 8): a bare number, no name.
  const banked = (sim.bellsCollected || 0) * TUNING.META.CURRENCY_PER_BELL;
  if (banked > 0) metaStats.increment('currency', banked);
  const dailyCard = metaDaily.recordRun(DAILY_SEED, {
    distance, bestChain: sim.player.bestChain, correct: wg.correctCount,
  });
  // RC9.4: a finished DAILY RUN retires its own explanation. It is written
  // here rather than at the start of one, because a run abandoned on the
  // title has not taught anybody what the mode is.
  if (runMode === 'standard') learn('Daily');
  // RC13.8 — medals: this run's feats plus the lifetime figures, judged once.
  const medalIds = newlyEarned({
    bestChain: sim.player.bestChain, perfects: run.perfectsThisRun,
    rank: rankFor({ correct: wg.correctCount, wrong: wg.wrongCount, perfects: run.perfectsThisRun }),
    score: finalScore, continued: runContinued, madeTable: hiPlace > 0,
    finished: !!sim.escaped || !!sim.routeFinished, wrong: wg.wrongCount,
  }, { streak: dailyCard?.streak || 0, learned: mastery.count, beaten: nemesis.retiredCount },
  Storage.medals());
  if (medalIds.length) Storage.addMedals(medalIds);
  const medalsWon = medalIds.map((id) => {
    const m = medalById(id);
    const lit = m.unlocks && TUNING.META.COSMETICS.find((c) => c.id === m.unlocks);
    return lit ? `${m.label} · ${lit.label} LIT` : m.label;
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
    chainMetres: sim.chainMetres || 0,
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
    retired: run.retiredThisRun,
    gates: wg.next,
    routeGates: sim.rules?.GATES | 0,
    // PD-2: THIS run's reading, for the scorecard — the stat bar used to
    // quietly show the lifetime accuracy under a run's own numbers.
    correct: wg.correctCount,
    wrong: wg.wrongCount,
    bestChain: sim.player.bestChain,
    perfects: run.perfectsThisRun,
    medals: medalsWon,
    // RC-2: ONE reward figure on the card — bells plus cleared objectives,
    // already banked above; the card only reports the total.
    reward: banked + (objectives.reward || 0),
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
    // A run that reached the finish gets the card under its own name —
    // FINISH, one of the four — whether it ended by choice or in overrun.
    finished: !!sim.escaped,
    challengeResult: CHALLENGE
      ? { goal: CHALLENGE.goal, beaten: CHALLENGE.goal > 0 && finalScore > CHALLENGE.goal }
      : null,
    endFlow: endedFlowLevel,
    // E4: the run's ONE standout, or null for an ordinary run — scarcity
    // is what keeps the line meaning something.
    standout: pickStandout({
      dashRung: run.dashRungMax, earlyStreak: run.bestEarlyStreak, burst10: run.burst10,
      bestChain: sim.player.bestChain, avgReadMs, reads: wg.readCount,
    }),
    // RC10.3: words this run took from "getting wrong" to "know". Only when
    // it happened — an ordinary run says nothing, exactly like the standout.
    learnedWords: run.learnedWords,
    masteredTotal: mastery.count,
  });
  // RC9.8: the clip, and ONLY when the run earned a standout. No standout, no
  // frozen moment, no player and no button — an ordinary run is offered a
  // still and nothing else, which is the same scarcity the line is built on.
  momentClip.show(frozenRank > 0 ? moments.moment() : null, endedFlowLevel);
  ui.showHud(false);
  ui.showDeath(true);
  deathShownAt = performance.now();

  // Re-warm the plates for the NEXT attempt's fresh words while the death
  // card idles, keeping the AGAIN tap as hitch-free as the first BEGIN RUN.
  warmPlates();
}

/** Pre-paint the next attempt's first two plates (salt + difficulty aware). */
function warmPlates() {
  const d = TUNING.MODES.DIFFICULTY[effectiveDifficulty()];
  const prof = {
    TIER_MIN: d.TIER_MIN, TIER_MAX: d.TIER_MAX, TIER_EVERY_M: d.TIER_EVERY_M,
    CHART: chartForRun(), // PD-1: warm the plates for the chart the run will play
  };
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
  if (initials.isOpen) initials.commit();
  initials.close();
  // RC10.3: the title's learned count is the one number a run can move, so it
  // is refreshed on the way back rather than only at boot.
  ui.setMastery(mastery.count, nemesis.toughest());
  paused = false;
  running = false;
  input.enabled = false;
  input.releaseAll();
  sim.phase = PHASE.TITLE;
  // Playtest 10/8: a quit run left its ×N chain on the title. Nothing the
  // run was saying — judgment, chain, score pops — survives to the menu.
  judgment.reset();
  pauseUI?.setPaused(false);
  pauseUI?.setButton(false);
  // No overlay panel survives the trip to the title — the overlap bug was
  // the settings sheet still open over a freshly shown title screen.
  panelFroze = false;
  launchPending = false;
  launch.cancel();
  accessUI?.panel.classList.remove('on');
  shopUI?.panel.classList.remove('on');
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
  if (!ghostEnabled) { sim.ghost.load(null); return; }
  // Turning BEST RUN back on mid-run should visibly work now, not at the
  // next restart: load the replay — the challenger's, on a dare — and
  // seek it to the run's clock.
  const data = ghostForRun();
  sim.ghost.load(data);
  if (data) {
    sim.ghost.t = Math.max(0, Math.min(sim.time, Math.max(0, sim.ghost.duration - 0.001)));
    sim.ghost.step(0);
  }
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
    shopUI = buildShopPanel({
      stats: metaStats, onEquip: applyCosmetic,
      onOpen: freezeForPanel, onClose: unfreezeForPanel,
    });
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

function onAdvance({ deliberate = false } = {}) {
  if (running || paused || onboarding?.visible || continueOffer.active || launchPending) return;
  // PD-2: ONE modal rule for every overlay — a tap on or around ANY open
  // sheet (settings, shop, profile) can never start a run underneath it.
  // The pause menu and the continue offer are covered by the flags above.
  if (document.querySelector('#accessPanel.on, #shopPanel.on, #curveScreen.on')) return;
  // A tap during the kill cam cuts straight to the card — but only once the
  // share frame has been taken, so skipping never costs the player the image
  // of how it ended. (Before this, every death cost the full 1.5 s.)
  if (sim.phase === PHASE.KILL) {
    if (shotTaken) sim.skipKillCam();
    return;
  }
  // The same settle guard covers both ways a card can appear: a death (phase
  // DEAD) and a finished route (phase still RUNNING, sim.escaped set). It
  // exists to stop a tap aimed at the dying run from starting the next one;
  // R is the retry key and cannot be an accident, so it is not held back.
  if (!deliberate && (sim.phase === PHASE.DEAD || sim.escaped) &&
      performance.now() - deathShownAt < 350) return;
  audio.uiTap();
  // RC6: BEGIN RUN starts the run — for everyone, on the first tap of the
  // first session included. A card between the player and the game is the
  // wrong first beat for a cabinet, and the teaching is already in the run:
  // TEACH carries the fundamentals and the study stop waits for the first
  // answer of each verb. The six-rule sheet is a REFERENCE now, reachable
  // whenever it is wanted (HOW TO PLAY, and the pause menu) and never
  startRun({ instant: deliberate });
}

window.addEventListener('pointerup', (e) => {
  // RC6: the first touch of an attract loop belongs to ending it — it puts
  // the machine back in the player's hands and starts nothing by surprise.
  // A tap on a button still reaches that button's own handler.
  if (attract.active) { attract.exit(); return; }
  if (e.target.closest?.('[data-rc2-ui],[data-rc7-ui],button')) return;
  onAdvance();
});
window.addEventListener('keydown', (e) => {
  // Backtick opens the tuning panel — first, so it works from the title, a
  // live run or a pause. Never while a field has focus: the panel's own
  // search box and JSON box are places you type a backtick on purpose.
  if (e.code === 'Backquote' && !e.repeat && !/^(INPUT|TEXTAREA)$/.test(e.target?.tagName || '')) {
    e.preventDefault();
    devTools.toggleDevPanel();
    return;
  }
  // F is the arcade convention and the one key a desktop player tries. Not
  // while a field has focus, and not while onboarding owns the screen.
  if (e.code === 'KeyF' && !e.repeat && !/^(INPUT|TEXTAREA)$/.test(e.target?.tagName || '')) {
    e.preventDefault();
    toggleFullscreen();
    return;
  }
  if (onboarding?.visible) return;
  // Any key ends the attract loop, exactly as any touch does.
  if (attract.active) { attract.exit(); return; }
  // RC13.7: while initials are being entered, the letters are theirs.
  if (initials.isOpen && initials.key(e)) { e.preventDefault(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (sim.phase === PHASE.RUNNING) {
      e.preventDefault();
      paused ? resumeGame() : pauseGame();
    }
    return;
  }
  if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'KeyR') return;
  onAdvance({ deliberate: e.code === 'KeyR' && !e.repeat });
});

// Mode/difficulty chips: persist the choice, swap the storage variant,
// refresh the per-variant best and re-warm the next attempt's plates.
function syncModeChips() {
  for (const b of document.querySelectorAll('#modeRow .modeChip')) {
    b.classList.toggle('on', b.dataset.mode === runMode);
  }
  const locked = runMode === 'standard' && !CHALLENGE;
  for (const b of document.querySelectorAll('#difficultyRow .modeChip')) {
    b.classList.toggle('on', b.dataset.difficulty === effectiveDifficulty());
    b.classList.toggle('locked', locked);
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
    if (runMode === 'standard') return; // locked: the DAILY RUN has one difficulty
    runDifficulty = chip.dataset.difficulty;
    Storage.setDifficultyPref(runDifficulty);
  }
  syncVariant();
  syncModeChips();
  ui.setSeed(SEED_STRING, Storage.bestFor(SEED), Storage.runsToday(SEED), Storage.bestAllTime());
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

// RC13.7 — initials for a top-ten run, written to the device's table.
let hiscoreBoard = null;
let hiscoreScore = 0;
const initials = new InitialsEntry({
  host: document.getElementById('initialsRow'),
  onCommit: (i) => {
    if (!hiscoreBoard) return;
    const { rows } = insertHiscore(Storage.hiscores(hiscoreBoard),
      { initials: i, score: hiscoreScore, time: Date.now() });
    Storage.setHiscores(hiscoreBoard, rows);
    Storage.setLastInitials(i);
    audio.credit();
  },
});
const deathAgain = document.getElementById('deathAgain');
const deathMenu = document.getElementById('deathMenu');
deathAgain?.addEventListener('click', (e) => {
  e.stopPropagation();
  initials.commit();   // leaving the card never loses a qualifying score
  audio.uiTap();
  startRun();
});
deathMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  initials.commit();
  audio.uiTap();
  quitToTitle();
});

// THE CHALLENGE LINK (Phase 14, folded into SHARE at RC9.2): the run just
// played, encoded. Whoever opens it stands at the start of the same track,
// same rules, same words, same bar, with this score as the target.
//
// It stopped being a button of its own. LINK sat beside SHARE doing half of
// what a player means by sharing a run, and the half they would skip: the
// image travels and the dare stays behind. One tap now does both — ui/share.js
// owns the act, and this owns the coordinates, because main is the only file
// that knows which seed, salt and bar the run was actually played at.
//
// The link is a URL and nothing else: no request is made to build it, and
// `audit:network` still measures zero at play time.
function challengeLinkForLastRun() {
  return buildChallengeLink(
  location.origin + location.pathname, {
    seedString: SEED_STRING,
    mode: runMode,
    difficulty: effectiveDifficulty(),
    salt: currentSalt,
    goal: lastRunScore,
    bar: lastRunBar,
    // RC10.5: and the run itself, so the link is an opponent rather than a
    // number. The recorder's samples are already in hand — this only
    // resamples them down to something a message can carry.
    ghost: lastRunGhost,
  });
}

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
    retired: run.retiredThisRun,
    gates: wg.next,
    routeGates: sim.rules?.GATES | 0, distance: sim.distance, seconds: sim.time,
      mode: runMode, difficulty: effectiveDifficulty(), continued: runContinued,
      correct: wg.correctCount, wrong: wg.wrongCount,
      falseTaps: wg.falseTaps, missedReals: wg.missedReals,
      bestChain: p.bestChain, peakSpeed: p.peakSpeed, endSpeed: p.speed,
      dashMeterSpent: p.boostSpent, heartsLeft: sim.hearts,
      bells: sim.bellsCollected, endGap: sim.beast.gap,
    },
    tuning: TUNING,
    access: ACCESS,
    seed: SEED_STRING,
    fakes: fakeTally.snapshot(),
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
  // RC-2: the fold. The card shows five moments; MORE STATS opens the
  // analysis (run shape, objectives, stat bar) and the share row with it.
  const more = e.target.closest('#moreStats');
  if (more) {
    e.stopPropagation();
    audio.uiTap();
    const deepStats = document.getElementById('deepStats');
    const opening = !!deepStats?.hidden;
    if (deepStats) deepStats.hidden = !opening;
    more.textContent = opening ? 'LESS STATS ‹' : 'MORE STATS ›';
    ui.deathScreen.classList.toggle('deepOpen', opening);
    return;
  }
  if (!e.target.closest('#missedOpen')) return;
  e.stopPropagation();
  audio.uiTap();
  ui.renderMissedPanel((w) => nemesis.history(w));
  // RC13.9: the definitions chunk is usually here already (prefetched on the
  // results card); if not, the rows repaint with their meanings when it lands.
  loadDefinitions().then(() => ui.renderMissedPanel((w) => nemesis.history(w)));
  missedPanel?.classList.add('on');
});
document.getElementById('missedClose')?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.uiTap();
  missedPanel?.classList.remove('on');
});
missedPanel?.addEventListener('click', (e) => e.stopPropagation());

// The hidden ?mix=1 calibration dock (audio/live-mix.js) — never in release.
if (LIVE_MIX.enabled) mountMixPanel();

// SAVE and SHARE are one system (ui/share.js); main supplies the coordinates.
installShareUi({
  challengeLink: () => challengeLinkForLastRun(),
  score: () => sim.score,
  // The DAILY RUN travels as text too — ten squares, no words spoiled.
  shareText: () => lastRunGrid,
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (running && sim.phase === PHASE.RUNNING) pauseGame();
    else audio.suspend();
    input.releaseAll();
  }
});

// Sim events → presentation: src/app/sim-events.js. The drain reacts with
// the systems built above and writes back only the hit-stop and the
// dash-learned flag, through the two accessors here.
const drainSimEvents = createSimEventDrain({
  sim, run, learn, audio, spray, ui, rig, windStreaks, music, streakBurst,
  editorialWorld, fakeTally, judgment, nemesis, mastery, wordGateActors,
  get hitStop() { return hitStop; },
  set hitStop(v) { hitStop = v; },
  get dashLearned() { return dashLearned; },
  set dashLearned(v) { dashLearned = v; },
});

let last = performance.now();

function tick(dt) {
  const p = sim.player;
  // Phase R: how far this render frame sits between fixed sim steps. 1 when
  // the sim did not advance (paused, title) so the view is the live state.
  let alpha = 1;

  if (!paused && (running || sim.phase === PHASE.KILL)) {
    input.update(dt, !p.airborne);
    pad.update(input);
    simInput.carve = input.carve;
    simInput.flip = input.flip;
    // Phase C: two zones, one primitive. The right half (or the right arrow,
    // or D) says the word is real; the left half (or the left arrow, or A)
    // says it is fake. Saying nothing still says fake. The sim never jumps —
    // the ground stays under the word.
    simInput.confirm = input.jump;
    simInput.reject = input.reject;
    // Playtest 10/8: the PRESS itself gets a tell — the instant it lands, on
    // the side that was pressed, before (and apart from) the verdict.
    if (running && (simInput.confirm || simInput.reject)) ui.pressTell(simInput.confirm ? 'real' : 'fake');
    if (simInput.confirm) learn('Confirm');
    if (simInput.reject) learn('Reject');
    simInput.raiseBar = input.raiseBar;
    // Phase R: the compression lesson retires on the first SUCCESSFUL raise —
    // the level actually moving — not on an accidental hold that went nowhere.
    if (p.compressionLevel > 0) learn('Bar');
    simInput.jump = false;
    simInput.boostHeld = input.boostHeld;
    simInput.dragging = input.dragging;

    // The FINISH card is a real choice: the run holds still behind it until
    // END RUN or KEEP GOING (render/endgame-sky.js owns the card).
    alpha = stage.endgameSky.choiceVisible ? 0 : sim.advance(dt, simInput);
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

  // Phase R: everything below is presentation, and presentation reads the
  // interpolated pose — the sim's own state is never written through pv (its
  // continuous fields are own properties; the rest falls through).
  const pv = viewPlayer(p, sim.viewPrev, alpha);
  const bv = viewBeast(sim.beast, sim.viewPrev, alpha);

  terrainMesh.update(pv.d);
  terrainMesh.pump();
  props.update(pv.d);
  if (bellRenderer.terrain !== sim.terrain) bellRenderer.reset(sim.terrain);
  bellRenderer.update(pv.d, performance.now() / 1000, sim.player.chain | 0);
  landmarks.update(pv.d);
  wordGateActors.update(dt, pv.d, stage.camera);
  streakBurst.update(paused ? 0 : dt, stage.camera);
  dataworld.update(dt);

  const slope = sim.terrain.normalAt(pv.x, pv.d);
  playerActor.update(pv, slope, dt, bv.gap);
  ghostActor.update(sim.ghost, dt);
  windStreaks.update(paused ? 0 : dt, running ? (p.effSpeed || p.speed) : 0, p.overdrive);
  trackPylons.terrain = sim.terrain;
  trackPylons.update(pv.d);
  editorialWorld.terrain = sim.terrain;
  launch.update(dt);
  // RC6 attract: a title with nothing on it and nobody in it. Any sheet, the
  // how-to, a pending or playing arrival, or a live run all count as busy.
  attractPanels.update(dt, attract.active, ui.modality);
  attract.update(paused ? 0 : dt,
    sim.phase === PHASE.TITLE && !running && !paused && !launchPending &&
    launch.t < 0 && !onboarding?.visible && !continueOffer.active &&
    !document.querySelector('#accessPanel.on, #shopPanel.on, #curveScreen.on'));
  const bandNow = editorialWorld.update(pv.d, p.chain, bv.gap, dt);
  // E2: crossing a band threshold is an ARRIVAL — one note rising with the
  // band, one swell of ink (the swell yields to REDUCED FLASH; the note
  // stays). Fires only on the way up; the fall already lands with the drain.
  if (running && bandNow > worldBand) {
    audio.bandRise(bandNow);
    editorialWorld.pulseInk();
  }
  worldBand = bandNow;
  // E2: the Redline release — the run was inside the scream range and clean
  // reading opened real daylight. One rising breath, no label.
  if (running && sim.phase === PHASE.RUNNING) {
    if (bv.gap < 12) inScream = true;
    else if (inScream && bv.gap > 34) {
      inScream = false;
      audio.redlineRelease();
    }
  }

  const beastGroundY = sim.terrain.heightAt(bv.x, pv.d - bv.gap);
  const killT = sim.phase === PHASE.KILL || sim.phase === PHASE.DEAD ? sim.killTimer : 0;
  beastActor.update(dt, bv.gap, bv.x, beastGroundY, pv.d, killT,
    sim.beast.side, sim.beast.lunge, sim.beast.lungeT);

  if (!paused && running && !p.airborne) {
    const edge = Math.min(1, Math.abs(p.heading) / TUNING.PLAYER.MAX_CARVE);
    const rate = (2 + edge * 46) * (0.35 + Math.min(1, p.speed / TUNING.RUN.CEILING) * 0.65);
    sprayAcc += rate * dt;
    while (sprayAcc >= 1) {
      sprayAcc -= 1;
      spray.emit(pv.x, pv.y, -pv.d, 1, 1.6 + edge * 4,
        0.9 + edge * 2.0, -Math.sign(p.heading) * edge * 3.4);
    }
  }
  spray.update(paused ? 0 : dt);

  const bands = sim.beast.bands();
  const dreadLive = !paused && (running || sim.phase === PHASE.KILL);

  // The flow channel (Phase 9): the chain drives world brilliance through
  // one pure curve — eased upward link by link, snapped down on a loss so
  // the collapse lands with the drain.
  if (running && sim.phase === PHASE.RUNNING) endedFlowLevel = flowLevel(flowChain);
  flowChain = p.chain < flowChain
    ? p.chain
    : flowChain + (p.chain - flowChain) * (1 - Math.exp(-3.5 * dt));
  // REDUCED FLASH keeps the earned brightness but kills the marquee pulse.
  // On the results card the world holds the ended band's glow, steady — the
  // collapse already landed with the drain; the card is the payoff, not the
  // punishment.
  const flowF = dreadLive && running
    ? (ACCESS.reducedFlash
      ? flowGlow(flowLevel(flowChain))
      : flowFactor(flowChain, performance.now() / 1000))
    : sim.phase === PHASE.DEAD ? flowGlow(endedFlowLevel) : 1;
  materialPass.terrain.userData.uP9Flow.value = flowF;
  skyline.terrain = sim.terrain;
  skyline.update(pv.d, { sky: stage.scene.background, flow: flowF });
  dataworld.setFlow(flowF);
  trackPylons.setFlow(flowF);
  editorialWorld.setFlow(flowF);
  playerActor.flow = flowF;
  playerActor.dashChain = p.overdrive ? p.dashChain : 0; // Phase I: the tail reads the rung
  // The score's reading of the run. Music modulates, the run decides: the
  // intensity term is the game's, and the mapping may only tint it.
  const clock = music.update(performance.now());
  // RC9.7: the high-flow layer. Audio only — its gain is deliberately not
  // read by anything that draws, and musicResponse below is untouched by it.
  highLayer.update({
    clock, chain: sim.wordGates?.streak || 0, dt, running: running && !paused,
  });
  musicState = musicResponse(clock, {
    intensity: Math.max(0, Math.min(1,
      0.45 * ((p.speed - TUNING.RUN.FLOOR) / (TUNING.RUN.CEILING - TUNING.RUN.FLOOR))
      + 0.40 * Math.min(1, (p.chain ?? 0) / 8)
      + (p.overdrive ? 0.15 : 0))),
  }, { reducedFlash: ACCESS.reducedFlash, motionScale: ACCESS.reducedFlash ? TUNING.CAMERA.ACCESS_MOTION_SCALE : 1 });
  rig.music = musicState;
  rig.update(dt, pv, bv.gap, dreadLive ? bands.shake : 0, killT, sim.terrain,
    bv.x, sim.beast.side);
  stage.followLight(pv.x, pv.y, -pv.d);
  audio.update(dt, p, bands, dreadLive);
  updateMobileTouchUi(p, running);
  // RC10.1: every frame, including paused and dead — a pad has to be able to
  // reach RESUME and AGAIN. It used to be polled from inside a runtime patch
  // of the audio bridge, purely because that ran once a frame.
  controllerNav.update(sim.phase);
  devTools.profileOverlay?.update(sim.player.d, dt);
  // RC7: the three stops own the fundamentals. The sim reads which of them
  // this player has already been SHOWN (persisted beside the other learned
  // lessons, so each fires once for a life, whatever the player did with
  // it), and GUIDED TIPS switches the whole thing off live.
  const stopsOn = !!ACCESS.guidedTips && !stopsDone();
  // The switch is the chip alone. It must NOT also depend on "all three are
  // learned", because a stop is marked shown the instant it begins — gating
  // on that switched the system off underneath the third stop while it was
  // still on screen, taking its line and its ring with it. Re-firing is
  // already impossible: `learned` and `firedThisRun` refuse each stop
  // individually, which is the check that belongs at this level.
  sim.teach.enabled = !!ACCESS.guidedTips;
  const dashLearned = metaStats.get('usedDash', 0) > 0;
  sim.teach.learned = {
    real: metaStats.get('usedStopReal', 0) > 0,
    fake: metaStats.get('usedStopFake', 0) > 0,
    dash: dashLearned,
  };
  // RC7.1: once the dash stop has let go without a dash, the ring stays lit
  // on the control and the COACH carries the line — the teaching follows the
  // player through the run instead of ending with the freeze.
  const dashPending = stopsOn && !dashLearned && !sim.teach.active &&
    sim.teach.firedThisRun.dash && running &&
    sim.player.boostMeter >= TUNING.BOOST.MIN_ACTIVATE && !sim.player.overdrive;
  const teachModality = modalityFor({ touch: ui.touch, pad: padConnected() });
  // RC8.1: the coach and the charged hint speak in the same modality the
  // stops do. One detection, one vocabulary — the strings were the bug.
  ui.setModality(teachModality);
  ui.setDashLine(dashPending ? stopLine('dash', teachModality) : '');
  ui.setGuidedActive(stopsOn);
  ui.setStopActive(!!sim.teach.active);
  // RC11.4 — teaching outranks flash. While a stop is frozen or the coach is
  // speaking, the judgment stands down rather than sharing the frame with the
  // one thing a new player has to read.
  judgment.setMuted(!!sim.teach.active || stopsOn && !!dashPending);
  judgment.update(dt);
  // The DASH as an event: the label breathes when the meter is full, and the
  // frame's edge lights for as long as the dash is live. REDUCED FLASH keeps
  // the colour and drops the animation, like every other motion term.
  if (dashFlareEl) {
    const live = running && p.overdrive;
    dashFlareEl.classList.toggle('on', live && !ACCESS.reducedFlash);
    dashFlareEl.style.opacity = live && ACCESS.reducedFlash ? '0.5' : '';
  }
  if (meterLabelEl) {
    meterLabelEl.classList.toggle('ready',
      running && !p.overdrive && !ACCESS.reducedFlash &&
      p.boostMeter >= TUNING.BOOST.MIN_ACTIVATE);
  }
  // RC9.9 — the held breath. A stop freezes the sim outright, which is right
  // and which also leaves a still frame that a player cannot tell from a
  // hang. The five things that are STILL TRUE through the freeze — the stop's
  // line, the bar's marks, the hearts, the score's glow and the ring on the
  // control being pointed at — brighten and dim together on the music's own
  // two-bar phrase. One writer, one custom property, and CSS spends it: there
  // is no per-element animation to fall out of step with the others.
  {
    const on = !!sim.teach.active && !ACCESS.reducedFlash;
    if (on) {
      appEl.style.setProperty('--breath', breathAt({
        active: true,
        beat: clock?.playing ? clock.beat : null,
        seconds: performance.now() / 1000,
      }).toFixed(3));
    } else if (breathing) {
      appEl.style.setProperty('--breath', '1');
    }
    if (on !== breathing) { appEl.classList.toggle('breathing', on); breathing = on; }
  }
  guided.update({
    running,
    enabled: !!ACCESS.guidedTips,
    stop: sim.teach.active,
    modality: teachModality,
    dashPending,
    veilUp: launch.t >= 0,
    hintUp: !!ui.powerHint?.classList.contains('on'),
  });
  ui.update(dt, sim, dreadLive, clock);
  // RC9.3: the keyboard legend, where the touch buttons would be. Off on a
  // touch device (the buttons ARE the legend) and off in portrait (there is
  // no cabinet); each glyph dims for good on the flag its control writes.
  keyLegend.update({
    framed: isFramed(), touch: ui.touch, running, learned: learnedNow,
  });
  // RC9.8: the rolling buffer. It measures the device before it arms, draws
  // nothing on screen, and freezes whenever the run's rarest feat improves —
  // the last freeze wins, exactly as the rarest ledger wins the line.
  moments.update(dt, running && sim.phase === PHASE.RUNNING);
  {
    // The SAME five ledgers finalizeRun feeds pickStandout, read live — a run
    // whose only feat is its reading speed has to be able to freeze on it too.
    const wg = sim.wordGates;
    const rank = standoutRank({
      dashRung: run.dashRungMax, earlyStreak: run.bestEarlyStreak, burst10: run.burst10,
      bestChain: sim.player.bestChain,
      avgReadMs: wg.readCount > 0 ? Math.round((wg.latencySum / wg.readCount) * 1000) : 0,
      reads: wg.readCount,
    });
    if (rank > frozenRank && moments.freeze()) frozenRank = rank;
  }
  // Phase L HUD pass: while the run is live the only chrome is PAUSE — the
  // sound/settings/shop buttons come back whenever the game is stopped.
  appEl.classList.toggle('chromeless', running && !paused && sim.phase === PHASE.RUNNING);
  // RC7: REDUCED FLASH reaches CSS, so a rule can drop a pulse without a
  // second copy of the setting living in the stylesheet's own module.
  appEl.classList.toggle('rf', !!ACCESS.reducedFlash);
  // RC7.1: the results card carries no chrome. The gear belongs to the
  // title — the card is a score and two buttons, and a settings cog
  // floating over it invites everything except the next run.
  appEl.classList.toggle('carded', ui.deathScreen.classList.contains('on'));
  stage.render();

  if (!shotTaken && sim.phase === PHASE.KILL &&
      sim.killTimer >= TUNING.BEAST.KILL_WHIP_TIME + 0.24) {
    shotTaken = true;
    try { shotUrl = composeShareCard(canvas, endedFlowLevel); }
    catch { shotUrl = null; }
  }
}

// RC13.5 — hit-stop. Presentation time stands still for a few frames; the
// fixed-step sim just waits for it, so determinism is untouched.
let hitStop = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  last = now;
  if (hitStop > 0) { hitStop -= rawDt; tick(0); return; }
  tick(Math.min(rawDt, 0.1));
}
requestAnimationFrame(frame);

// The audit and test surface (window.__*) — src/app/dev-hooks.js. It gets
// the systems built above, the actions below, and live getters for the few
// `let`s its hooks report; it keeps no state and patches nothing.
const { devTools } = installDevHooks({
  sim, ui, music, rig, stage, input, simInput, launch, attract, moments, momentClip,
  render: {
    stage, terrainMesh, props, landmarks, rig, playerActor, beastActor, ghostActor, spray, materialPass,
    wordGateActors, dataworld, streakBurst, bells: bellRenderer, editorialWorld, judgment, skyline,
  },
  seed: SEED, seedString: SEED_STRING, challenge: CHALLENGE,
  startRun, quitToTitle, onFinishRun, setGhostEnabled, pauseGame, resumeGame, tick,
  effectiveDifficulty, challengeLinkForLastRun,
  get running() { return running; },
  get paused() { return paused; },
  get musicState() { return musicState; },
  get ghostEnabled() { return ghostEnabled; },
  get runMode() { return runMode; },
  get currentSalt() { return currentSalt; },
  get lastRunScore() { return lastRunScore; },
  get gateTrail() { return run.gateTrail; },
});