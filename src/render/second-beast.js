import * as THREE from 'three';

const std = (color, roughness = 0.82, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness, metalness: 0.01, flatShading: true, dithering: true, ...extra,
});
const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
});
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Sparse second pursuer: pale/frosted and broad so it never reads as a clone of
 * the classic black beast. Each simulation pattern gets its own body language,
 * but all motion stays tied to the one deterministic world-space state.
 */
export class SecondBeastActor {
  constructor(scene) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.root.visible = false;
    scene.add(this.root);

    const snowHide = std(0xd9e5e8, 0.84);
    const shadowHide = std(0x718694, 0.9);
    const dark = std(0x14212a, 0.94);
    const crystal = std(0x38c8e8, 0.28, { metalness: 0.08, emissive: 0x0b5366, emissiveIntensity: 0.18 });
    const eye = basic(0x77efff);

    // A boulder with shoulders: much wider and paler than the main beast.
    this.torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.38, 0), snowHide);
    this.torso.scale.set(1.52, 1.18, 1.05);
    this.torso.position.set(0, 1.95, 0.15);
    this.body.add(this.torso);

    const chest = new THREE.Mesh(new THREE.IcosahedronGeometry(0.92, 0), shadowHide);
    chest.scale.set(1.05, 1.16, 0.82);
    chest.position.set(0, 1.35, -0.22);
    this.body.add(chest);

    this.head = new THREE.Group();
    this.head.position.set(0, 2.72, -0.72);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 0), snowHide);
    skull.scale.set(1.05, 0.9, 1.1);
    this.head.add(skull);
    const face = new THREE.Mesh(new THREE.IcosahedronGeometry(0.31, 0), dark);
    face.scale.set(1.05, 0.78, 0.8);
    face.position.set(0, -0.05, -0.48);
    this.head.add(face);

    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), eye);
      e.position.set(s * 0.16, 0.02, -0.72);
      this.head.add(e);

      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, s < 0 ? 1.25 : 1.55, 5), crystal);
      horn.position.set(s * 0.42, 0.64, -0.08);
      horn.rotation.z = s * -0.48;
      horn.rotation.x = 0.12;
      this.head.add(horn);
      const tine = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.72, 5), crystal);
      tine.position.set(s * 0.68, 0.76, -0.02);
      tine.rotation.z = s * -1.02;
      this.head.add(tine);
    }
    this.body.add(this.head);

    this.crystals = [];
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.16 + i * 0.012, 0.7 + i * 0.08, 5), crystal);
      c.position.set((i % 2 ? 1 : -1) * (0.18 + (i % 3) * 0.16), 2.4 - i * 0.26, 0.92 + i * 0.13);
      c.rotation.x = 1.02;
      c.rotation.z = (i % 2 ? 1 : -1) * 0.16;
      this.body.add(c);
      this.crystals.push(c);
    }

    this.arms = [];
    this.legs = [];
    for (const s of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 1.8, 6), snowHide);
      upper.position.set(s * 1.18, 1.28, -0.15);
      upper.rotation.z = s * 0.18;
      this.body.add(upper);
      this.arms.push({ mesh: upper, side: s });

      const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 0), shadowHide);
      fist.scale.set(1.12, 0.78, 1.15);
      fist.position.set(s * 1.32, 0.36, -0.42);
      this.body.add(fist);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.25, 6), shadowHide);
      leg.position.set(s * 0.54, 0.56, 0.42);
      this.body.add(leg);
      this.legs.push({ mesh: leg, side: s });
    }

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.55, 12),
      new THREE.MeshBasicMaterial({ color: 0x18303b, transparent: true, opacity: 0.16, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(1.45, 0.9, 1);
    this.root.add(this.shadow);

    this.t = 0;
  }

  reset() {
    this.t = 0;
    this.root.visible = false;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
  }

  update(state, terrain, dt, killT = 0, player = null) {
    this.t += dt;
    if (!state || (!state.active && !state.killed && killT <= 0)) {
      this.root.visible = false;
      return;
    }

    this.root.visible = true;
    const groundY = terrain.heightAt(state.x, state.d);
    this.root.position.set(state.x, groundY + state.lift, -state.d);
    this.root.rotation.y = -state.heading;
    this.shadow.position.y = -state.lift + 0.035;
    this.shadow.material.opacity = 0.08 + 0.10 * (1 - clamp01(Math.abs(state.lift) / 6));

    const charge = state.phase === 'charge';
    const cadence = charge ? (state.kind === 'cross' ? 10.2 : 9.2) : 5.4;
    const stride = this.t * cadence;
    const crouch = state.phase === 'tell'
      ? 0.82 + clamp01(state.phaseT / Math.max(0.01, state.tellTime)) * 0.18
      : 1;
    this.body.scale.y += (crouch - this.body.scale.y) * (1 - Math.exp(-11 * dt));
    this.body.position.y = Math.abs(Math.sin(stride)) * (charge ? 0.18 : 0.08);

    for (const arm of this.arms) {
      arm.mesh.rotation.x = Math.sin(stride + (arm.side > 0 ? Math.PI : 0)) * (charge ? 0.82 : 0.34);
      arm.mesh.rotation.z = arm.side * 0.18;
    }
    for (const leg of this.legs) {
      leg.mesh.rotation.x = Math.sin(stride + (leg.side < 0 ? Math.PI : 0)) * (charge ? 0.62 : 0.28);
    }
    this.crystals.forEach((c, i) => {
      c.rotation.z += Math.sin(this.t * 3.1 + i) * 0.0015;
    });

    if (state.kind === 'vault' && charge) {
      const e = clamp01(state.phaseT / Math.max(0.01, state.chargeTime));
      this.body.rotation.x = Math.sin(e * Math.PI) * 0.42;
      this.body.rotation.z = 0;
      this.head.rotation.x = -Math.sin(e * Math.PI) * 0.22;
    } else if (state.kind === 'downhill' && charge) {
      const e = clamp01(state.phaseT / Math.max(0.01, state.chargeTime));
      this.body.rotation.x = 0.18 + Math.sin(e * Math.PI) * 0.18;
      this.body.rotation.z = state.side * -0.10;
      this.head.rotation.x = -0.10;
    } else if (state.kind === 'uphill' && charge) {
      const e = clamp01(state.phaseT / Math.max(0.01, state.chargeTime));
      this.body.rotation.x = -0.18 - Math.sin(e * Math.PI) * 0.08;
      this.body.rotation.z = state.side * 0.08;
      this.head.rotation.x = 0.16;
    } else if (state.kind === 'cross' && charge) {
      const e = clamp01(state.phaseT / Math.max(0.01, state.chargeTime));
      this.body.rotation.x = 0.03;
      this.body.rotation.z = state.side * (0.16 + Math.sin(e * Math.PI) * 0.12);
      this.head.rotation.x = -0.04;
    } else if (state.phase === 'tell') {
      this.body.rotation.x = -0.16;
      this.body.rotation.z *= 1 - Math.min(1, dt * 8);
      this.head.rotation.x = 0.18;
    } else {
      this.body.rotation.x *= 1 - Math.min(1, dt * 7);
      this.body.rotation.z *= 1 - Math.min(1, dt * 7);
      this.head.rotation.x *= 1 - Math.min(1, dt * 7);
    }

    if (state.phase === 'exit') {
      // A miss is still an authored beat: keep the beast committed and upright
      // while it runs out of the scene instead of visually melting into terrain.
      this.body.rotation.x *= 1 - Math.min(1, dt * 5);
      this.body.rotation.z *= 1 - Math.min(1, dt * 5);
      this.head.rotation.x *= 1 - Math.min(1, dt * 5);
      this.shadow.material.opacity *= 0.94;
    }

    if (killT > 0 && player) {
      const k = clamp01(killT / 0.5);
      const dx = player.x - state.x;
      this.root.rotation.y += Math.sign(dx || state.side) * 0.38 * k;
      this.body.position.z = -1.3 * k;
      this.body.position.y += 0.7 * k;
      this.body.rotation.x = 0.5 * k;
      this.arms.forEach((a) => { a.mesh.rotation.x = -1.0 * k; });
    }
  }
}

export default SecondBeastActor;
