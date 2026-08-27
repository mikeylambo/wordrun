const DEFAULT_MANIFEST = '/audio/approved/manifest.json';

const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

export class ApprovedAudioAssets {
  constructor(ctx, buses, manifestUrl = DEFAULT_MANIFEST) {
    this.ctx = ctx;
    this.buses = buses;
    this.manifestUrl = manifestUrl;
    this.entries = new Map();
    this.buffers = new Map();
    this.loops = new Map();
    this.ready = false;
    this.loading = false;
    this.error = null;
    this.loaded = 0;
    this.expected = 0;
  }

  async load() {
    if (this.loading || this.ready) return this;
    this.loading = true;
    try {
      const response = await fetch(this.manifestUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`approved audio manifest ${response.status}`);
      const manifest = await response.json();
      const files = manifest?.files && typeof manifest.files === 'object' ? manifest.files : {};
      const entries = Object.entries(files).filter(([, spec]) => spec && (typeof spec === 'string' || spec.url));
      this.expected = entries.length;

      await Promise.all(entries.map(async ([id, raw]) => {
        const spec = typeof raw === 'string' ? { url: raw } : raw;
        this.entries.set(id, spec);
        try {
          const file = await fetch(spec.url, { cache: 'force-cache' });
          if (!file.ok) throw new Error(`${id} ${file.status}`);
          const bytes = await file.arrayBuffer();
          const buffer = await this.ctx.decodeAudioData(bytes.slice(0));
          this.buffers.set(id, buffer);
          this.loaded++;
        } catch (err) {
          console.warn(`[audio] approved asset unavailable: ${id}`, err);
        }
      }));
      this.ready = true;
    } catch (err) {
      // An empty/missing approval manifest must never break gameplay audio.
      this.error = String(err?.message || err);
      this.ready = true;
      console.info('[audio] procedural-only mix; approved manifest unavailable');
    } finally {
      this.loading = false;
      globalThis.__AUDIO_ASSETS = this.status();
    }
    return this;
  }

  status() {
    return {
      ready: this.ready,
      loaded: this.loaded,
      expected: this.expected,
      activeLoops: [...this.loops.keys()],
      ids: [...this.buffers.keys()],
      error: this.error,
    };
  }

  has(id) { return this.buffers.has(id); }

  _bus(name) { return this.buses?.[name] || this.buses?.surface; }

  _panner(pan = 0) {
    if (!this.ctx.createStereoPanner) return null;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan);
    return p;
  }

  oneShot(id, { gain = 1, pan = 0, bus = 'surface', rate = 1, delay = 0 } = {}) {
    const buffer = this.buffers.get(id);
    if (!buffer) return false;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const p = this._panner(pan);
    src.buffer = buffer;
    src.playbackRate.value = rate;
    g.gain.value = Math.max(0, gain) * (this.entries.get(id)?.gain ?? 1);
    src.connect(g);
    if (p) { g.connect(p); p.connect(this._bus(bus)); }
    else g.connect(this._bus(bus));
    src.start(t);
    return true;
  }

  setLoop(id, target, { gain = 1, pan = 0, bus = 'surface', rate = 1, tau = 0.09 } = {}) {
    const buffer = this.buffers.get(id);
    if (!buffer) return false;
    let voice = this.loops.get(id);
    if (!voice) {
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      const p = this._panner(pan);
      src.buffer = buffer;
      src.loop = true;
      src.playbackRate.value = rate;
      g.gain.value = 0;
      src.connect(g);
      if (p) { g.connect(p); p.connect(this._bus(bus)); }
      else g.connect(this._bus(bus));
      src.start();
      voice = { src, gain: g, pan: p };
      this.loops.set(id, voice);
      globalThis.__AUDIO_ASSETS = this.status();
    }
    voice.src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, Math.max(0.02, tau));
    if (voice.pan) voice.pan.pan.setTargetAtTime(clamp(pan), this.ctx.currentTime, Math.max(0.02, tau));
    const trim = this.entries.get(id)?.gain ?? 1;
    voice.gain.gain.setTargetAtTime(Math.max(0, target) * gain * trim, this.ctx.currentTime, Math.max(0.02, tau));
    return true;
  }
}

export default ApprovedAudioAssets;
