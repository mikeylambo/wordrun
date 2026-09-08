/**
 * Actors — DICTION DASH.
 *
 * The runner is the figure from the Redline key art, built the way this
 * game builds everything: procedurally, from tapered strokes of light,
 * posed by trig. There is no authored mesh, no skeleton, no skinning and
 * no animation clip — a hand-made pivot rig swung by a DISTANCE-driven
 * phase, so a frozen sim is a frozen figure for free and the pose is a
 * pure function of ground covered rather than of how the browser feels.
 *
 * Phase N5 (the cover figure) replaced the luminous mannequin with an
 * athlete: broad shoulder yoke, narrow waist, long heavy legs, a small
 * featureless head. And it inverted the read. The body is now a NEAR-BLACK
 * MASS wearing a luminous rim; the light does not fill him until he earns
 * it. `flow` — the chain's own brightness, already computed for the world —
 * drives an eased `ignite` that lifts the mass out of the dark and pushes
 * the rim toward white-hot. A brighter vocabulary, a brighter runner. No
 * new meter, no new gameplay system: the chain was already the number.
 *
 * Two anatomical hinges were also backwards and are not any more: knees
 * FOLD (heel toward the backside, -x) and elbows FLEX (hand forward, +x).
 * Nobody could see it on a stick figure. On a body you can see nothing else.
 *
 * PlayerActor keeps the exact update(p, slope, dt, gap) contract, the pivot
 * for airborne rotation, the contact shadow and the track ribbon the runner
 * draws down the page. Lane logic, hit-boxes and movement are untouched sim
 * state; this file only draws them, and never writes a sim field.
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
const TRACK_SPACING_M = 0.72;   // RC7.1's sampling rate, folded in below
const TRACK_HALF_W = 0.21;

/**
 * The figure's proportions, in one readable block because they ARE the
 * character: broad across the shoulders, narrow at the waist, heaviest in
 * the thigh, long in the leg. The gates assert the relationships (thigh
 * heavier than calf, upper arm heavier than forearm, shoulders wider than
 * the chest they sit on) rather than any single carved number, so the
 * silhouette can be tuned without the build going red for it — and cannot
 * quietly slide back into a rod-limbed mannequin.
 */
export const FIGURE = {
  HIP_Y: 0.98,          // hip pivot height — unchanged, the camera is framed on it
  SHOULDER_SPAN: 0.63,  // the broad line, tip to tip
  CHEST: 0.222,         // ribcage radius
  WAIST: 0.110,         // the taper it drives into
  PELVIS: 0.156,
  THIGH: 0.142,         // the heaviest section of the figure
  CALF: 0.097,
  UPPER_ARM: 0.098,
  FOREARM: 0.068,
  THIGH_LEN: 0.50,
  SHIN_LEN: 0.46,
  UPPER_ARM_LEN: 0.30,
  FOREARM_LEN: 0.27,
  FOOT_LEN: 0.17,
  HEAD: 0.121,          // small against the yoke — anonymous, like the key art
};

// The palette of the construct. The mass is near-black navy and lifts toward
// a pale cyan as the chain burns; the rim and the core accents are the light.
// No red anywhere on the runner — that hue belongs to the Redline alone.
const BODY_DARK = 0x060c15;
const BODY_LIT = 0x74c2de;
const GHOST_DARK = 0x121b23;
const GHOST_LIT = 0x5d7f8e;

/** Additive light: seams, rim, core accents, halo, pool, tail. */
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false,
  blending: THREE.AdditiveBlending, fog: false,
});

/**
 * The interior mass. Normal-blended and opaque so it can actually be DARK —
 * additive light cannot subtract, and a figure that is only ever brighter
 * than its background has no silhouette to read. Fog is off because the
 * runner sits at a fixed depth in every frame: atmosphere on him is a
 * constant tax on legibility and buys nothing.
 */
const massMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: opacity < 1, opacity, fog: false,
});

