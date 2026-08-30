/**
 * The page bed (Phase 15) — this game's own atmosphere.
 *
 * What it replaces: a recorded alpine-wind loop inherited from the source
 * frame. A game about outrunning a proofreader's Redline across an
 * unfinished manuscript should not sound like a mountain, and a
 * ski-named asset is the kind of thing that reads badly the moment
 * anyone outside the studio opens the build.
 *
 * What it is: three procedural layers on the ambience bus, all built from
 * the engine's existing noise buffers — no new files, no download, and it
 * scales with speed exactly where the old bed did.
 *
 *   GRAIN  a continuous paper-fibre hiss (narrow band, slowly wandering)
 *          — the texture of the page itself, always under everything.
 *   RUSTLE sparse filtered bursts at irregular intervals — pages turning
 *          somewhere ahead. Faster and more frequent as the run speeds up.
 *   INK    an occasional low resonant bloom — the wet-ink body that keeps
 *          the bed from being all treble.
 *
 * Presentation only: consumes speed and a live flag, writes nothing back,
 * and schedules itself off the caller's update tick — no timer, no rAF.
 */

/** Layer levels as a pure function of the run — testable without an AudioContext. */
export function bedLevels({ live = false, speedN = 0 } = {}) {
  if (!live) return { grain: 0, rustleRate: 0, ink: 0 };
  const s = Math.max(0, Math.min(1, speedN));
  return {
    grain: 0.20 + s * 0.13,      // matches the retired bed's speed law
    rustleRate: 0.28 + s * 0.62, // page turns per second
    ink: 0.10 + s * 0.06,
  };
}

export class PageBed {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} destination  the ambience bus
   * @param {AudioBuffer} noise      the engine's looping noise buffer
   */
  constructor(ctx, destination, noise) {
    this.ctx = ctx;
    this.dest = destination;
    this.noise = noise;
    this._nextRustle = 0;
    this._phase = 0;

    // GRAIN — looping noise through a narrow band, gain rides the run.
    this.grainSrc = ctx.createBufferSource();
    this.grainSrc.buffer = noise;
    this.grainSrc.loop = true;
    this.grainFilter = ctx.createBiquadFilter();
    this.grainFilter.type = 'bandpass';
    this.grainFilter.frequency.value = 1150;
    this.grainFilter.Q.value = 1.6;
    this.grainGain = ctx.createGain();
    this.grainGain.gain.value = 0;
    this.grainSrc.connect(this.grainFilter);
    this.grainFilter.connect(this.grainGain);
    this.grainGain.connect(destination);
    this.grainSrc.start();

    // A slow wander on the band keeps the hiss from reading as flat noise.
    this.wanderLfo = ctx.createOscillator();
    this.wanderGain = ctx.createGain();
    this.wanderLfo.frequency.value = 0.07;
    this.wanderGain.gain.value = 260;
    this.wanderLfo.connect(this.wanderGain);
    this.wanderGain.connect(this.grainFilter.frequency);
    this.wanderLfo.start();

    // INK — a low bloom voice, opened by update() rather than one-shot.
    this.inkSrc = ctx.createBufferSource();
    this.inkSrc.buffer = noise;
    this.inkSrc.loop = true;
    this.inkFilter = ctx.createBiquadFilter();
    this.inkFilter.type = 'lowpass';
    this.inkFilter.frequency.value = 210;
    this.inkFilter.Q.value = 3.1;
    this.inkGain = ctx.createGain();
    this.inkGain.gain.value = 0;
    this.inkSrc.connect(this.inkFilter);
    this.inkFilter.connect(this.inkGain);
    this.inkGain.connect(destination);
    this.inkSrc.start();
  }

  /** One page turn: a short swept burst, panned wherever it happened. */
  _rustle(gain) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.85 + Math.random() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    const f0 = 1900 + Math.random() * 1500;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const pan = ctx.createStereoPanner?.();
    src.connect(filter);
    if (pan) {
      pan.pan.value = (Math.random() * 2 - 1) * 0.7;
      filter.connect(g); g.connect(pan); pan.connect(this.dest);
    } else {
      filter.connect(g); g.connect(this.dest);
    }
    src.start(t);
    src.stop(t + 0.2);
  }

  /**
   * Drive from the audio update tick.
   * @param {number} dt      seconds since the last call
   * @param {object} state   { live, speedN }
   */
  update(dt, state) {
    const { grain, rustleRate, ink } = bedLevels(state);
    const t = this.ctx.currentTime;
    const tau = 0.18;
    this.grainGain.gain.setTargetAtTime(grain * 0.055, t, tau);

    // Ink blooms breathe on a slow phase rather than firing discretely —
    // one fewer scheduled voice, and it never stacks.
    this._phase += dt * 0.11;
    const breath = 0.5 + 0.5 * Math.sin(this._phase * Math.PI * 2);
    this.inkGain.gain.setTargetAtTime(ink * 0.09 * breath * breath, t, 0.4);

    if (rustleRate <= 0) { this._nextRustle = 0; return; }
    this._nextRustle -= dt;
    if (this._nextRustle <= 0) {
      // Irregular on purpose: an even cadence reads as a machine, not a room.
      this._nextRustle = (0.6 + Math.random() * 1.9) / rustleRate;
      this._rustle(0.018 + Math.random() * 0.016);
    }
  }

  stop() {
    try { this.grainSrc.stop(); this.inkSrc.stop(); this.wanderLfo.stop(); }
    catch { /* already stopped */ }
  }
}

export default PageBed;
