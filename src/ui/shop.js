/**
 * The ◆ shop (Phase 14) — the balance's first sink with a face.
 *
 * One overlay, opened from the title: the runner-light palettes from
 * TUNING.META.COSMETICS, each chip showing its price until owned and its
 * swatch always. Buying spends from the meta stats 'currency' key (the
 * same ledger the bells feed) and equips immediately; choices persist
 * through Storage prefs. Cosmetic only — no palette touches gameplay or
 * the semantic color grammar.
 */

import TUNING from '../TUNING.js';
import { Storage } from '../storage/storage.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export function buildShopPanel({ stats, onEquip, onOpen, onClose }) {
  const style = document.createElement('style');
  style.textContent = `
    #shopBtn{position:absolute;top:calc(var(--safe-t) + 160px);right:14px;z-index:41;min-width:34px;height:34px;padding:0 8px;border-radius:17px;border:1px solid rgba(255,255,255,.2);background:rgba(14,22,28,.6);color:#dff2fc;font:700 11px/1 var(--face);pointer-events:auto;cursor:pointer}
    /* z 90: above the pause button (81) and mute (80), so nothing behind an
       open panel is tappable — the overlap bug was the pause button living
       on top of this sheet. */
    #shopPanel{position:absolute;inset:0;z-index:90;display:none;flex-direction:column;gap:14px;align-items:center;justify-content:center;background:rgba(4,7,10,.82);pointer-events:auto}
    #shopPanel.on{display:flex}
    #shopPanel h3{margin:0;font:700 12px/1 var(--face);letter-spacing:.3em;color:rgba(244,250,253,.8)}
    #shopBalance{font:600 10px/1 var(--face);letter-spacing:.2em;color:#a8ecff}
    .shopChips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:min(88vw,420px)}
    .shopChip{display:flex;flex-direction:column;gap:5px;align-items:center;min-width:74px}
    .shopChip .swatch{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.25)}
    .shopChip .modeChip{min-width:74px}
    #shopDone{margin-top:6px}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'shopBtn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Runner light shop');
  document.getElementById('app').appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'shopPanel';
  panel.innerHTML = '<h3>RUNNER LIGHT</h3><div id="shopBalance"></div>';
  const chips = document.createElement('div');
  chips.className = 'shopChips';
  panel.appendChild(chips);

  const balance = () => Math.max(0, Math.floor(stats.get('currency', 0)));
  const owned = (id) => id === 'default' || Storage.cosmeticsOwned().includes(id);
  const equipped = () => Storage.equippedCosmetic();

  const entries = [];
  for (const c of TUNING.META.COSMETICS) {
    const wrap = document.createElement('div');
    wrap.className = 'shopChip';
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = `radial-gradient(circle at 35% 35%, ${hex(c.limb)}, ${hex(c.halo)})`;
    swatch.style.boxShadow = `0 0 14px ${hex(c.halo)}66`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'modeChip';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (owned(c.id)) {
        Storage.setEquippedCosmetic(c.id);
        onEquip?.(c);
      } else if (balance() >= c.cost) {
        stats.increment('currency', -c.cost);
        Storage.addCosmetic(c.id);
        Storage.setEquippedCosmetic(c.id);
        onEquip?.(c);
      }
      sync();
    });
    wrap.append(swatch, b);
    chips.appendChild(wrap);
    entries.push({ c, b });
  }

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'modeChip';
  done.id = 'shopDone';
  done.textContent = 'DONE';
  done.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.remove('on');
    onClose?.();
  });
  panel.appendChild(done);
  document.getElementById('app').appendChild(panel);

  function sync() {
    btn.textContent = `◆ ${balance()}`;
    panel.querySelector('#shopBalance').textContent = `BALANCE ◆ ${balance()}`;
    for (const { c, b } of entries) {
      const has = owned(c.id);
      b.textContent = has ? c.label : `${c.label} · ◆${c.cost}`;
      b.classList.toggle('on', equipped() === c.id);
      b.disabled = !has && balance() < c.cost;
      b.style.opacity = b.disabled ? '.45' : '';
    }
  }
  sync();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.add('on');
    sync();
    // Playtest: the shop opened over a live run and the run kept going —
    // the same hearts-behind-a-panel bug the settings surface had. The
    // caller supplies the quiet freeze; opening always reports.
    onOpen?.();
  });

  return { btn, panel, sync };
}
