/**
 * Actors — DICTION DASH.
 *
 * The runner is a RUNNING FIGURE OF LIGHT: the Dasher — a skinned athlete
 * (src/render/runner.glb, built by `npm run build:runner`) drawn by a light
 * shader from its normals alone, so it stays in the same error-absorbent
 * glow language as the Redline: a white rim that carries the silhouette, a
 * dim tinted fill that carries the volume. Its authored run clip is NOT
 * played on a clock — the clip's time is a pure function of the stride
 * phase, which is a pure function of ground covered (RC9.9), so a frozen sim
 * is a frozen figure and the feet keep the ground's pace at every speed.
 * PlayerActor keeps the exact update(p, slope, dt, gap) contract, the pivot
 * for airborne rotation, and the track-ribbon system (the ink stroke the
 * runner draws down the page). Lane logic, hit-boxes and movement are
 * untouched sim state; this file only draws them.
 */

import * as THREE from 'three';
import TUNING from '../TUNING.js';

// Playtest: "some lines are out of place, when the rest of them fit the road."
// This trail was one of them. At 180 slots sampled once a frame it recorded
// ~180m of path — the whole run so far — and its material had fog OFF, alone
// among everything drawn on the ground. So the far end stayed at full additive
// brightness while the road under it faded into the distance, and a ground
// mark that does not recede reads as a line laid OVER the scene rather than
// left on it. Shorter tail, and it takes the same fog as the road.
const TRACK_SEGMENTS = 48;

const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false,
  blending: THREE.AdditiveBlending, fog: false,
});

/**
 * The Dasher's light: rim-lit from the view, so the silhouette is always the
 * brightest thing about it — the one shape the eye must find between word
 * plates. `uFill` is the palette's tint (the cosmetic slot the old limbs
 * carried); `uCore` is the white rim and never changes. The ghost draws the
 * rim alone, additively — a hologram of the run it is replaying.
 */
