// RC7.1 — feel/stability only. No new game systems.
// Runs inside the existing game frame: no second requestAnimationFrame loop.

function patchRenderBudget(stage) {
  if (!stage?.renderer || stage.__rc71BudgetPatched) return;
  stage.__rc71BudgetPatched = true;
  const baseRender = stage.render.bind(stage);
  let last = performance.now();
  let ema = 16.7;
  let slowFor = 0;
  let fastFor = 0;
  const floor = 0.85;
  const ceiling = Math.min(window.devicePixelRatio || 1, 2);

  const applyDpr = (next) => {
    next = Math.max(floor, Math.min(ceiling, Math.round(next * 20) / 20));
    if (Math.abs(next - stage.dpr) < 0.04) return;
    stage.dpr = next;
    // RC9.3: through stage.resize(), not around it. This used to size the
    // buffer to the WINDOW, which was the same rectangle as the canvas right
    // up until the cabinet framed the play area — after which every drop in
    // the render budget would have re-stretched the buffer across the whole
    // window and left the camera's aspect behind. resize() reads the canvas
    // and updates the projection; the governor's job is the ratio alone.
    stage.resize();
  };

  stage.render = function renderRC71() {
    const now = performance.now();
    const dtMs = Math.min(80, Math.max(1, now - last));
    last = now;
    ema += (dtMs - ema) * 0.035;

    if (ema > 23.5) {
      slowFor += dtMs / 1000;
      fastFor = 0;
      if (slowFor > 1.1) {
        applyDpr(stage.dpr - 0.15);
        slowFor = 0;
      }
    } else if (ema < 17.4) {
      fastFor += dtMs / 1000;
      slowFor = 0;
      if (fastFor > 5.0) {
        applyDpr(stage.dpr + 0.1);
        fastFor = 0;
      }
    } else {
      slowFor = Math.max(0, slowFor - dtMs / 1800);
      fastFor = Math.max(0, fastFor - dtMs / 1600);
    }

    baseRender();
  };
}

// RC7.1's other half — the track ribbon's 0.72m sampling rate — used to be
// installed here by reassigning PlayerActor's `_track` at runtime. It is
// written into that class now (with the write-head wrap bug that hid five
// sixths of the ribbon fixed), so this file is one system: the DPR budget.
function boot() {
  const render = window.__RENDER;
  if (!render?.stage) {
    requestAnimationFrame(boot);
    return;
  }
  patchRenderBudget(render.stage);
  window.__RC71_FEEL = { trackGcReduced: true, adaptiveDpr: true };
}

requestAnimationFrame(boot);
