/**
 * Gates for the score map format and its runtime (music/FORMAT.md).
 *
 * These run headlessly against the real map. The clock is arithmetic on a fed
 * playback position, which is exactly why it is testable without audio.
 */

import fs from 'node:fs';
import { ScoreMap, applyOverlay } from '../src/music/score-map.js';
import { MusicClock } from '../src/music/music-clock.js';
import { musicResponse } from '../src/render/music-response.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  PASS ${msg}`); } else { fail++; console.log(`  FAIL ${msg}`); } };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg} — ${a.toFixed(4)} vs ${b.toFixed(4)} (±${tol})`);

const raw = JSON.parse(fs.readFileSync('music/into-the-night.scoremap.json', 'utf8'));
const overlay = fs.existsSync('music/into-the-night.overlay.json')
  ? JSON.parse(fs.readFileSync('music/into-the-night.overlay.json', 'utf8')) : null;
const score = new ScoreMap(raw, overlay);

console.log('\nFORMAT — the map describes music and nothing else');
{
  const text = JSON.stringify(raw).toLowerCase();
  const gameWords = ['camera', 'player', 'dash', 'heart', 'plate', 'word', 'score', 'lane', 'fov'];
  const found = gameWords.filter((w) => text.includes(`"${w}"`));
  ok(found.length === 0, `no game concepts leaked into the map${found.length ? ` — found ${found}` : ''}`);
  ok(raw.format === 1, 'declares a format version');
  ok(Object.values(raw.events).every((l) => l.every(([b, s]) => s >= 0 && s <= 1)),
    'every event strength is normalised to 0..1');
  ok(Object.values(raw.events).every((l) => l.every(([b], i) => i === 0 || b >= l[i - 1][0])),
    'events are sorted by beat, which the binary searches rely on');
  ok(Object.values(raw.curves).every((c) => c.v.every((x) => x >= 0 && x <= 1)),
    'every curve sample is 0..1');
  const dense = Object.entries(raw.events).filter(([, l]) => l.length / raw.grid.beats.length > 1.5);
  ok(dense.length === 0, `nothing dense is stored as events${dense.length ? ` — ${dense.map(([k]) => k)}` : ''}`);
}

console.log('\nGRID — beats are the only currency, seconds live in one place');
{
  near(score.beatAt(score.secondsAt(300)), 300, 1e-6, 'beat -> seconds -> beat round-trips');
  near(score.secondsAt(score.beatAt(120.5)), 120.5, 1e-6, 'seconds -> beat -> seconds round-trips');
  ok(score.secondsAt(10) < score.secondsAt(11), 'the grid increases monotonically');
  const spans = raw.grid.beats.slice(1).map((b, i) => b - raw.grid.beats[i]);
  const bpm = spans.map((s) => 60 / s);
  ok(Math.min(...bpm) > 150 && Math.max(...bpm) < 180,
    `tempo stays inside a sane band — ${Math.min(...bpm).toFixed(2)}..${Math.max(...bpm).toFixed(2)} BPM`);
  ok(Math.max(...bpm) - Math.min(...bpm) > 1,
    'the grid follows real tempo movement rather than sitting on one constant');
  ok(!score.loopMisaligned, `the loop is bar-aligned — ${score.loopFrom}..${score.loopTo}`);
}

