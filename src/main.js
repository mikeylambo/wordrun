/**
 * DESCENT — entry point. Deterministic game, expressive presentation.
 */

import TUNING from './TUNING.js';
import { Sim, PHASE, emptyInput } from './sim/sim.js';
import { dailySeed, dailySeedString } from './sim/rng.js';
import { Stage } from './render/scene.js';
import { TerrainMesh } from './render/terrain-mesh.js';
import { Props } from './render/props.js';
import { PlayerActor, BeastActor, GhostActor } from './render/actors.js';
import { CameraRig } from './render/camera-rig.js';
import { Spray } from './render/fx.js';
import { Landmarks } from './render/landmarks.js';
import { applyMaterialPass } from './render/material-pass.js';
import { Audio } from './audio/audio.js';
import { Input } from './input/input.js';
import { Storage } from './storage/storage.js';
import { UI } from './ui/ui.js';
import { PauseUI } from './ui/pause.js';
import { OnboardingUI } from './ui/onboarding.js';

const canvas = document.getElementById('gl');
const stage = new Stage(canvas);
const ui = new UI();
const audio = new Audio();
const input = new Input(canvas);

const SEED = dailySeed();
const SEED_STRING = dailySeedString();
const sim = new Sim(SEED);
const terrainMesh = new TerrainMesh(stage.scene, sim.terrain);
const props = new Props(stage.scene, sim.terrain);
const landmarks = new Landmarks(stage.scene, sim.terrain);
const playerActor = new PlayerActor(stage.scene);
const beastActor = new BeastActor(stage.scene);
const ghostActor = new GhostActor(stage.scene);
const rig = new CameraRig(stage.camera);
const spray = new Spray(stage.scene);
const materialPass = applyMaterialPass(stage.scene, terrainMesh, { playerActor, beastActor });

const simInput = emptyInput();
let running = false;
let paused = false;
let topSpeed = 0;
let sprayAcc = 0;
let deathShownAt = 0;
let shotUrl = null;
let shotTaken = false;
let prevLunge = 'idle';
let ghostEnabled = Storage.ghostEnabled();

ui.setSeed(SEED_STRING, Storage.bestFor(SEED), Storage.runsToday(SEED));
ui.showTitle(true);
input.onFirstGesture = () => audio.start();

function startRun() {
  audio.start();
  const ghostData = ghostEnabled ? Storage.loadGhost(SEED) : null;
  const runs = Storage.runsToday(SEED);
  const grace = Math.max(0, 1 - runs / TUNING.BEAST.GRACE_RUNS);

  sim.start(SEED, ghostData, grace);
  terrainMesh.terrain = sim.terrain;
  props.terrain = sim.terrain;
  landmarks.terrain = sim.terrain;

  terrainMesh.reset();
  terrainMesh.update(0);
  terrainMesh.flush();
  props.reset();
  props.update(0, true);
  landmarks.reset();
  landmarks.update(0);

  rig.reset();
  beastActor.reset();
  spray.clear();
  ui.clearDread();
  ui.clearRun();
  shotUrl = null;
  shotTaken = false;
  topSpeed = 0;
  sprayAcc = 0;
  paused = false;
  running = true;
  input.enabled = true;
  input.releaseAll();

  onboarding.hide();
  pauseUI.setPaused(false);
  pauseUI.setButton(true);
  ui.showTitle(false);
  ui.showDeath(false);
  ui.showHud(true);
  Storage.bumpRuns(SEED);
}

function endRun() {
  running = false;
  paused = false;
  input.enabled = false;
  pauseUI.setPaused(false);
  pauseUI.setButton(false);

  const distance = sim.distance;
  const isPb = Storage.setBestFor(SEED, distance);
  sim.recorder.finish(sim.player);
  Storage.saveGhostIfBest(SEED, sim.recorder.serialize({ seed: SEED, distance }));

  ui.renderDeath({
    distance,
    best: Storage.bestFor(SEED),
    isPb,
    shotUrl,
  });
  ui.showHud(false);
  ui.showDeath(true);
  deathShownAt = performance.now();
}

function pauseGame() {
  if (!running || sim.phase !== PHASE.RUNNING || paused) return;
  paused = true;
  input.enabled = false;
  input.releaseAll();
  audio.suspend();
  pauseUI.setPaused(true);
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  input.enabled = true;
  input.releaseAll();
  audio.resume();
  pauseUI.setPaused(false);
}

function quitToTitle() {
  paused = false;
  running = false;
  input.enabled = false;
  input.releaseAll();
  sim.phase = PHASE.TITLE;
  pauseUI.setPaused(false);
  pauseUI.setButton(false);
  onboarding.hide();
  ui.showDeath(false);
  ui.showHud(false);
  ui.clearDread();
  ui.clearRun();
  ui.showTitle(true);
  audio.suspend();
}

