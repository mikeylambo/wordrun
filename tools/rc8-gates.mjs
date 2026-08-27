import fs from 'node:fs';
import * as THREE from 'three';
import TUNING from '../src/TUNING.js';
import { Terrain } from '../src/sim/terrain.js';
import { TerrainMesh } from '../src/render/terrain-mesh.js';
import { Props } from '../src/render/props.js';
import { SURFACES } from '../src/render/surface-textures.js';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nDESCENT — RC8 visual/material foundation verification');

const seed = 1057066883;
const terrain = new Terrain(seed);
const scene = new THREE.Scene();
const tm = new TerrainMesh(scene, terrain);
tm.update(0);
tm.flush();
const first = tm.slots.find((s) => s.mesh.visible)?.geo;
check('terrain carries reusable UVs for shared micro-surfaces', !!first?.attributes?.uv,
  `${first?.attributes?.uv?.count || 0} UV vertices`);
check('terrain carries a dedicated ice/snow surface channel', !!first?.attributes?.surface,
  `${first?.attributes?.surface?.count || 0} surface samples`);

let maxIce = 0;
for (let d = 0; d < 5000; d += 180) {
  tm.update(d);
  tm.flush();
  for (const slot of tm.slots) {
    if (!slot.mesh.visible) continue;
    const a = slot.geo.attributes.surface.array;
    for (let i = 0; i < a.length; i++) maxIce = Math.max(maxIce, a[i]);
  }
}
check('ice regions actually populate the surface-response channel', maxIce > 0.5, `max ice weight ${maxIce.toFixed(2)}`);

const required = ['snow', 'rock', 'bark', 'cloth', 'hide', 'metal', 'ice'];
check('shared surface library covers every RC8 material family', required.every((k) => SURFACES[k]), required.join(', '));
check('surface library uses tiny in-memory textures rather than downloaded art',
  required.every((k) => SURFACES[k].map?.image?.width === 64 && SURFACES[k].map?.image?.height === 64),
  '64×64 procedural maps');

const props = new Props(scene, terrain);
check('trees/rocks/gates are final Standard materials, not post-converted Lambert references',
  Object.values(props.mats).every((m) => m.isMeshStandardMaterial),
  Object.values(props.mats).map((m) => m.type).join(', '));
check('prop materials keep shared normal and roughness detail',
  Object.values(props.mats).every((m) => m.normalMap && m.roughnessMap));

const materialSource = fs.readFileSync(new URL('../src/render/material-pass.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const sceneSource = fs.readFileSync(new URL('../src/render/scene.js', import.meta.url), 'utf8');
check('RC8 remains post-process free and shadow-map free',
  !/EffectComposer|SSAOPass|UnrealBloomPass|shadowMap\.enabled\s*=\s*true/.test(materialSource + sceneSource));
check('final classic beast is polished after the presentation swap',
  /requestAnimationFrame\(\(\) => requestAnimationFrame/.test(materialSource) && /applyBeastMaterials/.test(materialSource));
check('main only binds the actor-aware material pass without changing the game-loop API',
  main.includes('applyMaterialPass(stage.scene, terrainMesh, { playerActor, beastActor })') &&
  main.includes('Storage.bumpRuns(SEED)') && main.includes('return sim.state();'));

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
