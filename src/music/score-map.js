/**
 * Score map access — see music/FORMAT.md.
 *
 * Portable: no engine, no game, no DOM. Given a parsed score map (and
 * optionally a hand-authored overlay) this answers questions about the music
 * in beats. Nothing here knows what a beat is for.
 */

const BEATS_PER_BAR = 4;

/**
 * Merge a hand-authored overlay over a generated map.
 *
 * Sections replace wholesale, because a person who has written sections has
 * decided the machine's guesses are not what they want. `drop` removes events
 * a transcription hallucinated, matched within a tolerance so an overlay does
 * not have to reproduce float times exactly. An overlay may not add events —
 * that would mean the map itself is wrong and should be regenerated.
 */
export function applyOverlay(map, overlay) {
  if (!overlay) return map;
  const out = { ...map, events: { ...map.events }, curves: { ...map.curves } };
  if (overlay.sections) out.sections = overlay.sections;
  if (overlay.grid?.loop) out.grid = { ...map.grid, loop: overlay.grid.loop };
  for (const [from, to] of Object.entries(overlay.rename || {})) {
    if (out.events[from]) { out.events[to] = out.events[from]; delete out.events[from]; }
    if (out.curves[from]) { out.curves[to] = out.curves[from]; delete out.curves[from]; }
  }
  for (const [type, beats] of Object.entries(overlay.drop || {})) {
    const list = out.events[type];
    if (!list) continue;
    out.events[type] = list.filter(([b]) => !beats.some((x) => Math.abs(x - b) < 0.05));
  }
  return out;
}

export class ScoreMap {
  constructor(map, overlay = null) {
    this.map = applyOverlay(map, overlay);
    const g = this.map.grid;
    this.beats = g.beats;
    this.offset = g.offset ?? 0;
    this.loopFrom = g.loop?.from ?? 0;
    this.loopTo = g.loop?.to ?? this.beats.length - 1;
    this.loopBeats = this.loopTo - this.loopFrom;
    if (this.loopTo % BEATS_PER_BAR !== 0 || this.loopFrom % BEATS_PER_BAR !== 0) {
      // Not fatal, but the phase will walk on every lap. FORMAT.md explains why
      // this has to be fixed in how the audio is cut, not in code.
      this.loopMisaligned = true;
    }
    this.loopSeconds = this.secondsAt(this.loopTo) - this.secondsAt(this.loopFrom);
  }

  get duration() { return this.map.duration; }
  get types() { return Object.keys(this.map.events); }

  /** Seconds for a fractional beat, interpolating the grid. */
  secondsAt(beat) {
    const b = this.beats;
    if (beat <= 0) return b[0];
    if (beat >= b.length - 1) {
      const span = b[b.length - 1] - b[b.length - 2];
      return b[b.length - 1] + (beat - (b.length - 1)) * span;
    }
    const i = Math.floor(beat);
    return b[i] + (beat - i) * (b[i + 1] - b[i]);
  }

  /** Fractional beat for a time in seconds. */
  beatAt(seconds) {
    const b = this.beats;
    if (seconds <= b[0]) return 0;
    if (seconds >= b[b.length - 1]) return b.length - 1;
    let lo = 0, hi = b.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (b[m] <= seconds) lo = m; else hi = m; }
    return lo + (seconds - b[lo]) / (b[lo + 1] - b[lo]);
  }

  events(type) { return this.map.events[type] || []; }

  /** Index of the first event at or after `beat`. Events are sorted, and this
   *  runs every frame for several types, so it binary-searches. */
  _lowerBound(type, beat) {
    const list = this.events(type);
    let lo = 0, hi = list.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (list[m][0] < beat) lo = m + 1; else hi = m; }
    return lo;
  }

  /** Events with beat in [from, to). Both are loop-local and from <= to. */
  between(type, from, to) {
    const list = this.events(type);
    const out = [];
    for (let i = this._lowerBound(type, from); i < list.length && list[i][0] < to; i++) out.push(list[i]);
    return out;
  }

  /** Beat of the first event of `type` at or after `beat`, wrapping the loop. */
  nextAfter(type, beat) {
    const list = this.events(type);
    if (!list.length) return null;
    const i = this._lowerBound(type, beat);
    return i < list.length ? list[i][0] : list[0][0] + this.loopBeats;
  }

  /** Beat of the last event of `type` at or before `beat`, wrapping backwards. */
  prevBefore(type, beat) {
    const list = this.events(type);
    if (!list.length) return null;
    const i = this._lowerBound(type, beat) - 1;
    return i >= 0 ? list[i][0] : list[list.length - 1][0] - this.loopBeats;
  }

  /** A per-bar curve sampled at a fractional beat, linearly interpolated. */
  curve(name, beat) {
    const c = this.map.curves[name];
    if (!c) return 0;
    const x = beat / BEATS_PER_BAR;
    const i = Math.floor(x);
    if (i < 0) return c.v[0] ?? 0;
    if (i >= c.v.length - 1) return c.v[c.v.length - 1] ?? 0;
    return c.v[i] + (x - i) * (c.v[i + 1] - c.v[i]);
  }

  sectionAt(beat) {
    const s = this.map.sections || [];
    for (const sec of s) if (beat >= sec.from && beat < sec.to) return sec;
    return null;
  }
}

export default ScoreMap;
