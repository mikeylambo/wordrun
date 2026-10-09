import { appSource } from './lib/app-source.mjs';
/**
 * V1 release gates — rescoped for DICTION DASH Phase 7.
 *
 * The original suite verified DESCENT's authored final mountain and hunt
 * cadence; both are retired with the downhill verb and the pressure
 * director. What this suite still owes the release frame:
 *
 *   - the canonical 30K finish machinery (consumed once, prestige beyond)
 *   - the band arc's late start distances (FINISH lands at 30K)
 *   - the flat track staying O(1) through a 120K soak
 *   - the retirement itself: no pursuit director, no authored composition
 *   - mobile affordances, no stray RAF loops, layer load order, copy
 */

import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { Terrain } from '../src/sim/terrain.js';
import { ENDGAME } from '../src/design/endgame.js';
import { MOUNTAIN_BANDS } from '../src/render/art-direction.js';

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.error(`FAIL ${label}`); }
};

check(ENDGAME.ESCAPE_DISTANCE === 30000, 'canonical finish is 30K');
check(ENDGAME.GLORY_DISTANCE === 50000 && ENDGAME.HALO_DISTANCE === 75000 && ENDGAME.CROWN_DISTANCE === 100000,
  'post-finish prestige remains 50K / 75K / 100K');

const bands = Object.fromEntries(MOUNTAIN_BANDS.map((b) => [b.id, b.start]));
check(bands['deep-moon'] === 23000 && bands['high-night'] === 25000 && bands['still-night'] === 27000,
  'late palette arc keeps its authored start distances');
check(bands['false-dawn'] === 28000 && bands['first-light'] === 29200 && bands.dawn === 30000 && bands.morning === 31500,
  'the FINISH band lands exactly at 30K, morning after');

// ── 120K soak on the flat track ───────────────────────────────────────────
const seed = 0x51a7c0de;
const CURVE_ENVELOPE = Object.keys(TUNING.RUN)
  .filter((k) => /^CURVE_AMP_/.test(k))
  .reduce((sum, k) => sum + TUNING.RUN[k], 0);
const soakTerrain = new Terrain(seed);
let maxChunks = 0;
let corridorOk = true;
for (let d = 0; d <= 120000; d += TUNING.TERRAIN.CHUNK_LEN) {
  const ci = Math.floor(d / TUNING.TERRAIN.CHUNK_LEN);
  for (let i = -TUNING.TERRAIN.CHUNKS_BEHIND; i <= TUNING.TERRAIN.CHUNKS_AHEAD; i++) {
    soakTerrain.chunk(ci + i);
  }
  soakTerrain.prune(ci);
  maxChunks = Math.max(maxChunks, soakTerrain.chunks.size);
  // The lateral envelope is the SUM OF EVERY curve amplitude the tuning
  // declares — derived, never hand-summed, so a new winding wave (Phase W
  // added the third) can never silently invalidate this fence again. The
  // curvature bound is the same measured invariant the TRACK gate holds.
  if (Math.abs(soakTerrain.elevAt(d)) > TUNING.TERRAIN.ROUTE.ELEV_CAP_M + 1e-9 ||
      Math.abs(soakTerrain.corridorX(d)) > CURVE_ENVELOPE + 1e-9 ||
      Math.abs(soakTerrain.corridorSlope(d)) >= 0.5) corridorOk = false;
}
check(maxChunks <= 18, `track chunk cache stays bounded through 120K (max ${maxChunks})`);
check(corridorOk, 'the route stays inside its elevation cap and curve envelope through 120K');

// ── Source-level release assertions ───────────────────────────────────────
// The V1 release layers (v1-finalize, v1-contact, v1-chase, rc97-endgame,
// v1-mobile-ui, rc9-audio …) were runtime patches; each one's behaviour now
// lives in the file that owns it, and these checks read those files.
const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const finishSource = src('src/sim/finish.js');
const simSource = src('src/sim/sim.js');
const mainSource = appSource();
const skySource = src('src/render/endgame-sky.js');
const mobileSource = src('src/ui/touch-controls.js');
const beastSource = src('src/sim/beast.js');
const onboarding = src('src/ui/onboarding.js');
const ui = src('src/ui/ui.js');

