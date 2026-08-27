import * as THREE from 'three';
import './presentation-bridge.js';
import '../rc5.js';
import '../rc9-audio.js';
import '../rc7-feel.js';
import '../rc81-ui.js';
import { SURFACES, applySurface } from './surface-textures.js';
import TUNING from '../TUNING.js';

function toStandard(old) {
  const next = new THREE.MeshStandardMaterial({
    color: old.color?.clone?.() || new THREE.Color(0xffffff),
    vertexColors: !!old.vertexColors,
    transparent: !!old.transparent,
    opacity: old.opacity ?? 1,
    depthWrite: old.depthWrite ?? true,
    side: old.side,
    roughness: 0.83,
    metalness: 0.015,
    flatShading: old.flatShading ?? true,
  });
  next.name = old.name || '';
  return next;
}

function classify(material) {
  if (!material || material.isMeshBasicMaterial) return null;
  if (material.name?.includes('bark')) return 'bark';
  if (material.name?.includes('rock')) return 'rock';
  if (material.name?.includes('metal')) return 'metal';

  const c = material.color || new THREE.Color(0.5, 0.5, 0.5);
  const hsl = {};
  c.getHSL(hsl);
  const rough = material.roughness ?? 0.8;
  const metal = material.metalness ?? 0;

  if (hsl.h > 0.48 && hsl.h < 0.62 && rough < 0.42 && hsl.l > 0.42) return 'ice';
  if (metal > 0.16) return 'metal';
  if (hsl.l > 0.72 && rough > 0.88) return 'snow';
  if (hsl.h > 0.035 && hsl.h < 0.13 && hsl.s > 0.12) return 'bark';
  if (hsl.l < 0.34) return 'rock';
  return null;
}

function polish(material, role = classify(material)) {
  if (!material || !role || material.isMeshBasicMaterial) return material;
  if (role === 'snow') return applySurface(material, SURFACES.snow, { roughness: 0.9, metalness: 0 });
  if (role === 'ice') return applySurface(material, SURFACES.ice, { roughness: 0.3, metalness: 0.055 });
  if (role === 'metal') return applySurface(material, SURFACES.metal, {
    roughness: Math.min(material.roughness ?? 0.55, 0.56), metalness: Math.max(material.metalness ?? 0, 0.18),
  });
  if (role === 'bark') return applySurface(material, SURFACES.bark, { roughness: 0.9, metalness: 0 });
  if (role === 'cloth') return applySurface(material, SURFACES.cloth, { roughness: 0.86, metalness: 0 });
  if (role === 'hide') return applySurface(material, SURFACES.hide, { roughness: 0.88, metalness: 0 });
  return applySurface(material, SURFACES.rock, { roughness: 0.88, metalness: 0.005 });
}