const BODY_VERT = /* glsl */`
  #include <common>
  #include <skinning_pars_vertex>
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <beginnormal_vertex>
    #include <skinnormal_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    vN = normalize(normalMatrix * objectNormal);
    vV = -mvPosition.xyz;
  }
`;
const BODY_FRAG = /* glsl */`
  uniform vec3 uCore;
  uniform vec3 uFill;
  uniform float uGlow;
  uniform float uFillAmt;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    float facing = abs(dot(n, normalize(vV)));
    // Two rims: a tight white edge that draws the silhouette, and a wide
    // tinted bloom that makes the body read as lit from within.
    float edge = pow(1.0 - facing, 3.2);
    float bloom = pow(1.0 - facing, 1.3);
    // A soft key from above gives the limbs their volume without any light
    // in the scene having a say — the figure is its own light.
    float key = 0.5 + 0.5 * n.y;
    vec3 col = uFill * uFillAmt * (0.05 + 0.14 * key + 0.4 * bloom)
      + uCore * edge * 2.2;
    gl_FragColor = vec4(col * uGlow, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function bodyMaterial(ghost) {
  return new THREE.ShaderMaterial({
    vertexShader: BODY_VERT,
    fragmentShader: BODY_FRAG,
    uniforms: {
      uCore: { value: new THREE.Color(ghost ? 0x9fb9c8 : 0xeaffff) },
      uFill: { value: new THREE.Color(ghost ? 0x8aa6b6 : 0x9fe8ff) },
      uGlow: { value: 1 },
      uFillAmt: { value: ghost ? 0 : 1 },
      uOpacity: { value: ghost ? TUNING.GHOST.OPACITY : 1 },
    },
    // The live figure is solid, so its far limbs never shine through its
    // near ones; the ghost is pure additive light.
    transparent: ghost,
    depthWrite: !ghost,
    blending: ghost ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: true,
    fog: false,
  });
}

// Head-to-toe height of the drawn figure — the old construct's crown.
const FIGURE_HEIGHT_M = 1.9;
// The model is authored facing +Z; the runner runs toward -Z.
const FIGURE_YAW = Math.PI;

const RUNNER_URL = new URL('./runner.glb', import.meta.url).href;
let runnerAsset = null;
let cloneRig = null;

/**
 * Load the Dasher once; every figure clones the same template. The template
 * also carries the run cycle's MEAN POSE — the clip averaged over one
 * stride — which is the centre the posture knobs swing around: scaling a
 * bone toward its mean tightens the swing without ever moving the figure off
 * its line (scaling toward the T-pose bind would lift the arms instead).
 */
function loadRunner() {
  // The loader, the meshopt decoder and the skeleton cloner arrive in their
  // own chunk, after first paint — nothing on the critical path waits on them.
  runnerAsset ??= import('./runner-loader.js')
    .then(({ GLTFLoader, MeshoptDecoder, cloneSkinned }) => {
      cloneRig = cloneSkinned;
      return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(RUNNER_URL);
    })
    .then((gltf) => {
      const scene = gltf.scene;
      const clip = gltf.animations.find((a) => /run/i.test(a.name)) || gltf.animations[0];
      scene.updateMatrixWorld(true);
      const height = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).y;

      const mixer = new THREE.AnimationMixer(scene);
      mixer.clipAction(clip).play();
      const bones = [];
      scene.traverse((o) => { if (o.isBone) bones.push(o); });
      const sum = bones.map(() => new THREE.Vector4());
      const hipsY = { sum: 0 };
      const hips = bones.find((b) => b.name === 'Hips');
      const SAMPLES = 24;
      for (let i = 0; i < SAMPLES; i++) {
        mixer.setTime((i / SAMPLES) * clip.duration);
        bones.forEach((b, j) => {
          const q = b.quaternion, s = sum[j];
          const sign = s.x * q.x + s.y * q.y + s.z * q.z + s.w * q.w < 0 ? -1 : 1;
          s.x += q.x * sign; s.y += q.y * sign; s.z += q.z * sign; s.w += q.w * sign;
        });
        hipsY.sum += hips.position.y;
      }
      const mean = new Map(bones.map((b, j) =>
        [b.name, new THREE.Quaternion(sum[j].x, sum[j].y, sum[j].z, sum[j].w).normalize()]));
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      return { scene, clip, mean, meanHipsY: hipsY.sum / SAMPLES, scale: FIGURE_HEIGHT_M / height };
    })
    .catch((err) => {
      console.warn('[actors] runner model failed to load', err);
      return null;
    });
  return runnerAsset;
}

/**
 * Dress one figure: clone the template, give it its own light material, bind
 * a mixer to the clone. Ghost and player each own their clone, so their
 * skeletons never share a pose.
 */
function attachRig(r, asset, ghost) {
  const model = cloneRig(asset.scene);
  model.rotation.y = FIGURE_YAW;
  model.scale.setScalar(asset.scale);
  const mat = bodyMaterial(ghost);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = mat;
    o.frustumCulled = false; // the bind-pose bounds do not follow the stride
  });
  const bone = (name) => model.getObjectByName(name);
  const bones = [];
  model.traverse((o) => { if (o.isBone) bones.push(o); });
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(asset.clip).play();
  r.figure.add(model);
  r.bodyMat = mat;
  r.rig = {
    model, mixer, duration: asset.clip.duration, bones,
    mean: bones.map((b) => asset.mean.get(b.name)),
    meanHipsY: asset.meanHipsY,
    // Hips translation is in the armature's units; posture offsets are metres.
    unitsPerM: 1 / (asset.scale * (bone('Hips').parent.scale.y || 1)),
    hips: bone('Hips'),
    spine: bone('Spine02'),
    armL: bone('LeftArm'),
    armR: bone('RightArm'),
  };
}

/**
 * The running figure, built onto the actor `r`: the Dasher, a halo shell
 * and a light pool. Ghost builds the same construct, paler. The model arrives asynchronously (it is
 * ~70 KB and lands during the title); until it does the figure is its halo.
 */
function buildRunner(r, ghost = false) {
  const g = new THREE.Group();

  const haloColor = ghost ? 0x6f8b9c : 0x67d8ff;
  const baseOpacity = ghost ? TUNING.GHOST.OPACITY : 1;

  // Everything the body does happens inside this group, so the pivot, lean
  // and stagger shudder the actor applies to `group` carry the figure.
  const figure = new THREE.Group();
  g.add(figure);

  // The light-being shell: a soft halo around the torso keeps the figure
  // reading as a construct of glow rather than a mannequin.
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), glow(haloColor, 0.22 * baseOpacity));
  halo.scale.set(1.0, 1.55, 1.0);
  halo.position.y = 1.28;
  g.add(halo);

  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), glow(haloColor, 0.22 * baseOpacity));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.03;
  g.add(pool);

  // The comet tail: a horizontal streak stretching behind the figure as
  // speed climbs — invisible at a jog, unmistakable near the ceiling.
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1), glow(haloColor, 0));
  tail.rotation.x = -Math.PI / 2;
  tail.position.y = 1.05;
  g.add(tail);

  const materials = [halo.material, pool.material, tail.material];
  if (ghost) for (const m of materials) m.transparent = true;

  Object.assign(r, {
    group: g, figure, halo, pool, tail,
    bodyMat: null, rig: null, fill: null,
    materials, baseOpacity,
  });
  loadRunner().then((asset) => {
    if (!asset) return;
    attachRig(r, asset, ghost);
    // A palette chosen before the model landed is applied as it arrives.
    if (r.fill != null) r.bodyMat.uniforms.uFill.value.setHex(r.fill);
  });
}

/**
 * RC9.9 — ONE STRIDE RULE, and it is ground, not time.
 *
 * The phase advances with METRES COVERED. It used to advance with the render
 * frame's dt, which is the same number while the world is moving and a lie the
 * moment it stops: a teach stop freezes the sim outright — the clock, the
 * pursuit, the player, the gate — and the figure kept running on the spot in
 * front of a frozen world, which reads as a hang rather than as a held breath.
 * Distance-driven, a frozen sim is a frozen figure for free, and the pose is
 * a pure function of ground covered rather than of how the browser is feeling.
 *
 * The ghost rides the same rule from its own recorded motion, so the two
 * figures cannot fall out of step for reasons that have nothing to do with
 * either of them.
 */
export const STRIDE_BASE_M = 2.4;

/** Metres per full stride pair — longer as the figure sprints. */
export function strideLength(speedN) {
  return STRIDE_BASE_M + speedN * 0.9;
}

/**
 * @param {number} phase radians so far
 * @param {number} dD    metres covered since the last call
 * @param {number} speedN normalised speed, for the stride's length
 */
export function advanceStride(phase, dD, speedN) {
  if (!(dD > 0)) return phase;      // stopped, paused, or rewound: hold the pose
  return phase + dD * (Math.PI * 2) / strideLength(speedN);
}

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _mq = new THREE.Quaternion();
const _ax = new THREE.Vector3();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/**
 * Turn a bone about an axis given in the MODEL's frame (x = the figure's
 * left, y = up, z = forward), whatever its own authored axes are. Applied in
 * the bone's parent space, so it layers on top of the clip's pose.
 */
function bend(rig, bone, axis, angle) {
  if (!bone || !angle) return;
  rig.model.getWorldQuaternion(_mq).invert();
  bone.parent.getWorldQuaternion(_pq).premultiply(_mq).invert();
  _ax.copy(axis).applyQuaternion(_pq);
  bone.quaternion.premultiply(_q.setFromAxisAngle(_ax, angle));
}

/**
 * The shared run cycle — poses one rig from a phase angle. Used by the
 * player and the ghost so the two figures stride identically.
 *   phase    : radians, 2π per full stride pair = one pass of the clip
 *   speedN   : normalised speed (0..~1.85 with Overdrive)
 *   style    : the PLAYER's posture knobs (E3); the ghost passes nothing
 *     swingMul : scales every joint's excursion about the cycle's mean pose
 *     bobMul   : scales the pelvis's rise and fall
 *     hipDrop  : metres the pelvis sinks (the dash's drive, the dread crouch)
 *     lean     : extra forward pitch of the spine, radians
 *     flail    : 0..1 arms thrown wide (the stagger)
 */
function poseRunner(r, phase, speedN, style = {}) {
  const rig = r.rig;
  if (!rig) return;
  const cycle = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  rig.mixer.setTime(cycle * rig.duration);

  // A jog swings less than a sprint; the clip is authored at full sprint.
  const swing = Math.min(1.1, (0.8 + speedN * 0.15) * (style.swingMul ?? 1));
  if (Math.abs(swing - 1) > 1e-3) {
    for (let i = 0; i < rig.bones.length; i++) {
      const mean = rig.mean[i];
      if (!mean) continue;
      const q = rig.bones[i].quaternion;
      _q.copy(q);
      q.slerpQuaternions(mean, _q, swing);
    }
  }

  const hp = rig.hips.position;
  hp.y = rig.meanHipsY + (hp.y - rig.meanHipsY) * (style.bobMul ?? 1)
    - (style.hipDrop ?? 0) * rig.unitsPerM;

  bend(rig, rig.spine, AXIS_X, style.lean ?? 0);
  const flail = style.flail ?? 0;
  if (flail > 0) {
    bend(rig, rig.armL, AXIS_Z, flail * (1.1 + Math.sin(r.t * 31) * 0.3));
    bend(rig, rig.armR, AXIS_Z, -flail * (1.1 + Math.sin(r.t * 29) * 0.3));
  }
}

export class PlayerActor {
  constructor(scene) {
    buildRunner(this, false);
    this.pivot = new THREE.Group();
    this.pivot.add(this.group);
    this.root = new THREE.Group();
    this.root.add(this.pivot);
    scene.add(this.root);

    this.t = 0;
    this._lastD = 0;
    this._blink = 0;
    this._phase = 0;

    // The drawn line: the frame's track-ribbon system, a fine double-stroke
    // of ink the runner's footfalls leave on the page.
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
      color: 0x67d8ff, transparent: true, opacity: 0.42, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: true,
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
    const curL = new THREE.Vector3(p.x - rightX * 0.07, p.y + 0.03, -p.d - rightZ * 0.07);
    const curR = new THREE.Vector3(p.x + rightX * 0.07, p.y + 0.03, -p.d + rightZ * 0.07);
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
    // RC9.9: the ground covered since the last frame IS the stride's clock.
    // Read before `_lastD` moves, because the tracks need the same number.
    const strideD = p.d - this._lastD;
    this._lastD = p.d;
    this.root.position.set(p.x, p.y, -p.d);
    this.root.rotation.y = -p.heading;

    // Body lean into the turn, exactly like the old rig heeled over.
    const carveN = Math.max(-1, Math.min(1, p.heading / TUNING.PLAYER.MAX_CARVE));
    const lean = -carveN * 0.4;
    const slopePitch = Math.atan2(slope.dhdd, 1);
    const k = 1 - Math.exp(-12 * dt);
    this.group.rotation.z += ((p.airborne ? 0 : lean) - this.group.rotation.z) * k;
    this.group.rotation.x += ((p.airborne ? 0 : slopePitch) - this.group.rotation.x) * k;

    // Airborne spin/flip rides the same pivot the sim always drove.
    if (p.airborne) {
      this.pivot.rotation.y = p.yaw;
      this.pivot.rotation.x = p.pitch;
    } else {
      const settle = 1 - Math.exp(-10 * dt);
      this.pivot.rotation.y *= 1 - settle;
      this.pivot.rotation.x *= 1 - settle;
    }

    // Keyed 0..1.35 across the RUN floor→ceiling range (the old /32 maxed
    // out the animation at 43 m/s, so the top half of the curve looked
    // identical to the middle). Overdrive still stacks its own 0.5.
    const R = TUNING.RUN;
    const norm = Math.max(0, Math.min(1, (p.speed - R.FLOOR) / (R.CEILING - R.FLOOR)));
    const speedN = norm * 1.35 + (p.overdrive ? 0.5 : 0);

    // The nerve is a POSTURE input now (E3), so it is read before the pose.
    const nerve = Math.max(0, Math.min(1, 1 - beastGap / 45));
    // E3 — the runner's states, all pure functions of sim state:
    //   economy : high flow spends less motion — less bob, tighter swing,
    //             a steadier pulse. Mastery reads as ease, not flailing.
    //   dash    : the body drops and drives — pelvis low, swing tight,
    //             the speed-skater's start held for the whole spend.
    //   dread   : the Redline close pulls the figure into a crouch.
    const econ = Math.max(0, Math.min(1, ((this.flow ?? 1) - 1.25) / 0.5));
    // Stagger: the arms are thrown wide and settle back as it drains.
    const flailTarget = p.staggerT > 0 ? 1 : 0;
    this._flail = (this._flail ?? 0) +
      (flailTarget - (this._flail ?? 0)) * Math.min(1, dt * (flailTarget ? 14 : 8));
    const style = {
      swingMul: (p.overdrive ? 0.85 : 1) * (1 - econ * 0.25),
      bobMul: (p.overdrive ? 0.8 : 1) * (1 - econ * 0.5),
      hipDrop: (p.overdrive ? 0.09 : 0) + nerve * 0.035,
      // The clip is authored at a sprinter's lean; speed deepens it, Overdrive
      // is nearly horizontal fury, and the Redline close adds its own tension
      // to the spine (E3).
      lean: speedN * 0.1 - 0.06 + (p.overdrive ? 0.14 : 0) + nerve * 0.08,
      flail: this._flail,
    };

    // The run cycle is driven by distance, so stride matches the ground —
    // and so a frozen sim is a frozen figure (RC9.9). Airborne, the stride
    // holds where it left the ground.
    if (!p.airborne) this._phase = advanceStride(this._phase, strideD, speedN);
    poseRunner(this, this._phase, speedN, style);

    // The figure still pulses like a cursor: calm far from the Redline,
    // frantic close to it — the nerve tell carried over from Phase 5.
    // High flow steadies the pulse (E3): the light stops wavering.
    this._blink += dt * (1.6 + nerve * 6.5);
    const blink = 0.86 + Math.abs(Math.sin(this._blink * Math.PI)) * 0.14 * (1 - econ * 0.6);
    // Flow (Phase 9): the figure itself burns brighter with the chain —
    // main sets .flow each frame (glow × pulse); wrappers pass through.
    const flow = this.flow ?? 1;
    let bodyGlow = blink * (0.85 + flow * 0.15);
    this.halo.material.opacity =
      Math.min(0.6, 0.22 * this.baseOpacity * (0.8 + speedN * 0.35) * blink * flow);
    // The halo stretches into a teardrop with speed — the whole construct
    // reads as motion even in a still frame.
    this.halo.scale.set(1.0 + speedN * 0.1, 1.55 + speedN * 0.12, 1.0 + speedN * 0.55);
    this.halo.position.z = speedN * 0.5;

    // Comet tail: length and brightness ride the top half of the range.
    const tailN = Math.max(0, norm - 0.25) / 0.75;
    // Phase I: the tail brightens per dash-chain rung (main sets .dashChain).
    // RC8.3: capped by the LADDER's length, so a rung the score pays for is a
    // rung the eye is shown.
    const rung = Math.max(0, Math.min(TUNING.SCORE.DASH_CHAIN_MULT.length - 1, this.dashChain | 0));
    this.tail.material.opacity = Math.min(0.85, tailN * 0.4 * this.baseOpacity * (1 + 0.28 * rung));
    this.tail.scale.y = 0.001 + tailN * 9;             // plane local y = world z
    this.tail.position.z = (0.001 + tailN * 9) / 2 + 0.4;

    // Stagger: the construct destabilises — hard flicker, a shudder, arms
    // thrown wide (the flail, posed above). E3 adds the STUMBLE: one brutal
    // pitch forward that recovers as the stagger drains, without ever
    // touching forward motion (the sim owns that; this file never writes a
    // player field).
    if (p.staggerT > 0) {
      const jitter = Math.sin(this.t * 61) * 0.09;
      this.group.position.x = jitter;
      this.group.rotation.x += (p.staggerT / TUNING.PLAYER.STAGGER_TIME) * 0.3;
      bodyGlow *= 0.55 + Math.abs(Math.sin(this.t * 47)) * 0.45;
    } else {
      this.group.position.x *= 1 - Math.min(1, dt * 10);
    }
    if (this.bodyMat) this.bodyMat.uniforms.uGlow.value = Math.min(1.15, bodyGlow);

    this._track(p);
  }

  /**
   * Cosmetic palette (Phase 14): tint the glow surfaces — halo, ground
   * pool, comet tail, track trail, the body's fill — leaving the white rim
   * alone so the figure always reads. Cosmetic only; semantic cues live
   * elsewhere.
   */
  setPalette({ halo, limb } = {}) {
    if (halo != null) {
      this.halo.material.color.setHex(halo);
      this.pool.material.color.setHex(halo);
      this.tail.material.color.setHex(halo);
      this.tracks.material.color.setHex(halo);
    }
    if (limb != null) {
      this.fill = limb;
      this.bodyMat?.uniforms.uFill.value.setHex(limb);
    }
  }

  setVisible(v) { this.root.visible = v; }
}

export class GhostActor {
  constructor(scene) {
    buildRunner(this, true);
    this.tail.visible = false; // the comet tail is the live runner's alone
    this.root = new THREE.Group();
    this.root.add(this.group);
    this.root.visible = false;
    scene.add(this.root);
    this._phase = 0;
    this._lastD = null;
  }

  update(ghost, dt) {
    if (!ghost || !ghost.active) { this.root.visible = false; this._lastD = null; return; }
    this.root.visible = true;
    this.root.position.set(ghost.x, ghost.y, -ghost.d);
    for (const m of this.materials) if (m.transparent) m.opacity = ghost.opacity;
    if (this.bodyMat) this.bodyMat.uniforms.uOpacity.value = ghost.opacity;

    // Stride from its own recorded motion, so the pale runner keeps pace —
    // the same distance-driven rule the live figure runs (RC9.9). The rate is
    // still a rate, because the stride's LENGTH is a function of speed; only
    // the phase is advanced by ground.
    const strideD = this._lastD == null ? 0 : Math.max(0, ghost.d - this._lastD);
    const v = dt > 0 ? strideD / dt : 0;
    this._lastD = ghost.d;
    const R = TUNING.RUN;
    const speedN = Math.max(0, Math.min(1, (v - R.FLOOR) / (R.CEILING - R.FLOOR))) * 1.35;
    this._phase = advanceStride(this._phase, strideD, speedN);
    this.t = (this.t ?? 0) + dt;
    poseRunner(this, this._phase, speedN, { lean: speedN * 0.1 - 0.06 });

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

/**
 * The Redline fills the antagonist slot in the render graph, consuming the
 * exact update() contract (gap, side, lunge, killT) the beast carried.
 */
export { CorruptionActor as BeastActor } from './corruption.js';
