/**
 * Dev-only tooling, each behind a URL flag and each a dynamic import, so a
 * normal load never fetches or parses any of it.
 *
 *   ?dev=1      the tuning panel (src/dev-panel.js), for playtesting where
 *               there is no console. Backtick toggles it on a keyboard
 *               (window.__DEV_PANEL), because a playtester changing a look
 *               does not want to retype a URL and lose the run.
 *   ?soak=…     RC11.9: the capture audit, run BY the device instead of at it
 *               (src/dev/soak.js). `?soak=1` paints the report for a person
 *               holding a phone; any other value loads the same module and
 *               exposes window.__SOAK for the node audit to drive across the
 *               emulated matrix — one protocol, two callers.
 *   ?playtest=1 a REPORT button on the results card (also on with ?dev=1):
 *               one tap copies everything a playtest note needs to be
 *               REPLAYED — the challenge link (seed, mode, difficulty, word
 *               salt and bar, exactly), the distance, the cause, the last
 *               misses and the device. A note that says "the 40th word felt
 *               unfair" becomes a run anyone can stand at the start of.
 *   ?profile=1  RC10.8: the road's own numbers under the runner — segment,
 *               grade, roll and the cross-slope the mesh actually renders,
 *               marking anything over the RC8.2 ceiling
 *               (src/dev/profile-overlay.js). Draws into its own corner and
 *               takes no input; main.js updates it from the frame loop.
 */

/**
 * @param {object} deps
 * @param {() => object} deps.terrain — the live track, read when the profile
 *   overlay arrives (a run restart can replace it).
 * @param {() => object|null} [deps.report] — the playtest report for the run
 *   on the card, or null when there is none.
 * @returns {{ toggleDevPanel: () => void, readonly profileOverlay: object|null }}
 */
export function mountDevTools({ terrain, report = () => null }) {
  const params = new URLSearchParams(location.search);

  if (params.get('playtest') === '1' || params.get('dev') === '1') mountReportButton(report);

  let devPanelEl = null;
  let devPanelLoading = false;
  function toggleDevPanel() {
    if (devPanelEl) { devPanelEl.hidden = !devPanelEl.hidden; return; }
    if (devPanelLoading) return;
    devPanelLoading = true;
    import('../dev-panel.js')
      .then((m) => m.mountDevPanel())
      .then(() => { devPanelEl = document.getElementById('devPanel'); })
      .catch(() => {})
      .finally(() => { devPanelLoading = false; });
  }
  if (params.get('dev') === '1') toggleDevPanel();

  const SOAK = params.get('soak');
  if (SOAK) {
    import('./soak.js').then((m) => { if (SOAK === '1') m.mountSoak(); }).catch(() => {});
  }

  let profileOverlay = null;
  if (params.get('profile') === '1') {
    import('./profile-overlay.js')
      .then((m) => { profileOverlay = new m.ProfileOverlay(terrain()); })
      .catch(() => {});
  }

  return {
    toggleDevPanel,
    get profileOverlay() { return profileOverlay; },
  };
}

function mountReportButton(report) {
  const card = document.getElementById('deathScreen');
  if (!card || document.getElementById('playtestReport')) return;
  const btn = document.createElement('button');
  btn.id = 'playtestReport';
  btn.type = 'button';
  btn.dataset.rc2Ui = '1';
  btn.textContent = 'REPORT';
  btn.setAttribute('aria-label', 'Copy a replayable playtest report for this run');
  btn.style.cssText = 'position:absolute;top:max(12px,env(safe-area-inset-top,0px));right:12px;z-index:5;'
    + 'border:1px solid rgba(255,255,255,.28);background:rgba(8,14,20,.6);color:#eaf6fc;'
    + 'font:700 9px/1 var(--face);letter-spacing:.2em;padding:9px 11px;pointer-events:auto';
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('pointerup', (e) => e.stopPropagation());
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const r = report();
    if (!r) return;
    const text = JSON.stringify(r, null, 1);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* fall through */ }
    if (!ok && navigator.share) {
      try { await navigator.share({ text, title: 'DICTION DASH playtest report' }); ok = true; } catch { /* dismissed */ }
    }
    btn.textContent = ok ? 'COPIED' : 'COPY BLOCKED';
    setTimeout(() => { btn.textContent = 'REPORT'; }, 1400);
  });
  card.appendChild(btn);
}
