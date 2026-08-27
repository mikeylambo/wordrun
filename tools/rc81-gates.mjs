import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const pause = read('src/ui/pause.js');
const onboarding = read('src/ui/onboarding.js');
const uiPatch = read('src/rc81-ui.js');
const props = read('src/render/props.js');
const material = read('src/render/material-pass.js');

check('pause menu title is plain PAUSE', pause.includes('<h2>PAUSE</h2>') && !pause.includes('HOLD UP.'));
check('pause action says RESTART', pause.includes('data-act="restart">RESTART</button>') && !pause.includes('START OVER'));
check('pause control is stacked above music', pause.includes('#mute{right:15px!important;top:calc(env(safe-area-inset-top,0px) + 61px)!important}') && pause.includes('rc2PauseBtn') && pause.includes('+ 15px'));
check('HOW TO SKI opens onboarding card', pause.includes("descent:show-how") && onboarding.includes("document.addEventListener('descent:show-how'") && onboarding.includes('showHelp()'));
check('help card returns to pause instead of starting run', onboarding.includes("this.startButton.textContent = 'BACK'") && onboarding.includes('if (this.helpMode)'));
check('GO meter has explicit player-facing name', uiPatch.includes("content:'GO METER'"));
check('threat cue projects from skier world position', uiPatch.includes('point.set(p.x, p.y + 2.65, -p.d).project(stage.camera)') && uiPatch.includes("document.getElementById('rc5Threat')"));
check('threat cue has no side offset after projection', uiPatch.includes('#rc5Threat.left,#rc5Threat.right,#rc5Threat.leap{margin-left:-17px!important}'));
check('BEST RUN can reload immediately when switched on', uiPatch.includes('sim.ghost.load(data)') && uiPatch.includes('sim.ghost.t =') && uiPatch.includes('sim.ghost.step(0)'));
check('BEST RUN can unload immediately when switched off', uiPatch.includes('sim.ghost.load(null)'));
check('tree snow is probabilistic rather than universal', props.includes('let nTree = 0, nTreeSnow = 0') && props.includes('if (f2 < snowChance'));
check('rock snow is probabilistic rather than universal', props.includes('nRockSnow = 0') && props.includes('if (f < snowChance'));
check('props get deterministic per-instance tint variation', props.includes('this.pine.setColorAt') && props.includes('this.rock.setColorAt'));
check('tree silhouettes gain deterministic lean variation', props.includes('const leanMax =') && props.includes('qTilt.setFromAxisAngle'));
check('RC8.1 patch is loaded by render entry', material.includes("import '../rc81-ui.js';"));

console.log(`\nRC8.1: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
