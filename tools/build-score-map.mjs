/**
 * Builds a score map (music/FORMAT.md) from a stem separator's MIDI
 * transcription, plus an optional arrangement analysis of the stem audio.
 *
 *   node tools/build-score-map.mjs <midi-dir> <track-slug> [arrangement.json]
 *
 * Reads MIDI rather than the rendered stem audio on purpose. A separator's
 * "fixed tempo" render flattens the music onto one constant grid and drifts
 * against the master; the transcription carries the real tempo map and does
 * not. See music/README.md for the measurement.
 *
 * An existing <track>.overlay.json is NEVER touched or consumed here — it is
 * merged at load time by src/music/score-map.js, so regenerating can never
 * destroy hand authoring.
 */

import fs from 'node:fs';
import path from 'node:path';

const OFFSET_S = 0.08;
const GM = { 36: 'kick', 38: 'snare', 39: 'clap', 42: 'hat', 49: 'crash' };
const BEATS_PER_BAR = 4;

export function readMidi(file) {
  const b = fs.readFileSync(file);
  if (b.subarray(0, 4).toString() !== 'MThd') throw new Error(`not MIDI: ${file}`);
  const division = b.readUInt16BE(12);
  let pos = 8 + b.readUInt32BE(4);
  const notes = [];
  const tempos = [];
  while (pos < b.length && b.subarray(pos, pos + 4).toString() === 'MTrk') {
    const len = b.readUInt32BE(pos + 4);
    const d = b.subarray(pos + 8, pos + 8 + len);
    pos += 8 + len;
    let i = 0, tick = 0, running = null;
    const vlq = () => { let v = 0, c; do { c = d[i++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
    while (i < d.length) {
      tick += vlq();
      let status = d[i];
      if (status & 0x80) { i++; running = status; } else status = running;
      if (status === 0xff) {
        const type = d[i++];
        const n = vlq();
        const data = d.subarray(i, i + n); i += n;
        if (type === 0x51) tempos.push([tick, (data[0] << 16) | (data[1] << 8) | data[2]]);
      } else if (status === 0xf0 || status === 0xf7) {
        i += vlq();
      } else {
        const hi = status & 0xf0;
        const n = hi === 0xc0 || hi === 0xd0 ? 1 : 2;
        const a = d.subarray(i, i + n); i += n;
        if (hi === 0x90 && a[1] > 0) notes.push([tick, a[0], a[1]]);
      }
    }
  }
  tempos.sort((x, y) => x[0] - y[0]);
  if (!tempos.length || tempos[0][0] > 0) tempos.unshift([0, 500000]);
  return { division, notes: notes.sort((x, y) => x[0] - y[0]), tempos };
}

/** Integrate the tempo map once; then any tick resolves in log time. */
export function tickToSeconds(division, tempos) {
  const marks = [[0, 0]];
  for (let k = 1; k < tempos.length; k++) {
    const [pt, pus] = tempos[k - 1];
    const ct = tempos[k][0];
    marks.push([ct, marks[marks.length - 1][1] + ((ct - pt) / division) * (pus / 1e6)]);
  }
  const usAt = (tick) => {
    let lo = 0, hi = tempos.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tempos[m][0] <= tick) lo = m; else hi = m - 1; }
    return tempos[lo][1];
  };
  return (tick) => {
    let lo = 0, hi = marks.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (marks[m][0] <= tick) lo = m; else hi = m - 1; }
    return marks[lo][1] + ((tick - marks[lo][0]) / division) * (usAt(tick) / 1e6);
  };
}

