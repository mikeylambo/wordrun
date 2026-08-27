import * as THREE from 'three';

// RC3 is a deliberately small browser-side direction pass. It keeps the
// deterministic core intact while changing the release feel: quieter UI,
// more air, and a SkiFree-like late beast ambush instead of a constant doom
// clock from metre zero.

const AMBUSH_START = 5000;
const AMBUSH_ENTER_TIME = 1.35;

function ease(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function standard(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, flatShading: true });
}

function basic(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
}

function restoreBeast(actor, T) {
  if (!actor?.body || actor.__rc3Restored) return;
  actor.__rc3Restored = true;

  actor.body.clear();
  actor.root.scale.setScalar(T.BEAST.MODEL_SCALE);

  const dark = standard(0x080a0c, 0.97);
  const maw = standard(0x351012, 0.9);
  const eyeMat = basic(0xff2a1f);
  const glowMat = basic(0xff2a1f, 0.24);

  const hull = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 0), dark);
  hull.scale.set(1.15, 1.0, 1.85);
  hull.position.y = 1.85;
  actor.body.add(hull);

  const shoulders = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), dark);
  shoulders.position.set(0, 2.35, -1.15);
  shoulders.scale.set(1.2, 0.95, 1.0);
  actor.body.add(shoulders);

  const head = new THREE.Group();
  head.position.set(0, 2.3, -2.35);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.86, 0), dark);
  skull.scale.set(0.95, 0.85, 1.3);
  head.add(skull);

  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.15, 5), maw);
  jaw.rotation.x = -Math.PI / 2;
  jaw.position.set(0, -0.24, -0.85);
  head.add(jaw);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), eyeMat);
    eye.position.set(s * 0.36, 0.22, -0.68);
    head.add(eye);

    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), glowMat);
    glow.position.copy(eye.position);
    head.add(glow);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95, 4), dark);
    horn.position.set(s * 0.46, 0.72, 0.1);
    horn.rotation.z = s * -0.35;
    horn.rotation.x = 0.3;
    head.add(horn);
  }
  actor.body.add(head);

  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.9, 0.46), dark);
      leg.position.set(sx * 0.85, 0.95, sz * 1.2);
      actor.body.add(leg);
      legs.push({ mesh: leg, phase: (sx + 1) + (sz + 1) * 0.5 });
    }
  }

  actor.head = head;
  actor.legs = legs;
  actor.__rc3Hull = hull;
  actor.__rc3Shoulders = shoulders;
  actor.root.visible = false;

  actor.update = function updateRC3(dt, gap, x, groundY, playerD, killT, side = 1) {
    const sim = window.__SIM;
    if (!sim) return;
    const beast = sim.beast;
    const ambushed = !!beast.__rc3Ambushed;
    const enterT = beast.__rc3AmbushT || 0;

    if (!ambushed && killT <= 0) {
      this.root.visible = false;
      return;
    }

    this.root.visible = true;
    this.t = (this.t || 0) + dt;

    let entranceLift = 0;
    if (enterT < AMBUSH_ENTER_TIME && killT <= 0) {
      const k = ease(enterT / AMBUSH_ENTER_TIME);
      const fromX = side * (T.TERRAIN.HALF_WIDTH + 11);
      const targetX = x;
      const bx = fromX + (targetX - fromX) * k;
      const bd = playerD - (18 + (1 - k) * 7);
      const by = sim.terrain.heightAt(bx, bd);
      this.root.position.set(bx, by, -bd);
      this.root.rotation.y = side * (0.92 * (1 - k));
      entranceLift = Math.sin(k * Math.PI) * 1.0;
    } else {
      this.root.position.set(x, groundY, -(playerD - gap));
      this.root.rotation.y *= 1 - Math.min(1, dt * 5);
    }

    const urgency = 1 + Math.max(0, 1 - gap / 44) * 1.75;
    const stride = this.t * 7.0 * urgency;
    for (const l of this.legs) {
      l.mesh.rotation.x = Math.sin(stride + l.phase * Math.PI) * 0.76;
      l.mesh.position.y = 0.95 + Math.abs(Math.cos(stride + l.phase * Math.PI)) * 0.16;
    }
    this.body.position.y = entranceLift + Math.abs(Math.sin(stride)) * 0.18;
    this.body.rotation.z = Math.sin(stride * 0.5) * 0.04;
    this.head.rotation.x = Math.sin(stride) * 0.08;

    if (killT > 0) {
      const k = ease(killT / 0.45);
      this.body.rotation.x = 0.85 * k;
      this.body.position.y = k * 1.55;
      this.body.position.z = -k * 2.0;
      this.head.rotation.x = -0.65 * k;
      this.root.rotation.y = side * 0.58 * k;
    } else {
      this.body.rotation.x *= 1 - Math.min(1, dt * 8);
      this.body.position.z *= 1 - Math.min(1, dt * 8);
    }
  };
}

