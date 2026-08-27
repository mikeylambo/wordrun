/**
 * Streak burst — the vibrancy layer, concentrated at the payoff.
 *
 * Fires on every correct read, keyed to the current chain: a 3-streak reads
 * differently from a 10-streak. Escalation adds rings, hues and reach —
 * cyan alone, then violet joins, then gold — but NEVER red: the Redline is
 * the one saturated red thing on screen, and the word plate keeps its
 * solid-glyph-core treatment no matter what fires behind it.
 *
 * Purely presentational: consumes word_correct events, writes nothing back.
 */

import * as THREE from 'three';

// Escalation palette — red is deliberately absent at every tier.
const TIER_COLORS = [
  [0x67d8ff],
  [0x67d8ff, 0xb18cff],
  [0x67d8ff, 0xb18cff, 0xffd977],
];

const POOL = 9; // three full top-tier bursts in flight at once

export class StreakBurst {
  constructor(scene) {
    this.rings = [];
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x67d8ff, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0, span: 1, grow: 1, delay: 0 });
    }
  }

  reset() {
    for (const r of this.rings) {
      r.life = 0;
      r.mesh.visible = false;
    }
  }

  /** word_correct event: position + chain decide how loud the payoff is. */
  fire(e) {
    const chain = e.chain ?? 1;
    const tier = chain >= 7 ? 2 : chain >= 3 ? 1 : 0;
    const colors = TIER_COLORS[tier];
    const punch = 1 + Math.min(chain, 10) * 0.08;

    let launched = 0;
    for (const r of this.rings) {
      if (r.life > 0) continue;
      const idx = launched;
      r.life = 0.55 + tier * 0.12;
      r.maxLife = r.life;
      r.delay = idx * 0.07;
      r.span = (1.6 + idx * 0.9) * punch;
      r.grow = (7 + tier * 4) * punch;
      r.mesh.material.color.setHex(colors[idx % colors.length]);
      r.mesh.position.set(e.x, e.y + 1.4, -e.d);
      r.mesh.scale.setScalar(0.01);
      r.mesh.visible = false; // becomes visible when its delay elapses
      launched++;
      if (launched > tier) break;
    }
  }

  update(dt, camera) {
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      if (r.delay > 0) { r.delay -= dt; continue; }
      r.life -= dt;
      if (r.life <= 0) { r.mesh.visible = false; continue; }
      const t = 1 - r.life / r.maxLife;
      r.mesh.visible = true;
      r.mesh.scale.setScalar(r.span * (0.25 + t * 1.1) + t * r.grow * 0.12);
      r.mesh.material.opacity = 0.55 * (1 - t) * (1 - t);
      r.mesh.quaternion.copy(camera.quaternion);
    }
  }
}
