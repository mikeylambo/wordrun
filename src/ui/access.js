/**
 * Accessibility (Phase 11) — three options, persisted, applied live.
 *
 * The colour-vision palettes port SIGNAL's design directly (its
 * src/palettes.ts): support lives in an accessibility surface rather than
 * a cosmetics screen, and each mode replaces THE AXIS THAT FAILS rather
 * than recolouring the world. Deuteranopia and protanopia compress
 * red/green, so the danger accent and the plate's right/wrong pair move
 * to blue/orange; tritanopia compresses blue/yellow, so it keeps red and
 * gets a red/cyan right-wrong pair instead. The world's mood bands are
 * aesthetic, not semantic, and stay untouched.
 *
 * REDUCED FLASH kills the peak-flow marquee pulse and halves the drain —
 * a game whose reward state is rhythmic flashing owes its players this
 * switch. READABLE TYPE renders the word plates in a wider-spaced
 * humanist face instead of the condensed monospace.
 *
 * The panel is also the game's one persisted settings surface, so the
 * LOOK row (STANDARD / BROADCAST, see render/broadcast-pass.js) lives
 * here despite being cosmetic rather than accessibility.
 */

import { Storage } from '../storage/storage.js';

const PALETTES = {
  off: { danger: 0xff2a1f, dangerCss: '255,42,31', right: '#57e389', wrong: '#ff2a1f' },
  deuteranopia: { danger: 0xff7800, dangerCss: '255,120,0', right: '#3fa7ff', wrong: '#ff7800' },
  protanopia: { danger: 0xff8c42, dangerCss: '255,140,66', right: '#5bc4ff', wrong: '#ff8c42' },
  tritanopia: { danger: 0xff2a1f, dangerCss: '255,42,31', right: '#00e0d5', wrong: '#ff4d6d' },
};

/** Live settings — renderers read this directly each frame/paint. */
export const ACCESS = {
  reducedFlash: false,
  readableType: false,
  // The BROADCAST look (Phase N as decided): a whole-frame cel/ink/glow
  // treatment, strictly opt-in — the shipped look is the default and this
  // stays false until a player flips the chip. Stage.render() reads it live.
  broadcastLook: false,
  // PD-1: the guided teaching surface. Default ON — a new player gets the
  // centered lessons; they retire on demonstrated action anyway, and this
  // chip serves the two edge cases (an expert on a fresh profile who wants
  // silence, and a returner who wants the teaching back).
  guidedTips: true,
  palette: 'off',
  epoch: 0, // bumped on every change so canvas caches (plates) re-paint
  ...PALETTES.off,
};

function persist() {
  Storage.setAccessPrefs({
    reducedFlash: ACCESS.reducedFlash,
    readableType: ACCESS.readableType,
    broadcastLook: ACCESS.broadcastLook,
    guidedTips: ACCESS.guidedTips,
    palette: ACCESS.palette,
  });
}

let styleEl = null;

function apply() {
  const p = PALETTES[ACCESS.palette] || PALETTES.off;
  Object.assign(ACCESS, p);
  ACCESS.epoch++;

  // DOM consumer of the danger accent: the close-range red wash. (The
  // hearts left the danger palette in the Phase L HUD pass — they are
  // vitality, not the Redline's alarm, and their rose hue reads in every
  // colour-vision mode without a per-mode repaint. The lunge tell went
  // with the lunge in Phase 18.) Source constants stay the shipped red;
  // modes override at runtime only.
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'accessOverrides';
    document.head.appendChild(styleEl);
  }
  const c = p.dangerCss;
  styleEl.textContent = ACCESS.palette === 'off' ? '' : `
    #dreadRed{background:radial-gradient(135% 90% at 50% 118%,rgba(${c},.5) 0%,rgba(${c},0) 58%) !important}
  `;
}

export function initAccess() {
  const saved = Storage.accessPrefs();
  ACCESS.reducedFlash = !!saved.reducedFlash;
  ACCESS.readableType = !!saved.readableType;
  ACCESS.broadcastLook = !!saved.broadcastLook;
  ACCESS.guidedTips = saved.guidedTips !== false; // unset = ON
  ACCESS.palette = PALETTES[saved.palette] ? saved.palette : 'off';
  apply();
}

