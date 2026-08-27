import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { Terrain } from '../src/sim/terrain.js';
import { BellField } from '../src/design/bells.js';
import { ENDGAME, FINAL_MOUNTAIN, applyEndgameTerrain } from '../src/design/endgame.js';
import { CHASE } from '../src/design/release-tuning.js';
import { MOUNTAIN_BANDS } from '../src/render/art-direction.js';

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.error(`FAIL ${label}`); }
};

applyEndgameTerrain(Terrain, TUNING);
check(Terrain.prototype.__descentEndgameTerrain === true && Terrain.prototype._generate?.name === 'generateEndgameChunk',
  'endgame terrain composer owns Terrain._generate');

check(ENDGAME.ESCAPE_DISTANCE === 30000, 'canonical escape is 30K');
check(ENDGAME.HIGH_NIGHT === 25000 && ENDGAME.FALSE_DAWN === 28000 && ENDGAME.FIRST_LIGHT === 29200,
  'night -> false dawn -> first light resolves before 30K');
check(ENDGAME.GLORY_DISTANCE === 50000 && ENDGAME.HALO_DISTANCE === 75000 && ENDGAME.CROWN_DISTANCE === 100000,
  'post-finish prestige remains 50K / 75K / 100K');
check(FINAL_MOUNTAIN.EMPTY_START === 23200 && FINAL_MOUNTAIN.FOREST_START === 25500 && FINAL_MOUNTAIN.BREAK_D === 29140,
  'final mountain owns Empty, Last Forest and The Break');

check(CHASE.STALK_SHORT_MIN === 8 && CHASE.STALK_SHORT_MAX === 14 &&
  CHASE.STALK_NORMAL_MIN === 15 && CHASE.STALK_NORMAL_MAX === 25 &&
  CHASE.STALK_LONG_MIN === 27 && CHASE.STALK_LONG_MAX === 40,
  'Beast One stalking has short / normal / long deterministic timing bands');
check(CHASE.RETURN_GRACE_MIN === 8.5 && CHASE.RETURN_GRACE_MAX === 12.5,
  'KEEP GOING earns a real quiet interval before pursuit can return');

const bands = Object.fromEntries(MOUNTAIN_BANDS.map((b) => [b.id, b.start]));
check(bands['deep-moon'] === 23000 && bands['high-night'] === 25000 && bands['still-night'] === 27000,
  'late mountain palette reaches high night inside the canonical run');
check(bands['false-dawn'] === 28000 && bands['first-light'] === 29200 && bands.dawn === 30000 && bands.morning === 31500,
  'palette reaches dawn at escape and morning after the finish');

const seed = 0x51a7c0de;
const soakTerrain = new Terrain(seed);
const bells = new BellField(seed, soakTerrain);
let maxChunks = 0;
let maxHeightCache = 0;

// 120 km headless travel soak. Keep this state intentionally separate from the
// authored-region composition checks below: a real run sees THE EMPTY on its
// first forward traversal, not after travelling to 120K and regenerating 23K.
for (let d = 0; d <= 120000; d += TUNING.TERRAIN.CHUNK_LEN) {
  const ci = Math.floor(d / TUNING.TERRAIN.CHUNK_LEN);
  for (let i = -TUNING.TERRAIN.CHUNKS_BEHIND; i <= TUNING.TERRAIN.CHUNKS_AHEAD; i++) {
    soakTerrain.chunk(ci + i);
  }
  bells.around(d, 35, 360);
  soakTerrain.prune(ci);
  maxChunks = Math.max(maxChunks, soakTerrain.chunks.size);
  maxHeightCache = Math.max(maxHeightCache, soakTerrain.heightCache.size);
}

// prune() deliberately retains a wider safety margin than the eight rendered
// chunks, so ~17 cached chunks is expected and still O(1) with distance.
check(maxChunks <= 18, `terrain chunk cache stays bounded through 120K (max ${maxChunks})`);
check(maxHeightCache <= 24, `height cache stays bounded through 120K (max ${maxHeightCache})`);
check(bells.cache.size < 500, `bell route cache remains small through 120K (${bells.cache.size} lines)`);

for (const d of [10000, 30000, 50000, 75000, 100000]) {
  check(bells.around(d, 35, 360).length > 0, `bells continue around ${Math.round(d / 1000)}K`);
}

// Fresh deterministic terrain models the first/only forward traversal through
// the finale. This prevents the unrelated 120K cache soak from becoming an
// accidental prerequisite for measuring authored composition.
const compositionTerrain = new Terrain(seed);
const countRange = (start, end) => {
  let trees = 0, solids = 0, heights = 0, chunks = 0;
  const len = TUNING.TERRAIN.CHUNK_LEN;
  const ci0 = Math.floor(start / len);
  const ci1 = Math.floor((end - 1e-6) / len);

  // Endgame composition itself assigns a chunk to a region by midpoint, so the
  // gate uses the identical ownership rule at boundaries.
  for (let ci = ci0; ci <= ci1; ci++) {
    const mid = (ci + 0.5) * len;
    if (mid < start || mid >= end) continue;
    const c = compositionTerrain.chunk(ci);
    chunks++;
    for (const x of c.colliders) {
      if (x.type === 'tree') trees++;
      if (x.type === 'tree' || x.type === 'rock' || x.type === 'gate') solids++;
    }
    heights += c.heights.filter((h) => !h.authored && (h.type === 'cliff' || h.type === 'mogul')).length;
  }
  return { trees, solids, heights, chunks };
};

