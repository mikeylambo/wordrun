/** Tiny pause UI. */
export class PauseUI {
  constructor({ onPause, onResume, onRestart, onQuit, ghostEnabled = true, onGhostChange }) {
    this.onPause = onPause;
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onQuit = onQuit;
    this.onGhostChange = onGhostChange;
    this.ghostEnabled = !!ghostEnabled;
    this.paused = false;

    const style = document.createElement('style');
    style.textContent = `
      #rc2PauseBtn{position:absolute;z-index:81;right:15px;top:calc(env(safe-area-inset-top,0px) + 15px);width:38px;height:38px;border-radius:50%;border:1px solid rgba(12,20,27,.32);background:rgba(235,245,250,.68);color:#111a21;font:900 14px/1 ui-monospace,monospace;display:none;place-items:center;cursor:pointer;backdrop-filter:blur(7px)}
      #rc2PauseBtn.on{display:grid}
      #mute{right:15px!important;top:calc(env(safe-area-inset-top,0px) + 61px)!important}
      #rc2Pause{position:absolute;inset:0;z-index:70;display:none;align-items:center;justify-content:center;background:rgba(8,13,17,.72);backdrop-filter:blur(8px);color:#f4fafc;padding:24px}
      #rc2Pause.on{display:flex}#rc2Pause .card{width:min(88vw,340px);text-align:center}
      #rc2Pause h2{font:900 clamp(34px,10vw,58px)/.9 ui-monospace,monospace;letter-spacing:.12em;margin-right:-.12em;margin-bottom:24px}
      #rc2Pause .actions{display:grid;gap:8px}#rc2Pause button.menu{appearance:none;width:100%;padding:13px 14px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#f7fbfd;cursor:pointer;font:900 11px/1 ui-monospace,monospace;letter-spacing:.22em}
      #rc2Pause button.menu:hover{background:rgba(255,255,255,.11)}
      #rc2Pause button.menu.secondary{opacity:.78}
      #deathScreen.rc2Poster{justify-content:flex-end!important;padding-bottom:max(7vh,48px)!important;gap:9px!important}
      #deathScreen.rc2Poster #shot,#deathScreen.rc2Poster #deathStats,#deathScreen.rc2Poster #deathSeed{display:none!important}
      #deathScreen.rc2Poster #deathTag{font-size:11px;letter-spacing:.42em}#deathScreen.rc2Poster .big{font-size:clamp(64px,20vw,118px)}
    `;
    document.head.appendChild(style);

    this.button = document.createElement('button');
    this.button.id = 'rc2PauseBtn';
    this.button.dataset.rc2Ui = '1';
    this.button.setAttribute('aria-label', 'Pause');
    this.button.textContent = 'Ⅱ';
    document.getElementById('app').appendChild(this.button);

    this.panel = document.createElement('div');
    this.panel.id = 'rc2Pause';
    this.panel.dataset.rc2Ui = '1';
    this.panel.innerHTML = `
      <div class="card">
        <h2>PAUSE</h2>
        <div class="actions">
          <button class="menu" data-act="resume">RESUME</button>
          <button class="menu" data-act="restart">RESTART</button>
          <button class="menu" data-act="ghost"></button>
          <button class="menu secondary" data-act="how">HOW TO SKI</button>
          <button class="menu secondary" data-act="quit">MENU</button>
        </div>
      </div>`;
    document.getElementById('app').appendChild(this.panel);
    this.ghostButton = this.panel.querySelector('[data-act="ghost"]');
    this._syncGhost();

    this.button.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.setPaused(true);
      this.onPause?.();
    });
    this.panel.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'resume') { this.setPaused(false); this.onResume?.(); }
      if (act === 'restart') { this.setPaused(false); this.onRestart?.(); }
      if (act === 'quit') { this.setPaused(false); this.onQuit?.(); }
      if (act === 'how') document.dispatchEvent(new CustomEvent('descent:show-how'));
      if (act === 'ghost') {
        this.setGhost(!this.ghostEnabled);
        this.onGhostChange?.(this.ghostEnabled);
      }
    });
  }

  _syncGhost() {
    if (this.ghostButton) this.ghostButton.textContent = `BEST RUN · ${this.ghostEnabled ? 'ON' : 'OFF'}`;
  }
  setGhost(on) { this.ghostEnabled = !!on; this._syncGhost(); }
  setButton(on) { this.button.classList.toggle('on', !!on); }

  setPaused(on) {
    this.paused = !!on;
    this.panel.classList.toggle('on', this.paused);
  }
}

export default PauseUI;
