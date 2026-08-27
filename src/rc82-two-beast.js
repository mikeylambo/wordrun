// RC8.2 — a rare second creature shares the run without becoming another chase servo.
// Presentation attaches to the existing render call; there is no second permanent frame loop.
import { SecondBeastActor } from './render/second-beast.js';

function boot() {
  const sim = window.__SIM;
  const render = window.__RENDER;
  if (!sim?.secondBeast || !render?.stage || !render?.rig || !window.__RC5) {
    requestAnimationFrame(boot);
    return;
  }
  if (window.__RC82) return;

  const actor = new SecondBeastActor(render.stage.scene);
  render.secondBeastActor = actor;

  // If beast two lands the hit, the existing cinematic rig frames that world
  // position instead of blindly orbiting the main pursuer.
  const rigUpdate = render.rig.update.bind(render.rig);
  render.rig.update = function updateTwoBeastCamera(
    dt, player, gap, shakeAmp, killT, terrain, beastX, beastSide
  ) {
    if (killT > 0 && sim.killSource === 'second') {
      const second = sim.secondBeast;
      const secondGap = Math.max(2.5, Math.abs(player.d - second.d));
      return rigUpdate(dt, player, secondGap, shakeAmp, killT, terrain, second.x, second.side);
    }
    return rigUpdate(dt, player, gap, shakeAmp, killT, terrain, beastX, beastSide);
  };

  // The main beast should not perform its poster-frame kill pose when it was
  // the pale ambusher that actually made contact.
  const mainBeastUpdate = render.beastActor.update.bind(render.beastActor);
  render.beastActor.update = function updateMainBeastWithSource(
    dt, gap, x, groundY, playerD, killT, ...rest
  ) {
    const mainKillT = sim.killSource === 'second' ? 0 : killT;
    return mainBeastUpdate(dt, gap, x, groundY, playerD, mainKillT, ...rest);
  };

  let lastActive = false;
  let lastPhase = 'idle';
  let lastNow = performance.now();
  const stageRender = render.stage.render.bind(render.stage);
  render.stage.render = function renderWithSecondBeast() {
    const now = performance.now();
    const renderDt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) || 1 / 60;
    lastNow = now;

    const second = sim.secondBeast;
    const killT = sim.killSource === 'second' ? sim.killTimer : 0;
    actor.update(second, sim.terrain, renderDt, killT, sim.player);

    if (second.active && !lastActive) {
      const ground = sim.terrain.heightAt(second.x, second.d);
      render.spray?.emit(second.x, ground + 0.25, -second.d, 34, 9.0, 4.8, -second.side * 2.4);
      window.__RC5?.hud?.threatCue(second.side, second.kind === 'vault' ? 'leap' : 'side');
    }
    if (second.active && second.phase === 'charge' && lastPhase !== 'charge') {
      const ground = sim.terrain.heightAt(second.x, second.d);
      render.spray?.emit(second.x, ground + 0.25, -second.d, 26, 7.5, 4.0, second.side * 1.8);
    }

    lastActive = second.active;
    lastPhase = second.phase;
    stageRender();
  };

  window.__RC82 = {
    version: '8.2',
    secondBeast: true,
    sameRun: true,
    actor,
  };
}

requestAnimationFrame(boot);
