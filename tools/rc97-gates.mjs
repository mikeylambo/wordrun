import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const rules = read('src/design/endgame.js');
const runtime = read('src/rc97-endgame.js');
const sky = read('src/render/endgame-sky.js');
const final = read('src/v1-finalize.js');
const scene = read('src/render/scene.js');
const art = read('src/render/art-direction.js');
const index = read('index.html');

let pass = 0;
let fail = 0;
const check = (ok, label) => {
  if (ok) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.error(`FAIL ${label}`); }
};

check(rules.includes('ESCAPE_DISTANCE: 30000') && rules.includes('GLORY_DISTANCE: 50000') &&
  rules.includes('HALO_DISTANCE: 75000') && rules.includes('CROWN_DISTANCE: 100000'),
  'endgame has canonical 30K escape and 50K/75K/100K Overrun prestige');
check(rules.includes('EMPTY_START: 23200') && rules.includes('FOREST_START: 25500') &&
  rules.includes('FINAL_APPROACH: 28500') && rules.includes('BREAK_D: 29140'),
  'final approach is authored as Empty, Last Forest and The Break');
check(rules.includes('hash01') && !rules.includes('Math.random'),
  'deep geography composition remains deterministic per daily seed');
check(!rules.includes('requestAnimationFrame'), 'endgame terrain rules add no render loop');

check(runtime.includes("player.d >= ENDGAME.ESCAPE_DISTANCE") && runtime.includes("t: 'escape'"),
  'first deterministic canonical-distance crossing creates a real escape state');
check(runtime.includes('sim.beastStopD = player.d - this.gap') && runtime.includes('player.d - stopD'),
  'main beast stops in world space while player gap grows after escape');
check(runtime.includes('this.mode = CHASE_MODE.RELIEF') && runtime.includes('this.lunge = LUNGE.IDLE'),
  'escape neutralizes Hunt and lunge behavior instead of despawning the beast');
check(runtime.includes('SecondBeast.prototype.step') && runtime.includes("this.phase = 'idle'") && runtime.includes('sim?.escaped'),
  'frost beast withdraws permanently from the earned postgame');
check(runtime.includes("this.titleHint.textContent = 'HOW FAR CAN YOU GO?'") && runtime.includes('sim?.distance >= 15600'),
  'runtime keeps home screen mystery-first and late lighting unannounced');
check(!runtime.includes('requestAnimationFrame'), 'escape/gameplay patch adds no animation loop');

check(art.includes("id: 'high-night', name: 'HIGH NIGHT', start: 25000") &&
  art.includes("id: 'false-dawn', name: 'FALSE DAWN', start: 28000") &&
  art.includes("id: 'first-light', name: 'FIRST LIGHT', start: 29200") &&
  art.includes("id: 'dawn', name: 'DAWN', start: 30000"),
  'late palette resolves night -> false dawn -> first light -> dawn by 30K');
check(art.includes("id: 'morning', name: 'MORNING', start: 31500") &&
  art.includes("id: 'halo'") && art.includes("id: 'crown'"),
  'postgame palette opens into morning and retains deep prestige states');
check((art.match(/announce: false/g) || []).length >= 9,
  'deep visual progression is discovered rather than announced as game zones');
check(art.includes('nextStart >= 13200') && art.includes('Math.max(transition, 760)'),
  'late color transitions happen over long distance rather than hard thresholds');

check(scene.includes("import '../rc97-endgame.js'") && scene.includes("import { EndgameSky }"),
  'endgame rules and sky are loaded in the existing Stage path');
check(scene.includes('if (this.endgameSky.update(distance, x, y, z)) return'),
  'late lighting runs through existing Stage.followLight path');
check(scene.includes('TUNING.CAMERA.FOV, 1, 0.5, 420'),
  'deep morning receives enough camera far plane for expanded visibility');

check(sky.includes('for (let i = 0; i < 520; i++)') && sky.includes("'rc97Horizon'"),
  'high night has a real starfield and horizon-light presentation');
check(final.includes('v1Weather') && final.includes('whiteout'),
  'V1 late weather remains deterministic while keeping the finale readable');
check(sky.includes('TorusGeometry(7.4') && sky.includes('sundogL') && sky.includes('sundogR'),
  'prestige presentation still has environmental halo/parhelion treatment');
check(sky.includes('YOU MADE IT DOWN.') && sky.includes('FINISH RUN') && sky.includes('KEEP GOING') &&
  final.includes("distanceLabel.textContent !== '30 KM'"),
  '30K has a true ending choice rather than only a score threshold');
check(sky.includes('performance.now() - this.escapeSeenAt >= 3600') && sky.includes('globalThis.__AUDIO?.suspend?.()'),
  'escape gets a silent coast before the ending card');
check(sky.includes('this.choiceSpeed = sim.player.speed') && sky.includes('Math.max(14, this.choiceSpeed || 14)'),
  'ending choice freezes cleanly and KEEP GOING restores the run');
check(sky.includes('this.overrun = true') && sky.includes('distance - this.lastSavedDistance >= 250'),
  'Overrun remains a persistent distance score attack after canon escape');
check(!sky.includes('requestAnimationFrame') && !final.includes('requestAnimationFrame'),
  'sky/final ending presentation adds no second animation loop');
check(index.includes('HOW FAR CAN YOU GO?') && !index.includes('IT ALWAYS CATCHES YOU.'),
  'native home screen keeps the beast secret before first paint');

console.log(`\nRC9.7/V1 endgame gates: ${pass} pass / ${fail} fail`);
if (fail) process.exit(1);
