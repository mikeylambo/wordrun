// RC8.1 — UI clarity fixes that need access to live render/storage state.
// (Phase 0: the threat-indicator anchoring and its CSS were removed with the
// rest of the dead hunt/threat cue — beast.mode has been hardcoded 'run' since
// the pursuit director was deleted, so the indicator never appeared. What
// remains is the live BEST RUN toggle, which genuinely needs sim state.)
import Storage from './storage/storage.js';

function patchGhostPreference() {
  if (Storage.__rc81GhostPatched) return;
  Storage.__rc81GhostPatched = true;
  const baseSet = Storage.setGhostEnabled.bind(Storage);

  Storage.setGhostEnabled = function setGhostEnabledRC81(enabled) {
    const on = !!enabled;
    const ok = baseSet(on);
    const sim = window.__SIM;
    if (!sim) return ok;

    if (!on) {
      sim.ghost.load(null);
      return ok;
    }

    // Turning BEST RUN back on during a paused/active run should visibly work
    // immediately, not wait for the next restart. Seek the replay to run time.
    const seed = window.__SEED?.seed ?? sim.seed;
    const data = Storage.loadGhost(seed);
    sim.ghost.load(data);
    if (data) {
      sim.ghost.t = Math.max(0, Math.min(sim.time, Math.max(0, sim.ghost.duration - 0.001)));
      sim.ghost.step(0);
    }
    return ok;
  };
}

patchGhostPreference();

window.__RC81_UI = {
  version: '8.1',
  ghostLiveToggle: true,
};
