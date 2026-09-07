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
  // RC10.2 — the plate's legibility, as two dials rather than one switch.
  // Index into TUNING.PLATE's tables; 0 is the shipped default at both.
  plateSpacing: 0,
  plateSize: 0,
  // Derived from the two above and maintained by `apply()`: true whenever the
  // player has asked for ANY legibility help. The plate renderer and the run
  // export both read it, and the interface treatment follows it, so raising
  // either dial improves the whole game rather than only the word.
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
  musicOff: false,   // RC-5: the score, on its own switch
  sfxOff: false,     // RC-5: everything that is not the score
  palette: 'off',
  epoch: 0, // bumped on every change so canvas caches (plates) re-paint
  ...PALETTES.off,
};

function persist() {
  Storage.setAccessPrefs({
    reducedFlash: ACCESS.reducedFlash,
    plateSpacing: ACCESS.plateSpacing,
    plateSize: ACCESS.plateSize,
    broadcastLook: ACCESS.broadcastLook,
    guidedTips: ACCESS.guidedTips,
    musicOff: ACCESS.musicOff,
    sfxOff: ACCESS.sfxOff,
    palette: ACCESS.palette,
  });
}

let styleEl = null;

function apply() {
  const p = PALETTES[ACCESS.palette] || PALETTES.off;
  Object.assign(ACCESS, p);
  ACCESS.epoch++;
  // RC10.2: one intent, applied everywhere. A player who asked for a more
  // legible WORD is telling you something about the whole screen, so the same
  // switch relaxes the interface's smallest labels and sets the prose in the
  // same hyperlegible face. The plate reads the dials; CSS reads the class.
  ACCESS.readableType = ACCESS.plateSpacing > 0 || ACCESS.plateSize > 0;
  document.getElementById('app')?.classList.toggle('readable', ACCESS.readableType);

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
  // RC9.1: the right/wrong pair reaches CSS too. The review panel marks the
  // letters that moved in exactly these two colours, and a colour-vision mode
  // has to remap the marks the same way it remaps the plate — a review screen
  // that teaches with red against green teaches nobody in the modes this
  // palette exists for. Written for every palette INCLUDING `off`, so the
  // stylesheet reads one source for the pair rather than a default of its own.
  styleEl.textContent = `:root{--sem-right:${p.right};--sem-wrong:${p.wrong}}` +
    (ACCESS.palette === 'off' ? '' : `
    #dreadRed{background:radial-gradient(135% 90% at 50% 118%,rgba(${c},.5) 0%,rgba(${c},0) 58%) !important}
  `);
}

/**
 * Ask for (or leave) full screen.
 *
 * The play area is a fixed-aspect cabinet inside the window, so on a desktop a
 * windowed browser spends most of its pixels on bezel: full screen is the
 * single biggest legibility gain available to a keyboard player, and it costs
 * no new system. `#app` is not the element that goes full screen — the bezel
 * and the marquee are part of the presentation — so the document element does.
 * Rejection is normal (an iOS browser, a policy) and is not an error: the chip
 * simply reports what the browser did.
 */
export function setFullscreen(on) {
  const el = document.documentElement;
  const p = on
    ? (document.fullscreenElement ? null : el.requestFullscreen?.({ navigationUI: 'hide' }))
    : (document.fullscreenElement ? document.exitFullscreen?.() : null);
  p?.catch?.(() => {});
}

/** The switch, without caring which way it is currently thrown. */
export function toggleFullscreen() { setFullscreen(!document.fullscreenElement); }

export function initAccess() {
  const saved = Storage.accessPrefs();
  ACCESS.reducedFlash = !!saved.reducedFlash;
  // A profile saved before RC10.2 carries `readableType` and no dials. It
  // meant exactly today's step 1 tracking and no size change, so that is what
  // it becomes — nobody's setting silently moves under them.
  const step = (v, fallback) => (Number.isInteger(v) && v >= 0 && v <= 2 ? v : fallback);
  const legacy = saved.readableType ? 1 : 0;
  ACCESS.plateSpacing = step(saved.plateSpacing, legacy);
  ACCESS.plateSize = step(saved.plateSize, 0);
  ACCESS.broadcastLook = !!saved.broadcastLook;
  ACCESS.guidedTips = saved.guidedTips !== false; // unset = ON
  ACCESS.musicOff = saved.musicOff === true;      // unset = music ON
  ACCESS.sfxOff = saved.sfxOff === true;          // unset = sfx ON
  ACCESS.palette = PALETTES[saved.palette] ? saved.palette : 'off';
  apply();
}