{
  // Nothing solid spawns on the flat track, anywhere — including the stretch
  // where the retired endgame terrain hook used to plant a pine forest.
  const t = new Terrain(12345);
  let solids = 0;
  for (let d = 0; d < 32000; d += TUNING.TERRAIN.CHUNK_LEN) {
    solids += t.chunk(Math.floor(d / TUNING.TERRAIN.CHUNK_LEN)).colliders.length;
  }
  check(solids === 0 && t.collidersNear(26000).length === 0,
    'the track spawns no solid anywhere through 32K — no contact system is needed, so none exists');
}
check(ui.includes('BEST EVER') && /Storage\.bestAllTime\(\)/.test(mainSource) &&
  mainSource.includes('ui.setAllTimeBest(Storage.bestAllTime())'),
  'all-time record is surfaced unobtrusively, by the title line\'s one writer');
check(skySource.includes("querySelector('#rc97Dist')") && skySource.includes('run.distance ?? ENDGAME.ESCAPE_DISTANCE'),
  'ending card reports the distance the run actually reached');

check(!fs.existsSync(new URL('../src/v1-chase.js', import.meta.url)) &&
  !beastSource.includes('pickStalkBand') && !beastSource.includes('mistakePressure +='),
  'the pursuit director is retired: no cadence bands or pressure accumulation anywhere in the pursuit');

check(finishSource.includes('!sim.escapeConsumed') && finishSource.includes('sim.postFinishActive = true') &&
  finishSource.includes("t: 'beast_return'"),
  'finish is consumed once and the Redline can become lethal again afterward');
check(/this\.endgame && stepFinish\(this, dt\)/.test(simSource) && /sim\.endgame = true;/.test(mainSource),
  'the finish is a rule of the played game, switched on explicitly by main.js');
// Phase 20 removed the Caret, so the finish only has to hold off one
// pursuer — and nothing may reintroduce a second.
check(!finishSource.includes('SecondBeast') && !finishSource.includes('secondBeast'),
  'the finish sequence has one pursuer to withdraw, not two');