/**
 * The rim: the same geometry again, grown slightly and drawn BACK-FACE ONLY,
 * so the mass occludes everything except a hairline of light around the
 * silhouette. One trick, applied uniformly, and the figure reads as an
 * outline drawing at any size — the Smash-Bros silhouette test, passed by
 * construction. This is the surface `setPalette` tints.
 */
const rimMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, depthWrite: false, side: THREE.BackSide,
  blending: THREE.AdditiveBlending, fog: false,
});

/** Remember what each material was authored at, so the ghost can scale it. */
const authored = (m) => { m.userData.base = m.opacity; return m; };

/**
 * One anatomical form: the dark mass, plus its rim shell sharing the exact
 * same geometry (no duplicate buffers — only a second draw).
 */
function mass(mats, geo, rim = 1.1) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mats.body));
  if (rim) {
    const edge = new THREE.Mesh(geo, mats.rim);
    edge.scale.setScalar(rim);
    g.add(edge);
  }
  return g;
}

/**
 * One articulated limb: a pivot group at the joint, a HEAVY upper bone, a
 * nested second joint (knee/elbow) with a narrower lower bone, and a third
 * nested pivot at the ankle/wrist carrying the foot or the hand.
 *
 * The bones stay calligraphic — tapered strokes, thick at the joint they
 * hang from and drawn almost to a point at the far end — but they are no
 * longer rods: `upperThick` and `lowerThick` are separate, because a thigh
 * is not a calf and an upper arm is not a forearm, and that difference is
 * most of what makes a limb read as anatomy at gameplay scale.
 */
function limb(mats, x, y, upperLen, lowerLen, upperThick, lowerThick) {
  const joint = new THREE.Group();
  joint.position.set(x, y, 0);
  joint.add(mass(mats, new THREE.SphereGeometry(upperThick * 0.94, 9, 6), 0));

  const upper = mass(mats,
    new THREE.CylinderGeometry(upperThick, upperThick * 0.70, upperLen, 9), 1.085);
  upper.position.y = -upperLen / 2;
  joint.add(upper);

  const mid = new THREE.Group();
  mid.position.y = -upperLen;
  mid.add(mass(mats, new THREE.SphereGeometry(lowerThick * 0.99, 9, 6), 0));

  // The lower bone tapers almost to a point — the stroke's exit.
  const lower = mass(mats,
    new THREE.CylinderGeometry(lowerThick, lowerThick * 0.40, lowerLen, 9), 1.085);
  lower.position.y = -lowerLen / 2;
  mid.add(lower);

  const end = new THREE.Group();
  end.position.y = -lowerLen;
  mid.add(end);
  joint.add(mid);
  return { joint, mid, end, upper, lower };
}

/**
 * The running figure: pelvis, a torso that tapers from a broad shoulder
 * yoke into a narrow waist, a small featureless head, two arms, two legs
 * with feet, the spine seam and shoulder line in white-hot core light, a
 * halo shell, a light pool and the comet tail. Ghost builds the same
 * construct, paler.
 */
