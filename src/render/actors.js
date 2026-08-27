import * as THREE from 'three';
import TUNING from '../TUNING.js';

const std = (color, roughness = 0.82, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness, metalness: 0.01, flatShading: true, ...extra,
});
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const TRACK_SEGMENTS = 180;

function buildSkier(ghost = false) {
  const g = new THREE.Group();
  const ghostOpts = ghost ? {
    transparent: true, opacity: TUNING.GHOST.OPACITY, depthWrite: false,
  } : {};

  const coat = ghost ? std(0xa9bfca, 0.9, ghostOpts) : std(0xe8ddc6, 0.94);
  const dark = ghost ? coat : std(0x20262b, 0.82);
  const boots = ghost ? coat : std(0x3a302b, 0.78);
  const ski = ghost ? coat : std(0x8f3429, 0.68);
  const orange = ghost ? coat : std(0xd85d2f, 0.72);
  const lens = ghost ? coat : std(0xe5a33f, 0.3, { metalness: 0.08 });

  // One big, silly shape: a winter coat almost too large for its owner.
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), coat);
  torso.scale.set(0.94, 1.14, 0.82);
  torso.position.set(0, 1.17, 0.05);
  g.add(torso);

  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.52, 6), coat);
  hem.position.set(0, 0.84, 0.13);
  hem.rotation.x = 0.12;
  g.add(hem);

  const hood = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), coat);
  hood.scale.set(1.06, 1.12, 1.0);
  hood.position.set(0, 1.72, 0.02);
  g.add(hood);

  const face = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 1), dark);
  face.position.set(0, 1.72, -0.18);
  g.add(face);

  // Huge ski goggles instead of a sci-fi visor.
  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.08), lens);
  goggles.position.set(0, 1.77, -0.39);
  goggles.rotation.x = -0.04;
  g.add(goggles);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.06, 0.27), dark);
  strap.position.set(0, 1.77, -0.18);
  g.add(strap);

  const arms = [];
  const legs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.68, 6), coat);
    arm.position.set(s * 0.48, 1.16, -0.04);
    arm.rotation.z = s * 0.22;
    arm.rotation.x = 0.55;
    g.add(arm);
    arms.push({ mesh: arm, side: s });

    const mitten = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), orange);
    mitten.position.set(s * 0.53, 0.9, -0.28);
    g.add(mitten);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.72, 6), dark);
    leg.position.set(s * 0.2, 0.5, 0.04);
    leg.rotation.x = -0.22;
    g.add(leg);
    legs.push({ mesh: leg, side: s });

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.42), boots);
    boot.position.set(s * 0.2, 0.17, -0.07);
    g.add(boot);

    // Comically long skis: readable at phone size, and not superhero-coded.
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 2.35), ski);
    board.position.set(s * 0.21, 0.04, -0.03);
    g.add(board);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.42), orange);
    tip.position.set(s * 0.21, 0.12, -1.27);
    tip.rotation.x = -0.46;
    g.add(tip);
  }

  let scarf = null;
  if (!ghost) {
    scarf = new THREE.Group();
    scarf.position.set(0.1, 1.57, 0.2);
    const segments = [];
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.18 - i * 0.009, 0.075, 0.5), orange);
      seg.position.z = 0.25 + i * 0.43;
      scarf.add(seg);
      segments.push(seg);
    }
    scarf.userData.segments = segments;
    g.add(scarf);
  }

  return { group: g, torso, head: hood, goggles, arms, legs, scarf, materials: [coat, dark, boots, ski, orange, lens] };
}

