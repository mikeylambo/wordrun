/**
 * Musical position from a playing audio source — see music/FORMAT.md.
 *
 * Portable: no engine, no game, no DOM, no Web Audio. The consumer reads its
 * own playback position however it can and feeds it in; everything here is
 * arithmetic, which is also what makes it testable without playing anything.
 *
 * Three problems this exists to solve, all of which are easy to get wrong:
 *
 *  1. Frame time is not audio time. They drift apart within seconds, so a beat
 *     counted in rAF deltas is visibly late within a minute. Position must come
 *     from the audio source. How coarsely a source reports it varies: measured
 *     against a real element in Chromium here, currentTime advanced on 1492 of
 *     1497 frames, so the prediction had almost nothing to do — but other
 *     browsers throttle it to a few updates a second, where a raw read makes
 *     the beat visibly stutter. So we predict forward at frame rate and slew
 *     gently toward each new reading, snapping only when it is far out. On a
 *     source that is already fine-grained this costs nothing and stays exact
 *     (0.1 ms mean error, 33 ms worst — a dropped frame, carried by the
 *     prediction); on a coarse one it is the difference between smooth and not.
 *
 *  2. Reacting to an event is already too late. A visual needs to start before
 *     the hit lands or it has no attack. So the useful question is `until`, not
 *     `did it happen` — ask how far away the next kick is and drive an envelope
 *     with it.
 *
 *  3. Loops wrap. Sessions here are unbounded, so a single track plays many
 *     times; `beat` keeps counting up across laps while lookups use the
 *     loop-local position.
 */

const SNAP_S = 0.25;      // beyond this the reading is a seek, not drift
const SLEW_RATE = 0.5;    // correct at most half a second per second played

export class MusicClock {
  constructor(scoreMap) {
    this.score = scoreMap;
    this.reset();
  }

  reset() {
    this.playing = false;
    this.lap = 0;
    this._predicted = 0;
    this._lastRaw = null;
    this._lastMs = null;
    this._beat = 0;
    this._prevBeat = 0;
    this._crossed = {};
  }

  /**
   * Call once a frame.
   *   rawSeconds — the source's own playback position, coarse is fine
   *   nowMs      — a monotonic millisecond clock (performance.now())
   */
  update(rawSeconds, nowMs) {
    const dt = this._lastMs == null ? 0 : Math.max(0, (nowMs - this._lastMs) / 1000);
    this._lastMs = nowMs;

    if (rawSeconds == null) { this.playing = false; return; }
    this.playing = true;

    this._predicted += dt;
    if (this._lastRaw == null) {
      this._predicted = rawSeconds;
    } else if (rawSeconds !== this._lastRaw) {
      // A fresh reading. Snap on a seek or a loop restart; otherwise ease over
      // so the beat never jumps backwards mid-animation.
      const err = rawSeconds - this._predicted;
      if (Math.abs(err) > SNAP_S) this._predicted = rawSeconds;
      else this._predicted += Math.sign(err) * Math.min(Math.abs(err), SLEW_RATE * dt);
    }
    this._lastRaw = rawSeconds;

    const s = this.score;
    const prevLocal = this._local;
    let local = s.beatAt(this._predicted);
    if (local >= s.loopTo) local = s.loopFrom + ((local - s.loopFrom) % s.loopBeats);
    // A lap shows up as the position jumping backwards, which covers both a
    // source that loops itself and one that is restarted. Testing `local >=
    // loopTo` would never fire: the grid ends one beat short of loopTo.
    if (prevLocal != null && local < prevLocal - s.loopBeats / 2) this.lap++;
    this._prevLocal = prevLocal == null ? local : prevLocal;
    this._local = local;
    this._prevBeat = this._beat;
    this._beat = this.lap * s.loopBeats + local;
    this._crossed = {};
  }

  /** Beats since playback began, counting up across loops. */
  get beat() { return this._beat; }
  /** Position within the loop — what every lookup uses. */
  get beatInLoop() { return this._local ?? 0; }
  get bar() { return Math.floor(this.beatInLoop / 4); }
  get section() { return this.score.sectionAt(this.beatInLoop); }
  get seconds() { return this._predicted; }

  /** Seconds until the next event of `type`. Drive envelopes with this. */
  until(type) {
    const next = this.score.nextAfter(type, this.beatInLoop);
    if (next == null) return Infinity;
    const s = this.score;
    const dt = next >= s.loopTo
      ? (s.secondsAt(s.loopTo) - s.secondsAt(this.beatInLoop))
        + (s.secondsAt(next - s.loopBeats) - s.secondsAt(s.loopFrom))
      : s.secondsAt(next) - s.secondsAt(this.beatInLoop);
    return Math.max(0, dt);
  }

  /**
   * Events of `type` crossed since the previous update, as [beat, strength].
   * Use this to fire; use `until` to anticipate.
   */
  crossed(type) {
    if (this._crossed[type]) return this._crossed[type];
    const s = this.score;
    const from = this._prevLocal ?? 0;
    const to = this._local ?? 0;
    // Read-only: the window is fixed by update(), so asking for two types in
    // one frame cannot make the second one miss.
    const out = to >= from
      ? s.between(type, from, to)
      : [...s.between(type, from, s.loopTo), ...s.between(type, s.loopFrom, to)];
    this._crossed[type] = out;
    return out;
  }

  /** A per-bar curve at the current position, 0..1. */
  curve(name) { return this.score.curve(name, this.beatInLoop); }

  /**
   * 1 at a hit, falling to 0 over `windowS`. The shape every music-reactive
   * visual actually wants, without each caller re-deriving it from `crossed`.
   */
  pulse(type, windowS = 0.18) {
    const s = this.score;
    const prev = s.prevBefore(type, this.beatInLoop);
    if (prev == null) return 0;
    const age = prev < 0
      ? (s.secondsAt(this.beatInLoop) - s.secondsAt(s.loopFrom))
        + (s.secondsAt(s.loopTo) - s.secondsAt(prev + s.loopBeats))
      : s.secondsAt(this.beatInLoop) - s.secondsAt(prev);
    return age < 0 || age > windowS ? 0 : 1 - age / windowS;
  }
}

export default MusicClock;