function setGhostEnabled(on) {
  ghostEnabled = !!on;
  Storage.setGhostEnabled(ghostEnabled);
  pauseUI?.setGhost(ghostEnabled);
  onboarding?.setGhost(ghostEnabled);
  if (!ghostEnabled) sim.ghost.load(null);
}

const pauseUI = new PauseUI({
  onPause: pauseGame,
  onResume: resumeGame,
  onRestart: startRun,
  onQuit: quitToTitle,
  ghostEnabled,
  onGhostChange: setGhostEnabled,
});

const onboarding = new OnboardingUI({
  ghostEnabled,
  onGhostChange: setGhostEnabled,
  onStart: () => {
    Storage.setOnboardingSeen(true);
    audio.uiTap();
    startRun();
  },
});

function onAdvance() {
  if (running || paused || onboarding.visible) return;
  if (sim.phase === PHASE.KILL) return;
  if (sim.phase === PHASE.DEAD && performance.now() - deathShownAt < 350) return;
  audio.uiTap();
  if (sim.phase === PHASE.TITLE && !Storage.onboardingSeen()) {
    onboarding.show();
    return;
  }
  startRun();
}

window.addEventListener('pointerup', (e) => {
  if (e.target.closest?.('[data-rc2-ui],[data-rc7-ui],button')) return;
  onAdvance();
});
window.addEventListener('keydown', (e) => {
  if (onboarding.visible) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (sim.phase === PHASE.RUNNING) {
      e.preventDefault();
      paused ? resumeGame() : pauseGame();
    }
    return;
  }
  if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'KeyR') return;
  onAdvance();
});

ui.mute.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.start();
  const m = !audio.muted;
  audio.setMuted(m);
  ui.mute.textContent = m ? '×' : '♪';
});

const deathAgain = document.getElementById('deathAgain');
const deathMenu = document.getElementById('deathMenu');
deathAgain?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.uiTap();
  startRun();
});
deathMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.uiTap();
  quitToTitle();
});

ui.saveShot.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!shotUrl) return;
  const name = `wordrun-${Math.floor(sim.distance)}m-${SEED_STRING}.png`;
  try {
    const blob = await (await fetch(shotUrl)).blob();
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `WORD RUN — ${Math.floor(sim.distance)}m` });
      return;
    }
  } catch { /* fall through */ }
  const a = document.createElement('a');
  a.href = shotUrl;
  a.download = name;
  a.click();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (running && sim.phase === PHASE.RUNNING) pauseGame();
    else audio.suspend();
    input.releaseAll();
  }
});

function drainSimEvents() {
  const events = sim.drainEvents();
  if (!events) return;
  for (const e of events) {
    switch (e.t) {
      case 'takeoff': audio.takeoff(); break;
      case 'land_clean':
        audio.landClean();
        spray.emit(e.x, e.y, -e.d, 16, 4.2, 3.0, 0);
        if (e.chain > 0) audio.chainLink(e.chain);
        if (e.proxMult > 1.05) audio.courageBank(e.proxMult);
        break;
      case 'land_flub':
        audio.landFlub();
        spray.emit(e.x, e.y, -e.d, 20, 6.5, 2.0, 0);
        ui.hitFlash();
        break;
      case 'land_bump': audio.landBump(); break;
      case 'hit':
        audio.hit();
        spray.emit(e.x, e.y, -e.d, 18, 7, 3.2, 0);
        ui.hitFlash();
        break;
      case 'gate':
        audio.gate();
        if (e.chain > 0) audio.chainLink(e.chain);
        break;
      case 'chain_lost': audio.chainLost(); break;
      case 'overdrive_on':
        audio.overdriveOn();
        audio.shove();
        break;
      case 'overdrive_off': audio.overdriveOff(); break;
      case 'stunt_escape':
        audio.shove();
        audio.courageBank(2);
        spray.emit(e.x, e.y, -e.d, 28, 8, 4.2, 0);
        break;
      case 'kill': audio.kill(); break;
    }
  }
}

let last = performance.now();

