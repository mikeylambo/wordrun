/**
 * Runner model build — turns the rigged character export into the game asset.
 *
 *   npm run build:runner -- <rigged.glb> [more-clips.glb ...]
 *
 * The first file carries the mesh, the skeleton and (usually) the run clip.
 * Every further file contributes only its ANIMATIONS, retargeted by bone name
 * onto the first file's skeleton — so a new clip exported from the same rig
 * (idle, a victory lap, a slow-down) is one more argument, not a new pipeline.
 *
 * What ships is a light construct, not a textured mannequin: the figure is
 * drawn by a shader in src/render/actors.js from normals alone, so textures,
 * UVs and the PBR material are stripped. What remains — positions, normals,
 * skin weights, bones and clips — is quantized and meshopt-compressed
 * (EXT_meshopt_compression; three's decoder ships with the bundle, no
 * network). Output: src/render/runner.glb, which actors.js loads via
 * `new URL('./runner.glb', import.meta.url)` so Vite fingerprints it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/render/runner.glb');
// Budget: the procedural runner cost nothing on the wire; its replacement may
// not cost the load profile anything a player can feel.
const MAX_BYTES = 256 * 1024;

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error('usage: npm run build:runner -- <rigged.glb> [clips.glb ...]');
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// "Armature|RunFast|baselayer" → "RunFast"
const clipName = (raw) => (raw.split('|').find((s, i, a) => a.length < 3 || i === 1) || raw);

const doc = await io.read(inputs[0]);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const nodesByName = new Map(root.listNodes().map((n) => [n.getName(), n]));

for (const a of root.listAnimations()) a.setName(clipName(a.getName()));

// Extra clip files: animations only, re-bound onto this skeleton by bone name.
for (const file of inputs.slice(1)) {
  const src = await io.read(file);
  for (const sa of src.getRoot().listAnimations()) {
    const anim = doc.createAnimation(clipName(sa.getName()));
    let bound = 0;
    for (const ch of sa.listChannels()) {
      const target = nodesByName.get(ch.getTargetNode()?.getName());
      if (!target) continue;
      const ss = ch.getSampler();
      const copy = (acc) => doc.createAccessor()
        .setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buffer);
      const sampler = doc.createAnimationSampler()
        .setInterpolation(ss.getInterpolation())
        .setInput(copy(ss.getInput())).setOutput(copy(ss.getOutput()));
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel()
        .setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
      bound++;
    }
    console.log(`  + ${anim.getName()} from ${path.basename(file)} (${bound} channels)`);
  }
}

// Strip everything the light shader does not read.
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const sem of prim.listSemantics()) {
      if (!['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0'].includes(sem)) prim.setAttribute(sem, null);
    }
    prim.setMaterial(null);
  }
}
for (const t of root.listTextures()) t.dispose();
for (const m of root.listMaterials()) m.dispose();
for (const e of doc.getRoot().listExtensionsUsed()) e.dispose();

// Scale tracks on a humanoid are constant 1 — pure payload.
for (const a of root.listAnimations()) {
  for (const ch of a.listChannels()) {
    if (ch.getTargetPath() !== 'scale') continue;
    const out = ch.getSampler().getOutput().getArray();
    if (out.every((v) => Math.abs(v - 1) < 1e-3)) { ch.getSampler().dispose(); ch.dispose(); }
  }
}

await doc.transform(
  resample({ tolerance: 1e-4 }),
  dedup(),
  prune(),
  quantize({ quantizePosition: 14, quantizeNormal: 10 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

const bytes = await io.writeBinary(doc);
fs.writeFileSync(OUT, bytes);

const verts = root.listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getCount();
console.log(`\nrunner.glb — ${(bytes.byteLength / 1024).toFixed(1)} KB, ${verts} vertices, `
  + `${root.listSkins()[0]?.listJoints().length ?? 0} bones`);
for (const a of root.listAnimations()) {
  const dur = Math.max(...a.listSamplers().map((s) => s.getInput().getMax([])[0]));
  console.log(`  clip ${a.getName()} — ${dur.toFixed(3)} s, ${a.listChannels().length} channels`);
}
if (bytes.byteLength > MAX_BYTES) {
  console.error(`FAIL  runner.glb is over its ${MAX_BYTES / 1024} KB budget`);
  process.exit(1);
}