// The finish had never been RUN by a gate, only read — and the second-pursuer
// removal left a bare `second` reference inside the escape branch, which is
// unreachable until 30 km and therefore invisible to every other test. This
// drives a real Sim across the canonical finish; a dangling identifier throws
// here instead of on a player's best run of the game.
{
  const { Sim } = await import('../src/sim/sim.js');
  const sim = new Sim(12345);
  sim.endgame = true;
  sim.start();
  sim.player.d = ENDGAME.ESCAPE_DISTANCE - 5;
  const input = { carve: 0, flip: 0, jump: false, confirm: false, boostHeld: false, dragging: false };
  let threw = null;
  try {
    for (let i = 0; i < 400 && !sim.escaped; i++) sim.step(input);
  } catch (e) { threw = e; }
  check(!threw && sim.escaped === true &&
    sim.events.some((e) => e.t === 'escape') && sim.player.dead === false,
    'a real sim crosses the canonical finish and escapes without throwing'
    + (threw ? ` — ${threw.message}` : ` — escaped at ${Math.floor(sim.escapeD || 0)} m`));

  // And KEEP GOING: the grace runs out and the Redline comes back, once.
  sim.keepGoingChosen = true;
  sim.postFinishGraceRemaining = 1;
  for (let i = 0; i < 200 && !sim.postFinishActive; i++) sim.step(input);
  check(sim.postFinishActive && !sim.escaped && sim.beastReturnSerial === 1 &&
    sim.events.some((e) => e.t === 'beast_return'),
    'KEEP GOING hands the run back to the pursuit after its grace');

  // A headless sim (endgame off) never finishes — every golden depends on it.
  const plain = new Sim(12345);
  plain.start();
  plain.player.d = ENDGAME.ESCAPE_DISTANCE + 5;
  for (let i = 0; i < 60; i++) plain.step(input);
  check(!plain.escaped, 'the headless sim is untouched: no finish unless the endgame is switched on');
}
// Death to control. The kill cam is skippable — after the share frame — and
// skipping it changes nothing about the run that just ended.
{
  const { Sim, PHASE } = await import('../src/sim/sim.js');
  const run = new Sim(4242);
  run.start();
  const input = { carve: 0, flip: 0, jump: false, confirm: false, boostHeld: false, dragging: false };
  check(run.skipKillCam() === false && run.phase === PHASE.RUNNING,
    'skipping the kill cam does nothing to a live run');
  run.beast.gap = 0.1;
  for (let i = 0; i < 600 && run.phase === PHASE.RUNNING; i++) run.step(input);
  const scoreAtKill = run.score;
  const killed = run.phase === PHASE.KILL;
  check(killed && run.skipKillCam() === true && run.phase === PHASE.DEAD &&
    run.score === scoreAtKill && run.deathCause === 'redlined',
    'and in the kill cam it goes straight to the card with the run exactly as it ended');
  check(/if \(sim\.phase === PHASE\.KILL\) \{\n\s+if \(app\.shotTaken\) sim\.skipKillCam\(\);/.test(mainSource) &&
    /onAdvance\(\{ deliberate: e\.code === 'KeyR' && !e\.repeat \}\)/.test(mainSource),
    'a tap skips the cam only once the share frame is taken; R, the retry key, skips the settle guard');
}
check(!/textContent\s*=\s*['\"](?:OVER ?RUN|OVERRUN)/i.test(finishSource + skySource + ui),
  'no post-finish mode name is exposed through player-facing text');

check(mobileSource.includes("go.id = 'v1MobileDash'") && mobileSource.includes("guide.id = 'v1TouchGuide'"),
  'mobile has a visible DASH affordance and a contextual gesture overlay');
check(/import \{ updateMobileTouchUi \} from '\.\/ui\/touch-controls\.js';/.test(mainSource) &&
  /audio\.update\(dt, p, bands, dreadLive\);\n  updateMobileTouchUi\(p, running\);/.test(mainSource),
  'the touch controls are an import, updated from the frame loop — not from inside the audio engine');

check(!finishSource.includes('requestAnimationFrame') && !mobileSource.includes('requestAnimationFrame') &&
  !src('src/ui/haptics.js').includes('requestAnimationFrame') && !src('src/ui/share.js').includes('requestAnimationFrame'),
  'finish, touch controls, haptics and share add no RAF');
check(!onboarding.includes('READ THE MOUNTAIN. COMMIT TO THE LINE.') && !onboarding.includes('class="lead"'),
  'onboarding tagline is removed at source — nothing hides it at runtime any more');
// Phase 19 retired the tagline: a title screen that asks the player a
// rhetorical question does not trust its own wordmark. RC-5 went further —
// the day's name went with it, to the chip that selects the mode, because a
// label under the wordmark reads as a subtitle for the GAME. What must hold
// is the invariant, not the replacement text: the caption is empty for an
// ordinary day (a CHALLENGE still names its dare), and no tagline anywhere.
// RC9.2 took the last caption too. A CHALLENGE named itself on one line and
// dared on another; one line does both now, and it is the seed line's — so
// the hint under the wordmark is empty on every screen there is.
// RC13.3: the key art's poster lines (BEAT THE REDLINE · KEEP THE WORDS, and
// SPEED SHARPENS MINDS) bracket the screen as part of the LOCKUP, by the
// designer's call — the caption under the wordmark stays empty regardless.
check(/titleHint\.textContent = '';/.test(ui) && !/HOW FAR CAN YOU GO/.test(ui) &&
  /BEAT \$\{this\._challenge\.goal\.toLocaleString\('en-US'\)\} · THIS ROUTE/.test(ui),
  'the wordmark stands alone — no tagline, and no caption for any day');

console.log(`\nV1 release gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