function buildRunner(ghost = false) {
  const g = new THREE.Group();
  const F = FIGURE;

  const coreColor = ghost ? 0xbfd6e2 : 0xeafcff;
  const limbColor = ghost ? 0x8aa6b6 : 0x9fe8ff;
  const haloColor = ghost ? 0x6f8b9c : 0x67d8ff;
  const baseOpacity = ghost ? TUNING.GHOST.OPACITY : 1;

  // The three surfaces of the construct: mass, rim, core.
  const bodyMat = authored(massMat(ghost ? GHOST_DARK : BODY_DARK, ghost ? 0.85 : 1));
  const limbMat = authored(rimMat(limbColor, 0.62 * baseOpacity));
  const coreMat = authored(glow(coreColor, 0.7 * baseOpacity));
  const mats = { body: bodyMat, rim: limbMat };

  // Everything above the legs leans as one piece — the sprinter's angle.
  const hips = new THREE.Group();
  hips.position.y = F.HIP_Y;
  g.add(hips);

  const pelvis = mass(mats, new THREE.SphereGeometry(F.PELVIS, 10, 7), 1.09);
  pelvis.scale.set(1.0, 0.66, 0.72);
  pelvis.position.y = 0.01;
  hips.add(pelvis);

  const chest = new THREE.Group();
  chest.position.y = 0.1;
  hips.add(chest);

  // The torso in two masses, because one cylinder cannot be both broad and
  // narrow: the abdomen drives DOWN into the waist, the ribcage flares UP
  // into the yoke. The V is the character.
  const abdomen = mass(mats,
    new THREE.CylinderGeometry(F.CHEST * 0.78, F.WAIST, 0.26, 10), 1.075);
  abdomen.scale.z = 0.74;
  abdomen.position.y = 0.13;
  chest.add(abdomen);

  const ribcage = mass(mats,
    new THREE.CylinderGeometry(F.CHEST, F.CHEST * 0.78, 0.28, 10), 1.075);
  ribcage.scale.z = 0.74;
  ribcage.position.y = 0.39;
  chest.add(ribcage);

  // The shoulder yoke — the widest thing on the figure, and the reason the
  // silhouette reads as an athlete rather than a letterform.
  const yoke = mass(mats, new THREE.SphereGeometry(0.15, 12, 8), 1.075);
  yoke.scale.set(F.SHOULDER_SPAN / 0.30, 0.60, 0.86);
  yoke.position.y = 0.53;
  chest.add(yoke);

  const neck = mass(mats, new THREE.CylinderGeometry(0.052, 0.072, 0.11, 8), 0);
  neck.position.y = 0.605;
  chest.add(neck);

  // A smooth, featureless oval. No face, no mask, no detail — the key-art
  // runner is anonymous, and anonymity is what lets the player be him.
  const head = mass(mats, new THREE.SphereGeometry(F.HEAD, 14, 10), 1.1);
  head.scale.set(0.94, 1.16, 1.02);
  head.position.y = 0.755;
  chest.add(head);

  // The crest survives as the ONE identity mark, reinterpreted: no longer a
  // horn off the crown but a slim accent of light swept back off the skull,
  // the way speed leaves a mark on everything else in this game.
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.019, 0.13, 6), coreMat);
  crest.position.set(0, 0.79, 0.095);
  crest.rotation.x = 1.15;
  chest.add(crest);

  // The core light the player actually sees: he is viewed from behind, so
  // the structural glow lives on the SPINE and across the back of the yoke.
  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0135, 0.0165, 0.46, 8), coreMat);
  spine.position.set(0, 0.31, F.CHEST * 0.74);
  spine.rotation.x = -0.06;
  chest.add(spine);

  const yokeLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0125, 0.0125, F.SHOULDER_SPAN * 0.62, 8), coreMat);
  yokeLine.rotation.z = Math.PI / 2;
  yokeLine.position.set(0, 0.545, 0.092);
  chest.add(yokeLine);

  // Arms hang from the yoke so they inherit the lean, and sit at its tips.
  const armX = F.SHOULDER_SPAN / 2 - 0.015;
  const armL = limb(mats, -armX, 0.515, F.UPPER_ARM_LEN, F.FOREARM_LEN, F.UPPER_ARM, F.FOREARM);
  const armR = limb(mats, armX, 0.515, F.UPPER_ARM_LEN, F.FOREARM_LEN, F.UPPER_ARM, F.FOREARM);
  armL.mid.rotation.x = 1.42;
  armR.mid.rotation.x = 1.42;
  chest.add(armL.joint, armR.joint);

  // Hands stay abstract: bright endpoints. At gameplay distance fingers are
  // noise, and a point of light is what the eye tracks anyway.
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(F.FOREARM * 0.86, 8, 6), coreMat);
    arm.end.add(hand);
  }

  // Legs hang from the hips; knees fold BACKWARD through the cycle.
  const legL = limb(mats, -0.126, 0, F.THIGH_LEN, F.SHIN_LEN, F.THIGH, F.CALF);
  const legR = limb(mats, 0.126, 0, F.THIGH_LEN, F.SHIN_LEN, F.THIGH, F.CALF);
  hips.add(legL.joint, legR.joint);

  // Feet: abstract, but present. A limb that ends at the ankle floats; a
  // limb that ends in a foot lands.
  for (const leg of [legL, legR]) {
    const foot = mass(mats,
      new THREE.CylinderGeometry(F.CALF * 0.80, F.CALF * 0.34, F.FOOT_LEN, 8), 1.08);
    foot.rotation.x = -Math.PI / 2;
    foot.scale.set(0.92, 1, 0.44);
    foot.position.set(0, -0.024, -0.038);
    leg.end.add(foot);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(F.CALF * 0.44, 8, 6), coreMat);
    leg.end.add(spark);
  }

  // The light-being shell: a soft halo around the torso keeps the figure
  // reading as a construct of glow rather than a mannequin.
  // Detail 1, not 0: at twenty triangles the shell's facets read as a hard
  // polygon behind the figure any time he is large in frame (the attract
  // loop, the arrival, a capture). Eighty triangles is still nothing.
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1),
    authored(glow(haloColor, 0.22 * baseOpacity)));
  halo.scale.set(1.0, 1.55, 1.0);
  halo.position.y = 1.28;
  g.add(halo);

  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18),
    authored(glow(haloColor, 0.22 * baseOpacity)));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.03;
  g.add(pool);

  // The comet tail: a horizontal streak stretching behind the figure as
  // speed climbs — invisible at a jog, unmistakable near the ceiling.
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1), authored(glow(haloColor, 0)));
  tail.rotation.x = -Math.PI / 2;
  tail.position.y = 1.05;
  g.add(tail);

  const materials = [coreMat, limbMat, bodyMat, halo.material, pool.material, tail.material];

  return {
    group: g, hips, chest, head, halo, pool, tail,
    armL, armR, legL, legR,
    coreMat, limbMat, bodyMat, materials, baseOpacity,
    dark: new THREE.Color(ghost ? GHOST_DARK : BODY_DARK),
    lit: new THREE.Color(ghost ? GHOST_LIT : BODY_LIT),
  };
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