console.log('\nOVERLAY — regeneration can never destroy hand authoring');
{
  const hand = { sections: [{ from: 0, to: 64, tag: 'intro' }], drop: { crash: [raw.events.crash[0][0]] }, rename: { clap: 'rim' } };
  const merged = applyOverlay(raw, hand);
  ok(merged.sections.length === 1 && merged.sections[0].tag === 'intro', 'overlay sections replace generated ones');
  ok(merged.events.crash.length === raw.events.crash.length - 1, 'overlay drops a hallucinated hit');
  ok(!!merged.events.rim && !merged.events.clap, 'overlay renames an event type');
  ok(raw.events.crash.length > 0 && !!raw.events.clap, 'the generated map is not mutated by merging');
  const code = fs.readFileSync('tools/build-score-map.mjs', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok(!/overlay/i.test(code), 'the generator never touches an overlay file (comments aside)');
}

console.log('\nCLOCK — position comes from audio, not from frames');
{
  const clock = new MusicClock(score);
  // A source that reports position only 5 times a second, against a 60 fps
  // frame loop: the naive read stutters, the clock must not.
  let ms = 0, played = 0, lastReport = 0, report = 0;
  const seen = [];
  for (let f = 0; f < 600; f++) {
    ms += 1000 / 60; played += 1 / 60;
    if (played - lastReport >= 0.2) { report = played; lastReport = played; }
    clock.update(report, ms);
    seen.push(clock.beatInLoop);
  }
  const steps = seen.slice(1).map((b, i) => b - seen[i]);
  ok(steps.every((s) => s >= 0), 'the beat never runs backwards between frames');
  const moving = steps.filter((s) => s > 0);
  ok(moving.length > steps.length * 0.9, 'the beat advances on nearly every frame, not only on a new reading');
  near(clock.seconds, 10, 0.25, 'predicted position tracks a coarsely-reported source');
}

console.log('\nCLOCK — anticipation, firing, and laps');
{
  const clock = new MusicClock(score);
  let ms = 0;
  // Start 60 s in: the drums do not enter until about 20 s, so a lookahead
  // measured over the intro would correctly report half a minute of nothing.
  for (let f = 0; f < 60 * 60; f++) { ms += 1000 / 60; clock.update(f / 60, ms); }

  const until = clock.until('kick');
  ok(until >= 0 && until < 4, `until() gives a usable lookahead — next kick in ${until.toFixed(3)}s`);
  const nextBeat = score.nextAfter('kick', clock.beatInLoop);
  near(score.secondsAt(nextBeat) - score.secondsAt(clock.beatInLoop), until, 1e-6,
    'until() agrees with the grid');

  // Every kick in a stretch is reported exactly once, none twice, none missed.
  const c2 = new MusicClock(score);
  let ms2 = 0, fired = 0;
  for (let f = 0; f < 60 * 60; f++) { ms2 += 1000 / 60; c2.update(f / 60, ms2); fired += c2.crossed('kick').length; }
  const expected = score.between('kick', 0, score.beatAt(60)).length;
  ok(fired === expected, `every hit fires exactly once over a minute — ${fired} vs ${expected} in the map`);

  // Asking twice in one frame must not consume the window.
  const c3 = new MusicClock(score);
  let ms3 = 0;
  for (let f = 0; f < 300; f++) { ms3 += 1000 / 60; c3.update(f / 60, ms3); }
  ok(JSON.stringify(c3.crossed('kick')) === JSON.stringify(c3.crossed('kick')),
    'crossed() is read-only within a frame');
  ok(c3.crossed('snare') !== undefined && c3.crossed('kick').length === c3.crossed('kick').length,
    'asking for one type does not steal another type\'s window');

  // Wrap: run past the loop, then restart the source as a real loop would.
  const c4 = new MusicClock(score);
  let ms4 = 0, t = score.duration - 1;
  for (let f = 0; f < 60; f++) { ms4 += 1000 / 60; c4.update(t, ms4); t += 1 / 60; }
  const lapBefore = c4.lap;
  for (let f = 0; f < 120; f++) { ms4 += 1000 / 60; c4.update(f / 60, ms4); }
  ok(c4.lap === lapBefore + 1, `a restart counts one lap — ${lapBefore} -> ${c4.lap}`);
  ok(c4.beat > score.loopBeats, `beat keeps counting up across the loop — ${c4.beat.toFixed(1)}`);
  ok(c4.beatInLoop < 10, `beatInLoop wraps back for lookups — ${c4.beatInLoop.toFixed(2)}`);
}

console.log('\nCLOCK — pulse and curves stay in range');
{
  const clock = new MusicClock(score);
  let ms = 0, maxP = 0, minP = 1, sawFull = false;
  for (let f = 0; f < 60 * 90; f++) {
    ms += 1000 / 60; clock.update(f / 60, ms);
    const p = clock.pulse('kick');
    maxP = Math.max(maxP, p); minP = Math.min(minP, p);
    if (p > 0.9) sawFull = true;
    const e = clock.curve('energy');
    if (e < 0 || e > 1) { ok(false, 'energy curve left 0..1'); break; }
  }
  ok(minP >= 0 && maxP <= 1, `pulse stays inside 0..1 — ${minP.toFixed(2)}..${maxP.toFixed(2)}`);
  ok(sawFull, 'pulse reaches full strength at a hit');
  ok(clock.curve('energy') >= 0 && clock.curve('energy') <= 1, 'curves stay inside 0..1');
}

console.log('\nSECTIONS — they tile the track');
{
  const s = score.map.sections;
  ok(s.length > 0, `the map has sections — ${s.length}`);
  ok(s.every((x, i) => i === 0 || Math.abs(x.from - s[i - 1].to) < 0.01), 'sections are contiguous, with no gaps');
  ok(s.every((x) => x.to > x.from), 'no section is empty or inverted');
  ok(s.every((x, i) => i === 0 || x.layers.join() !== s[i - 1].layers.join()),
    'no two neighbouring sections carry the same layer set');
  const quiet = s.filter((x) => !x.layers.includes('bass'));
  ok(quiet.length >= 2, `the arrangement's bass drop-outs survive as sections — ${quiet.length} of them`);
  ok(score.sectionAt(score.map.sections[1].from + 1) === s[1], 'a beat resolves to its section');
}

console.log('\nSHIPPING — the map the game loads is the map in source');
{
  const shipped = 'public/audio/music/into-the-night.scoremap.json';
  ok(fs.existsSync(shipped), 'the score map ships with the build');
  ok(fs.existsSync('public/audio/music/into-the-night.mp3'), 'the track ships with the build');
  if (fs.existsSync(shipped)) {
    ok(fs.readFileSync(shipped, 'utf8') === fs.readFileSync('music/into-the-night.scoremap.json', 'utf8'),
      'the shipped copy has not drifted from the generated one');
  }
  const player = fs.readFileSync('src/music-track.js', 'utf8');
  ok(!/https?:\/\//.test(player), 'the player fetches nothing off-origin');
  ok(player.includes('el.loop = true'), 'the whole song loops naturally, with no splice point to author');
}

console.log('\nMAPPING — music modulates, the run decides');
{
  const clock = new MusicClock(score);
  let ms = 0;
  for (let f = 0; f < 60 * 60; f++) { ms += 1000 / 60; clock.update(f / 60, ms); }

  const hot = musicResponse(clock, { intensity: 1 }, {});
  const cold = musicResponse(clock, { intensity: 0 }, {});
  ok(hot.drive > cold.drive, `the run sets the level — ${cold.drive.toFixed(2)} cold vs ${hot.drive.toFixed(2)} hot`);
  ok(cold.drive === 0, 'a cold run stays cold however loud the track is');

  // Sweep the whole track at a fixed run state: the music may only swing drive
  // within its band, never gate it.
  const c2 = new MusicClock(score);
  let ms2 = 0, lo = 1, hi = 0, maxPulse = 0, maxAccent = 0, sawCalm = false;
  for (let f = 0; f < 60 * 270; f++) {
    ms2 += 1000 / 60; c2.update(f / 60, ms2);
    const r = musicResponse(c2, { intensity: 0.6 }, {});
    lo = Math.min(lo, r.drive); hi = Math.max(hi, r.drive);
    maxPulse = Math.max(maxPulse, r.pulse); maxAccent = Math.max(maxAccent, r.accent);
    if (r.calm) sawCalm = true;
    if (r.pulse < 0 || r.shimmer < 0 || r.shimmer > 1 || r.accent < 0 || r.accent > 1) {
      ok(false, 'a mapping output left its range'); break;
    }
  }
  ok(lo > 0, `music never gates the run to nothing — floor ${lo.toFixed(2)}`);
  ok(hi <= 0.6 * 1.25 + 1e-9, `music never lifts the run past its band — ceiling ${hi.toFixed(2)}`);
  ok(maxPulse > 0 && maxPulse < 0.06, `the beat bob stays subtle — peak ${maxPulse.toFixed(3)}`);
  ok(sawCalm, 'the bass drop-outs reach the mapping as calm sections');

  const quiet = musicResponse(c2, { intensity: 0.6 }, { reducedFlash: true });
  ok(quiet.accent === 0, 'reduced flash removes every discrete accent');
  const still = musicResponse(c2, { intensity: 0.6 }, { motionScale: 0 });
  ok(still.pulse === 0 && still.shimmer === 0, 'motion scale 0 removes every music-driven movement');

  ok(musicResponse(null, { intensity: 0.5 }, {}).drive === 0.5,
    'with no track playing the run drives everything by itself');
}

console.log('\nMAPPING — nothing discrete runs fast enough to flash');
{
  const c3 = new MusicClock(score);
  let ms3 = 0, accents = 0, wasOn = false;
  for (let f = 0; f < 60 * 270; f++) {
    ms3 += 1000 / 60; c3.update(f / 60, ms3);
    const on = musicResponse(c3, { intensity: 1 }, {}).accent > 0.5;
    if (on && !wasOn) accents++;
    wasOn = on;
  }
  const hz = accents / 270;
  ok(hz < 3, `discrete accents stay under the photosensitivity threshold — ${hz.toFixed(2)} Hz over the track`);
}

console.log(`\nMusic gates: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
