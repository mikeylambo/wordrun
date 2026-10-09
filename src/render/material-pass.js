import * as THREE from 'three';
import { SURFACES, applySurface } from './surface-textures.js';
import TUNING from '../TUNING.js';
import { WET_MASK } from './road-reflection.js';

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
    // RC13.1 — the key art's road: dark stone, faintly wet, so the rails and
    // the lit signs leave a sheen on it.
    roughness: 0.62,
    metalness: 0.12,
    flatShading: true,
    map: SURFACES.snow.map,
    roughnessMap: SURFACES.snow.roughnessMap,
    normalMap: SURFACES.snow.normalMap,
    normalScale: SURFACES.snow.normalScale.clone(),
    dithering: true,
  });
  terrain.name = 'rc8-terrain';

  terrain.onBeforeCompile = (shader) => {
    // Flow (Phase 9): the etched light's brightness is a live uniform fed
    // by the chain — glow × marquee pulse from flow-curve.js.
    shader.uniforms.uP9Flow = terrain.userData.uP9Flow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float surface;\nattribute float lane;\nvarying float vRc8Surface;\nvarying float vP4Lane;\nvarying vec3 vP4World;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRc8Surface = surface;\nvP4Lane = lane;\nvP4World = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRc8Surface;\nvarying vec3 vP4World;')
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nfloat rc8Ice = smoothstep(0.08, 0.92, vRc8Surface);\nroughnessFactor = mix(roughnessFactor, 0.27, rc8Ice);')
      .replace('#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.045, smoothstep(0.08, 0.92, vRc8Surface));')
      // The data-stream reads as a track because the ground says so: a grid
      // etched in light, and two rails burning at the ribbon edges.
      // The grid is drawn in TRACK space, not world space. It used to take
      // both axes from vP4World.xz, which works only while the ribbon runs
      // straight: world-X stripes are not parallel to a rail that is sliding
      // in X through a turn, so they wandered across the ribbon and were cut
      // off by its edge at whatever angle the corner happened to make. That
      // is the "lines don't connect" read — the grid and the rails were in two
      // different coordinate systems and could never meet. The across-axis now
      // comes from the signed lane attribute, so every stripe runs parallel to
      // the rails and every rung ends exactly on one.
      .replace('#include <common>', '#include <common>\nvarying float vP4Lane;')
      .replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float p4Across = vP4Lane * uP4HalfW;
        vec2 p4Cell = vec2(p4Across, vP4World.z) / uP4Cell;
        vec2 p4F = abs(fract(p4Cell) - 0.5);
        // RC13.1: the grid became the SEAMS between stone slabs — a thin, low
        // light that still sweeps under the runner at GRID_CELL_M (it is a
        // speed cue), instead of a TRON lattice louder than the word.
        float p4Line = smoothstep(0.475, 0.5, max(p4F.x, p4F.y));
        // Every slab its own stone: a per-cell shade, so the road reads as
        // laid paving rather than one painted surface.
        float p4Slab = fract(sin(dot(floor(p4Cell), vec2(12.9898, 78.233))) * 43758.5453);
        float p4Rail = smoothstep(0.8, 0.97, abs(vP4Lane));
        // The rail is the EDGE of the etched surface, so the grid ends where
        // the rail begins to burn. Letting it run on into the strip outboard
        // of the rail left every rung crossing its own boundary and hanging
        // off the side of the road, which reads as unfinished however well
        // the lines themselves line up.
        p4Line *= 1.0 - smoothstep(0.74, 0.88, abs(vP4Lane));
        // The etched light drifts through hues down the page — cyan through
        // violet through teal over ~300m — so no stretch of track sits in a
        // single monochrome wash. Red stays the Redline's alone.
        float p4Hue = 0.5 + 0.5 * sin(vP4World.z * 0.021);
        float p4Hue2 = 0.5 + 0.5 * sin(vP4World.z * 0.0093 + 2.1);
        vec3 p4GridCol = mix(vec3(0.05, 0.34, 0.46), vec3(0.30, 0.16, 0.52), p4Hue);
        p4GridCol = mix(p4GridCol, vec3(0.05, 0.44, 0.30), p4Hue2 * 0.55);
        vec3 p4RailCol = mix(vec3(0.10, 0.62, 0.80), vec3(0.52, 0.26, 0.86), p4Hue2);
        // The rail burns toward white-cyan at its core, like the key art's
        // edge light; the seams stay a whisper of the same hue.
        p4RailCol = mix(p4RailCol, vec3(0.62, 0.92, 1.0), 0.45);
        totalEmissiveRadiance += vec3(0.010, 0.018, 0.028) * p4Slab * (1.0 - p4Rail);
        totalEmissiveRadiance += p4GridCol * p4Line * 0.2 * uP9Flow;
        totalEmissiveRadiance += p4RailCol * p4Rail * 1.45 * uP9Flow;
        // Playtest 10/9 — WET ROADS. A rain-slick street smears every light
        // above it into a long broken streak running toward you. Columns at
        // seeded lateral positions, dashed along the road, cool tints only,
        // off the rails, quiet under the runner and gone toward the horizon —
        // plus a faint sheen where the surface turns grazing.
        {
          float wetDist = length(vP4World - cameraPosition);
          float wetFade = smoothstep(5.0, 22.0, wetDist) * (1.0 - smoothstep(110.0, 210.0, wetDist));
          float colW = 1.35;
          float colId = floor(p4Across / colW);
          float h = fract(sin(colId * 91.7 + 3.1) * 43758.5453);
          float inCol = 1.0 - smoothstep(0.08, 0.32, abs(fract(p4Across / colW) - 0.5) * colW);
          float len = 9.0 + h * 22.0;
          float seg = fract(vP4World.z / len + h * 7.0);
          float dash = smoothstep(0.0, 0.2, seg) * (1.0 - smoothstep(0.4, 0.7, seg));
          float shimmer = 0.75 + 0.25 * sin(vP4World.z * 0.9 + h * 40.0);
          vec3 wetCol = mix(vec3(0.62, 0.86, 1.0), vec3(0.30, 0.78, 0.92), step(0.7, h));
          float wet = step(0.45, h) * inCol * dash * shimmer * wetFade * (1.0 - p4Rail);
          totalEmissiveRadiance += wetCol * wet * uWetStreaks;
          vec3 wetV = normalize(cameraPosition - vP4World);
          float graze = pow(1.0 - clamp(abs(wetV.y), 0.0, 1.0), 4.0);
          totalEmissiveRadiance += vec3(0.30, 0.55, 0.75) * graze * uWetSheen * (1.0 - p4Rail);
        }`)
      // The wet MIRROR's mask (render/road-reflection.js): the road writes
      // 1 − wet weight into alpha — off the rails, quiet under the runner,
      // gone toward the horizon. Every other surface writes 1.
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          float wmD = length(vP4World - cameraPosition);
          float wm = smoothstep(4.0, 14.0, wmD) * (1.0 - smoothstep(90.0, 200.0, wmD));
          wm *= 1.0 - smoothstep(0.74, 0.86, abs(vP4Lane));
          gl_FragColor.a = 1.0 - wm * uWetMask;
        }`)
      .replace('#include <common>\nvarying float vP4Lane;',
        '#include <common>\nuniform float uP9Flow;\nuniform float uP4HalfW;\nuniform float uP4Cell;\nuniform float uWetStreaks;\nuniform float uWetSheen;\nuniform float uWetMask;\nvarying float vP4Lane;');
    shader.uniforms.uWetStreaks = { value: TUNING.WET.STREAKS };
    shader.uniforms.uWetSheen = { value: TUNING.WET.SHEEN };
    shader.uniforms.uWetMask = WET_MASK;
    shader.uniforms.uP4HalfW = terrain.userData.uP4HalfW;
    shader.uniforms.uP4Cell = terrain.userData.uP4Cell;
  };
  terrain.userData.uP9Flow = { value: 1 };
  terrain.userData.uP4HalfW = { value: TUNING.RUN.TRACK_HALF_W };
  // RC8.3: the grid cell IS the ground frequency — how often a rung sweeps
  // under the runner — so it is a speed cue and lives with the others in
  // TUNING.CUES rather than as a 6.0 buried in a shader string.
  terrain.userData.uP4Cell = { value: TUNING.CUES.GRID_CELL_M };
  terrain.customProgramCacheKey = () => 'dictiondash-rc14-wet-mirror-road';
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

  const rim = new THREE.DirectionalLight(0xbfe9ff, 0.34);
  rim.position.set(-35, 28, 25);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xf2f7fa, 0.16);
  fill.position.set(24, 14, -18);
  scene.add(fill);

  // The contact shadows are the actors' own now (render/contact-shadow.js);
  // this pass used to bolt them on by wrapping each actor's update().
  requestAnimationFrame(() => requestAnimationFrame(() => {
    applyBeastMaterials(actors.beastActor);
  }));

  return { terrain, rim, fill, surfaceLibrary: SURFACES };
}

export default applyMaterialPass;
