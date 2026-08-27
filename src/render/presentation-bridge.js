import * as THREE from 'three';

const flat = (color, roughness = 0.94) => new THREE.MeshStandardMaterial({
  color, roughness, metalness: 0.01, flatShading: true,
});
const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
});
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};

function restoreClassicBeast(actor, T) {
  // WORD RUN Phase 4: the antagonist is the corruption presentation, not a
  // creature model. The classic-beast rebuild would wipe it out — retired.
  return;
  // eslint-disable-next-line no-unreachable
  if (!actor?.body || actor.__classicRestored) return;
  actor.__classicRestored = true;
  actor.body.clear();
  actor.root.scale.setScalar(T.BEAST.MODEL_SCALE);

  const dark = flat(0x080a0c, 0.97);
  const maw = flat(0x351012, 0.9);
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
  actor.t = 0;
  actor.root.visible = false;

  actor.update = function updateClassic(dt, gap, x, groundY, playerD, killT, side = 1) {
    this.t += dt;
    const sim = window.__SIM;
    const beast = sim?.beast;
    const hunting = beast?.mode === 'hunt';

    // The beast is persistent. Never hard-pop it out because a GO shove or
    // huge landing opened the gap; the scene fog/distance can hide it naturally.
    const visible = sim?.phase === 'running' || killT > 0;
    this.root.visible = visible;
    if (!visible) return;

    const leapAttack = hunting && beast?.attackKind === 'leap';
    let leapLift = 0;
    let leapPitch = 0;

    if (leapAttack && !beast?.airPounce) {
      const k = clamp01((beast?.attackT || 0) / 2.8);
      leapLift = Math.sin(k * Math.PI) * 2.7;
      leapPitch = Math.sin(k * Math.PI) * 0.28;
    }

    if (beast?.airPounce) {
      if (beast.lunge === 'tell') {
        const k = clamp01(beast.lungeT / Math.max(0.01, T.BEAST.LUNGE_TELL));
        leapLift = -0.28 * k;
        leapPitch = -0.22 * k;
      } else if (beast.lunge === 'strike') {
        const k = clamp01(beast.lungeT / Math.max(0.01, T.BEAST.LUNGE_TIME));
        leapLift = 1.1 + Math.sin(k * Math.PI * 0.72) * 3.5;
        leapPitch = 0.48 + k * 0.48;
      }
    }

    this.root.position.set(x, groundY + leapLift, -(playerD - gap));
    const urgency = 1 + Math.max(0, 1 - gap / 42) * 1.85;
    const stride = this.t * 7.2 * urgency;
    for (const l of this.legs) {
      l.mesh.rotation.x = Math.sin(stride + l.phase * Math.PI) * 0.75;
      l.mesh.position.y = 0.95 + Math.abs(Math.cos(stride + l.phase * Math.PI)) * 0.16;
    }
    this.body.position.y = Math.abs(Math.sin(stride)) * 0.22;
    this.body.rotation.x = leapPitch;
    this.body.rotation.z = Math.sin(stride * 0.5) * 0.045;
    this.head.rotation.x = Math.sin(stride) * 0.09 - leapPitch * 0.35;

    if (killT > 0) {
      const k = ease(killT / 0.45);
      if (beast?.killAir && sim?.player) {
        const targetLift = Math.max(2.5, sim.player.y - groundY - 0.8);
        this.root.position.y = groundY + targetLift * k;
        this.body.rotation.x = 1.05 * k;
        this.body.position.y = 0.4 + k * 1.15;
        this.body.position.z = -k * 2.4;
        this.head.rotation.x = -0.82 * k;
        this.root.rotation.y = side * 0.34 * k;
      } else {
        this.body.rotation.x = 0.85 * k;
        this.body.position.y = k * 1.6;
        this.body.position.z = -k * 2.0;
        this.head.rotation.x = -0.65 * k;
        this.root.rotation.y = side * 0.6 * k;
      }
    } else {
      this.body.position.z *= 1 - Math.min(1, dt * 8);
      this.root.rotation.y *= 1 - Math.min(1, dt * 6);
    }
  };

  actor.reset = function resetClassic() {
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.visible = false;
    this.t = 0;
  };
}

function quietUI() {
  if (document.getElementById('rc4-quiet-ui')) return;
  const style = document.createElement('style');
  style.id = 'rc4-quiet-ui';
  style.textContent = `#styleWord,#courage,#titleScreen .eyebrow{display:none!important}`;
  document.head.appendChild(style);

  const power = document.getElementById('powerHint');
  if (power) {
    const clean = () => {
      if (/OVERDRIVE/i.test(power.textContent || '')) power.textContent = 'GO';
    };
    new MutationObserver(clean).observe(power, { childList: true, subtree: true, characterData: true });
    clean();
  }
}

function boot() {
  const render = window.__RENDER;
  const T = window.__TUNING;
  if (!render || !T) {
    requestAnimationFrame(boot);
    return;
  }
  restoreClassicBeast(render.beastActor, T);
  quietUI();
  window.__RC4_PRESENTATION = { classicBeast: true, quietUI: true, fogCulledBeast: true };
}

requestAnimationFrame(boot);
