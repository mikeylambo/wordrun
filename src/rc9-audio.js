import './rc9-assets.js';
import './rc9-feedback.js';
import './v1-finalize.js';
import './v1-contact.js';
import './v1-chase.js';
import './v1-ship-polish.js';
import './v1-viewport.js';
import './v1-final-mix.js';
import './v1-house-pad.js';
import './v1-mixer.js';
import './v1-approved-mix.js';

// RC9 — one runtime audio owner. RC5 keeps rendering bells/hearts, but its
// prototype sound layer is replaced by the main Audio engine. V1 finalization
// evaluates after the RC9.10 feedback layer so release patches wrap the final
// implementations rather than racing earlier prototype shims.

function installSharedAudioContext() {
  if (typeof window === 'undefined' || window.__DASH_SHARED_AUDIO_CONTEXT__) return;
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) return;

  let shared = null;
  function SharedAudioContext(...args) {
    if (shared && shared.state !== 'closed') return shared;
    shared = new Native(...args);
    return shared;
  }
  SharedAudioContext.prototype = Native.prototype;

  window.AudioContext = SharedAudioContext;
  if (window.webkitAudioContext) window.webkitAudioContext = SharedAudioContext;
  window.__DASH_SHARED_AUDIO_CONTEXT__ = {
    native: Native,
    get: () => shared,
  };
}

installSharedAudioContext();

function boot() {
  const sim = window.__SIM;
  const rc = window.__RC5;
  const audio = window.__AUDIO;
  if (!sim || !rc?.bellRenderer || !rc?.hud || !audio) {
    requestAnimationFrame(boot);
    return;
  }
  if (window.__RC9_AUDIO) return;

  // Bell spawning is endless, but plain metallic gold loses most of its visual
  // contrast once AFTERLIGHT turns into deep night. Give the physical bell mesh
  // a restrained emissive floor instead of adding a HUD marker or neon pickup.
  const bellGold = rc.bellRenderer.body?.material;
  if (bellGold?.emissive) {
    bellGold.emissive.setHex(0x5a350b);
    bellGold.emissiveIntensity = 0.52;
  }
  const bellDark = rc.bellRenderer.clapper?.material;
  if (bellDark?.emissive) {
    bellDark.emissive.setHex(0x2a1603);
    bellDark.emissiveIntensity = 0.28;
  }

  let lastNow = performance.now();
  let lastMode = sim.beast.mode;
  let lastHearts = sim.hearts;
  let lastBells = sim.bellsCollected;

  // RC5's render wrapper calls system.update by property lookup every frame.
  // Replacing that property removes the old beep layer without adding a loop.
  rc.update = function updateRC9(now = performance.now()) {
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;

    if (rc.bellRenderer.terrain !== sim.terrain) rc.bellRenderer.reset(sim.terrain);
    rc.bellRenderer.update(sim.player.d, now / 1000);
    rc.hud.update(dt);

    // Run resets should not sound like three hearts being awarded at once.
    if (sim.time < 0.22 || sim.bellsCollected < lastBells) {
      lastHearts = sim.hearts;
      lastBells = sim.bellsCollected;
      lastMode = sim.beast.mode;
    }

    if (sim.hearts !== lastHearts) {
      if (sim.hearts < lastHearts) audio.heartLost?.();
      else {
        audio.heartRestore?.();
        rc.hud.setHearts(sim.hearts, true);
      }
      lastHearts = sim.hearts;
    }
    rc.hud.setHearts(sim.hearts, false);

    if (sim.bellsCollected > lastBells) {
      const count = sim.bellsCollected - lastBells;
      for (let i = 0; i < count; i++) {
        const step = (lastBells + i) % rc.hearts.BELL_TONE_CYCLE;
        audio.bell?.(step);
      }
      lastBells = sim.bellsCollected;
    }

    if (sim.beast.mode !== lastMode) {
      if (sim.beast.mode === 'hunt') {
        const side = sim.beast.attackKind === 'side' ? sim.beast.side : 0;
        audio.huntStart?.(side, sim.beast.attackKind);
        rc.hud.threatCue(sim.beast.side, sim.beast.attackKind);
      } else if (lastMode === 'hunt') {
        audio.huntEnd?.();
      }
      lastMode = sim.beast.mode;
    }
  };

  window.__RC9_AUDIO = {
    version: '1.0-rc',
    sharedContext: true,
    mainAudio: audio,
    rc5Takeover: true,
    approvedAssetBridge: true,
    playtestFeedback: true,
    bellNightReadability: true,
    v1Finalization: true,
    oneHeartPerPhysicalContact: true,
    keepGoingPursuit: true,
    variableHuntCadence: true,
    shipPolish: true,
    controllerSupport: true,
    portraitViewportFill: true,
    finalPriorityMix: true,
    authoredStartingHouseTerrace: true,
    hiddenLiveMixer: true,
    approvedLiveMixBaseline: true,
  };
}

requestAnimationFrame(boot);
