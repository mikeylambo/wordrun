import fs from 'node:fs';

// Load the same prototype stack in the same order as the game: Sim applies RC6
// authored air first, then RC9.5/9.8 world interaction refines named landmarks.
await import('../src/sim/sim.js');
await import('../src/rc95-world.js');
const { default: TUNING } = await import('../src/TUNING.js');
const { Terrain } = await import('../src/sim/terrain.js');
const { Player } = await import('../src/sim/player.js');
const { BellField } = await import('../src/design/bells.js');
const { SecondBeast } = await import('../src/sim/second-beast.js');

let pass = 0;
let fail = 0;
const check = (ok, label, detail = '') => {
  if (ok) { pass++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

console.log('\nDESCENT — RC9.8 finish-polish verification');

const seed = 1057066883;
const terrain = new Terrain(seed);
const chunkLen = TUNING.TERRAIN.CHUNK_LEN;

function cliffsAround(d, radius) {
  const lo = Math.floor((d - radius) / chunkLen) - 1;
  const hi = Math.floor((d + radius) / chunkLen) + 1;
  const out = [];
  for (let ci = lo; ci <= hi; ci++) {
    for (const f of terrain.heightsOf(ci)) {
      if (f.type === 'cliff' && Math.abs(f.d - d) <= radius) out.push(f);
    }
  }
  return out;
}

const bridge = cliffsAround(2334, 4).find((f) => f.id === 'bridge-super-launch');
check(!!bridge && bridge.drop === 12.6 && bridge.lip === 3.15,
  'Bridge Big Air is deliberately trimmed but still authored',
  bridge ? `drop ${bridge.drop}, lip ${bridge.lip}` : 'missing');

const throatCliffs = cliffsAround(3020, 185);
const throat = throatCliffs.find((f) => f.id === 'throat-entry-kicker');
check(!!throat && throat.d === 2918 && throat.drop === 5.8 && throat.lip === 1.55,
  'THE THROAT gets its own lower entry kicker',
  throat ? `d ${throat.d}, drop ${throat.drop}` : 'missing');
check(throatCliffs.length === 1 && throatCliffs[0]?.id === 'throat-entry-kicker',
  'generic Big-Air cliffs cannot stack inside THE THROAT',
  throatCliffs.map((f) => `${f.id || 'random'}@${Math.round(f.d)}`).join(', ') || 'none');

// The tunnel collider is an annulus matching the visible torus. Isolate one hoop
// so random terrain solids cannot make this geometry test seed-dependent.
const tunnelTerrain = new Terrain(seed + 1);
const tunnelD = 5580 - 3.5 * 7;
const ring = tunnelTerrain.collidersNear(tunnelD, 2, 2).find((c) => c.type === 'ring');
check(!!ring && ring.ringR === 16.8 && ring.centerH === 9.5,
  'THE TUNNEL exposes ring-shaped collision geometry');

if (ring) {
  const onlyRing = () => [ring];
  const openingPlayer = new Player(tunnelTerrain);
  openingPlayer.d = ring.d;
  openingPlayer.x = ring.x;
  openingPlayer.y = tunnelTerrain.heightAt(ring.x, ring.d) + ring.centerH;
  openingPlayer.airborne = true;
  openingPlayer._hitCooldown = 0;
  const originalNear = tunnelTerrain.collidersNear.bind(tunnelTerrain);
  tunnelTerrain.collidersNear = onlyRing;
  const beforeOpen = openingPlayer.obstaclesHit;
  openingPlayer._collide([]);
  check(openingPlayer.obstaclesHit === beforeOpen,
    'the centre of THE TUNNEL remains an honest fly-through opening');

  const ringPlayer = new Player(tunnelTerrain);
  ringPlayer.d = ring.d;
  ringPlayer.x = ring.x + ring.ringR;
  ringPlayer.y = tunnelTerrain.heightAt(ring.x, ring.d) + ring.centerH;
  ringPlayer.airborne = true;
  ringPlayer._hitCooldown = 0;
  const beforeRing = ringPlayer.obstaclesHit;
  ringPlayer._collide([]);
  check(ringPlayer.obstaclesHit === beforeRing + 1,
    'flying through visible tunnel ice now produces a physical hit');
  tunnelTerrain.collidersNear = originalNear;
}

// BellField has no terminal index. Verify the player-facing route still exists
// well after the 13K report and into the final approach.
const bellTerrain = new Terrain(seed + 2);
const bells = new BellField(seed + 2, bellTerrain);
for (const d of [13000, 25000, 45000]) {
  const visible = bells.around(d, 35, 360);
  check(visible.length > 0, `bell routes continue past ${Math.round(d / 1000)}K`, `${visible.length} nearby`);
}

// Four direct spawns on one deterministic director must cover the choreography
// vocabulary once before repeating it. Edge-position logic should always enter
// from the opposite side of a skier committed to the left margin.
const frostTerrain = new Terrain(seed + 3);
const frost = new SecondBeast(seed + 3);
const frostPlayer = {
  d: 6200, x: -10, heading: 0.04,
  y: frostTerrain.heightAt(-10, 6200), speed: 34, airborne: false,
};
const frostMain = { mode: 'hunt', hunts: 1, modeDuration: 30, modeT: 8, gap: 45 };
const seen = [];
let allOpposite = true;
let uphillState = null;
for (let i = 0; i < 4; i++) {
  frostMain.hunts = i + 1;
  frost._spawn(frostPlayer, frostTerrain, frostMain);
  seen.push(frost.kind);
  allOpposite &&= frost.side === 1;
  if (frost.kind === 'uphill') {
    uphillState = {
      startX: frost.startX, endX: frost.endX,
      startD: frost.startD, endD: frost.endD,
      chargeTime: frost.chargeTime, side: frost.side,
    };
  }
  frost.active = false;
  frost.phase = 'idle';
}
check(new Set(seen).size === 4 && ['cross', 'vault', 'downhill', 'uphill'].every((k) => seen.includes(k)),
  'the first four Frost Beast appearances cover four distinct patterns', seen.join(', '));
check(allOpposite, 'Frost Beast enters from the opposite side of an edge-hugging skier');

if (uphillState) {
  Object.assign(frost, uphillState, {
    active: true, kind: 'uphill', phase: 'charge', phaseT: 0,
    x: uphillState.startX, d: uphillState.startD, lift: 0,
    killed: false,
  });
  // Put the test skier far aside so this step measures facing, not contact.
  const spectator = { ...frostPlayer, x: 20, y: frostTerrain.heightAt(20, frostPlayer.d) };
  frost.step(TUNING.SIM.DT, spectator, frostMain, frostTerrain);
  check(Math.cos(frost.heading) < 0,
    'the uphill/camera rush faces against downhill travel instead of backwards',
    `heading ${frost.heading.toFixed(3)}`);
}

// Misses continue into bounds/fog instead of sinking beneath the surface.
frost.active = true;
frost.killed = false;
frost.kind = 'cross';
frost.phase = 'exit';
frost.phaseT = 0;
frost.lift = 0;
frost.exitXDir = 1;
frost.exitDDir = 1;
frost.x = 0;
frost.d = frostPlayer.d + 30;
let sank = false;
for (let i = 0; i < 120 && frost.active; i++) {
  frost.step(TUNING.SIM.DT, frostPlayer, frostMain, frostTerrain);
  if (frost.lift < -0.001) sank = true;
}
check(!sank, 'Frost Beast exits never dissolve downward into the snow');

const worldSource = fs.readFileSync(new URL('../src/rc95-world.js', import.meta.url), 'utf8');
const secondSource = fs.readFileSync(new URL('../src/sim/second-beast.js', import.meta.url), 'utf8');
const audioBridge = fs.readFileSync(new URL('../src/rc9-audio.js', import.meta.url), 'utf8');
check(!worldSource.includes('requestAnimationFrame'), 'landmark polish adds no animation loop');
check(!secondSource.includes('requestAnimationFrame'), 'Frost Beast choreography stays headless and deterministic');
check(audioBridge.includes('bellNightReadability: true') && audioBridge.includes('emissiveIntensity = 0.52'),
  'deep-night bell visibility has a restrained material floor');

// Deployment stamp: no runtime effect; used only to retry RC9.8 preview hosting.
console.log(`\nRC9.8 finish-polish gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
