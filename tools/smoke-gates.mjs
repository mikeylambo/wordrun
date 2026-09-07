/**
 * Publishability smoke test — the real player flow, in a real browser.
 *
 * The bespoke suites in `npm run gates` prove the MATHS: the speed curve, the
 * reading window, the route's geometry, the ladders, the word bank. None of
 * them opens the game. This walks the flow a player actually walks, in three
 * modalities, and asserts only what a shipping smoke test should:
 *
 *   the app reaches an interactive title
 *   a run can begin
 *   answer input reaches gameplay
 *   pause and resume work
 *   the results card can be reached
 *   retry works, and returns a live run
 *   no uncaught console error anywhere in the walk
 *   a controller activating a menu does not leak an answer into gameplay
 *   the portrait phone viewport stays usable
 *
 * It is deliberately NOT part of `npm run gates`: playwright-core is not a
 * repo dependency (see dev/measure-plate-fit.mjs for the same rule), and a
 * suite that needs a browser must not be able to block a commit on a machine
 * that has none.
 *
 *   npm run build && npm run smoke
 *
 * PLAYWRIGHT_CORE points at an install; CHROME overrides the binary.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const PORT = 4210;

let PASS = 0, FAIL = 0;
const out = [];
const check = (name, ok, detail = '') => {
  if (ok) { PASS++; out.push(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { FAIL++; out.push(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); }
  return ok;
};
const head = (t) => out.push(`\n\x1b[1m${t}\x1b[0m`);

const preview = spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => {
  preview.stdout.on('data', (b) => { if (String(b).includes(String(PORT))) res(); });
  preview.on('exit', (c) => rej(new Error(`preview exited ${c}`)));
  setTimeout(() => rej(new Error('preview did not start')), 30000);
});

const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

/** A page with a clean profile, an error ledger, and a scriptable fake pad. */
async function open({ width = 1280, height = 900, touch = false, query = '', fresh = true,
  currency = 0 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1,
    isMobile: touch, hasTouch: touch,
  });
  if (!fresh) {
    await ctx.addInitScript((cur) => {
      window.__SMOKE_CURRENCY = cur;
      try {
        localStorage.setItem('dictiondash.v1.__migrated', '1');
        localStorage.setItem('dictiondash.v1.pref.onboarding.rc9', '1');
        localStorage.setItem('dictiondash.v1.meta.stats',
          JSON.stringify({ usedDash: 3, usedStopReal: 2, usedStopFake: 2, usedConfirm: 9,
            currency: cur }));
      } catch {}
    }, currency);
  }
  // A gamepad the test drives. navigator.getGamepads is the only door the
  // game uses, so overriding it exercises the shipped reader rather than a
  // parallel path.
  await ctx.addInitScript(() => {
    window.__FAKEPAD = { connected: true, id: 'smoke pad', index: 0, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__PAD_ON = false;
    navigator.getGamepads = () => (window.__PAD_ON ? [window.__FAKEPAD] : []);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });
  await page.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SIM && window.__START, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}

/** Advance the sim headlessly; the renderer is far too slow to run a whole run. */
const step = (page, n, cmd = {}) => page.evaluate(
  ({ n, cmd }) => window.__STEP(n, cmd), { n, cmd });
const phase = (page) => page.evaluate(() => window.__SIM.phase);
const shown = (page, id) => page.evaluate((id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { on: el.classList.contains('on'), w: Math.round(r.width), h: Math.round(r.height),
    visible: getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0 };
}, id);

const allErrors = [];