function tick(dt) {
  const p = sim.player;

  if (!paused && (running || sim.phase === PHASE.KILL)) {
    input.update(dt, !p.airborne);
    simInput.carve = input.carve;
    simInput.flip = input.flip;
    simInput.jump = input.jump;
    simInput.boostHeld = input.boostHeld;
    simInput.dragging = input.dragging;

    sim.advance(dt, simInput);
    input.consumeJump();
    drainSimEvents();
    if (p.speed > topSpeed) topSpeed = p.speed;

    if (running && sim.phase !== PHASE.RUNNING) {
      if (sim.phase === PHASE.DEAD) endRun();
    } else if (!running && sim.phase === PHASE.DEAD) {
      endRun();
    }
    if (running && sim.phase === PHASE.KILL) {
      running = false;
      input.enabled = false;
      pauseUI.setButton(false);
    }
  }

  if (!paused && sim.beast.lunge !== prevLunge) {
    if (sim.beast.lunge === 'tell') audio.lungeTell();
    else if (sim.beast.lunge === 'strike') audio.lungeStrike();
    prevLunge = sim.beast.lunge;
  }

  terrainMesh.update(p.d);
  terrainMesh.pump();
  props.update(p.d);
  landmarks.update(p.d);

  const slope = sim.terrain.normalAt(p.x, p.d);
  playerActor.update(p, slope, dt, sim.beast.gap);
  ghostActor.update(sim.ghost, dt);

  const beastGroundY = sim.terrain.heightAt(sim.beast.x, p.d - sim.beast.gap);
  const killT = sim.phase === PHASE.KILL || sim.phase === PHASE.DEAD ? sim.killTimer : 0;
  beastActor.update(dt, sim.beast.gap, sim.beast.x, beastGroundY, p.d, killT,
    sim.beast.side, sim.beast.lunge, sim.beast.lungeT);

  if (!paused && running && !p.airborne) {
    const edge = Math.min(1, Math.abs(p.heading) / TUNING.PLAYER.MAX_CARVE);
    const rate = (2 + edge * 46) * (0.35 + Math.min(1, p.speed / 34) * 0.65);
    sprayAcc += rate * dt;
    while (sprayAcc >= 1) {
      sprayAcc -= 1;
      spray.emit(p.x, p.y, -p.d, 1, 1.6 + edge * 4,
        0.9 + edge * 2.0, -Math.sign(p.heading) * edge * 3.4);
    }
  }
  spray.update(paused ? 0 : dt);

  const bands = sim.beast.bands();
  const dreadLive = !paused && (running || sim.phase === PHASE.KILL);
  rig.update(dt, p, sim.beast.gap, dreadLive ? bands.shake : 0, killT, sim.terrain,
    sim.beast.x, sim.beast.side);
  stage.followLight(p.x, p.y, -p.d);
  audio.update(dt, p, bands, dreadLive);
  ui.update(dt, sim, dreadLive);
  stage.render();

  if (!shotTaken && sim.phase === PHASE.KILL &&
      sim.killTimer >= TUNING.BEAST.KILL_WHIP_TIME + 0.24) {
    shotTaken = true;
    try { shotUrl = composeShot(canvas); }
    catch { shotUrl = null; }
  }
}

function composeShot(srcCanvas) {
  const w = 720;
  const h = Math.round((srcCanvas.height / srcCanvas.width) * w);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d');
  g.drawImage(srcCanvas, 0, 0, w, h);
  const grad = g.createLinearGradient(0, h * 0.62, 0, h);
  grad.addColorStop(0, 'rgba(10,14,19,0)');
  grad.addColorStop(1, 'rgba(10,14,19,0.24)');
  g.fillStyle = grad;
  g.fillRect(0, h * 0.62, w, h * 0.38);
  return out.toDataURL('image/png');
}

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  last = now;
  tick(Math.min(rawDt, 0.1));
}
requestAnimationFrame(frame);

window.__STATE = () => sim.state();
window.__DEBUG = () => sim.debug();
window.__SIM = sim;
window.__TUNING = TUNING;
window.__RENDER = {
  stage, terrainMesh, props, landmarks, rig, playerActor, beastActor, ghostActor, spray, materialPass,
};
window.__INPUT = input;
window.__START = () => { startRun(); return sim.state(); };
window.__QUIT = () => { quitToTitle(); return { phase: sim.phase }; };
window.__GHOST = (on = ghostEnabled) => { setGhostEnabled(on); return { enabled: ghostEnabled }; };
window.__PAUSE = (on = true) => { on ? pauseGame() : resumeGame(); return { paused }; };
window.__SEED = { seed: SEED, string: SEED_STRING };
window.__TICK = (n = 1, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) tick(dt);
  return { phase: sim.phase, running, paused, distance: +sim.distance.toFixed(2) };
};
window.__STEP = (n = 1, cmd = {}) => {
  for (let i = 0; i < n; i++) {
    simInput.carve = cmd.carve ?? 0;
    simInput.flip = cmd.flip ?? 0;
    simInput.jump = !!cmd.jump;
    simInput.boostHeld = !!cmd.boostHeld;
    sim.step(simInput);
  }
  return sim.state();
};