function terrainMaterial() {
  const terrain = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
    map: SURFACES.snow.map,
    roughnessMap: SURFACES.snow.roughnessMap,
    normalMap: SURFACES.snow.normalMap,
    normalScale: SURFACES.snow.normalScale.clone(),
    dithering: true,
  });
  terrain.name = 'rc8-terrain';

  terrain.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float surface;\nattribute float lane;\nvarying float vRc8Surface;\nvarying float vP4Lane;\nvarying vec3 vP4World;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRc8Surface = surface;\nvP4Lane = lane;\nvP4World = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRc8Surface;\nvarying vec3 vP4World;')
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nfloat rc8Ice = smoothstep(0.08, 0.92, vRc8Surface);\nroughnessFactor = mix(roughnessFactor, 0.27, rc8Ice);')
      .replace('#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.045, smoothstep(0.08, 0.92, vRc8Surface));')
      // The data-stream reads as a track because the ground says so: a world-
      // space grid etched in light, and two rails burning at the ribbon edges.
      .replace('#include <common>', '#include <common>\nvarying float vP4Lane;')
      .replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec2 p4Cell = vP4World.xz / 6.0;
        vec2 p4F = abs(fract(p4Cell) - 0.5);
        float p4Line = smoothstep(0.44, 0.5, max(p4F.x, p4F.y));
        float p4Rail = smoothstep(0.8, 0.97, vP4Lane);
        totalEmissiveRadiance += vec3(0.05, 0.34, 0.46) * p4Line * 0.55;
        totalEmissiveRadiance += vec3(0.10, 0.62, 0.80) * p4Rail * 1.1;`);
  };
  terrain.customProgramCacheKey = () => 'wordrun-p7-track-ribbon-v1';
  return terrain;
}

function applyPlayerMaterials(actor) {
  if (!actor?.root) return;
  actor.root.traverse((obj) => {
    const m = obj.material;
    if (!m || m.isMeshBasicMaterial) return;
    const hex = m.color?.getHex?.();
    if (m.roughness != null && m.roughness < 0.42) polish(m, 'ice');
    else if (hex === 0x8f3429) polish(m, 'metal');
    else polish(m, 'cloth');
  });
}

function applyBeastMaterials(actor) {
  if (!actor?.root) return;
  actor.root.traverse((obj) => {
    const m = obj.material;
    if (!m || m.isMeshBasicMaterial) return;
    polish(m, (m.roughness ?? 0.9) > 0.89 ? 'hide' : 'rock');
  });
}

function makeContact(scene, radius, opacity) {
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

function attachPlayerContact(scene, playerActor) {
  if (!playerActor || playerActor.__rc8ContactPatched) return null;
  playerActor.__rc8ContactPatched = true;
  const shadow = makeContact(scene, 0.82, 0.12);
  shadow.scale.set(1.15, 0.62, 1);
  const base = playerActor.update.bind(playerActor);
  playerActor.update = function updateRC8Contact(p, slope, dt, beastGap) {
    base(p, slope, dt, beastGap);
    const ground = p.terrain.heightAt(p.x, p.d);
    const air = Math.max(0, p.y - ground);
    shadow.position.set(p.x, ground + 0.035, -p.d);
    shadow.material.opacity = 0.12 * Math.max(0.18, 1 - air / 8);
    const s = 1 + Math.min(0.55, air * 0.045);
    shadow.scale.set(1.15 * s, 0.62 * s, 1);
    shadow.visible = !p.dead || air < 2;
  };
  return shadow;
}

function attachBeastContact(scene, beastActor) {
  if (!beastActor || beastActor.__rc8ContactPatched) return null;
  beastActor.__rc8ContactPatched = true;
  const shadow = makeContact(scene, 2.1, 0.16);
  shadow.scale.set(1.2, 0.72, 1);
  const base = beastActor.update.bind(beastActor);
  beastActor.update = function updateRC8Contact(dt, gap, x, groundY, playerD, killT, ...rest) {
    base(dt, gap, x, groundY, playerD, killT, ...rest);
    shadow.position.set(x, groundY + 0.04, -(playerD - gap));
    shadow.material.opacity = 0.11 + Math.max(0, 1 - gap / 45) * 0.07;
    shadow.visible = beastActor.root.visible;
  };
  return shadow;
}

export function applyMaterialPass(scene, terrainMesh, actors = {}) {
  const terrain = terrainMaterial();
  terrainMesh.material?.dispose?.();
  terrainMesh.material = terrain;
  for (const slot of terrainMesh.slots || []) slot.mesh.material = terrain;

  const converted = new Map();
  scene.traverse((obj) => {
    if (!obj.isMesh && !obj.isInstancedMesh) return;
    const old = obj.material;
    if (!old || old.isMeshBasicMaterial || old === terrain) return;

    let m = old;
    if (old.isMeshLambertMaterial) {
      m = converted.get(old.uuid);
      if (!m) {
        m = toStandard(old);
        converted.set(old.uuid, m);
      }
      obj.material = m;
    }
    if (!actors.playerActor?.root?.getObjectById?.(obj.id) &&
        !actors.beastActor?.root?.getObjectById?.(obj.id)) polish(m);
  });

  applyPlayerMaterials(actors.playerActor);
  const playerContact = attachPlayerContact(scene, actors.playerActor);

  const rim = new THREE.DirectionalLight(0xbfe9ff, 0.34);
  rim.position.set(-35, 28, 25);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xf2f7fa, 0.16);
  fill.position.set(24, 14, -18);
  scene.add(fill);

  const contact = { player: playerContact, beast: null };
  requestAnimationFrame(() => requestAnimationFrame(() => {
    applyBeastMaterials(actors.beastActor);
    contact.beast = attachBeastContact(scene, actors.beastActor);
  }));

  return { terrain, rim, fill, contact, surfaceLibrary: SURFACES };
}

export default applyMaterialPass;
