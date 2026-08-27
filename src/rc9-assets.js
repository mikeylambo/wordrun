import TUNING from './TUNING.js';
import { ApprovedAudioAssets } from './audio/approved-assets.js';

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
  let lastHitKind = null;
  let lastLanding = null;
  let lastTakeoffKind = 'terrain';
  let lastOrganicStepAt = -Infinity;
  let lastHardCarveAt = -Infinity;

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
  const baseDrain = sim.drainEvents.bind(sim);
  sim.drainEvents = function drainEventsForApprovedAudio() {
    const events = baseDrain();
    if (events) {
      for (const e of events) {
        if (e.t === 'hit') lastHitKind = e.kind || null;
        if (e.t === 'land_clean' || e.t === 'land_flub') lastLanding = e;
        if (e.t === 'takeoff') {
          lastTakeoffKind = e.kind || 'terrain';
          audio.__rc9TakeoffKind = lastTakeoffKind;
        }
      }
    }
    return events;
  };

  const baseUpdate = audio.update.bind(audio);
  audio.update = function updateWithApprovedBeds(dt, p, bands, running) {
    baseUpdate(dt, p, bands, running);
    ensureAssets();
    if (!assets) return;

    const phase = sim.phase;
    const live = !!running && phase === 'running';
    const kill = phase === 'kill' || phase === 'dead';
    const speedN = clamp((p.speed - 7) / 30);
    const edge = p.airborne ? 0 : clamp(Math.abs(p.heading) / TUNING.PLAYER.MAX_CARVE);
    const airborne = !!p.airborne;
    const onIce = live && !airborne && !!p.onIce;
    const inPowder = live && !airborne && !!p.inPowder;
    const onSnow = live && !airborne && !onIce && !inPowder;

    // Generated ski loops remain optional/disabled in the current manifest.
    assets.setLoop('ski_packed_loop', onSnow ? (0.34 + speedN * 0.38) * (0.82 + edge * 0.18) : 0,
      { bus: 'surface', gain: 0.48, rate: 0.96 + speedN * 0.10, tau: 0.08 });
    assets.setLoop('ski_powder_loop', inPowder ? 0.42 + speedN * 0.34 : 0,
      { bus: 'surface', gain: 0.52, rate: 0.95 + speedN * 0.08, tau: 0.10 });
    assets.setLoop('ski_ice_loop', onIce ? (0.28 + speedN * 0.34) * (0.72 + edge * 0.28) : 0,
      { bus: 'surface', gain: 0.42, rate: 0.97 + speedN * 0.08, tau: 0.06 });

    // Keep organic ambience behind the procedural wind; RC9.5 gives bells and
    // threat cues the foreground and lets air feel spacious rather than loud.
    assets.setLoop('wind_alpine_bed', live && !kill ? 0.20 + speedN * 0.13 : 0,
      { bus: 'ambience', gain: 0.25, rate: 1, tau: 0.18 });

    // Hard carving gets an occasional authored sweep rather than another
    // continuous layer. The cooldown keeps a held turn from machine-gunning Foley.
    const now = audio.ctx?.currentTime ?? 0;
    if (onSnow && edge >= 0.82 && speedN >= 0.42 && assets.has('carve_hard') && now - lastHardCarveAt >= 1.15) {
      lastHardCarveAt = now;
      assets.oneShot('carve_hard', {
        bus: 'surface',
        gain: 0.28 + edge * 0.08,
        pan: clamp(Math.sign(p.heading) * 0.18, -1, 1),
        rate: 0.97 + speedN * 0.06,
      });
    }
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

  // Hero launch Foley is now terrain-only. A player tapping jump at random gets
  // the lighter procedural hop from rc9-feedback instead of a giant ramp sound.
  layer('takeoff', () => lastTakeoffKind === 'terrain' ? 'takeoff_big_air' : null,
    () => ({ bus: 'surface', gain: 0.34 }));
  layer('landClean', () => 'landing_clean', () => ({ bus: 'surface', gain: lastLanding?.hang > 1.2 ? 0.48 : 0.36 }));
  layer('landFlub', () => 'landing_heavy', () => ({ bus: 'surface', gain: lastLanding?.hang > 1.0 ? 0.52 : 0.40 }));
  layer('hit', () => lastHitKind === 'tree' ? 'tree_hit' : lastHitKind === 'rock' ? 'rock_hit' : null,
    () => ({ bus: 'surface', gain: 0.46 }));
  layer('overdriveOn', () => 'go_rush', () => ({ bus: 'ambience', gain: 0.34 }));

  layer('huntStart', (side, kind) => kind === 'leap' ? 'beast_main_leap' : 'beast_main_distant',
    (side) => ({ bus: 'threat', gain: 0.42, pan: clamp(side * 0.72, -1, 1) }));
  layer('lungeTell', () => 'beast_main_close', () => ({
    bus: 'threat', gain: 0.42,
    pan: clamp(((sim.beast?.x ?? sim.player.x) - sim.player.x) / 8, -1, 1),
  }));

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
    terrainOnlyHeroLaunch: true,
    manifest: '/audio/approved/manifest.json',
    slots: [
      'ski_packed_loop', 'ski_powder_loop', 'ski_ice_loop', 'wind_alpine_bed', 'go_rush',
      'carve_hard', 'takeoff_big_air', 'landing_clean', 'landing_heavy', 'tree_hit', 'rock_hit',
      'beast_main_distant', 'beast_main_close', 'beast_main_step', 'beast_main_leap',
      'frost_beast_enter', 'frost_beast_charge', 'frost_beast_vault', 'frost_beast_kill',
    ],
    get status() { return assets?.status?.() || { ready: false, loaded: 0, expected: 0, ids: [] }; },
  };
}

requestAnimationFrame(boot);