/**
 * The shared run cycle — drives one rig from a phase angle. Used by the
 * player and the ghost so the two figures stride identically.
 *   phase    : radians, 2π per full stride pair
 *   speedN   : normalised speed (0..~1.85 with Overdrive)
 *   airborne : freeze the cycle into a leap pose
 *
 * Phase N5 rebuilt this into a sprint rather than a walk played fast. Four
 * things do the work, and none of them needs a mocap clip:
 *   1. the hip drives ASYMMETRICALLY — far more flexion in front of the body
 *      than extension behind it, because the ground is under him for about a
 *      third of the cycle and the other two thirds are recovery;
 *   2. the knee FOLDS (heel toward the backside) hardest just after toe-off —
 *      the recovery whip that separates a sprint from a jog;
 *   3. the ankle plantarflexes through the drive and gathers before the strike;
 *   4. the spine counter-rotates against the legs, with a shoulder roll on
 *      top, which is most of what makes a run read as a run from behind.
 */
function poseRunner(r, phase, speedN, airborne, dt, style = {}) {
  // E3 runner states: the style knob set is how the PLAYER's posture reads
  // its situation (dash aggression, high-flow economy, dread crouch). The
  // ghost passes nothing and strides exactly as it always has.
  const swingMul = style.swingMul ?? 1;
  const bobMul = style.bobMul ?? 1;
  const hipDrop = style.hipDrop ?? 0;
  const driveMul = style.driveMul ?? 1;        // the arms, independent of the legs
  const shoulderRise = style.shoulderRise ?? 0;
  const swing = (0.75 + speedN * 0.35) * swingMul;
  const sL = Math.sin(phase);
  const sR = Math.sin(phase + Math.PI);

  // Dread pulls the shoulders up toward the ears — a tell you feel before
  // you name it. Zero for the ghost, so its build pose is untouched.
  r.chest.position.y = 0.1 + shoulderRise;

  if (airborne) {
    // A held leap: lead leg reaching, trail leg extended, arms split.
    const k = 1 - Math.exp(-10 * dt);
    const to = (o, axis, v) => { o.rotation[axis] += (v - o.rotation[axis]) * k; };
    to(r.legL.joint, 'x', 0.88);
    to(r.legR.joint, 'x', -0.74);
    to(r.legL.mid, 'x', -0.66);
    to(r.legR.mid, 'x', -1.08);
    to(r.legL.end, 'x', 0.20);
    to(r.legR.end, 'x', -0.30);
    to(r.armL.joint, 'x', -0.64);
    to(r.armR.joint, 'x', 0.70);
    to(r.armL.mid, 'x', 1.12);
    to(r.armR.mid, 'x', 1.58);
    to(r.chest, 'y', 0);
    to(r.chest, 'z', 0);
    to(r.hips, 'y', 0);
    r.hips.position.y = FIGURE.HIP_Y;
    return;
  }

  // Ground cycle. Hips: asymmetric sprint drive, biased forward.
  r.legL.joint.rotation.x = (sL * 0.92 + 0.16) * swing;
  r.legR.joint.rotation.x = (sR * 0.92 + 0.16) * swing;

  // Knees fold backward, hardest just after toe-off, and fold harder the
  // faster he is moving — the recovery whip.
  const fold = 0.9 + speedN * 0.5;
  r.legL.mid.rotation.x = -(0.16 + 0.71 * (1 - Math.cos(phase - 5.3))) * fold;
  r.legR.mid.rotation.x = -(0.16 + 0.71 * (1 + Math.cos(phase - 5.3))) * fold;

  // Ankles: pointed through the drive, gathered before the strike.
  r.legL.end.rotation.x = 0.30 * Math.sin(phase + 2.1) - 0.06;
  r.legR.end.rotation.x = 0.30 * Math.sin(phase + Math.PI + 2.1) - 0.06;

  // Arms counter-swing from the shoulder, and the elbow TIGHTENS on the
  // forward drive and opens on the recovery, the way a sprinter's does.
  const drive = swing * driveMul;
  r.armL.joint.rotation.x = (sR * 0.80 - 0.06) * drive;
  r.armR.joint.rotation.x = (sL * 0.80 - 0.06) * drive;
  r.armL.mid.rotation.x = 1.42 + sR * 0.38 * driveMul;
  r.armR.mid.rotation.x = 1.42 + sL * 0.38 * driveMul;

  // The spine answers the legs: counter-rotation plus a shoulder roll.
  r.chest.rotation.y = -sL * 0.11 * swingMul;
  r.chest.rotation.z = sL * 0.05 * swingMul;
  r.hips.rotation.y = sL * 0.055;

  // The body rides the stride: a small double-frequency bob. High flow
  // spends less of it (economy of motion); the dash drops the whole pelvis.
  r.hips.position.y = 0.98 - hipDrop +
    Math.abs(Math.sin(phase)) * (0.035 + speedN * 0.03) * bobMul;
}

