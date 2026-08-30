import TUNING from './TUNING.js';
import { ApprovedAudioAssets } from './audio/approved-assets.js';
import { PageBed } from './audio/page-bed.js';

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function boot() {
  const audio = window.__AUDIO;
  const sim = window.__SIM;
  if (!audio || !sim) {
    requestAnimationFrame(boot);
    return;
  }
  if (window.__RC9_ASSETS) return;

  let assets = null;
  let pageBed = null;
  let lastOrganicStepAt = -Infinity;

  const ensureAssets = () => {
    if (assets || !audio.ready || !audio.ctx || !audio.bus) return;
    assets = new ApprovedAudioAssets(audio.ctx, audio.bus);
    audio.approvedAssets = assets;
    assets.load();
  };

  const baseStart = audio.start.bind(audio);
  audio.start = function startWithApprovedAssets(...args) {
    const out = baseStart(...args);
    ensureAssets();
    return out;
  };
  ensureAssets();

  // Capture semantic event detail without changing the main-loop API.
  // Phase 15 trimmed this to the one field a live consumer still reads:
  // rc9-feedback's procedural takeoff shaping. The landing and hit kinds
  // only ever fed authored Foley this game cannot reach — see the note in
  // the update below, and the reachability gate in corruption-gates.
  const baseDrain = sim.drainEvents.bind(sim);
  sim.drainEvents = function drainEventsForApprovedAudio() {
    const events = baseDrain();
    if (events) {
      for (const e of events) {
        if (e.t === 'takeoff') audio.__rc9TakeoffKind = e.kind || 'terrain';
      }
    }
    return events;
  };

  const baseUpdate = audio.update.bind(audio);
  audio.update = function updateWithApprovedBeds(dt, p, bands, running) {
    baseUpdate(dt, p, bands, running);
    ensureAssets();

    const phase = sim.phase;
    const live = !!running && phase === 'running' && !(phase === 'kill' || phase === 'dead');
    const speedN = clamp((p.speed - 10) / (TUNING.RUN.CEILING - 10));

    // Phase 15: the recorded alpine-wind bed and the three ski surface loops
    // are retired — wrong world, and the ski loops were never in the manifest
    // to begin with (referenced, never loaded, inert in play). The atmosphere
    // is now this game's own: procedural page grain, page turns and ink
    // blooms, built from the engine's noise buffers. No file, no download —
    // so unlike the bed it replaces, it plays even if the manifest never
    // loads, which is why it needs no approved-asset guard at all.
    //
    // The same pass retired six inherited Foley assets — a hard carve
    // sweep, a launch, two landings, a tree hit and a rock hit — after
    // measuring that none of them can sound in this game. Five full 30 km
    // runs (106,775 sim steps) produced zero airborne frames and zero
    // obstacle hits, because nothing solid spawns and the confirm verb
    // never jumps; the carve sweep needed 82% of MAX_CARVE and the
    // auto-followed line peaks at 48%. Eight files that could only ever be
    // downloaded, never heard. What is left here is the bed alone.
    if (!pageBed && audio.ctx && audio.bus?.ambience && audio.noise) {
      pageBed = new PageBed(audio.ctx, audio.bus.ambience, audio.noise);
    }
    pageBed?.update(dt, { live, speedN });
  };

  const layer = (method, idFor, optionsFor) => {
    const base = audio[method]?.bind(audio);
    if (!base) return;
    audio[method] = function approvedLayer(...args) {
      ensureAssets();
      const id = idFor(...args);
      if (id && assets?.has(id)) assets.oneShot(id, optionsFor?.(...args) || {});
      return base(...args);
    };
  };

  // The takeoff/landing/tree/rock layers are gone with their assets: they
  // wrapped events this game cannot produce. The procedural voices they
  // wrapped are untouched — `layer` only ever added a sample on top.
  layer('overdriveOn', () => 'go_rush', () => ({ bus: 'ambience', gain: 0.34 }));

  layer('huntStart', (side, kind) => kind === 'leap' ? 'beast_main_leap' : 'beast_main_distant',
    (side) => ({ bus: 'threat', gain: 0.42, pan: clamp(side * 0.72, -1, 1) }));

  // Keep exact procedural cadence, but do not stack a 1.2s organic sample on
  // every pursuit beat. The body sample is an accent; the procedural transient
  // remains the timing signal on every step.
  const baseThump = audio._thump?.bind(audio);
  if (baseThump) {
    audio._thump = function thumpWithApprovedStep(vol, pan = 0, bus = audio.bus.threat) {
      ensureAssets();
      const now = audio.ctx?.currentTime ?? 0;
      if (bus === audio.bus.threat && assets?.has('beast_main_step') && now - lastOrganicStepAt >= 0.68) {
        lastOrganicStepAt = now;
        assets.oneShot('beast_main_step', {
          bus: 'threat',
          gain: 0.28 * clamp(vol / Math.max(0.01, TUNING.AUDIO.FOOTFALL_MAX)),
          pan,
        });
      }
      return baseThump(vol, pan, bus);
    };
  }

  layer('secondBeastEnter', () => 'frost_beast_enter',
    (side) => ({ bus: 'threat', gain: 0.44, pan: clamp(side * 0.88, -1, 1) }));
  layer('secondBeastCharge', (side, kind) => kind === 'vault' ? 'frost_beast_vault' : 'frost_beast_charge',
    (side) => ({ bus: 'threat', gain: 0.48, pan: clamp(side * 0.92, -1, 1) }));
  layer('kill', (source) => (source || sim.killSource) === 'second' ? 'frost_beast_kill' : null,
    () => ({ bus: 'cinematic', gain: 0.52 }));

  window.__RC9_ASSETS = {
    version: '9.5',
    proceduralFallback: true,
    manifest: '/audio/approved/manifest.json',
    slots: [
      'go_rush',
      'beast_main_distant', 'beast_main_step', 'beast_main_leap',
      'frost_beast_enter', 'frost_beast_charge', 'frost_beast_vault', 'frost_beast_kill',
    ],
    get status() { return assets?.status?.() || { ready: false, loaded: 0, expected: 0, ids: [] }; },
  };
}

requestAnimationFrame(boot);
