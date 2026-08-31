/**
 * Builds the music beat map from a stem-separator's MIDI transcription.
 *
 *   node tools/build-beatmap.mjs <midi-dir> > music/<track>.beatmap.json
 *
 * The transcription carries a full tempo map — 692 changes across this track,
 * spanning 160.00 to 169.01 BPM — so integrating ticks through it reconstructs
 * the ORIGINAL recording's timeline, not the separator's warped one. That is
 * the whole reason this reads MIDI rather than the rendered stem audio: the
 * audio stems were flattened onto a constant 164.00 BPM grid and drift up to
 * half a second against the master by the end, while the MIDI does not drift
 * at all. See music/README.md.
 *
 * Times land a constant OFFSET_S ahead of the master's audio onsets; the
 * constant is measured, not guessed (music/README.md records the method).
 */

import fs from 'node:fs';
import path from 'node:path';

const OFFSET_S = 0.08;
const GM = { 36: 'kick', 38: 'snare', 39: 'clap', 42: 'hat', 49: 'crash' };

function readMidi(file) {
  const b = fs.readFileSync(file);
  if (b.subarray(0, 4).toString() !== 'MThd') throw new Error(`not a MIDI file: ${file}`);
  const headerLength = b.readUInt32BE(4);
  const division = b.readUInt16BE(12);
  let pos = 8 + headerLength;
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
        const len2 = vlq();
        const data = d.subarray(i, i + len2); i += len2;
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

// Integrate the tempo map once, then look up any tick in log time.
function tickToSeconds(division, tempos) {
  const marks = [[0, 0]];
  for (let k = 1; k < tempos.length; k++) {
    const [pt, pus] = tempos[k - 1];
    const ct = tempos[k][0];
    marks.push([ct, marks[marks.length - 1][1] + ((ct - pt) / division) * (pus / 1e6)]);
  }
  return (tick) => {
    let lo = 0, hi = marks.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (marks[mid][0] <= tick) lo = mid; else hi = mid - 1; }
    let us = 500000;
    for (let k = tempos.length - 1; k >= 0; k--) if (tempos[k][0] <= tick) { us = tempos[k][1]; break; }
    return marks[lo][1] + ((tick - marks[lo][0]) / division) * (us / 1e6);
  };
}

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/build-beatmap.mjs <midi-dir>'); process.exit(1); }
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mid'));
const pick = (tag) => files.find((f) => f.toLowerCase().includes(tag));

const drums = readMidi(path.join(dir, pick('drum')));
const at = tickToSeconds(drums.division, drums.tempos);
const round2 = (s) => Math.round((s + OFFSET_S) * 100) / 100;

const events = {};
for (const [tick, pitch] of drums.notes) {
  const name = GM[pitch];
  if (name) (events[name] ||= []).push(round2(at(tick)));
}

const lastTick = drums.notes[drums.notes.length - 1][0];
const beats = [];
for (let tick = 0; at(tick) <= at(lastTick); tick += drums.division) {
  beats.push(Math.round((at(tick) + OFFSET_S) * 1000) / 1000);
}

const bassFile = pick('bass');
const bass = bassFile
  ? readMidi(path.join(dir, bassFile)).notes.map(([tick, pitch]) => [round2(at(tick)), pitch])
  : [];

const spans = [];
for (let i = 1; i < beats.length; i++) spans.push(beats[i] - beats[i - 1]);
process.stdout.write(JSON.stringify({
  track: path.basename(dir),
  offset: OFFSET_S,
  bpm: { min: +(60 / Math.max(...spans)).toFixed(2), max: +(60 / Math.min(...spans)).toFixed(2) },
  beats,
  events,
  bass,
}, null, 1));