/** The settings panel: an overlay of chip rows, opened from the title. */
export function buildAccessPanel(hooks = {}) {
  const style = document.createElement('style');
  style.textContent = `
    #accessBtn{position:absolute;top:calc(var(--safe-t) + 118px);right:14px;z-index:41;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(14,22,28,.6);color:#dff2fc;font:700 12px/1 var(--face);pointer-events:auto;cursor:pointer}
    /* z 90: above the pause button (81) and mute (80). At 70 the pause
       button floated ON TOP of the open panel — a player could pause under
       it, hit MENU, and land the title screen beneath this sheet with every
       layer's text overlapping. Nothing behind an open panel is tappable. */
    #accessPanel{position:absolute;inset:0;z-index:90;display:none;flex-direction:column;gap:14px;align-items:center;justify-content:center;background:rgba(4,7,10,.82);pointer-events:auto}
    #accessPanel.on{display:flex}
    #accessPanel h3{margin:0;font:700 12px/1 var(--face);letter-spacing:.3em;color:rgba(244,250,253,.8)}
    .accessRow{display:flex;flex-direction:column;gap:6px;align-items:center}
    .accessLabel{font:600 8px/1 var(--face);letter-spacing:.24em;color:rgba(235,247,252,.5)}
    .accessChips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
    #accessDone{margin-top:6px}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'accessBtn';
  btn.type = 'button';
  btn.textContent = 'AA';
  btn.setAttribute('aria-label', 'Accessibility options');
  document.getElementById('app').appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'accessPanel';
  const chipRow = (label, options, get, set) => {
    const row = document.createElement('div');
    row.className = 'accessRow';
    row.innerHTML = `<div class="accessLabel">${label}</div>`;
    const chips = document.createElement('div');
    chips.className = 'accessChips';
    for (const [value, text] of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'modeChip';
      b.textContent = text;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        set(value);
        apply();
        persist();
        sync();
      });
      b.dataset.value = value;
      chips.appendChild(b);
    }
    row.appendChild(chips);
    panel.appendChild(row);
    return () => {
      for (const b of chips.children) b.classList.toggle('on', b.dataset.value === String(get()));
    };
  };

  panel.innerHTML = '<h3>ACCESS</h3>';
  const syncs = [
    chipRow('FLASHING LIGHT', [[false, 'FULL'], [true, 'REDUCED']],
      () => ACCESS.reducedFlash, (v) => { ACCESS.reducedFlash = v === 'true' || v === true; }),
    chipRow('WORD TYPE', [[false, 'STANDARD'], [true, 'READABLE']],
      () => ACCESS.readableType, (v) => { ACCESS.readableType = v === 'true' || v === true; }),
    chipRow('COLOR VISION', [['off', 'DEFAULT'], ['deuteranopia', 'DEUTERANOPIA'],
      ['protanopia', 'PROTANOPIA'], ['tritanopia', 'TRITANOPIA']],
      () => ACCESS.palette, (v) => { ACCESS.palette = v; }),
    // Not an accessibility surface, but this panel is the game's one
    // persisted settings surface, so the look toggle lives here too.
    chipRow('LOOK', [[false, 'STANDARD'], [true, 'BROADCAST']],
      () => ACCESS.broadcastLook, (v) => { ACCESS.broadcastLook = v === 'true' || v === true; }),
    // PD-1: the guided teaching surface's switch lives with the other
    // persisted settings.
    chipRow('GUIDED TIPS', [[true, 'ON'], [false, 'OFF']],
      () => ACCESS.guidedTips, (v) => { ACCESS.guidedTips = v === 'true' || v === true; }),
  ];
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'modeChip';
  done.id = 'accessDone';
  done.textContent = 'DONE';
  // Playtest: the run kept going behind this panel, so reading the settings
  // cost you a life. Freeze the sim while it is open, WITHOUT routing through
  // pauseGame — that also raises the pause menu, and two stacked overlays is
  // not a fix. onOpen/onClose are supplied by main.js, which owns the flags.
  done.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.remove('on');
    hooks.onClose?.();
  });
  panel.appendChild(done);
  document.getElementById('app').appendChild(panel);

  const sync = () => { for (const s of syncs) s(); };
  sync();
  const open = () => { panel.classList.add('on'); sync(); hooks.onOpen?.(); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  // Playtest: the settings were reachable only from the title, so a player who
  // wanted them mid-run had to end the run. The pause menu raises the same
  // panel through this event. onOpen's own guard already declines to freeze
  // when the game is paused, so returning from here lands back on the pause
  // menu rather than resuming a run the player did not ask to resume.
  document.addEventListener('dictiondash:show-access', open);
  return { btn, panel, open };
}
