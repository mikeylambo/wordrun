/**
 * The runner's body — the authored model from the RUNNER MODEL v1.0 sheet.
 *
 * Geometry and the run cycle come from a rigged GLB (public/models/runner.glb,
 * shipped with the build — no request leaves the origin). The LOOK does not
 * come from its texture: it is a rim-light material, a deep navy body whose
 * silhouette burns pale cyan, which is the sheet's whole identity and holds up
 * at 30 px tall on a phone where a baked texture would turn to mush.
 *
 * The sheet's flow row — BASE, BUILDING, HIGH FLOW, DASH — is one dial here,
 * `setGlow(level)`: the rim brightens and widens as the chain climbs, and the
 * dash pushes it to white-hot. PlayerActor owns the dial; this file only
 * renders it.
 *
 * Loading is lazy and optional. Until the model arrives (or if it never
 * does), PlayerActor keeps drawing the procedural figure of light, so first
 * paint never waits on it and a missing file can never cost a run.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const RUNNER_MODEL_URL = '/models/runner.glb';

// The figure's height in metres — the procedural rig's head-top, so the
// camera, the contact shadow and the plate placement need no change.
export const RUNNER_HEIGHT_M = 1.92;

const BODY = 0x0a1726;
// With the model's texture: how far the albedo is pulled toward navy, and
// how hard its bright seams glow.
const BODY_TINT = 0x33506e;
const SEAM_GLOW = 0.6;
const RIM = new THREE.Color(0x9fe8ff);
const RIM_HOT = new THREE.Color(0xf2fdff);

/** The sheet's material: dark body, burning silhouette. Skinning-safe. */
export function rimMaterial({ opacity = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: BODY, roughness: 0.38, metalness: 0.15,
    emissive: 0x06111c, transparent: opacity < 1, opacity,
  });
  const uniforms = {
    uRimColor: { value: RIM.clone() },
    uRimStrength: { value: 1.4 },
    uRimPower: { value: 2.4 },
  };
  m.userData.rim = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimPower;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
  float rim = pow(1.0 - facing, uRimPower);
  gl_FragColor.rgb += uRimColor * rim * uRimStrength;
}`);
  };
  m.customProgramCacheKey = () => 'dd-runner-rim';
  return m;
}

let pending = null;

/**
 * Load once; resolves { scene, run } or null. `run` is the run-cycle clip
 * (the first clip whose name says run/sprint, else the first clip).
 */
export function loadRunnerModel(url = RUNNER_MODEL_URL) {
  if (pending) return pending;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  pending = loader.loadAsync(url).then((gltf) => {
    const clips = gltf.animations || [];
    const run = clips.find((c) => /run|sprint|jog/i.test(c.name)) || clips[0] || null;
    return { scene: gltf.scene, run };
  }).catch(() => null);
  return pending;
}

/**
 * One instance of the body, fitted to RUNNER_HEIGHT_M, feet on the origin,
 * facing −z (the way the runner runs), with its own mixer.
 */
export class RunnerBody {
  constructor(asset, { opacity = 1 } = {}) {
    this.root = new THREE.Group();
    this.material = rimMaterial({ opacity });
    const model = asset.scene;
    model.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        // The sheet's seam lines and chest chevron live in the model's own
        // texture. They become the glow: the texture tints a deep body and
        // drives the emissive, so the bright lines burn and the rest stays
        // dark under the rim.
        const tex = o.material?.map;
        if (tex && !this.material.map) {
          tex.colorSpace = THREE.SRGBColorSpace;
          this.material.map = tex;
          this.material.color.setHex(BODY_TINT);
          this.material.emissiveMap = tex;
          this.material.emissive.setHex(0xffffff);
          this.material.emissiveIntensity = SEAM_GLOW;
          this.material.needsUpdate = true;
        }
        o.material = this.material;
        o.frustumCulled = false; // a skinned mesh's bounds are its bind pose
      }
    });
    // Fit: scale to height, stand on the ground, centre on x/z.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = size.y > 0 ? RUNNER_HEIGHT_M / size.y : 1;
    model.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    // Meshy exports face +z; the runner runs toward −z.
    model.rotation.y = Math.PI;
    this.root.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    this.action = asset.run ? this.mixer.clipAction(asset.run) : null;
    this.action?.play();
    this.duration = asset.run?.duration || 1;
  }

  /**
   * Pose the cycle from the stride phase (radians, 2π per stride pair — the
   * same clock the procedural rig runs on, so a frozen sim is a frozen body).
   */
  pose(phase) {
    if (!this.action) return;
    const u = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
    this.mixer.setTime(u * this.duration);
  }

  /** The flow dial: 0 base · 1 building · 2 high flow · 3 dash. */
  setGlow(level, pulse = 1) {
    const r = this.material.userData.rim;
    const k = Math.max(0, Math.min(3, level)) / 3;
    r.uRimStrength.value = (2.2 + k * 2.6) * pulse;
    r.uRimPower.value = 2.1 - k * 0.9;           // a wider band as it burns
    r.uRimColor.value.copy(RIM).lerp(RIM_HOT, Math.max(0, k * 1.4 - 0.4));
    this.material.emissiveIntensity = SEAM_GLOW * (1 + k * 1.2) * pulse;
  }

  setOpacity(a) {
    this.material.opacity = a;
    this.material.transparent = a < 1;
  }
}