export class PlayerActor {
  constructor(scene) {
    const b = buildSkier(false);
    Object.assign(this, b);
    this.pivot = new THREE.Group();
    this.pivot.add(this.group);
    this.root = new THREE.Group();
    this.root.add(this.pivot);
    scene.add(this.root);

    this.t = 0;
    this._lastD = 0;
    this._lastTrackD = -999;
    this._trackHead = 0;
    this._trackReady = false;
    this._trackLeft = new THREE.Vector3();
    this._trackRight = new THREE.Vector3();
    this.trackPos = new Float32Array(TRACK_SEGMENTS * 4 * 3);
    for (let i = 0; i < this.trackPos.length; i += 3) this.trackPos[i + 1] = -9999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trackPos, 3));
    this.tracks = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0x708c9a, transparent: true, opacity: 0.28, depthWrite: false,
    }));
    this.tracks.frustumCulled = false;
    scene.add(this.tracks);
  }

  _clearTracks() {
    for (let i = 0; i < this.trackPos.length; i += 3) this.trackPos[i + 1] = -9999;
    this.tracks.geometry.attributes.position.needsUpdate = true;
    this._trackHead = 0;
    this._trackReady = false;
    this._lastTrackD = -999;
  }

  _track(p) {
    if (p.airborne || p.staggerT > 0.15) { this._trackReady = false; return; }
    if (p.d - this._lastTrackD < 0.48) return;
    this._lastTrackD = p.d;
    const rightX = Math.cos(p.heading), rightZ = Math.sin(p.heading);
    const curL = new THREE.Vector3(p.x - rightX * 0.21, p.y + 0.025, -p.d - rightZ * 0.21);
    const curR = new THREE.Vector3(p.x + rightX * 0.21, p.y + 0.025, -p.d + rightZ * 0.21);
    if (this._trackReady) {
      const base = this._trackHead * 12, a = this.trackPos;
      a[base] = this._trackLeft.x; a[base + 1] = this._trackLeft.y; a[base + 2] = this._trackLeft.z;
      a[base + 3] = curL.x; a[base + 4] = curL.y; a[base + 5] = curL.z;
      a[base + 6] = this._trackRight.x; a[base + 7] = this._trackRight.y; a[base + 8] = this._trackRight.z;
      a[base + 9] = curR.x; a[base + 10] = curR.y; a[base + 11] = curR.z;
      this._trackHead = (this._trackHead + 1) % TRACK_SEGMENTS;
      this.tracks.geometry.attributes.position.needsUpdate = true;
    }
    this._trackLeft.copy(curL); this._trackRight.copy(curR); this._trackReady = true;
  }

  update(p, slope, dt, beastGap = 80) {
    this.t += dt;
    if (p.d < this._lastD - 5) this._clearTracks();
    this._lastD = p.d;
    this.root.position.set(p.x, p.y, -p.d);
    this.root.rotation.y = -p.heading;

    // Go farther than realistic. The game reads at speed because the skier
    // practically falls into a hard carve and snaps back out of it.
    const carveN = Math.max(-1, Math.min(1, p.heading / TUNING.PLAYER.MAX_CARVE));
    const lean = -carveN * 0.78;
    const slopePitch = Math.atan2(slope.dhdd, 1);
    const k = 1 - Math.exp(-12 * dt);
    this.group.rotation.z += ((p.airborne ? 0 : lean) - this.group.rotation.z) * k;
    this.group.rotation.x += ((p.airborne ? 0 : slopePitch) - this.group.rotation.x) * k;

    if (p.airborne) {
      this.pivot.rotation.y = p.yaw;
      this.pivot.rotation.x = p.pitch;
    } else {
      const settle = 1 - Math.exp(-10 * dt);
      this.pivot.rotation.y *= 1 - settle;
      this.pivot.rotation.x *= 1 - settle;
    }

    // Knees come absurdly high in air; a flub produces an arm-windmill rather
    // than a subtle procedural wobble.
    for (const leg of this.legs) {
      const target = p.airborne ? 0.72 : -0.22;
      leg.mesh.rotation.x += (target - leg.mesh.rotation.x) * k;
    }
    for (const arm of this.arms) {
      let rz = arm.side * (0.18 + Math.max(0, carveN * arm.side) * 0.52);
      if (p.staggerT > 0) rz += Math.sin(this.t * 25 + arm.side) * 0.9;
      arm.mesh.rotation.z += (rz - arm.mesh.rotation.z) * k;
    }

    // The giant scarf is the signature. At Overdrive it becomes borderline
    // ridiculous, which is exactly the correct amount of restraint here.
    if (this.scarf) {
      const speed = Math.min(1.35, p.speed / 32) + (p.overdrive ? 0.45 : 0);
      this.scarf.rotation.x = 0.12 + speed * 0.1;
      const segs = this.scarf.userData.segments;
      for (let i = 0; i < segs.length; i++) {
        const wave = Math.sin(this.t * (7.5 + speed * 2) - i * 0.72);
        segs[i].rotation.y = wave * (0.08 + speed * 0.12);
        segs[i].rotation.x = Math.sin(this.t * 5.2 - i * 0.55) * 0.08;
        segs[i].scale.z = 1 + speed * 0.12;
      }
    }

    // Quick over-the-shoulder look when it is breathing on you.
    const lookBack = !p.airborne && beastGap < 18 ? 0.62 : 0;
    this.head.rotation.y += (lookBack - this.head.rotation.y) * (1 - Math.exp(-7 * dt));
    this._track(p);
  }

  setVisible(v) { this.root.visible = v; }
}

export class GhostActor {
  constructor(scene) {
    const b = buildSkier(true);
    this.group = b.group;
    this.materials = b.materials;
    this.root = new THREE.Group();
    this.root.add(this.group);
    this.root.visible = false;
    scene.add(this.root);
  }

  update(ghost, dt) {
    if (!ghost || !ghost.active) { this.root.visible = false; return; }
    this.root.visible = true;
    this.root.position.set(ghost.x, ghost.y, -ghost.d);
    for (const m of this.materials) if (m.transparent) m.opacity = ghost.opacity;
    if (ghost.yanking) {
      this.group.rotation.x = -1.1;
      this.group.rotation.z += dt * 6;
      this.root.position.y += Math.min(5, dt * 12);
    } else {
      this.group.rotation.x *= 1 - Math.min(1, dt * 8);
      this.group.rotation.z *= 1 - Math.min(1, dt * 8);
    }
  }
}

export class BeastActor {
  constructor(scene) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.root.scale.setScalar(TUNING.BEAST.MODEL_SCALE);
    scene.add(this.root);

