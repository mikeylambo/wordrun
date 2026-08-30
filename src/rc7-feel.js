// RC7.1 — feel/stability only. No new game systems.
// Runs inside the existing game frame: no second requestAnimationFrame loop.

function addThreatBang() {
  if (document.getElementById('rc71-threat-style')) return;
  const style = document.createElement('style');
  style.id = 'rc71-threat-style';
  style.textContent = `
    #rc5Threat svg{display:none!important}
    #rc5Threat::before{
      content:'!';display:grid;place-items:center;width:100%;height:100%;
      color:#ff382f;font:800 34px/.9 var(--face);
      -webkit-text-stroke:1px rgba(255,255,255,.7);
      text-shadow:0 3px 9px rgba(0,0,0,.42);
    }
    #rc5Threat.left{margin-left:-31px!important}
    #rc5Threat.right{margin-left:-3px!important}
    #rc5Threat.leap::before{font-size:38px}
  `;
  document.head.appendChild(style);
}

function patchTracks(actor) {
  if (!actor || actor.__rc71TrackPatched || !actor._trackLeft || !actor._trackRight) return;
  actor.__rc71TrackPatched = true;
  const curL = actor._trackLeft.clone();
  const curR = actor._trackRight.clone();

  actor._track = function trackRC71(p) {
    if (p.airborne || p.staggerT > 0.15) { this._trackReady = false; return; }
    // RC7 sampled roughly every 0.48m. 0.72m is still visually continuous at
    // play speed, while cutting buffer uploads and eliminating per-sample GC.
    if (p.d - this._lastTrackD < 0.72) return;
    this._lastTrackD = p.d;
    const rightX = Math.cos(p.heading), rightZ = Math.sin(p.heading);
    curL.set(p.x - rightX * 0.21, p.y + 0.025, -p.d - rightZ * 0.21);
    curR.set(p.x + rightX * 0.21, p.y + 0.025, -p.d + rightZ * 0.21);
    if (this._trackReady) {
      const base = this._trackHead * 12, a = this.trackPos;
      a[base] = this._trackLeft.x; a[base + 1] = this._trackLeft.y; a[base + 2] = this._trackLeft.z;
      a[base + 3] = curL.x; a[base + 4] = curL.y; a[base + 5] = curL.z;
      a[base + 6] = this._trackRight.x; a[base + 7] = this._trackRight.y; a[base + 8] = this._trackRight.z;
      a[base + 9] = curR.x; a[base + 10] = curR.y; a[base + 11] = curR.z;
      this._trackHead = (this._trackHead + 1) % 180;
      this.tracks.geometry.attributes.position.needsUpdate = true;
    }
    this._trackLeft.copy(curL);
    this._trackRight.copy(curR);
    this._trackReady = true;
  };
}

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
    stage.renderer.setPixelRatio(next);
    stage.renderer.setSize(window.innerWidth, window.innerHeight, false);
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

function boot() {
  const render = window.__RENDER;
  if (!render?.stage || !render?.playerActor) {
    requestAnimationFrame(boot);
    return;
  }
  addThreatBang();
  patchTracks(render.playerActor);
  patchRenderBudget(render.stage);
  window.__RC71_FEEL = { threatBang: true, trackGcReduced: true, adaptiveDpr: true };
}

requestAnimationFrame(boot);
