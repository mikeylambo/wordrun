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

// RC9 — the audio-side release chain. Its job now is to (1) make the whole
// build share ONE AudioContext and (2) pull in the v1 finalization layers in
// the right order (they wrap the final implementations, not earlier shims).
//
// Phase 0: the old per-frame poll that mirrored sim state into sounds is gone.
// Hearts and bells were dissolved out of the deleted rc5.js into the sim, and
// their sounds now fire from sim events in main.js's drainSimEvents; the bell
// mesh's night-readability emissive moved into render/bells.js. Nothing here
// reaches into a runtime-patched game object any more.

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

window.__RC9_AUDIO = {
  version: '1.0-rc',
  sharedContext: true,
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