    const hide = std(0x090c0e, 0.96);
    const hide2 = std(0x171b1c, 0.93);
    const claw = std(0x2d2926, 0.86);
    const eye = basic(0xff2a1f);

    // Top-heavy enough to be a little funny before it becomes terrifying.
    this.shoulders = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 0), hide);
    this.shoulders.scale.set(1.55, 1.0, 0.9);
    this.shoulders.position.set(0, 2.1, 0.18);
    this.body.add(this.shoulders);

    const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(0.82, 0), hide2);
    belly.scale.set(0.82, 1.18, 0.8);
    belly.position.set(0, 1.2, 0.12);
    this.body.add(belly);

    this.head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), hide);
    this.head.scale.set(0.92, 0.92, 1.18);
    this.head.position.set(0, 2.42, -0.9);
    this.body.add(this.head);

    // One horn is intentionally too long. Symmetry would make it look designed.
    for (const [s, h] of [[-1, 0.95], [1, 1.45]]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 5), claw);
      horn.position.set(s * 0.32, 2.88, -0.78);
      horn.rotation.z = s * -0.35;
      horn.rotation.x = -0.2;
      this.body.add(horn);
    }

    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.05), eye);
      e.position.set(s * 0.2, 2.5, -1.42);
      this.body.add(e);
    }

    this.arms = [];
    this.hands = [];
    this.legs = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.27, 2.25, 6), hide);
      arm.position.set(s * 1.03, 1.25, -0.18);
      arm.rotation.z = s * 0.17;
      this.body.add(arm);
      this.arms.push({ mesh: arm, side: s });

      const hand = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), claw);
      hand.scale.set(1.0, 0.65, 1.35);
      hand.position.set(s * 1.18, 0.16, -0.45);
      this.body.add(hand);
      this.hands.push({ mesh: hand, side: s });

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.31, 1.35, 6), hide2);
      leg.position.set(s * 0.48, 0.55, 0.45);
      this.body.add(leg);
      this.legs.push({ mesh: leg, side: s });
    }

    // Short spine fan: silhouette punctuation rather than monster detail.
    for (let i = 0; i < 4; i++) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.72 - i * 0.08, 4), hide2);
      spine.position.set(0, 2.25 - i * 0.32, 0.78 + i * 0.14);
      spine.rotation.x = 1.0;
      this.body.add(spine);
    }

    this.t = 0;
  }

  reset() {
    this.t = 0;
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
  }

  update(dt, gap, x, groundY, playerD, killT, side = 1, lunge = 'idle', lungeT = 0) {
    this.t += dt;
    const beastD = playerD - gap;
    this.root.position.set(x, groundY, -beastD);

    // Kooky gallop: giant shoulders bounce, hands almost slap the snow, and
    // the stride is too large for the body carrying it.
    const urgency = Math.max(0, Math.min(1, 1 - gap / 45));
    const cadence = 4.6 + urgency * 3.4;
    const phase = this.t * cadence;
    const bounce = Math.abs(Math.sin(phase)) * (0.12 + urgency * 0.16);
    this.body.position.y = bounce;
    this.shoulders.rotation.z = Math.sin(phase * 0.5) * 0.07;
    this.head.rotation.y = Math.sin(phase * 0.5) * 0.08;

    for (const arm of this.arms) {
      const swing = Math.sin(phase + (arm.side > 0 ? Math.PI : 0));
      arm.mesh.rotation.x = swing * (0.55 + urgency * 0.45);
      arm.mesh.rotation.z = arm.side * (0.15 + urgency * 0.08);
    }
    for (const hand of this.hands) {
      hand.mesh.position.z = -0.45 + Math.sin(phase + (hand.side > 0 ? Math.PI : 0)) * 0.42;
    }
    for (const leg of this.legs) {
      leg.mesh.rotation.x = Math.sin(phase + (leg.side < 0 ? Math.PI : 0)) * 0.46;
    }

    if (lunge === 'tell') {
      const k = Math.min(1, lungeT / Math.max(0.01, TUNING.BEAST.LUNGE_TELL));
      this.body.scale.y = 1 - k * 0.22;
      this.body.position.z = k * 0.35;
    } else if (lunge === 'strike') {
      this.body.scale.y = 1.08;
      this.body.position.z = -0.7;
      this.arms.forEach((a) => { a.mesh.rotation.x = -1.05; });
    } else {
      this.body.scale.y += (1 - this.body.scale.y) * (1 - Math.exp(-8 * dt));
      this.body.position.z += (0 - this.body.position.z) * (1 - Math.exp(-8 * dt));
    }

    if (killT > 0) {
      const k = Math.min(1, killT / Math.max(0.01, TUNING.BEAST.KILL_WHIP_TIME));
      this.body.rotation.z = side * -0.16 * k;
      this.body.scale.setScalar(1 + k * 0.12);
    } else {
      this.body.rotation.z *= 1 - Math.min(1, dt * 7);
      const s = this.body.scale.x + (1 - this.body.scale.x) * (1 - Math.exp(-7 * dt));
      this.body.scale.x = s;
      this.body.scale.z = s;
    }
  }
}
