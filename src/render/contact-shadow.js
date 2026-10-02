/**
 * Contact shadows (RC8) — a soft dark ellipse on the page under a figure, so
 * the runner and the Redline's tear read as standing ON the track rather than
 * floating over it. Each actor owns its own and positions it in update().
 */
import * as THREE from 'three';

export function makeContactShadow(scene, radius, opacity) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x0b1014, transparent: true, opacity, depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), mat);
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
