import * as THREE from 'three';
import { LANDMARKS, DISTANCE_MARKERS } from '../design/landmarks.js';

const mat = (color, roughness = 0.82, metalness = 0) => new THREE.MeshStandardMaterial({
  color, roughness, metalness, flatShading: true,
});

const SNOW = mat(0xdde8ee, 0.96);
const ROCK = mat(0x263541, 0.93);
const DARK = mat(0x11181e, 0.9);
const WOOD = mat(0x5b4838, 0.88);
const ICE = mat(0x9ddff0, 0.28, 0.06);
const METAL = mat(0x667784, 0.48, 0.32);
const SIGN = mat(0xc94c32, 0.7);
const BONE = mat(0xc8c1b4, 0.88);
const GLASS = mat(0x101820, 0.22, 0.22);
const PALE = mat(0xf1f1ec, 0.72);
const WARM = mat(0xd79b6e, 0.64, 0.04);

function mesh(geo, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

function buildHouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(7.5, 3.4, 5.2), WOOD, -11, 2.2, 0));
  const roof = mesh(new THREE.ConeGeometry(5.2, 2.4, 4), DARK, -11, 5.0, 0, 1, 1, 0.82);
  roof.rotation.y = Math.PI * 0.25;
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), ROCK, -8.7, 6.0, 0.4));
  for (const x of [-15.5, -6.5]) g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), METAL, x, 4, -2.4));
  return g;
}

function buildNeedles() {
  const g = new THREE.Group();
  const xs = [-18, -13.5, 17.5];
  const hs = [19, 14, 22];
  xs.forEach((x, i) => {
    const n = mesh(new THREE.ConeGeometry(2.4 + i * 0.3, hs[i], 5), ROCK, x, hs[i] * 0.5 - 0.3, (i - 1) * 5);
    n.rotation.z = (i - 1) * 0.05;
    g.add(n);
  });
  return g;
}

function buildDrop() {
  const g = new THREE.Group();
  for (const x of [-18.8, 18.8]) g.add(mesh(new THREE.BoxGeometry(2.5, 12, 11), ROCK, x, 5.1, 2));
  const arch = mesh(new THREE.BoxGeometry(35, 1.1, 1.1), METAL, 0, 10.7, 1);
  arch.rotation.z = -0.03;
  g.add(arch);
  const pennant = mesh(new THREE.ConeGeometry(1.6, 3.5, 3), SIGN, 0, 8.9, 1);
  pennant.rotation.z = Math.PI;
  g.add(pennant);
  return g;
}

function buildHalfpipe() {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = side * (17.4 + i * 0.65);
      const h = 2.4 + i * 1.35;
      const wall = mesh(new THREE.BoxGeometry(1.15, h, 18), ICE, x, h * 0.5 - 0.1, (i - 2.5) * 0.2);
      wall.rotation.z = side * -0.08;
      g.add(wall);
    }
  }
  return g;
}

function buildBridge() {
  const g = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(42, 1.0, 6), METAL, 0, 8.8, 0);
  deck.rotation.z = 0.025;
  g.add(deck);
  for (const x of [-19, 19]) g.add(mesh(new THREE.BoxGeometry(1.3, 12, 1.3), ROCK, x, 3.2, 0));
  for (let i = -4; i <= 4; i++) g.add(mesh(new THREE.BoxGeometry(0.12, 3.0, 0.12), DARK, i * 4.5, 6.8, 0));
  return g;
}

function ribTunnel(material = ROCK, count = 7, radius = 18.5) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const z = (i - (count - 1) / 2) * 7;
    const left = mesh(new THREE.CylinderGeometry(0.8, 1.35, 18, 6), material, -radius, 6.5, z);
    left.rotation.z = -0.28;
    const right = left.clone();
    right.position.x = radius;
    right.rotation.z = 0.28;
    g.add(left, right);
    const rib = mesh(new THREE.TorusGeometry(radius, 0.65, 5, 18, Math.PI), material, 0, 13.3, z);
    rib.rotation.z = Math.PI;
    rib.rotation.x = Math.PI * 0.5;
    g.add(rib);
  }
  return g;
}

function buildThroat() { return ribTunnel(ROCK, 7, 18.5); }

function buildTeeth() {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (10.5 + (i % 3) * 3.2);
    const h = 8 + (i % 4) * 3.6;
    const tooth = mesh(new THREE.ConeGeometry(1.9, h, 4), PALE, x, h * 0.5 - 0.2, (i - 4) * 5.3);
    tooth.rotation.z = side * 0.14;
    g.add(tooth);
  }
  return g;
}

