/**
 * The runner model's loading kit — split out of actors.js ONLY so it can be
 * a dynamic import: glTF parsing, the meshopt decoder and the skinned-mesh
 * cloner are ~35 KB gzipped that the first frame does not need. actors.js
 * imports this on demand and owns everything done with it.
 */
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
export { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