export class PlayerActor {
  constructor(scene) {
    const b = buildRunner(false);
    Object.assign(this, b);
    this.pivot = new THREE.Group();
    this.pivot.add(this.group);
    this.root = new THREE.Group();
    this.root.add(this.pivot);
    scene.add(this.root);

    this.t = 0;
    this._lastD = 0;
    this._blink = 0;
    this._phase = 0;
    this._ignite = 0;

    // RC8's contact shadow, and RC7.1's track sampling rate, both of which
    // used to be bolted onto this class from other files by reassigning
    // `update` at runtime. One file per system: they live here now.
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.82, 20),
      new THREE.MeshBasicMaterial({
        color: 0x0b1014, transparent: true, opacity: 0.12, depthWrite: false,
      }));
    this.shadow.rotation.x = -Math.PI * 0.5;
    this.shadow.renderOrder = 2;
    this.shadow.frustumCulled = false;
    this.shadow.scale.set(1.15, 0.62, 1);
    scene.add(this.shadow);

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

  /**
   * RC7.1 sampled every 0.72m instead of RC7's 0.48m: still visually
   * continuous at play speed, with a third of the buffer uploads. It also
   * wrapped the write head at 180 while the buffer only ever held 48
   * segments, so five sixths of every lap wrote past the end of the array
   * and silently did nothing — the ribbon drew for 35m, then froze for 95m,
   * which is exactly the "line out of place" the playtest kept reporting.
   * Folded in here, the head wraps at the length the buffer actually is.
   */
  _track(p) {
    if (p.airborne || p.staggerT > 0.15) { this._trackReady = false; return; }
    if (p.d - this._lastTrackD < TRACK_SPACING_M) return;
    this._lastTrackD = p.d;
    const rightX = Math.cos(p.heading), rightZ = Math.sin(p.heading);
    const curL = this._curL || (this._curL = new THREE.Vector3());
    const curR = this._curR || (this._curR = new THREE.Vector3());
    curL.set(p.x - rightX * TRACK_HALF_W, p.y + 0.025, -p.d - rightZ * TRACK_HALF_W);
    curR.set(p.x + rightX * TRACK_HALF_W, p.y + 0.025, -p.d + rightZ * TRACK_HALF_W);
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

  /** RC8's contact shadow: the one thing anchoring him to the road. */
  _contact(p) {
    const ground = p.terrain.heightAt(p.x, p.d);
    const air = Math.max(0, p.y - ground);
    this.shadow.position.set(p.x, ground + 0.035, -p.d);
    this.shadow.material.opacity = 0.12 * Math.max(0.18, 1 - air / 8);
    const s = 1 + Math.min(0.55, air * 0.045);
    this.shadow.scale.set(1.15 * s, 0.62 * s, 1);
    this.shadow.visible = !p.dead || air < 2;
  }

  /**
   * Phase N5 — THE LIGHT IS THE CHAIN.
   *
   * `flow` is the world's own earned brightness (glow × pulse), handed in by
   * main each frame: 0.78 at chain zero, 1.75 at the cap. Nothing new is
   * metered here and no gameplay depends on it — the figure simply spends
   * that number on himself. Dark mass and a thin cyan rim when the chain is
   * cold; the mass lifting and the rim going white-hot as it burns. Eased,
   * so a broken chain lets the light RECEDE rather than shatter: the
   * collapse metaphor in this game is the drain, never damage.
   */
  _ignition(dt, blink) {
    const flow = this.flow ?? 1;
    const target = Math.max(0, Math.min(1, (flow - 0.78) / 0.97));
    this._ignite += (target - this._ignite) * (1 - Math.exp(-4.2 * dt));
    const lit = this._ignite;
    this.bodyMat.color.lerpColors(this.dark, this.lit, lit * lit);
    this.limbMat.opacity = Math.min(1, (0.55 + lit * 0.45) * this.baseOpacity * blink);
    this.coreMat.opacity = Math.min(1, (0.6 + lit * 0.4) * this.baseOpacity * blink);
    return lit;
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
    //   dash    : the body drops and the ARMS drive — pelvis low, leg swing
    //             tight, the speed-skater's start held for the whole spend.
    //   dread   : the Redline close pulls the figure into a crouch and lifts
    //             the shoulders toward the ears.
    const econ = Math.max(0, Math.min(1, ((this.flow ?? 1) - 1.25) / 0.5));
    const style = {
      swingMul: (p.overdrive ? 0.85 : 1) * (1 - econ * 0.25),
      bobMul: (p.overdrive ? 0.8 : 1) * (1 - econ * 0.5),
      hipDrop: (p.overdrive ? 0.09 : 0) + nerve * 0.035,
      driveMul: (p.overdrive ? 1.34 : 1) * (1 - econ * 0.12),
      shoulderRise: nerve * 0.045,
    };

    // The run cycle is driven by distance, so stride matches the ground —
    // and so a frozen sim is a frozen figure (RC9.9).
    if (!p.airborne) this._phase = advanceStride(this._phase, strideD, speedN);
    poseRunner(this, this._phase, speedN, p.airborne, dt, style);

    // Sprinter's lean deepens with speed; Overdrive is nearly horizontal
    // fury, and the Redline close adds its own tension to the spine (E3).
    this.chest.rotation.x = -(0.16 + speedN * 0.22 +
      (p.overdrive ? 0.14 : 0) + nerve * 0.08);

    // The figure still pulses like a cursor: calm far from the Redline,
    // frantic close to it — the nerve tell carried over from Phase 5.
    // High flow steadies the pulse (E3): the light stops wavering.
    this._blink += dt * (1.6 + nerve * 6.5);
    const blink = 0.86 + Math.abs(Math.sin(this._blink * Math.PI)) * 0.14 * (1 - econ * 0.6);
    // Phase N5: the chain lifts the mass out of the dark and drives the rim
    // toward white-hot. Everything else here rides the number it returns.
    const lit = this._ignition(dt, blink);
    const flow = this.flow ?? 1;
    this.halo.material.opacity =
      Math.min(0.6, 0.22 * this.baseOpacity * (0.8 + speedN * 0.35) * blink * flow);
    this.pool.material.opacity = (0.16 + lit * 0.16) * this.baseOpacity;
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
    // thrown wide — where the old rig windmilled. E3 adds the STUMBLE: one
    // brutal pitch forward that recovers as the stagger drains, without
    // ever touching forward motion (the sim owns that; this file never
    // writes a player field).
    if (p.staggerT > 0) {
      const jitter = Math.sin(this.t * 61) * 0.09;
      this.group.position.x = jitter;
      this.group.rotation.x += (p.staggerT / TUNING.PLAYER.STAGGER_TIME) * 0.3;
      this.coreMat.opacity *= 0.55 + Math.abs(Math.sin(this.t * 47)) * 0.45;
      this.limbMat.opacity *= 0.5 + Math.abs(Math.sin(this.t * 47)) * 0.5;
      this.armL.joint.rotation.z = 0.9 + Math.sin(this.t * 31) * 0.3;
      this.armR.joint.rotation.z = -0.9 - Math.sin(this.t * 29) * 0.3;
    } else {
      this.group.position.x *= 1 - Math.min(1, dt * 10);
      this.armL.joint.rotation.z *= 1 - Math.min(1, dt * 8);
      this.armR.joint.rotation.z *= 1 - Math.min(1, dt * 8);
    }

    this._contact(p);
    this._track(p);
  }

  /**
   * Cosmetic palette (Phase 14): tint the glow surfaces — halo, ground
   * pool, comet tail, track trail, and the rim that traces the body —
   * leaving the white structural light alone so the figure always reads.
   * Cosmetic only; semantic cues live elsewhere.
   */
  setPalette({ halo, limb: rim } = {}) {
    if (halo != null) {
      this.halo.material.color.setHex(halo);
      this.pool.material.color.setHex(halo);
      this.tail.material.color.setHex(halo);
      this.tracks.material.color.setHex(halo);
    }
    if (rim != null) this.limbMat.color.setHex(rim);
  }

  setVisible(v) {
    this.root.visible = v;
    this.tracks.visible = v;
    this.shadow.visible = v;
  }
}

export class GhostActor {
  constructor(scene) {
    const b = buildRunner(true);
    Object.assign(this, b);
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
    // Each surface fades from what it was AUTHORED at, so the pale runner
    // keeps its own internal contrast instead of flattening to one value.
    for (const m of this.materials) {
      m.transparent = true;
      m.opacity = m.userData.base * ghost.opacity;
    }

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
    poseRunner(this, this._phase, speedN, false, dt);
    this.chest.rotation.x = -(0.16 + speedN * 0.22);

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