function buildRamp() {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const tower = mesh(new THREE.BoxGeometry(2.1, 15, 2.1), METAL, side * 17, 6.5, 2);
    tower.rotation.z = side * -0.08;
    g.add(tower);
  }
  g.add(mesh(new THREE.BoxGeometry(35, 1.1, 2.2), METAL, 0, 13.3, 2));
  const wing = mesh(new THREE.BoxGeometry(13, 1.0, 9), SNOW, -13, 3.4, -4);
  wing.rotation.x = -0.28;
  wing.rotation.z = -0.05;
  g.add(wing);
  return g;
}

function buildTunnel() {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const ring = mesh(new THREE.TorusGeometry(16.8, 0.72, 6, 22), ICE, 0, 9.5, (i - 3.5) * 7);
    ring.rotation.x = Math.PI * 0.5;
    g.add(ring);
  }
  return g;
}

function buildLift() {
  const g = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const x = i % 2 ? -15 : 15;
    const z = i * 12;
    g.add(mesh(new THREE.CylinderGeometry(0.42, 0.65, 13, 6), METAL, x, 5.8, z));
    g.add(mesh(new THREE.BoxGeometry(7.5, 0.5, 0.5), DARK, x, 11.6, z));
    const chair = mesh(new THREE.BoxGeometry(2.5, 0.25, 1.1), SIGN, x + (i % 2 ? 3 : -3), 8.0, z + 3);
    chair.rotation.z = i * 0.05;
    g.add(chair);
  }
  return g;
}

function buildRibcage() { return ribTunnel(BONE, 10, 19.5); }

function buildWhiteGate() {
  const g = new THREE.Group();
  for (const x of [-14.5, 14.5]) {
    const p = mesh(new THREE.BoxGeometry(3.2, 20, 3.2), PALE, x, 8.8, 0);
    p.rotation.z = Math.sign(x) * 0.05;
    g.add(p);
  }
  g.add(mesh(new THREE.BoxGeometry(31, 2.0, 3.2), PALE, 0, 17.4, 0));
  return g;
}

function buildWall() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(17, 24, 5), ROCK, -13.5, 10.2, 0));
  g.add(mesh(new THREE.BoxGeometry(17, 24, 5), ROCK, 13.5, 10.2, 0));
  for (const side of [-1, 1]) {
    const marker = mesh(new THREE.ConeGeometry(1.1, 6, 4), SIGN, side * 4.3, 5.0, -3);
    marker.rotation.z = side * 0.18;
    g.add(marker);
  }
  return g;
}

function buildShards() {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (8.5 + (i % 4) * 3.3);
    const h = 5 + (i % 5) * 3.1;
    const shard = mesh(new THREE.ConeGeometry(1.3 + (i % 3) * 0.4, h, 3), GLASS, x, h * 0.5 - 0.3, (i - 5.5) * 4.5);
    shard.rotation.z = side * (0.08 + (i % 3) * 0.04);
    g.add(shard);
  }
  return g;
}

function buildLastLift() {
  const g = buildLift();
  const fallen = mesh(new THREE.CylinderGeometry(0.5, 0.75, 22, 6), METAL, 0, 3.0, 2);
  fallen.rotation.z = 1.22;
  g.add(fallen);
  return g;
}

function buildAfterlight() {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(15.5, 1.25, 8, 28), WARM, 0, 11.5, 0);
  ring.rotation.x = Math.PI * 0.5;
  g.add(ring);
  for (const x of [-17.5, 17.5]) g.add(mesh(new THREE.CylinderGeometry(0.8, 1.2, 18, 6), PALE, x, 7.0, 0));
  return g;
}

function buildBellTower() {
  const g = new THREE.Group();
  for (const x of [-15, 15]) g.add(mesh(new THREE.BoxGeometry(2.2, 20, 2.2), ROCK, x, 9, 0));
  g.add(mesh(new THREE.BoxGeometry(32, 1.5, 2.4), DARK, 0, 18.0, 0));
  const bell = mesh(new THREE.CylinderGeometry(2.2, 4.0, 4.8, 8), WARM, 0, 13.7, 0);
  bell.rotation.z = 0.08;
  g.add(bell);
  g.add(mesh(new THREE.SphereGeometry(0.7, 8, 6), DARK, 0.2, 10.8, 0));
  return g;
}

