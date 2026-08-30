/**
 * V1 release gates — rescoped for DICTION DASH Phase 7.
 *
 * The original suite verified DESCENT's authored final mountain and hunt
 * cadence; both are retired with the downhill verb and the pressure
 * director. What this suite still owes the release frame:
 *
 *   - the canonical 30K finish machinery (consumed once, prestige beyond)
 *   - the band arc's late start distances (PUBLISHED lands at 30K)
 *   - bells continuing forever on the new track, with bounded caches
 *   - the flat track staying O(1) through a 120K soak
 *   - the retirement itself: no pursuit director, no authored composition
 *   - mobile affordances, no stray RAF loops, layer load order, copy
 */

import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { Terrain } from '../src/sim/terrain.js';
import { ENDGAME } from '../src/design/endgame.js';
import { BellField } from '../src/design/bells.js';
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
  'the finish band (PUBLISHED) lands exactly at 30K, morning after');

// ── 120K soak on the flat track ───────────────────────────────────────────
const seed = 0x51a7c0de;
const soakTerrain = new Terrain(seed);
const bells = new BellField(seed, soakTerrain);
let maxChunks = 0;
let corridorOk = true;
for (let d = 0; d <= 120000; d += TUNING.TERRAIN.CHUNK_LEN) {
  const ci = Math.floor(d / TUNING.TERRAIN.CHUNK_LEN);
  for (let i = -TUNING.TERRAIN.CHUNKS_BEHIND; i <= TUNING.TERRAIN.CHUNKS_AHEAD; i++) {
    soakTerrain.chunk(ci + i);
  }
  bells.around(d, 35, 360);
  soakTerrain.prune(ci);
  maxChunks = Math.max(maxChunks, soakTerrain.chunks.size);
  if (soakTerrain.heightAt(0, d) !== 0 ||
      Math.abs(soakTerrain.corridorX(d)) >
      TUNING.RUN.CURVE_AMP_A + TUNING.RUN.CURVE_AMP_B + 1e-9) corridorOk = false;
}
check(maxChunks <= 18, `track chunk cache stays bounded through 120K (max ${maxChunks})`);
check(corridorOk, 'the track stays flat and inside its curve envelope through 120K');
check(bells.cache.size < 500, `bell route cache remains small through 120K (${bells.cache.size} lines)`);
for (const d of [10000, 30000, 50000, 75000, 100000]) {
  check(bells.around(d, 35, 360).length > 0, `bells continue around ${Math.round(d / 1000)}K`);
}

// ── Source-level release assertions ───────────────────────────────────────
const finalSource = fs.readFileSync(new URL('../src/v1-finalize.js', import.meta.url), 'utf8');
const contactSource = fs.readFileSync(new URL('../src/v1-contact.js', import.meta.url), 'utf8');
const chaseSource = fs.readFileSync(new URL('../src/v1-chase.js', import.meta.url), 'utf8');
const escapeSource = fs.readFileSync(new URL('../src/rc97-endgame.js', import.meta.url), 'utf8');
const mobileSource = fs.readFileSync(new URL('../src/v1-mobile-ui.js', import.meta.url), 'utf8');
const beastSource = fs.readFileSync(new URL('../src/sim/beast.js', import.meta.url), 'utf8');
const audioBridge = fs.readFileSync(new URL('../src/rc9-audio.js', import.meta.url), 'utf8');
const onboarding = fs.readFileSync(new URL('../src/ui/onboarding.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');

check(contactSource.includes('__v1AllPhysicalLocks') && contactSource.includes('collideV1AllPhysical'),
  'contact-damage guard layer remains installed (inert on an empty track)');
check(finalSource.includes('BEST EVER') && finalSource.includes('bestAllTime'),
  'all-time record is surfaced unobtrusively');
check(finalSource.includes("distanceLabel.textContent !== '30 KM'"), 'ending card reports 30 KM');

check(chaseSource.includes('retired: true') && chaseSource.includes('pure-speed-differential'),
  'the pursuit director is retired: the gap is a pure speed differential');
check(!chaseSource.includes('pickStalkBand') && !beastSource.includes('mistakePressure +='),
  'no cadence bands or pressure accumulation anywhere in the pursuit');

check(escapeSource.includes('!sim.escapeConsumed') && escapeSource.includes('sim.postFinishActive = true') &&
  escapeSource.includes("t: 'beast_return'"),
  'finish is consumed once and the Redline can become lethal again afterward');
check(escapeSource.includes('SecondBeast.prototype.step') && escapeSource.includes('if (sim?.escaped)') &&
  escapeSource.includes('return baseStep.call(this, dt, player, main, terrain)'),
  'the Caret withdraws for the finish but resumes its pattern afterward');
check(!/textContent\s*=\s*['\"](?:OVER ?RUN|OVERRUN)/i.test(chaseSource + finalSource + escapeSource),
  'no post-finish mode name is exposed through player-facing text');

check(mobileSource.includes("go.id = 'v1MobileDash'") && mobileSource.includes("guide.id = 'v1TouchGuide'"),
  'mobile has visible GO affordance and contextual gesture overlay');

check(!finalSource.includes('requestAnimationFrame') && !contactSource.includes('requestAnimationFrame') &&
  !chaseSource.includes('requestAnimationFrame') && !escapeSource.includes('requestAnimationFrame') &&
  !mobileSource.includes('requestAnimationFrame'),
  'V1 finalization/contact/chase/mobile layers add no RAF');
check(audioBridge.includes("import './v1-finalize.js'") && audioBridge.includes("import './v1-contact.js'") &&
  audioBridge.includes("import './v1-chase.js'"),
  'V1 finalization, contact guard and retired-director stub load after RC9 feedback');
check(!onboarding.includes('READ THE MOUNTAIN. COMMIT TO THE LINE.') && !onboarding.includes('class="lead"'),
  'onboarding tagline is removed at source, not only hidden at runtime');
check(ui.includes("this.titleHint.textContent = 'HOW FAR CAN YOU GO?'"),
  'mystery title is native in UI source');

console.log(`\nV1 release gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