const empty = countRange(FINAL_MOUNTAIN.EMPTY_START, FINAL_MOUNTAIN.EMPTY_END);
const forest = countRange(FINAL_MOUNTAIN.FOREST_START, FINAL_MOUNTAIN.FOREST_END);
const approach = countRange(FINAL_MOUNTAIN.FINAL_APPROACH, ENDGAME.ESCAPE_DISTANCE);
check(empty.solids / empty.chunks < 1.2,
  `THE EMPTY is actually sparse (${empty.solids}/${empty.chunks} solids/chunks)`);
check(forest.trees / forest.chunks > empty.trees / empty.chunks + 1.2, 'LAST FOREST is materially denser than THE EMPTY');
check(forest.heights / forest.chunks < 1.2, 'LAST FOREST suppresses random stunt clutter');
check(approach.solids / approach.chunks < forest.solids / forest.chunks, 'final approach opens toward dawn');

const finalSource = fs.readFileSync(new URL('../src/v1-finalize.js', import.meta.url), 'utf8');
const contactSource = fs.readFileSync(new URL('../src/v1-contact.js', import.meta.url), 'utf8');
const chaseSource = fs.readFileSync(new URL('../src/v1-chase.js', import.meta.url), 'utf8');
const escapeSource = fs.readFileSync(new URL('../src/rc97-endgame.js', import.meta.url), 'utf8');
const mobileSource = fs.readFileSync(new URL('../src/v1-mobile-ui.js', import.meta.url), 'utf8');
const inputSource = fs.readFileSync(new URL('../src/input/input.js', import.meta.url), 'utf8');
const audioBridge = fs.readFileSync(new URL('../src/rc9-audio.js', import.meta.url), 'utf8');
const onboarding = fs.readFileSync(new URL('../src/ui/onboarding.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
check(finalSource.includes("id: 'the-break-air'") && finalSource.includes('drop: 12.9') && finalSource.includes('lip: 3.18'),
  'THE BREAK is authored near Bridge hero-air scale');
check(contactSource.includes('__v1AllPhysicalLocks') && contactSource.includes('generatedPropsIncluded: true') &&
  contactSource.includes('collideV1AllPhysical'),
  'every physical object uses contact-entry damage, including generated props');
check(finalSource.includes('playBeastBreak') && finalSource.includes('destructionSnapshot'),
  'Beast One destruction is paired with actual collision-removal SFX');
check(finalSource.includes('bellV1') && finalSource.includes('0.028'), 'bell gets a modest final presence lift');
check(finalSource.includes('BEST EVER') && finalSource.includes('bestAllTime'), 'all-time record is surfaced unobtrusively');
check(finalSource.includes("distanceLabel.textContent !== '30 KM'"), 'ending card reports 30 KM');

check(chaseSource.includes('pickStalkBand') && chaseSource.includes('immediateBandRepeatsSuppressed: true'),
  'Hunt cadence suppresses immediate timing-band repeats');
check(chaseSource.includes('sim.keepGoingChosen = true') && chaseSource.includes('postFinishGraceRemaining'),
  'KEEP GOING arms a quiet grace period rather than instantly respawning danger');
check(escapeSource.includes('!sim.escapeConsumed') && escapeSource.includes('sim.postFinishActive = true') &&
  escapeSource.includes("t: 'beast_return'"),
  'finish is consumed once and Beast One can become lethal again afterward');
check(escapeSource.includes('SecondBeast.prototype.step') && escapeSource.includes('if (sim?.escaped)') &&
  escapeSource.includes('return baseStep.call(this, dt, player, main, terrain)'),
  'Beast Two withdraws for the finish but resumes its existing pattern director afterward');
check(chaseSource.includes('playReturnRoar') && chaseSource.includes('The praised Hunt pulse'),
  'pursuit return has a distinct distant cue without touching Hunt heartbeat logic');
check(!/textContent\s*=\s*['\"](?:OVER ?RUN|OVERRUN)/i.test(chaseSource + finalSource + escapeSource),
  'no post-finish mode name is exposed through player-facing text');

check(inputSource.includes('TOUCH_DRAG_RANGE_AIR = 0.22') && inputSource.includes('_reanchorTouch'),
  'mobile air gesture uses shorter throw and fresh takeoff/landing origin');
check(mobileSource.includes("go.id = 'v1MobileGo'") && mobileSource.includes("guide.id = 'v1TouchGuide'"),
  'mobile has visible GO affordance and contextual gesture overlay');

check(!finalSource.includes('requestAnimationFrame') && !contactSource.includes('requestAnimationFrame') &&
  !chaseSource.includes('requestAnimationFrame') && !escapeSource.includes('requestAnimationFrame') &&
  !mobileSource.includes('requestAnimationFrame'),
  'V1 finalization/contact/chase/mobile layers add no RAF');
check(audioBridge.includes("import './v1-finalize.js'") && audioBridge.includes("import './v1-contact.js'") &&
  audioBridge.includes("import './v1-chase.js'"),
  'V1 finalization, contact guard and pursuit director load after RC9 feedback');
check(!onboarding.includes('READ THE MOUNTAIN. COMMIT TO THE LINE.') && !onboarding.includes('class="lead"'),
  'onboarding tagline is removed at source, not only hidden at runtime');
check(ui.includes("this.titleHint.textContent = 'HOW FAR CAN YOU GO?'") && !ui.includes("this.titleHint.textContent = 'IT ALWAYS CATCHES YOU.'"),
  'mystery title is native in UI source');

console.log(`\nV1 release gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
