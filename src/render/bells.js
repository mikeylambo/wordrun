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

export class BellRenderer {
  constructor(scene, terrain, field) {
    this.terrain = terrain;
    this.field = field;
    this.max = 56;
    this.lastT = -Infinity;
    this.lastD = -Infinity;
    this.dummy = new THREE.Object3D();

    const gold = new THREE.MeshStandardMaterial({
      color: 0xd8aa42, roughness: 0.38, metalness: 0.48, flatShading: true,
      emissive: 0x5a350b, emissiveIntensity: 0.52,
    });
    const darkGold = new THREE.MeshStandardMaterial({
      color: 0x8b6424, roughness: 0.5, metalness: 0.32, flatShading: true,
      emissive: 0x2a1603, emissiveIntensity: 0.28,
    });
    this.body = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.34, 0.52, 6, 1, false), gold, this.max
    );
    this.clapper = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 5, 3), darkGold, this.max
    );
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clapper.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // These 56 tiny instances are rebuilt around the player every frame, but
    // an InstancedMesh keeps its bounds near its construction origin, so at
    // long distances the default cull would drop every bell. Always submit.
    this.body.frustumCulled = false;
    this.clapper.frustumCulled = false;
    scene.add(this.body, this.clapper);
  }

  reset(terrain = this.terrain) {
    this.terrain = terrain;
    this.field.setTerrain(terrain);
    this.body.count = 0;
    this.clapper.count = 0;
    this.lastT = -Infinity;
    this.lastD = -Infinity;
  }

  update(distance, t) {
    if (t - this.lastT < 0.05 && Math.abs(distance - this.lastD) < 7) return;
    this.lastT = t;
    this.lastD = distance;

    const bells = this.field.around(distance, 35, 360).slice(0, this.max);
    let n = 0;
    for (const bell of bells) {
      const bob = Math.sin(t * 2.6 + bell.phase) * 0.065;
      const y = this.terrain.heightAt(bell.x, bell.d) + 1.5 + bob;
      this.dummy.position.set(bell.x, y, -bell.d);
      this.dummy.rotation.set(0, t + bell.phase, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.body.setMatrixAt(n, this.dummy.matrix);
      this.dummy.position.y = y - 0.31;
      this.dummy.updateMatrix();
      this.clapper.setMatrixAt(n, this.dummy.matrix);
      n++;
    }
    this.body.count = n;
    this.clapper.count = n;
    this.body.instanceMatrix.needsUpdate = true;
    this.clapper.instanceMatrix.needsUpdate = true;
  }
}

export default BellRenderer;
