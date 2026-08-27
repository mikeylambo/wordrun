import fs from 'node:fs';
import TUNING from '../src/TUNING.js';
import { Sim } from '../src/sim/sim.js';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('\nDESCENT — RC7.1 feel & stability verification');
const seed = 1057066883;

function prepAir(sim, yaw, pitch) {
  const p = sim.player;
  p.d = 520;
  p.x = 0;
  p.speed = 20;
  p.airborne = true;
  p.hangtime = 0.72;
  p.yaw = yaw;
  p.pitch = pitch;
  p.spinTotal = Math.PI * 2;
  p.flipTotal = 0;
  p.vy = -6.5;
  p.y = sim.terrain.heightAt(p.x, p.d) + 1.35;
  return p;
}

const assisted = new Sim(seed).start(seed, null, 0);
const ap = prepAir(
  assisted,
  TUNING.AIR.CLEAN_YAW * 1.28,
  TUNING.AIR.CLEAN_PITCH * 1.24
);
for (let i = 0; i < 90 && ap.airborne; i++) assisted.step({ carve: 0, flip: 0, jump: false, boostHeld: false, dragging: false });
check('releasing rotation near the snow can square up an almost-clean landing',
  !!ap.lastLanding?.clean && !!ap.lastLanding?.assisted,
  `clean=${ap.lastLanding?.clean} assisted=${ap.lastLanding?.assisted}`);

const bad = new Sim(seed + 1).start(seed + 1, null, 0);
const bp = prepAir(bad, Math.PI / 2, 0);
for (let i = 0; i < 90 && bp.airborne; i++) bad.step({ carve: 0, flip: 0, jump: false, boostHeld: false, dragging: false });
check('landing assist does not rescue a visibly unfinished quarter-turn',
  !!bp.lastLanding && !bp.lastLanding.clean && !bp.lastLanding.assisted,
  `clean=${bp.lastLanding?.clean} assisted=${bp.lastLanding?.assisted}`);

const feel = fs.readFileSync(new URL('../src/rc7-feel.js', import.meta.url), 'utf8');
check('monster warning presentation is now a literal exclamation mark',
  feel.includes("content:'!'") && feel.includes('#rc5Threat svg{display:none!important}'));
check('ski-track patch removes per-sample Vector3 allocation',
  feel.includes('curL.set(') && feel.includes('curR.set(') && !/actor\._track\s*=\s*function[\s\S]*new THREE\.Vector3/.test(feel));
check('stability patch adapts render resolution inside the existing render call',
  feel.includes('stage.render = function renderRC71') && feel.includes('setPixelRatio(next)'));
check('RC7.1 does not add a second permanent animation frame loop',
  !/function\s+frame\s*\([^)]*\)\s*\{[\s\S]*requestAnimationFrame\(frame\)/.test(feel));

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