function patchBeast(sim, T) {
  const beast = sim?.beast;
  if (!beast || beast.__rc3Patched) return;
  beast.__rc3Patched = true;

  // The mountain gets to be the game for a long stretch. After 5km, the beast
  // finally arrives from the side. Once it is here, speed/Overdrive still
  // matter, but the global ramp no longer guarantees a death at one fixed
  // distance.
  T.BEAST.MAX_GAP = 120;
  T.BEAST.START_GAP = 120;
  T.BEAST.GAP_AT_LO = 34;
  T.BEAST.GAP_AT_HI = 96;
  T.BEAST.RAMP_PER_1000M = 3.5;
  T.BEAST.DESIRED_FLOOR = 8;
  T.BEAST.CLOSE_RATE = 10;
  T.BEAST.OPEN_RATE = 10;
  T.BEAST.LUNGE_CHANCE_PER_S = 0.20;
  T.BEAST.LUNGE_COOLDOWN = 7.0;

  const originalReset = beast.reset.bind(beast);
  const originalStep = beast.step.bind(beast);

  beast.reset = function resetRC3() {
    originalReset();
    this.__rc3Ambushed = false;
    this.__rc3AmbushT = 0;
    this.gap = T.BEAST.MAX_GAP;
    this.desired = T.BEAST.MAX_GAP;
  };

  beast.step = function stepRC3(dt, player) {
    this._playerD = player.d;

    if (!this.__rc3Ambushed && player.d < AMBUSH_START) {
      this.t += dt;
      this.gap = T.BEAST.MAX_GAP;
      this.desired = T.BEAST.MAX_GAP;
      this.mistakePressure = 0;
      this.killed = false;
      this.lunge = 'idle';
      this.lungeT = 0;
      this.x = this.side * (T.TERRAIN.HALF_WIDTH + 12);
      return;
    }

    if (!this.__rc3Ambushed) {
      this.__rc3Ambushed = true;
      this.__rc3AmbushT = 0;
      this.gap = 29;
      this.desired = 48;
      this.mistakePressure = 0;
      this.lunge = 'idle';
      this.lungeT = 0;
      this.lungeCooldown = 4.5;
      this.x = player.x + this.side * 15;
    }

    this.__rc3AmbushT += dt;
    originalStep(dt, player);
  };

  // Main constructed the beast before this patch; put it in RC3's pre-ambush
  // state immediately rather than waiting for the next reset.
  beast.__rc3Ambushed = false;
  beast.__rc3AmbushT = 0;
  beast.gap = T.BEAST.MAX_GAP;
  beast.desired = T.BEAST.MAX_GAP;
}

function tuneAir(T) {
  // More reasons to leave the ground, without turning the slope into a
  // permanent trampoline.
  T.FEATURES.CLIFF_CHANCE = 0.38;
  T.FEATURES.MOGUL_CHANCE = 0.72;
  T.FEATURES.MOGUL_AMP = 0.48;
  T.FEATURES.CLIFF_LIP_H = 1.25;
  T.FEATURES.CLIFF_DROP[0] = 6.0;
  T.FEATURES.CLIFF_DROP[1] = 10.0;
  T.FEATURES.PITCHES.open.cliff = 0.9;
  T.FEATURES.PITCHES.trees.cliff = 0.28;
  T.FEATURES.PITCHES.cliffs.cliff = 3.15;
  T.FEATURES.PITCHES.moguls.cliff = 0.75;
  T.FEATURES.PITCHES.moguls.mogul = 2.65;
  T.PLAYER.JUMP_IMPULSE = 8.25;
}

function quietUI() {
  const style = document.createElement('style');
  style.textContent = `
    #styleWord, #courage { display:none !important; }
    #titleScreen .eyebrow { display:none !important; }
  `;
  document.head.appendChild(style);

  const eyebrow = document.querySelector('#titleScreen .eyebrow');
  if (eyebrow) eyebrow.textContent = '';

  // Keep onboarding functional, but remove slogan-like language from it.
  const coach = document.getElementById('coach');
  if (coach) {
    const observer = new MutationObserver(() => {
      if (/STYLE\s+(IS|MAKES)/i.test(coach.textContent || '')) coach.textContent = 'AIR FILLS POWER';
    });
    observer.observe(coach, { childList: true, subtree: true, characterData: true });
  }
}

function boot() {
  const sim = window.__SIM;
  const render = window.__RENDER;
  const T = window.__TUNING;
  if (!sim || !render || !T) {
    requestAnimationFrame(boot);
    return;
  }

  tuneAir(T);
  patchBeast(sim, T);
  restoreBeast(render.beastActor, T);
  quietUI();

  window.__RC3 = {
    ambushStart: AMBUSH_START,
    airTuned: true,
    beastRestored: true,
  };
}

requestAnimationFrame(boot);