function build(midiDir, slug, arrangementFile) {
  const files = fs.readdirSync(midiDir).filter((f) => f.endsWith('.mid'));
  const pick = (tag) => files.find((f) => f.toLowerCase().includes(tag));
  const drumFile = pick('drum');
  if (!drumFile) throw new Error(`no drum MIDI in ${midiDir}`);

  const drums = readMidi(path.join(midiDir, drumFile));
  const at = (tick) => tickToSeconds(drums.division, drums.tempos)(tick) + OFFSET_S;
  const secAt = tickToSeconds(drums.division, drums.tempos);
  const sec = (tick) => secAt(tick) + OFFSET_S;

  const lastTick = drums.notes[drums.notes.length - 1][0];
  const beats = [];
  for (let tick = 0; tick <= lastTick; tick += drums.division) beats.push(round(sec(tick), 3));
  const totalBeats = beats.length;
  const bars = Math.ceil(totalBeats / BEATS_PER_BAR);

  // Seconds -> beats, by interpolating the grid we just built.
  const toBeat = (s) => {
    let lo = 0, hi = beats.length - 1;
    if (s <= beats[0]) return 0;
    if (s >= beats[hi]) return hi;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (beats[m] <= s) lo = m; else hi = m; }
    return lo + (s - beats[lo]) / (beats[lo + 1] - beats[lo]);
  };

  // Sparse hits become events; dense hi-hats become a per-bar busyness curve.
  const byName = {};
  for (const [tick, pitch, vel] of drums.notes) {
    const name = GM[pitch];
    if (name) (byName[name] ||= []).push([toBeat(sec(tick)), vel]);
  }
  const events = {};
  const curves = {};
  for (const [name, hits] of Object.entries(byName)) {
    const peak = Math.max(...hits.map((h) => h[1]), 1);
    if (name === 'hat') {
      const v = new Array(bars).fill(0);
      for (const [beat] of hits) v[Math.floor(beat / BEATS_PER_BAR)]++;
      const top = Math.max(...v, 1);
      curves.hat = { per: 'bar', v: v.map((x) => round(x / top, 2)) };
    } else {
      events[name] = hits.map(([beat, vel]) => [round(beat, 3), round(vel / peak, 2)]);
    }
  }

  // Overall energy per bar, from how much is being hit and how hard.
  const energy = new Array(bars).fill(0);
  for (const [tick, pitch, vel] of drums.notes) {
    if (!GM[pitch]) continue;
    const bar = Math.floor(toBeat(sec(tick)) / BEATS_PER_BAR);
    if (bar >= 0 && bar < bars) energy[bar] += vel;
  }
  const topEnergy = Math.max(...energy, 1);
  curves.energy = { per: 'bar', v: energy.map((x) => round(x / topEnergy, 2)) };

  // Sections, where an arrangement analysis is available: a machine can only
  // say which layers are sounding. Naming the drop is a person's job, in the
  // overlay.
  const sections = [];
  if (arrangementFile) {
    const arr = JSON.parse(fs.readFileSync(arrangementFile, 'utf8'));
    const names = Object.keys(arr.stems).sort();
    const len = Math.min(...names.map((n) => arr.stems[n].length));

    // Per-second levels flicker, so a raw change-of-set segmenter returns
    // confetti. Settle each layer first: hysteresis to decide sounding or not,
    // then a median filter to remove single-second blips.
    const sounding = {};
    for (const n of names) {
      const lv = arr.stems[n];
      const on = new Array(len).fill(false);
      let state = false;
      for (let i = 0; i < len; i++) {
        if (lv[i] >= 5) state = true;
        else if (lv[i] <= 2) state = false;
        on[i] = state;
      }
      const med = new Array(len);
      for (let i = 0; i < len; i++) {
        let k = 0, c = 0;
        for (let j = Math.max(0, i - 3); j <= Math.min(len - 1, i + 3); j++) { c++; if (on[j]) k++; }
        med[i] = k * 2 > c;
      }
      sounding[n] = med;
    }
    const key = (i) => names.filter((n) => sounding[n][i]).join(',');

    // Contiguous spans, with anything shorter than MIN_SECTION_S folded into
    // its predecessor rather than dropped, so the sections tile the track.
    const MIN_SECTION_S = 6;
    let start = 0;
    for (let i = 1; i <= len; i++) {
      if (i < len && key(i) === key(start)) continue;
      const layers = key(start) ? key(start).split(',') : [];
      const last = sections[sections.length - 1];
      if (last && i - start < MIN_SECTION_S) last.to = round(toBeat(i), 1);
      else sections.push({ from: round(toBeat(start), 1), to: round(toBeat(i), 1), tag: 'auto', layers });
      start = i;
    }
    // Folding a short span into its predecessor can leave two neighbours with
    // the same layer set; they are one section.
    for (let i = sections.length - 1; i > 0; i--) {
      if (sections[i].layers.join() === sections[i - 1].layers.join()) {
        sections[i - 1].to = sections[i].to;
        sections.splice(i, 1);
      }
    }
  }

  const loopBars = Math.floor(totalBeats / BEATS_PER_BAR);
  return {
    format: 1,
    track: slug,
    duration: round(beats[beats.length - 1], 2),
    grid: { offset: OFFSET_S, beats, loop: { from: 0, to: loopBars * BEATS_PER_BAR } },
    events, curves, sections,
  };
}

const round = (v, p) => Math.round(v * 10 ** p) / 10 ** p;

const [, , midiDir, slug, arrangement] = process.argv;
if (!midiDir || !slug) {
  console.error('usage: node tools/build-score-map.mjs <midi-dir> <track-slug> [arrangement.json]');
  process.exit(1);
}
const map = build(midiDir, slug, arrangement);
const out = path.join('music', `${slug}.scoremap.json`);
fs.writeFileSync(out, JSON.stringify(map));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`${out} — ${kb(fs.statSync(out).size)}`);
console.log(`  ${map.grid.beats.length} beats, loop 0..${map.grid.loop.to}, ${map.sections.length} auto sections`);
for (const [k, v] of Object.entries(map.events)) console.log(`  event ${k.padEnd(6)} ${v.length}`);
for (const [k, v] of Object.entries(map.curves)) console.log(`  curve ${k.padEnd(6)} ${v.v.length} bars`);