function buildMouth() {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const jaw = mesh(new THREE.BoxGeometry(8.5, 17, 8), DARK, side * 16, 7.2, 0);
    jaw.rotation.z = side * -0.12;
    g.add(jaw);
  }
  for (let i = -4; i <= 4; i++) {
    const tooth = mesh(new THREE.ConeGeometry(1.3, 7.5, 4), PALE, i * 3.3, 12.5, -1);
    tooth.rotation.z = Math.PI;
    g.add(tooth);
  }
  return g;
}

function buildSunkenLodge() {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(15, 5.5, 10), WOOD, 8, 0.7, 0);
  body.rotation.z = -0.16;
  g.add(body);
  const roof = mesh(new THREE.ConeGeometry(9.5, 4.0, 4), DARK, 7.3, 4.4, 0, 1, 1, 0.8);
  roof.rotation.y = Math.PI * 0.25;
  roof.rotation.z = -0.16;
  g.add(roof);
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.5, 11, 6), METAL, -12, 3.4, 1));
  return g;
}

function buildMoonshot() {
  const g = buildRamp();
  g.scale.set(1.25, 1.35, 1.18);
  const moon = mesh(new THREE.TorusGeometry(5.2, 0.75, 6, 20), PALE, 0, 20, -2);
  moon.rotation.x = Math.PI * 0.5;
  g.add(moon);
  return g;
}

function markerTexture(metres) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const g = canvas.getContext('2d');
  g.fillStyle = '#11181e';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#c94c32';
  g.fillRect(0, 0, 18, canvas.height);
  g.fillStyle = '#f3f6f7';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 96px system-ui, sans-serif';
  g.fillText(`${Math.round(metres / 1000)} KM`, 270, 98);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildDistanceMarker(metres) {
  const g = new THREE.Group();
  const tex = markerTexture(metres);
  const boardMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const board = mesh(new THREE.PlaneGeometry(7.2, 2.7), boardMat, -13.0, 5.7, 0);
  g.add(board);
  g.add(mesh(new THREE.BoxGeometry(0.28, 6.8, 0.28), METAL, -16.0, 2.4, 0));
  g.add(mesh(new THREE.BoxGeometry(0.28, 6.8, 0.28), METAL, -10.0, 2.4, 0));
  return g;
}

const BUILDERS = {
  house: buildHouse,
  needles: buildNeedles,
  drop: buildDrop,
  halfpipe: buildHalfpipe,
  bridge: buildBridge,
  throat: buildThroat,
  teeth: buildTeeth,
  ramp: buildRamp,
  tunnel: buildTunnel,
  lift: buildLift,
  ribcage: buildRibcage,
  whitegate: buildWhiteGate,
  wall: buildWall,
  shards: buildShards,
  lastlift: buildLastLift,
  afterlight: buildAfterlight,
  belltower: buildBellTower,
  mouth: buildMouth,
  sunkenlodge: buildSunkenLodge,
  moonshot: buildMoonshot,
};

export class Landmarks {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.entries = [];
    this.markers = [];

    for (const def of LANDMARKS) {
      const builder = BUILDERS[def.kind];
      if (!builder) continue;
      const group = builder();
      group.visible = false;
      group.userData.landmark = def.id;
      scene.add(group);
      this.entries.push({ def, group, laidOut: false });
    }

    for (const d of DISTANCE_MARKERS) {
      const group = buildDistanceMarker(d);
      group.visible = false;
      scene.add(group);
      this.markers.push({ d, group, laidOut: false });
    }
  }

  _layout(entry) {
    const { def, group } = entry;
    const y = this.terrain.heightAt(0, def.d);
    group.position.set(0, y, -def.d);
    entry.laidOut = true;
  }

  _layoutMarker(entry) {
    const y = this.terrain.heightAt(-13, entry.d);
    entry.group.position.set(0, y, -entry.d);
    entry.laidOut = true;
  }

  reset() {
    for (const entry of this.entries) {
      entry.laidOut = false;
      entry.group.visible = false;
    }
    for (const entry of this.markers) {
      entry.laidOut = false;
      entry.group.visible = false;
    }
  }

  update(playerD) {
    for (const entry of this.entries) {
      if (!entry.laidOut) this._layout(entry);
      const delta = entry.def.d - playerD;
      entry.group.visible = delta > -260 && delta < 900;
    }
    for (const entry of this.markers) {
      if (!entry.laidOut) this._layoutMarker(entry);
      const delta = entry.d - playerD;
      entry.group.visible = delta > -180 && delta < 680;
    }
  }
}

export default Landmarks;
