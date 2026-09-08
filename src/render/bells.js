/**
 * BellRenderer — the gold bells the runner collects, as instanced meshes.
 *
 * Phase 0: lifted out of the deleted rc5.js runtime patch into a normal render
 * module. It draws (it does not decide): the simulation owns the BellField and
 * all collection/scoring (see sim/sim.js `this.bells`), and this reads that same
 * field to place the meshes. main.js constructs it after the material pass and
 * calls update() each frame; the pickup sound and HUD are driven by the sim's
 * 'bell' events, not from here.
 *
 * The emissive floor (once set post-boot by rc9-audio for AFTERLIGHT night
 * readability) and the frustum-culling opt-out (once set by rc9-feedback for the
 * far-distance cull) are baked into construction here, so nothing has to reach
 * into this object at runtime to finish configuring it.
 */

import * as THREE from 'three';
import { litCount, litFraction } from '../design/bells.js';

export class BellRenderer {
  constructor(scene, terrain, field) {
    this.terrain = terrain;
    this.field = field;
    this.max = 56;
    this.lastT = -Infinity;
    this.lastD = -Infinity;
    this.lastChain = -1;
    this.dummy = new THREE.Object3D();

    // Phase V (playtest: "bell colour on the track needs to change"): the
    // old gold sat at hue ~46° — one degree from the reserved streak-burst
    // tier-3 hue (45°), inside the 25° separation every semantic colour
    // must keep, so the pickup wore an earned signal's clothes. The bell is
    // now chartreuse (~78°): ≥25° clear of every reserved hue, of the
    // correct-read green, of the heart rose and of the world's resting
    // cyan — checked by the hue gate BEFORE this colour was chosen, per
    // the standing rule. Brighter emissive so it pops off the navy track.
    const bright = new THREE.MeshStandardMaterial({
      color: 0xcaff4a, roughness: 0.38, metalness: 0.35, flatShading: true,
      emissive: 0x6d9a14, emissiveIntensity: 1.5,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x74901f, roughness: 0.5, metalness: 0.25, flatShading: true,
      emissive: 0x243506, emissiveIntensity: 0.35,
    });
    // Playtest round two: brighter still, and each bell wears a soft
    // additive halo — the classic pickup glow, one extra instanced draw
    // call, lighting-independent so it survives the darkest bands.
    const glow = new THREE.MeshBasicMaterial({
      color: 0xcaff4a, transparent: true, opacity: 0.22, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: true,
    });
    // N7: a bell, not a cone. Six-sided and straight, seen from behind and
    // above at speed, it read as a flat chartreuse triangle inside a flat
    // chartreuse circle — the weakest-looking object in the frame. A lathed
    // profile costs the same one instanced draw and gives it the silhouette
    // the name promises: crown, shoulder, waist, and a flared lip. The HUE
    // is untouched and must stay untouched — chartreuse ~78° was chosen
    // against the 25° hue-separation gate before it was drawn, and this is
    // a shape change only.
    const bellProfile = [
      [0.045, 0.62], [0.075, 0.60], [0.062, 0.565],   // the crown loop
      [0.135, 0.545], [0.215, 0.44], [0.275, 0.30],   // shoulder into the waist
      [0.335, 0.145], [0.395, 0.04], [0.415, 0.0],    // the flare, out to the lip
    ].map(([r, y]) => new THREE.Vector2(r, y));
    this.body = new THREE.InstancedMesh(
      new THREE.LatheGeometry(bellProfile, 10), bright, this.max
    );
    this.clapper = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.10, 5, 3), dark, this.max
    );
    // N7: 0.72 -> 0.46. At 0.72 the halo was a sphere nearly twice the bell's
    // width, and with the bright pass now blooming it as well it read as a
    // flat chartreuse disc with a shape lost somewhere inside it — which is
    // exactly what a bell looked like on the track. The halo still exists and
    // is still lighting-independent, because that is what carries the pickup
    // through the darkest bands; it just stops being the whole object.
    this.halo = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.46, 10, 7), glow, this.max
    );
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clapper.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // These 56 tiny instances are rebuilt around the player every frame, but
    // an InstancedMesh keeps its bounds near its construction origin, so at
    // long distances the default cull would drop every bell. Always submit.
    this.body.frustumCulled = false;
    this.clapper.frustumCulled = false;
    this.halo.frustumCulled = false;
    scene.add(this.body, this.clapper, this.halo);
  }

  reset(terrain = this.terrain) {
    this.terrain = terrain;
    this.field.setTerrain(terrain);
    this.body.count = 0;
    this.clapper.count = 0;
    this.halo.count = 0;
    this.lastT = -Infinity;
    this.lastD = -Infinity;
    this.lastChain = -1;
  }

  /**
   * RC10.9: the chain draws the string. `chain` decides how many of each
   * string's seven bells exist to be seen at all (design/bells.js `litCount`
   * — the same function the sim collects by, so the eye and the ledger can
   * never disagree), and how brightly. Positions are untouched: they are
   * seeded from the route and read nothing about the player.
   */
  update(distance, t, chain = 0) {
    if (t - this.lastT < 0.05 && Math.abs(distance - this.lastD) < 7
      && chain === this.lastChain) return;
    this.lastT = t;
    this.lastD = distance;
    this.lastChain = chain;

    const lit = litCount(chain);
    if (lit <= 0) {
      // Chain 0: there is no string. Nothing is dimmed and nothing is teased —
      // the track is simply bare, which is what makes the first read light it.
      this.body.count = 0; this.clapper.count = 0; this.halo.count = 0;
      return;
    }
    // A longer chain is a brighter string as well as a longer one, so the
    // world answers the eleventh clean read and not only the first.
    const f = litFraction(chain);
    this.body.material.emissiveIntensity = 1.5 + 1.1 * f;
    this.halo.material.opacity = 0.20 + 0.22 * f;

    const bells = this.field.around(distance, 35, 360)
      .filter((b) => b.i < lit).slice(0, this.max);
    let n = 0;
    for (const bell of bells) {
      const bob = Math.sin(t * 2.6 + bell.phase) * 0.065;
      const y = this.terrain.heightAt(bell.x, bell.d) + 1.5 + bob;
      this.dummy.position.set(bell.x, y, -bell.d);
      this.dummy.rotation.set(0, t + bell.phase, 0);
      this.dummy.scale.setScalar(0.86 + 0.14 * f);
      this.dummy.updateMatrix();
      this.body.setMatrixAt(n, this.dummy.matrix);
      this.halo.setMatrixAt(n, this.dummy.matrix);
      this.dummy.position.y = y - 0.31;
      this.dummy.updateMatrix();
      this.clapper.setMatrixAt(n, this.dummy.matrix);
      n++;
    }
    this.body.count = n;
    this.clapper.count = n;
    this.halo.count = n;
    this.body.instanceMatrix.needsUpdate = true;
    this.clapper.instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true;
  }
}

export default BellRenderer;
