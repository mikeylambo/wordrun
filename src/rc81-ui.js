// RC8.1 — UI clarity fixes that need access to live render/storage state.
// No extra animation loop: all screen anchoring rides the existing player update.
import * as THREE from 'three';
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

function addUiStyle() {
  if (document.getElementById('rc81-ui-style')) return;
  const style = document.createElement('style');
  style.id = 'rc81-ui-style';
  style.textContent = `
    #rc5Threat{margin-left:-17px!important;margin-top:-34px!important}
    #rc5Threat.left,#rc5Threat.right,#rc5Threat.leap{margin-left:-17px!important}
  `;
  document.head.appendChild(style);
}

function patchThreatAnchor(stage, playerActor) {
  if (!stage?.camera || !playerActor || playerActor.__rc81ThreatAnchor) return;
  playerActor.__rc81ThreatAnchor = true;
  const point = new THREE.Vector3();
  const baseUpdate = playerActor.update.bind(playerActor);

  playerActor.update = function updateRC81Threat(p, slope, dt, beastGap) {
    baseUpdate(p, slope, dt, beastGap);
    const threat = document.getElementById('rc5Threat');
    if (!threat) return;

    point.set(p.x, p.y + 2.65, -p.d).project(stage.camera);
    const rect = stage.renderer.domElement.getBoundingClientRect();
    const x = rect.left + (point.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-point.y * 0.5 + 0.5) * rect.height;
    threat.style.left = `${x.toFixed(1)}px`;
    threat.style.top = `${y.toFixed(1)}px`;
    threat.style.visibility = point.z > -1 && point.z < 1 ? 'visible' : 'hidden';
  };
}

patchGhostPreference();

function boot() {
  const render = window.__RENDER;
  // Wait until RC7.1 has installed its player wrapper and CSS so our anchor/style
  // are definitively the final player-facing threat treatment.
  if (!render?.stage || !render?.playerActor || !window.__RC71_FEEL) {
    requestAnimationFrame(boot);
    return;
  }
  addUiStyle();
  patchThreatAnchor(render.stage, render.playerActor);
  window.__RC81_UI = {
    version: '8.1',
    threatAnchored: true,
    ghostLiveToggle: true,
  };
}
requestAnimationFrame(boot);
