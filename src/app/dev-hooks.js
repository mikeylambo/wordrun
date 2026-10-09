/**
 * The audit and test surface — every `window.__*` hook in one place.
 *
 * The smoke suite, the network and capture audits, the phone matrix and the
 * playtest report all drive the game through these. They were the last eighty
 * lines of main.js; they live here so the composition root is the game, and
 * this file is the one place to look for what a script may reach.
 *
 * main.js passes `app`: the systems it built, the actions it owns, and live
 * getters for the few `let`s these hooks report (running, paused, the music
 * state …). Nothing here keeps state of its own, and nothing patches a system
 * — every hook calls the same function the game itself calls.
 */

import TUNING from '../TUNING.js';
import { PHASE } from '../sim/sim.js';
import { ACCESS } from '../ui/access.js';
import { mountDevTools } from '../dev/dev-tools.js';

export function installDevHooks(app) {
  const { sim, ui, music, rig, stage, input, simInput, launch, attract, moments, momentClip, render } = app;

  window.__STATE = () => sim.state();
  window.__DEBUG = () => sim.debug();
  window.__SIM = sim;
  window.__MUSIC = () => ({
    el: music.el, clock: music.clock, state: app.musicState, fov: rig.camera.fov,
  });
  window.__TUNING = TUNING;
  window.__UI = ui;
  window.__RENDER = render;
  window.__STAGE = stage;

  // The playtest report (?playtest=1): everything a note needs to be replayed.
  function playtestReport() {
    if (sim.phase !== PHASE.DEAD && !sim.escaped) return null;
    const wg = sim.wordGates;
    const lastMisses = (wg.misses || []).slice(-3).map((m) => ({
      gate: m.index, shown: m.shown, answer: m.answer, how: m.reason, at: Math.round(m.d),
    }));
    return {
      v: 1,
      at: new Date().toISOString(),
      replay: app.challengeLinkForLastRun(),
      seed: app.seedString,
      mode: app.runMode,
      difficulty: app.effectiveDifficulty(),
      salt: app.currentSalt,
      distance: Math.round(sim.distance),
      score: app.lastRunScore,
      ended: sim.escaped ? 'finish' : (sim.deathCause || 'unknown'),
      heartsLeft: sim.hearts,
      reads: wg.readCount,
      lastMisses,
      trail: app.gateTrail.map((v) => (v === 1 ? '1' : v === 0 ? '0' : '.')).join(''),
      device: {
        ua: navigator.userAgent,
        viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio || 1}`,
        dpr: +stage.dpr.toFixed(2),
        access: { reducedFlash: ACCESS.reducedFlash, plateSpacing: ACCESS.plateSpacing, plateSize: ACCESS.plateSize, palette: ACCESS.palette },
      },
    };
  }
  // Dev-only tooling behind URL flags (?dev=1, ?soak=…, ?profile=1), each a
  // dynamic import a normal load never fetches — src/dev/dev-tools.js.
  const devTools = mountDevTools({ terrain: () => sim.terrain, report: playtestReport });
  window.__DEV_PANEL = devTools.toggleDevPanel;
  window.__PLAYTEST_REPORT = () => playtestReport();

  // RC9.8: the capture and the clip, for the audits and the phone matrix run.
  window.__CAPTURE = moments;
  window.__MOMENT = momentClip;
  window.__INPUT = input;
  window.__START = () => { app.startRun(); launch.snapToBlack(); return sim.state(); };
  window.__QUIT = () => { app.quitToTitle(); return { phase: sim.phase }; };
  // RC6: the attract loop is a real state the audits have to be able to read.
  window.__ATTRACT_ACTIVE = () => attract.active;
  window.__FINISH_RUN = () => { app.onFinishRun(); return { phase: sim.phase }; };
  window.__GHOST = (on = app.ghostEnabled) => { app.setGhostEnabled(on); return { enabled: app.ghostEnabled }; };
  window.__PAUSE = (on = true) => { on ? app.pauseGame() : app.resumeGame(); return { paused: app.paused }; };
  window.__SEED = { seed: app.seed, string: app.seedString };
  window.__CHALLENGE = app.challenge;
  window.__TICK = (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) app.tick(dt);
    return { phase: sim.phase, running: app.running, paused: app.paused, distance: +sim.distance.toFixed(2) };
  };
  window.__STEP = (n = 1, cmd = {}) => {
    for (let i = 0; i < n; i++) {
      simInput.carve = cmd.carve ?? 0;
      simInput.flip = cmd.flip ?? 0;
      simInput.jump = !!cmd.jump;
      simInput.confirm = !!cmd.confirm;
      simInput.boostHeld = !!cmd.boostHeld;
      sim.step(simInput);
    }
    return sim.state();
  };
  return { devTools, playtestReport };
}

export default installDevHooks;