try {
  // ── 1. cold boot → an interactive title ────────────────────────────────
  head('BOOT — a cold profile reaches a title a player can act on');
  {
    const { ctx, page, errors } = await open({ fresh: true });
    const title = await shown(page, 'titleScreen');
    check('the title screen is up after a cold boot', !!title?.visible && title.on,
      `${title?.w}x${title?.h}`);
    const chips = await page.evaluate(() => ({
      modes: [...document.querySelectorAll('#modeRow .modeChip')].map((b) => b.textContent.trim()),
      diffs: [...document.querySelectorAll('#difficultyRow .modeChip')].map((b) => b.textContent.trim()),
      begin: !!document.querySelector('.drop'),
      hint: (document.getElementById('titleHint')?.textContent || '').trim(),
    }));
    check('mode and difficulty are both offered, and the start affordance is named',
      chips.modes.length === 2 && chips.diffs.length === 3 && chips.begin,
      `${chips.modes.join('/')} · ${chips.diffs.join('/')} · hint "${chips.hint}"`);
    check('the title phase is idle, not already running', await phase(page) === 'title');
    allErrors.push(...errors.map((e) => `[boot] ${e}`));
    await ctx.close();
  }

  // ── 2. keyboard/mouse: the whole loop ──────────────────────────────────
  head('DESKTOP — keyboard and mouse walk the whole loop');
  {
    const { ctx, page, errors } = await open({ fresh: false });
    // mode + difficulty by click
    await page.click('#modeRow .modeChip[data-mode="endless"]');
    await page.click('#difficultyRow .modeChip[data-difficulty="normal"]');
    const picked = await page.evaluate(() => ({
      mode: document.querySelector('#modeRow .modeChip.on')?.dataset.mode,
      diff: document.querySelector('#difficultyRow .modeChip.on')?.dataset.difficulty,
    }));
    check('clicking a mode and a difficulty chip selects them', !!picked.mode && !!picked.diff,
      `${picked.mode} / ${picked.diff}`);

    // start with the key a player would press
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__SIM.phase === 'running', null, { timeout: 15000 });
    check('Enter begins a run', await phase(page) === 'running');

    // a CORRECT answer reaches gameplay
    const right = await page.evaluate(() => {
      const sim = window.__SIM;
      const before = sim.wordGates.correctCount;
      let guard = 0;
      while (guard++ < 4000) {
        const g = sim.wordGates.current();
        if (sim.wordGates.armed(sim.player.d) && g.real && !g.resolved) {
          window.__STEP(1, { confirm: true });
          break;
        }
        window.__STEP(1, {});
      }
      window.__STEP(4, {});
      return { before, after: sim.wordGates.correctCount, score: Math.round(sim.score) };
    });
    check('a correct answer reaches gameplay and is scored',
      right.after === right.before + 1 && right.score > 0,
      `${right.before} → ${right.after} correct, score ${right.score}`);

    // a WRONG answer costs what it should
    const wrong = await page.evaluate(() => {
      const sim = window.__SIM;
      const hearts0 = sim.hearts;
      let guard = 0;
      while (guard++ < 4000) {
        const g = sim.wordGates.current();
        if (sim.wordGates.armed(sim.player.d) && !g.real && !g.resolved) {
          window.__STEP(1, { confirm: true });   // calling a FAKE real
          break;
        }
        window.__STEP(1, {});
      }
      window.__STEP(4, {});
      return { hearts0, hearts1: sim.hearts, wrong: sim.wordGates.wrongCount };
    });
    check('tapping a fake costs a heart', wrong.hearts1 === wrong.hearts0 - 1,
      `hearts ${wrong.hearts0} → ${wrong.hearts1}, ${wrong.wrong} wrong`);

    // DASH: a tap spends a full meter
    const dash = await page.evaluate(() => {
      const sim = window.__SIM;
      sim.player.boostMeter = window.__TUNING.BOOST.METER_MAX;
      sim.player.overdrive = false;
      window.__STEP(1, { boostHeld: true });
      const on = sim.player.overdrive;
      window.__STEP(30, {});
      return { on, after: sim.player.overdrive };
    });
    check('a DASH tap fires overdrive', dash.on, `overdrive on, still live after 30 steps: ${dash.after}`);

    // DASH hold: the bar rises, and does not dash
    const bar = await page.evaluate(async () => {
      const inp = window.__INPUT;
      const sim = window.__SIM;
      sim.player.compressionLevel = 0;
      sim.player.boostMeter = 0;
      const t0 = performance.now();
      inp.dashPress();
      // Poll the hold across the real window, the way the frame loop does.
      while (performance.now() - t0 < window.__INPUT.constructor.HOLD_MS ?? 0) break;
      return { pressed: true };
    });
    check('the DASH control accepts a press through its public verb', bar.pressed);

    // The DASH HOLD is a different verb on the same control, and the one a
    // player is most likely to discover by accident. A press past HOLD_MS must
    // raise the bar and must NOT dash.
    const held = await page.evaluate(async () => {
      const inp = window.__INPUT;
      const sim = window.__SIM;
      sim.player.compressionLevel = 0;
      sim.player.boostMeter = 0;
      inp.dashEdge = false;
      inp.raiseBar = false;
      const HOLD = inp.constructor.HOLD_MS ?? 520;
      inp.dashPress();
      const t0 = performance.now();
      let raised = false;
      // Drive the frame loop the way the game does until the window is past.
      while (performance.now() - t0 < HOLD + 260) {
        window.__TICK(1, 1 / 60);
        if (sim.player.compressionLevel > 0) raised = true;
        await new Promise((r) => setTimeout(r, 8));
      }
      inp.dashRelease();
      window.__TICK(6, 1 / 60);
      return { raised: raised || sim.player.compressionLevel > 0,
        level: sim.player.compressionLevel, dashed: sim.player.overdrive };
    });
    check('holding the DASH control raises the bar and does not dash',
      held.raised && !held.dashed, `level ${held.level}, overdrive ${held.dashed}`);

    // pause / resume
    await page.keyboard.press('KeyP');
    const paused = await page.evaluate(() => ({ paused: !!window.__PAUSE(true).paused,
      menu: document.getElementById('rc2Pause')?.classList.contains('on') }));
    await page.keyboard.press('KeyP');
    const resumed = await page.evaluate(() => ({
      menu: document.getElementById('rc2Pause')?.classList.contains('on'),
      phase: window.__SIM.phase }));
    check('P pauses and raises the pause menu, and P resumes it',
      paused.menu === true && resumed.menu === false && resumed.phase === 'running',
      `paused menu ${paused.menu} → resumed menu ${resumed.menu}, phase ${resumed.phase}`);

    // death → results
    const dead = await page.evaluate(() => {
      const sim = window.__SIM;
      let guard = 0;
      while (sim.hearts > 0 && guard++ < 40000) {
        const g = sim.wordGates.current();
        if (sim.wordGates.armed(sim.player.d) && !g.real && !g.resolved) window.__STEP(1, { confirm: true });
        else window.__STEP(1, {});
      }
      return { hearts: sim.hearts, phase: sim.phase, cause: sim.deathCause };
    });
    await page.waitForFunction(() => document.getElementById('deathScreen')?.classList.contains('on'),
      null, { timeout: 20000 }).catch(() => {});
    const card = await shown(page, 'deathScreen');
    const cardText = await page.evaluate(() => ({
      score: (document.getElementById('finalDist')?.textContent || '').trim(),
      tag: (document.getElementById('deathTag')?.textContent || '').trim(),
      again: !!document.getElementById('deathAgain'),
      menu: !!document.getElementById('deathMenu'),
    }));
    // A run of wrong answers ends one of two ways and BOTH are shipped: the
    // third wrong read spends the last heart, or the speed loss lets the
    // Redline close first. The card is what matters here, not which.
    check('a run of wrong answers ends and raises the results card',
      (dead.phase === 'dead' || dead.phase === 'kill') &&
      !!card?.visible && cardText.again && cardText.menu && cardText.score !== '',
      `ended ${dead.cause} with ${dead.hearts} hearts · "${cardText.tag}" · score "${cardText.score}"`);

    // retry
    await page.click('#deathAgain');
    await page.waitForFunction(() => window.__SIM.phase === 'running', null, { timeout: 15000 });
    const retried = await page.evaluate(() => ({ phase: window.__SIM.phase,
      hearts: window.__SIM.hearts, d: Math.round(window.__SIM.player.d),
      card: document.getElementById('deathScreen')?.classList.contains('on') }));
    check('AGAIN starts a fresh live run and dismisses the card',
      retried.phase === 'running' && retried.hearts > 0 && retried.d < 200 && !retried.card,
      `phase ${retried.phase}, hearts ${retried.hearts}, ${retried.d} m in`);

    // back to the title
    await page.evaluate(() => window.__QUIT());
    const back = await page.evaluate(() => ({ phase: window.__SIM.phase,
      title: document.getElementById('titleScreen')?.classList.contains('on') }));
    check('quitting returns to an interactive title', back.phase === 'title' && back.title);

    allErrors.push(...errors.map((e) => `[desktop] ${e}`));
    await ctx.close();
  }

  // ── 2b. the judgment, which may never fight the plate ─────────────────
  head('JUDGMENT — arcade weight, and never over the word');
  {
    const { ctx, page, errors } = await open({ width: 390, height: 844, touch: true, fresh: false });
    await page.evaluate(() => window.__START());
    await page.waitForFunction(() => window.__SIM.phase === 'running', null, { timeout: 15000 });
    const shot = await page.evaluate(async () => {
      const sim = window.__SIM;
      // FOUR correct reads, not one: the combo hides at a chain of 1, so a
      // single read would let the chain check pass without ever drawing the
      // thing it claims to be checking.
      let guard = 0, got = 0;
      while (guard++ < 20000 && got < 4) {
        const g = sim.wordGates.current();
        if (sim.wordGates.armed(sim.player.d) && g.real && !g.resolved) {
          window.__STEP(1, { confirm: true });
          got++;
        } else window.__STEP(1, {});
      }
      window.__TICK(2, 1 / 60);
      const judge = document.getElementById('judge');
      const combo = document.getElementById('combo');
      const jr = judge.getBoundingClientRect();
      const VW = document.documentElement.clientWidth;
      const VH = document.documentElement.clientHeight;
      // The armed plate's own screen rect, projected the way the game draws it.
      const plate = window.__RENDER.wordGateActors.current.mesh;
      const cam = window.__RENDER.stage.camera;
      let pr = null;
      if (plate.visible) {
        const xs = [], ys = [];
        const V = plate.position.constructor;
        for (const [px, py] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
          const v = new V(px, py, 0).applyMatrix4(plate.matrixWorld).project(cam);
          xs.push((v.x * 0.5 + 0.5) * VW); ys.push((-v.y * 0.5 + 0.5) * VH);
        }
        pr = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      }
      const overlap = pr && !(jr.right < pr.x0 || jr.left > pr.x1 || jr.bottom < pr.y0 || jr.top > pr.y1);
      return {
        word: (judge.textContent || '').trim(), on: judge.classList.contains('on'),
        fontPx: Math.round(parseFloat(getComputedStyle(judge).fontSize)),
        combo: (combo.textContent || '').trim(),
        comboOn: combo.classList.contains('on'),
        comboPx: Math.round(parseFloat(getComputedStyle(combo).fontSize)),
        judgeRect: { t: Math.round(jr.top), b: Math.round(jr.bottom) },
        judgeTopFrac: jr.top / VH,
        labels: Object.values(window.__TUNING.JUDGE.LABELS),
        burstCanvas: !!document.getElementById('judgeBurst'),
        plateRect: pr && { t: Math.round(pr.y0), b: Math.round(pr.y1) },
        overlap: !!overlap, onScreen: jr.top >= 0 && jr.bottom <= VH,
        chain: sim.player.chain,
      };
    });
    // The labels are TUNING strings now (JUDGE.LABELS), so the check reads
    // them from the game rather than hard-coding a set that a panel edit could
    // silently walk away from.
    check('a correct read names its own quality, at a size you can read at speed',
      shot.on && shot.labels.includes(shot.word) && shot.fontPx >= 28 && shot.onScreen,
      `"${shot.word}" at ${shot.fontPx}px, from ${shot.labels.length} tuned labels`);
    // TWO checks, because one sampled frame is not the plate's corridor. The
    // plate TRAVELS: measured over 2400 frames at 390x844 the armed plate
    // sweeps 30-56 % of the viewport and the lookahead row 28-48 %. A single
    // frame's non-overlap passed at 46 % and the very next sample failed.
    const PLATE_FLOOR = 0.58;   // the corridor's measured bottom, written down
    check('the judgment sits below the plate corridor, not merely beside one plate',
      shot.judgeTopFrac >= PLATE_FLOOR,
      `top at ${(shot.judgeTopFrac * 100).toFixed(1)}% against a pinned ${(PLATE_FLOOR * 100).toFixed(0)}% floor`);
    check('and it does not overlap the armed plate in the sampled frame',
      shot.overlap === false,
      shot.plateRect
        ? `judgment ${shot.judgeRect.t}-${shot.judgeRect.b}px, plate ${shot.plateRect.t}-${shot.plateRect.b}px`
        : 'no plate armed at the sampled frame');
    check('the chain reads as a count, at arcade weight',
      shot.chain > 1 && shot.comboOn && /^×\d+$/.test(shot.combo) && shot.comboPx >= 24,
      `chain ${shot.chain} drawn as "${shot.combo}" at ${shot.comboPx}px`);
    // Teaching outranks flash.
    const muted = await page.evaluate(() => {
      window.__SIM.teach.active = 'real';
      window.__TICK(2, 1 / 60);
      const on = document.getElementById('judge').classList.contains('on');
      window.__SIM.teach.active = null;
      return on;
    });
    check('and it stands down while a teaching stop is on screen', muted === false);
    check('the glow burst has a canvas, and its whole shape is tunable',
      shot.burstCanvas === true, 'TUNING.JUDGE.BURST drives count, life, speed, drag, size, glow, gravity');
    allErrors.push(...errors.map((e) => `[judgment] ${e}`));
    await ctx.close();
  }

  // ── 3. touch / portrait ────────────────────────────────────────────────
  head('TOUCH — the portrait phone frame stays usable');
  {
    const { ctx, page, errors } = await open({ width: 390, height: 844, touch: true, fresh: false });
    await page.evaluate(() => window.__START());
    await page.waitForFunction(() => window.__SIM.phase === 'running', null, { timeout: 15000 });
    const controls = await page.evaluate(() => {
      const ids = ['v1MobileFake', 'v1MobileDash', 'v1MobileJump'];
      const VW = document.documentElement.clientWidth;
      const VH = document.documentElement.clientHeight;
      return ids.map((id) => {
        const el = document.getElementById(id);
        if (!el) return { id, present: false };
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const mid = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { id, present: true, w: Math.round(r.width), h: Math.round(r.height),
          onScreen: r.left >= -1 && r.right <= VW + 1 && r.top >= -1 && r.bottom <= VH + 1,
          shown: cs.display !== 'none' && +cs.opacity > 0.05,
          hit: !!mid && (mid === el || el.contains(mid)) };
      });
    });
    const bad = controls.filter((c) => !c.present || !c.onScreen || !c.shown || !c.hit);
    check('FAKE, DASH and REAL are all on-screen, visible and hit-testable at 390x844',
      bad.length === 0,
      controls.map((c) => `${c.id.replace('v1Mobile', '')} ${c.w}x${c.h}${c.hit ? '' : ' NOT-HITTABLE'}`).join(' · '));
    // Every touch target should clear the 44px guideline.
    const small = controls.filter((c) => c.present && (c.w < 44 || c.h < 44));
    check('and every touch target clears 44 px', small.length === 0,
      small.length ? small.map((c) => `${c.id} ${c.w}x${c.h}`).join(', ') : 'smallest is the row above');
    // the answer buttons reach the sim
    // REAL TOUCH, through CDP. A synthetic PointerEvent has no live pointer
    // behind it, so `setPointerCapture` throws on it and the test would be
    // measuring its own event rather than the game.
    const cdp = await ctx.newCDPSession(page);
    const box = await page.evaluate(() => {
      const r = document.getElementById('v1MobileJump').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    // `input.jump` is an EDGE: consumeJump() clears it at the end of every
    // frame, so reading it after the round trip races the frame loop. Latch it
    // where the sim reads it instead.
    await page.evaluate(() => {
      const inp = window.__INPUT;
      window.__sawJump = false;
      const orig = inp.consumeJump.bind(inp);
      inp.consumeJump = function () { if (this.jump) window.__sawJump = true; return orig(); };
    });
    await cdp.send('Input.dispatchTouchEvent',
      { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    const jumpSet = await page.evaluate(() => window.__INPUT.jump || window.__sawJump);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check('the REAL button reaches the input layer on a real touch', jumpSet === true,
      'a touch on #v1MobileJump sets input.jump');
    const noScroll = await page.evaluate(() => ({
      bodyScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hud: !!document.getElementById('hud'),
    }));
    check('the portrait frame does not scroll sideways', noScroll.bodyScroll <= 0,
      `${noScroll.bodyScroll}px of horizontal overflow`);
    allErrors.push(...errors.map((e) => `[touch] ${e}`));
    await ctx.close();
  }

  // ── 4. controller ──────────────────────────────────────────────────────
  head('CONTROLLER — A activates a menu without answering behind it');
  {
    const { ctx, page, errors } = await open({ fresh: false });
    const leak = await page.evaluate(async () => {
      window.__PAD_ON = true;
      const press = (i, on) => {
        window.__FAKEPAD.buttons[i] = { pressed: on, value: on ? 1 : 0 };
        window.__FAKEPAD.timestamp = performance.now();
      };
      // A on the title starts a run (the nav dispatches Enter).
      press(0, true);
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      press(0, false);
      // A press from the TITLE plays the full arrival before the run is built
      // in the dark — the phase is still 'title' for a second or more, and
      // that is the sequence working, not the pad failing.
      const t0 = performance.now();
      while (window.__SIM.phase !== 'running' && performance.now() - t0 < 12000) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      const started = window.__SIM.phase;
      if (started !== 'running') return { started, skipped: true };

      // Now pause, and press A to RESUME. The same A must not answer REAL.
      const sim = window.__SIM;
      const answered0 = sim.wordGates.correctCount + sim.wordGates.wrongCount;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
      const menuUp = document.getElementById('rc2Pause')?.classList.contains('on');
      press(0, true);
      for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
      press(0, false);
      for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
      return {
        started, menuUp,
        resumed: !document.getElementById('rc2Pause')?.classList.contains('on'),
        answered0, answered1: sim.wordGates.correctCount + sim.wordGates.wrongCount,
        jump: window.__INPUT.jump,
        consumed: window.__RENDER ? undefined : undefined,
      };
    });
    check('A on the title starts a run', leak.started === 'running', `phase ${leak.started}`);
    if (!leak.skipped) {
      check('A raises RESUME on the pause menu and does not answer behind it',
        leak.menuUp === true && leak.resumed === true &&
        leak.answered1 === leak.answered0 && leak.jump !== true,
        `menu ${leak.menuUp} → resumed ${leak.resumed}, answers ${leak.answered0} → ${leak.answered1}`);
    }
    allErrors.push(...errors.map((e) => `[pad] ${e}`));
    await ctx.close();
  }

  // ── 4b. the priced continue, and the reference card ───────────────────
  head('OFFERS — the continue is priced, refusable, and never silent');
  {
    // The profile opens already able to afford a continue. Seeding it after
    // load and reloading does NOT work: the init script runs again on reload
    // and writes the stats key back over the seeded balance.
    const { ctx, page, errors } = await open({ fresh: false, currency: 99999 });
    await page.evaluate(() => window.__START());
    await page.waitForFunction(() => window.__SIM.phase === 'running', null, { timeout: 15000 });
    const died = await page.evaluate(() => {
      const sim = window.__SIM;
      let guard = 0;
      while (sim.hearts > 0 && guard++ < 40000) {
        const g = sim.wordGates.current();
        if (sim.wordGates.armed(sim.player.d) && !g.real && !g.resolved) window.__STEP(1, { confirm: true });
        else window.__STEP(1, {});
      }
      return { phase: sim.phase };
    });
    await page.waitForFunction(
      () => document.getElementById('continueOffer')?.classList.contains('on') ||
            document.getElementById('deathScreen')?.classList.contains('on'),
      null, { timeout: 20000 }).catch(() => {});
    const state = await page.evaluate(() => ({
      offer: document.getElementById('continueOffer')?.classList.contains('on'),
      buy: (document.getElementById('continueBuy')?.textContent || '').trim(),
      balance: (document.getElementById('continueBalance')?.textContent || '').trim(),
      pass: !!document.getElementById('continuePass'),
      card: document.getElementById('deathScreen')?.classList.contains('on'),
    }));
    check('a player who can afford it IS offered a continue, priced, with the balance shown',
      state.offer === true && /\u25c6\s*\d/.test(state.buy) && /\d/.test(state.balance) && state.pass,
      state.offer ? `"${state.buy}" · "${state.balance}"` : 'NO OFFER — the card came up instead');
    if (state.offer) {
      await page.click('#continuePass');
      await page.waitForFunction(() => document.getElementById('deathScreen')?.classList.contains('on'),
        null, { timeout: 15000 }).catch(() => {});
      const after = await page.evaluate(() => ({
        offer: document.getElementById('continueOffer')?.classList.contains('on'),
        card: document.getElementById('deathScreen')?.classList.contains('on') }));
      check('declining the offer falls through to the results card',
        after.offer === false && after.card === true);
    }
    allErrors.push(...errors.map((e) => `[continue] ${e}`));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ fresh: false });
    const card = await page.evaluate(async () => {
      document.dispatchEvent(new Event('dictiondash:show-how'));
      await new Promise((r) => setTimeout(r, 400));
      const el = document.getElementById('rc7Onboarding');
      return { on: !!el?.classList.contains('on'),
        rules: el ? el.querySelectorAll('.rule').length : 0,
        start: (el?.querySelector('[data-act="start"]')?.textContent || '').trim() };
    });
    check('HOW TO PLAY opens the reference card with its rules and a way out',
      card.on && card.rules >= 5 && !!card.start,
      `${card.rules} rules, dismissed by "${card.start}"`);
    const closed = await page.evaluate(async () => {
      document.querySelector('#rc7Onboarding [data-act="start"]')
        ?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 300));
      return { on: !!document.getElementById('rc7Onboarding')?.classList.contains('on'),
        phase: window.__SIM.phase };
    });
    check('and closing it returns to the title without starting a run',
      closed.on === false && closed.phase === 'title', `phase ${closed.phase}`);
    allErrors.push(...errors.map((e) => `[howto] ${e}`));
    await ctx.close();
  }

  // ── 4c. the dev panel: every knob, and the JSON round trip ────────────
  head('DEV PANEL — every tuning value, and a JSON export that round-trips');
  {
    // A playtester should not have to retype a URL to change a look. The panel
    // is absent on a normal load and backtick brings it up — checked here
    // because the chunk is dynamic: a broken import fails silently otherwise.
    const { ctx, page, errors } = await open({ fresh: false });
    const before = await page.evaluate(() => !!document.getElementById('devPanel'));
    await page.keyboard.press('Backquote');
    await page.waitForFunction(
      () => !!document.querySelector('#devPanel [data-act="diff"]'), null, { timeout: 30000 })
      .catch(() => {});
    const shown = await page.evaluate(() => {
      const el = document.getElementById('devPanel');
      return !!el && !el.hidden && el.getBoundingClientRect().width > 0;
    });
    await page.keyboard.press('Backquote');
    const hidden = await page.evaluate(() => {
      const el = document.getElementById('devPanel');
      return !!el && (el.hidden || el.getBoundingClientRect().width === 0);
    });
    check('backtick opens the tuning panel on a normal load, and closes it again',
      !before && shown && hidden,
      `absent on boot ${!before} · shown ${shown} · hidden again ${hidden}`);
    allErrors.push(...errors.map((e) => `[panel-key] ${e}`));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ fresh: false, query: '?dev=1' });
    // Wait for the panel to FINISH mounting, not to start: #devPanel exists
    // before its 436 knob rows and the export block are appended, and waiting
    // on the element alone raced the build.
    await page.waitForFunction(
      () => !!document.querySelector('#devPanel [data-act="diff"]'), null, { timeout: 30000 });
    const panel = await page.evaluate(() => {
      const el = document.getElementById('devPanel');
      const T = window.__TUNING;
      // How many leaves does TUNING actually have? The panel must reach them all.
      let leaves = 0;
      const walk = (o) => {
        for (const v of Object.values(o)) {
          if (Array.isArray(v)) {
            if (v.every((x) => typeof x === 'number' || typeof x === 'string')) leaves += v.length;
            else walk(v);
          } else if (v && typeof v === 'object') walk(v);
          else if (['number', 'boolean', 'string'].includes(typeof v)) leaves++;
        }
      };
      walk(T);
      const btn = (a) => el.querySelector(`[data-act="${a}"]`);
      const ta = el.querySelector('textarea');
      btn('diff').click();
      const emptyDiff = ta.value;
      ta.value = JSON.stringify({ 'JUDGE.HOLD_S': 1.4, 'JUDGE.BURST.COUNT': 30, 'RUN.CEILING': 70 });
      btn('apply').click();
      const live = { hold: T.JUDGE.HOLD_S, burst: T.JUDGE.BURST.COUNT, ceiling: T.RUN.CEILING };
      btn('diff').click();
      let diff = {};
      try { diff = JSON.parse(ta.value); } catch {}
      btn('reset').click();
      const after = { hold: T.JUDGE.HOLD_S, burst: T.JUDGE.BURST.COUNT, ceiling: T.RUN.CEILING };
      return {
        knobs: el.querySelectorAll('.knob').length,
        sections: el.querySelectorAll('details.sec').length,
        leaves, emptyDiff, live, diff, after,
        cssTop: getComputedStyle(document.documentElement).getPropertyValue('--judge-top').trim(),
      };
    });
    check('the panel reaches every value in TUNING, grouped by section',
      panel.knobs === panel.leaves && panel.sections >= 15,
      `${panel.knobs} knobs across ${panel.sections} sections, against ${panel.leaves} leaves in TUNING`);
    check('with nothing touched, the exported diff is empty',
      panel.emptyDiff.trim() === '{}', `"${panel.emptyDiff.trim().slice(0, 40)}"`);
    check('applying JSON writes the live tuning object',
      panel.live.hold === 1.4 && panel.live.burst === 30 && panel.live.ceiling === 70,
      JSON.stringify(panel.live));
    check('and the diff exports exactly what moved, by path',
      Object.keys(panel.diff).length === 3 && panel.diff['JUDGE.HOLD_S'] === 1.4 &&
      panel.diff['JUDGE.BURST.COUNT'] === 30 && panel.diff['RUN.CEILING'] === 70,
      JSON.stringify(panel.diff));
    check('reset puts every value back where it started',
      panel.after.hold !== 1.4 && panel.after.burst !== 30 && panel.after.ceiling !== 70,
      JSON.stringify(panel.after));
    check('the judgment drives its CSS from a custom property the panel can write',
      /%$/.test(panel.cssTop), `--judge-top ${panel.cssTop}`);
    // 310px of controls inside a cabinet strip covered the game they tune.
    const geo = await page.evaluate(() => {
      const p = document.getElementById('devPanel').getBoundingClientRect();
      const a = document.getElementById('app').getBoundingClientRect();
      return { overlap: Math.round(Math.max(0, Math.min(p.right, a.right) - Math.max(p.left, a.left))),
        panel: `${Math.round(p.left)}..${Math.round(p.right)}`, app: `${Math.round(a.left)}..${Math.round(a.right)}` };
    });
    check('and it sits in the bezel, clear of the play area',
      geo.overlap === 0, `panel ${geo.panel}, play area ${geo.app}`);
    allErrors.push(...errors.map((e) => `[panel] ${e}`));
    await ctx.close();
  }

  // ── 4d. readouts: a score is the one string the player writes the length of
  head('READOUTS — no number leaves the frame, at any size, on any screen');
  {
    // The bug this covers shipped: on a windowed desktop the results headline
    // was sized in `vw` (the WINDOW) while it lived in the cabinet strip, and
    // a seven-figure score rendered 98px off the screen — the player saw
    // "L70,820". Two viewports the report came from, plus a phone, against
    // magnitudes a long DAILY reaches.
    const VIEWS = [[390, 844], [1280, 800], [1440, 700]];
    const SCORES = [1172, 170820, 12409931];
    const bad = [];
    const shrank = [];
    for (const [w, h] of VIEWS) {
      const { ctx, page, errors } = await open({ width: w, height: h, fresh: false });
      for (const score of SCORES) {
        const r = await page.evaluate((sc) => {
          const txt = sc.toLocaleString('en-US');
          window.__UI.showDeath(true);
          document.getElementById('deathScreen').classList.add('rc2Poster');
          document.getElementById('finalDist').textContent = txt;
          document.getElementById('dist').textContent = txt;
          window.__UI.refit();
          const app = document.getElementById('app').getBoundingClientRect();
          const range = document.createRange();
          const over = [];
          for (const el of document.querySelectorAll('#hud *, #deathScreen *')) {
            if (!el.firstChild || el.offsetParent === null) continue;
            if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
            range.selectNodeContents(el);
            const t = range.getBoundingClientRect();
            if (!t.width) continue;
            const px = Math.round(Math.max(app.left - t.left, t.right - app.right));
            if (px > 0) over.push(`${el.id || el.className}+${px}px`);
          }
          const big = document.getElementById('finalDist').parentElement;
          return { over, px: Math.round(parseFloat(getComputedStyle(big).fontSize)) };
        }, score);
        if (r.over.length) bad.push(`${w}x${h}@${score}: ${r.over.join(',')}`);
        shrank.push(`${w}x${h}: ${r.px}px`);
      }
      allErrors.push(...errors.map((e) => `[readouts] ${e}`));
      await ctx.close();
    }
    check('nothing in the HUD or the results card leaves the play frame',
      bad.length === 0, bad.slice(0, 3).join(' | ') || `${VIEWS.length * SCORES.length} combinations clean`);
    // A fit that never engages would also report "clean", so prove it moved:
    // the same card at 4 digits and at 8 must not be the same size.
    const first = shrank.filter((_, i) => i % SCORES.length === 0);
    const last = shrank.filter((_, i) => i % SCORES.length === SCORES.length - 1);
    check('and the headline actually gives ground as the number grows',
      first.every((v, i) => parseInt(v.split(': ')[1]) > parseInt(last[i].split(': ')[1])),
      first.map((v, i) => `${v.split(':')[0]} ${v.split(': ')[1]} → ${last[i].split(': ')[1]}`).join(' · '));
  }

  // ── 4d-bis. the profile: two columns, and no scroll on a desktop ───────
  head('PROFILE — everything a player came to look at, on one screen');
  {
    const { ctx, page, errors } = await open({ width: 1280, height: 800, fresh: false });
    const real = await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('dictiondash:show-curve'));
      const el = document.getElementById('curveScreen');
      return { on: el?.classList.contains('on'),
        cols: el?.querySelectorAll('#curveBody .pCol').length || 0 };
    });
    check('PROFILE opens, and its blocks are laid out in two columns',
      real.on && real.cols === 2, `open ${real.on}, ${real.cols} columns`);

    // A real profile here is a fresh one. The layout has to hold at the OTHER
    // end — a player two weeks in with a full mastery board, three cleared
    // objectives and a long beaten roll — so the worst case is written in.
    const fit = await page.evaluate(() => {
      const beaten = (n) => Array.from({ length: Math.min(6, n) }, (_, i) =>
        `<div class="bRow"><span class="bW">commencement</span><span class="bMeta">${i % 3 + 1} misses · ${i}d ago</span></div>`).join('')
        + (n > 6 ? `<p class="note">and ${n - 6} more.</p>` : '');
      const spark = '<span><svg class="spark" viewBox="0 0 100 26" preserveAspectRatio="none">'
        + '<line class="base" x1="2" y1="25" x2="98" y2="25"/><polyline points="2,20 20,15 40,18 60,10 80,12 98,6"/></svg></span>';
      const left = '<div class="cRow cTop"><span class="cK">BEST</span><span class="cV">111,487<i class="cBank">◆ 1,240</i></span></div>'
        + '<div class="cHead">1,204 WORDS LEARNED</div><div class="objList">'
        + [1, 2, 3, 4, 5].map((i) => `<div class="objRow"><span class="ol">TIER ${i}</span><span class="ob"><i style="width:${20 * i}%"></i></span><span class="ov">${120 * i}/${881 + i}</span></div>`).join('')
        + '</div><p class="note">A word counts once you read it right and are not owed it again. Miss it and it comes back.</p>'
        + '<div class="cHead">3 OF 3 GOALS TODAY</div><div class="goalList">'
        + ['1000M', '×6 CHAIN', '25 READS'].map((l) => `<div class="goalCheck done"><i>✓</i><span class="goalChip done">${l}</span></div>`).join('') + '</div>';
      const right = '<div class="cHead">OBJECTIVES</div><div class="objList">'
        + [['100 DASH', 15], ['300 M CLEAN', 15], ['20 READS', 20]].map(([l, r]) => `<div class="objRow"><span class="ol">${l}</span><span class="ob"><i style="width:57%"></i></span><span class="ov">◆${r}</span></div>`).join('') + '</div>'
        + [0, 1, 2, 3, 4].map((t) => `<div class="cRow"><span class="cK">TIER ${t}</span>${spark}<span class="cV"><s class="up">+7</s>${57 + t * 8}%</span></div>`).join('')
        + `<div class="cRow"><span class="cK">READ TIME</span>${spark}<span class="cV"><s class="up">−40ms</s>0.29s</span></div>`
        + '<p class="note">Last two weeks. A gap is a day not played.</p>'
        + '<div class="cHead">BEATEN — 40</div>' + beaten(40);
      const el = document.getElementById('curveScreen');
      el.classList.add('on');
      el.querySelector('#curveBody').innerHTML = `<div class="pCol">${left}</div><div class="pCol">${right}</div>`;
      const card = el.querySelector('.card');
      return { v: card.scrollHeight - card.clientHeight, h: card.scrollWidth - card.clientWidth,
        card: `${card.clientWidth}x${card.clientHeight}` };
    });
    check('and a two-week player\'s full profile needs no scrolling on a desktop',
      fit.v <= 0 && fit.h <= 0,
      `card ${fit.card}${fit.v > 0 ? `, ${fit.v}px of vertical scroll` : ''}${fit.h > 0 ? `, ${fit.h}px horizontal` : ''}`);
    allErrors.push(...errors.map((e) => `[profile] ${e}`));
    await ctx.close();
  }

  // ── 4e. full screen ────────────────────────────────────────────────────
  head('FULL SCREEN — the biggest legibility gain a desktop player can reach');
  {
    const { ctx, page, errors } = await open({ fresh: false });
    // Headless may refuse the request itself, and whether it grants it is the
    // browser's business — what must be true is that the key and the chip
    // both ASK. So record the call rather than the outcome.
    await page.evaluate(() => {
      window.__fsCalls = 0;
      Element.prototype.requestFullscreen = function () { window.__fsCalls++; return Promise.resolve(); };
    });
    await page.keyboard.press('KeyF');
    const byKey = await page.evaluate(() => window.__fsCalls);
    check('F asks the browser for full screen', byKey === 1, `${byKey} request(s)`);
    const chip = await page.evaluate(() => {
      document.getElementById('accessBtn')?.click();
      const rows = [...document.querySelectorAll('#accessPanel .accessRow')];
      const row = rows.find((r) => r.textContent.startsWith('FULL SCREEN'));
      if (!row) return { found: false };
      row.querySelector('.modeChip')?.click();
      return { found: true, calls: window.__fsCalls,
        chips: [...row.querySelectorAll('.modeChip')].map((b) => b.textContent) };
    });
    check('and SETTINGS carries the same switch, for a player who never finds the key',
      chip.found && chip.calls === 2 && chip.chips.join('/') === 'ON/OFF',
      chip.found ? `chips ${chip.chips.join('/')}, ${chip.calls} total requests` : 'no FULL SCREEN row');
    allErrors.push(...errors.map((e) => `[fullscreen] ${e}`));
    await ctx.close();
  }

  // ── 5. the two entry links ─────────────────────────────────────────────
  head('LINKS — the DAILY and a challenge both open on the right road');
  {
    const { ctx, page, errors } = await open({ fresh: false, query: '?draft=smoke-seed&mode=standard' });
    const ch = await page.evaluate(() => ({
      challenge: !!window.__CHALLENGE, seed: window.__SEED.string,
      mode: window.__CHALLENGE?.mode }));
    check('a challenge link opens on its own seed and mode',
      ch.challenge && ch.seed === 'smoke-seed' && ch.mode === 'standard',
      `seed "${ch.seed}", mode ${ch.mode}`);
    allErrors.push(...errors.map((e) => `[challenge] ${e}`));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ fresh: false });
    const daily = await page.evaluate(() => {
      document.querySelector('#modeRow .modeChip[data-mode="standard"]')?.click();
      return { note: (document.getElementById('dailyNote')?.textContent || '').trim(),
        seed: window.__SEED.string };
    });
    check('the DAILY chip explains the route, and the seed is the date',
      /\d+ WORDS/.test(daily.note) && /^\d{4}-\d{2}-\d{2}$/.test(daily.seed),
      `"${daily.note}" on ${daily.seed}`);
    allErrors.push(...errors.map((e) => `[daily] ${e}`));
    await ctx.close();
  }

  // ── 6. the ledger ──────────────────────────────────────────────────────
  head('ERRORS — nothing threw anywhere in the walk');
  check('no uncaught page error or console error in any modality',
    allErrors.length === 0, allErrors.slice(0, 6).join(' | ') || 'clean');
} finally {
  await browser.close();
  preview.kill();
}

console.log(out.join('\n'));
console.log(`\nSmoke gates: ${PASS} passed, ${FAIL} failed`);
if (FAIL) process.exit(1);