/** The settings panel: an overlay of chip rows, opened from the title. */
export function buildAccessPanel(hooks = {}) {
  const style = document.createElement('style');
  style.textContent = `
    #accessBtn{position:absolute;top:calc(var(--safe-t) + 9px);right:9px;z-index:81;width:38px;height:38px;font-size:15px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(14,22,28,.6);color:#dff2fc;font:700 12px/1 var(--face);pointer-events:auto;cursor:pointer}
    /* z 90: above the pause button (81) and mute (80). At 70 the pause
       button floated ON TOP of the open panel — a player could pause under
       it, hit MENU, and land the title screen beneath this sheet with every
       layer's text overlapping. Nothing behind an open panel is tappable. */
    #accessPanel{position:absolute;inset:0;z-index:90;display:none;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:#05080c;background-image:linear-gradient(180deg,#070c11,#04070a);pointer-events:auto;overflow-y:auto;padding:28px 0}
    .accessSection{font:800 9px/1 var(--face,system-ui);letter-spacing:.34em;color:#8be4ff;margin:6px 0 -4px;opacity:.85}
    #accessPanel.on{display:flex}
    #accessPanel .accessAction{margin:2px 0 4px;padding:11px 18px;border:1px solid rgba(255,255,255,.18);border-radius:2px;background:transparent;color:#eef7fb;font:700 9px/1 var(--face);letter-spacing:.24em;cursor:pointer;pointer-events:auto}
    #accessPanel .accessAction:active{background:rgba(255,255,255,.1)}
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
  // RC6: the one piece of chrome on the title. It was 'AA' sitting third in
  // a stack of three corner buttons (sound, AA, the ◆ balance); a cabinet
  // shows the game and one way in to everything else.
  btn.textContent = '⚙';
  btn.setAttribute('aria-label', 'Settings');
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

  panel.innerHTML = '<h3>SETTINGS</h3>';
  // PD-3: this is the game's one settings surface, so it reads like one —
  // three plain groups instead of a junk drawer. HOW TO PLAY deliberately
  // does NOT live here: learning the controls is never a settings hunt
  // (it has its own chip on the title, and the pause menu's entry).
  const section = (label) => {
    const h = document.createElement('div');
    h.className = 'accessSection';
    h.textContent = label;
    panel.appendChild(h);
  };
  // RC6: two ACTIONS at the head of the sheet — the reference card and the
  // bank. Both used to be their own corner button or title chip; the sheet
  // is where everything that is not the game itself now lives.
  const actionRow = (label, run) => {
    const r = document.createElement('button');
    r.type = 'button';
    r.className = 'accessAction';
    r.dataset.rc2Ui = '1';
    r.textContent = label;
    r.addEventListener('click', (e) => { e.stopPropagation(); run(r); });
    panel.appendChild(r);
    return r;
  };

  const syncs = [];
  section('GAME');
  actionRow('HOW TO PLAY', () => {
    panel.classList.remove('on');
    hooks.onClose?.();
    document.dispatchEvent(new CustomEvent('dictiondash:show-how'));
  });
  const bankRow = actionRow('◆ 0', () => {
    panel.classList.remove('on');
    hooks.onClose?.();
    document.dispatchEvent(new CustomEvent('dictiondash:show-shop'));
  });
  syncs.push(() => { bankRow.textContent = `◆ ${Math.floor(hooks.getBank?.() || 0)}`; });
  syncs.push(
    chipRow('GUIDED TIPS', [[true, 'ON'], [false, 'OFF']],
      () => ACCESS.guidedTips, (v) => { ACCESS.guidedTips = v === 'true' || v === true; }),
    // The ghost's switch, mirrored here from the how-to card under the same
    // BEST RUN label. State lives with main.js; hooks carry it.
    chipRow('BEST RUN', [[true, 'ON'], [false, 'OFF']],
      () => !!hooks.getGhost?.(), (v) => hooks.setGhost?.(v === 'true' || v === true)),
  );
  section('VISUAL');
  syncs.push(
    chipRow('LOOK', [[false, 'STANDARD'], [true, 'BROADCAST']],
      () => ACCESS.broadcastLook, (v) => { ACCESS.broadcastLook = v === 'true' || v === true; }),
    // Full screen is NOT persisted and deliberately not in ACCESS: a browser
    // only grants it inside a user gesture, so a remembered "on" could not be
    // honoured on the next boot and the switch would lie. The chip reads the
    // browser's own state instead, which is the truth on every surface.
    chipRow('FULL SCREEN', [[true, 'ON'], [false, 'OFF']],
      () => !!document.fullscreenElement, (v) => setFullscreen(v === 'true' || v === true)),
    chipRow('FLASHING LIGHT', [[false, 'FULL'], [true, 'REDUCED']],
      () => ACCESS.reducedFlash, (v) => { ACCESS.reducedFlash = v === 'true' || v === true; }),
    // RC10.2: the one legibility switch becomes two dials. WORD SPACING is
    // the lever with the best evidence behind it and the one a one-edit fake
    // asks the most of; WORD SIZE is the one nobody could reach at all.
    chipRow('WORD SPACING', [[0, 'NORMAL'], [1, 'WIDE'], [2, 'WIDEST']],
      () => ACCESS.plateSpacing, (v) => { ACCESS.plateSpacing = Number(v) || 0; }),
    chipRow('WORD SIZE', [[0, 'NORMAL'], [1, 'LARGE'], [2, 'LARGEST']],
      () => ACCESS.plateSize, (v) => { ACCESS.plateSize = Number(v) || 0; }),
    chipRow('COLOR VISION', [['off', 'DEFAULT'], ['deuteranopia', 'DEUTERANOPIA'],
      ['protanopia', 'PROTANOPIA'], ['tritanopia', 'TRITANOPIA']],
      () => ACCESS.palette, (v) => { ACCESS.palette = v; }),
  );
  section('AUDIO');
  syncs.push(
    // The mute button's state, reachable as a setting too. Hooks again —
    // the audio system belongs to main.
    // RC-5: one SOUND switch could not answer "keep the game, lose the
    // score" — the commonest thing a player wants from a runner they play
    // with their own music on. Two lines, each persisted.
    chipRow('MUSIC', [[true, 'ON'], [false, 'OFF']],
      () => !ACCESS.musicOff, (v) => {
        ACCESS.musicOff = !(v === 'true' || v === true);
        hooks.setMusicMuted?.(ACCESS.musicOff);
      }),
    chipRow('SFX', [[true, 'ON'], [false, 'OFF']],
      () => !ACCESS.sfxOff, (v) => {
        ACCESS.sfxOff = !(v === 'true' || v === true);
        hooks.setSfxMuted?.(ACCESS.sfxOff);
      }),
  );
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
  // F, the browser's own Esc and the chip all reach the same state, so the
  // chip follows the browser rather than remembering what it last asked for.
  document.addEventListener('fullscreenchange', sync);
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
