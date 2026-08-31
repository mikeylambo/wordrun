/**
 * Plays the score track and keeps a MusicClock on it.
 *
 * Game-side glue: src/music/ stays portable and knows nothing about this
 * game's audio graph, and this file knows nothing about how the score map was
 * analysed. All it does is get a file playing, route it where mute and the
 * duck can reach it, and hand the clock a playback position every frame.
 *
 * A media element rather than a decoded buffer on purpose: this is a 7 MB
 * file, and streaming it means the run can start before the whole track has
 * arrived. Decoding it up front would put several seconds of silence between
 * BEGIN RUN and any sound at all.
 */

import { ScoreMap } from './music/score-map.js';
import { MusicClock } from './music/music-clock.js';

const TRACK_URL = './audio/music/into-the-night.mp3';
const MAP_URL = './audio/music/into-the-night.scoremap.json';

export class MusicTrack {
  constructor() {
    this.clock = null;
    this.el = null;
    this.ready = false;
    this._wired = false;
  }

  /** Fetch the map and stage the audio. Safe to call before any gesture. */
  async load() {
    try {
      const res = await fetch(MAP_URL);
      if (!res.ok) throw new Error(`score map ${res.status}`);
      this.clock = new MusicClock(new ScoreMap(await res.json()));
    } catch {
      return false;   // no map, no sync — the game plays on in silence
    }
    const el = new Audio(TRACK_URL);
    el.loop = true;          // the whole song, looping naturally
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    this.el = el;
    this.ready = true;
    return true;
  }

  /**
   * Route through the game's own music bus so mute, the drain's lowpass and
   * every duck already in the mix apply to the score for free.
   */
  attach(audio) {
    if (!this.ready || this._wired || !audio?.ctx || !audio?.bus?.ambience) return;
    try {
      const src = audio.ctx.createMediaElementSource(this.el);
      this.gain = audio.ctx.createGain();
      this.gain.gain.value = 0.62;
      src.connect(this.gain).connect(audio.bus.ambience);
      this._wired = true;
    } catch { /* a second attach on the same element throws; harmless */ }
  }

  play() { if (this.ready) this.el.play().catch(() => {}); }
  pause() { if (this.ready) this.el.pause(); }

  stop() {
    if (!this.ready) return;
    this.el.pause();
    this.el.currentTime = 0;
    this.clock?.reset();
  }

  /** Once a frame. Returns the clock, or null when nothing is playing. */
  update(nowMs) {
    if (!this.ready || !this.clock) return null;
    const playing = !this.el.paused && !this.el.ended;
    this.clock.update(playing ? this.el.currentTime : null, nowMs);
    return this.clock;
  }
}

export default MusicTrack;
