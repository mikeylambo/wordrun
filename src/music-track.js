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
import { pickTrack, urlsFor } from './music/setlist.js';

export class MusicTrack {
  constructor() {
    this.clock = null;
    this.el = null;
    this.ready = false;
    this.id = null;     // RC10.6: which score this session is playing
    this._wired = false;
  }

  /**
   * Fetch the map and stage the audio. Safe to call before any gesture.
   *
   * RC10.6: `id` names a track in the setlist. Nothing else here changed —
   * the map, the clock, the bus and the element are all per-track already
   * and only ever knew one name because three files spelled it out.
   */
  async load(id = null) {
    const track = id ? { id } : pickTrack(0);
    const urls = urlsFor(track?.id);
    if (!urls) return false;
    this.id = track.id;
    try {
      const res = await fetch(urls.map);
      if (!res.ok) throw new Error(`score map ${res.status}`);
      this.clock = new MusicClock(new ScoreMap(await res.json()));
    } catch {
      return false;   // no map, no sync — the game plays on in silence
    }
    const el = new Audio(urls.track);
    el.loop = true;          // the whole song, looping naturally
    // RC10.4: 'none', not 'auto'. This is the largest file in the build by a
    // factor of five, and `preload = 'auto'` began pulling all 6.7 MB of it
    // the instant the element existed — during boot, against the bundle and
    // the fonts, for a track that cannot sound until the player has made a
    // gesture. It is staged here and fetched at `play()`, which is the first
    // moment anyone wants it. Streaming still means the run starts before the
    // whole track has arrived; that was never what cost the load.
    el.preload = 'none';
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
      src.connect(this.gain).connect(audio.bus.music);
      this._wired = true;
    } catch { /* a second attach on the same element throws; harmless */ }
  }

  play() {
    if (!this.ready) return;
    // The moment the file is actually wanted. Setting this before play() lets
    // the element buffer ahead rather than fetching in lockstep with playback.
    if (this.el.preload !== 'auto') this.el.preload = 'auto';
    this.el.play().catch(() => {});
  }
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
