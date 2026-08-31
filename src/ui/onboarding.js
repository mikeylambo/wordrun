// RC7 first-run clarity: one screen, then get out of the player's way.
// V1: the threat is discovered in play, never explained on title/help screens.
export class OnboardingUI {
  constructor({ ghostEnabled = true, onGhostChange, onStart }) {
    this.ghostEnabled = !!ghostEnabled;
    this.onGhostChange = onGhostChange;
    this.onStart = onStart;
    this.helpMode = false;

    const style = document.createElement('style');
    style.id = 'rc7-onboarding-style';
    style.textContent = `
      #rc7Onboarding{position:absolute;inset:0;z-index:76;display:none;align-items:center;justify-content:center;
        padding:24px;background:rgba(8,13,17,.78);backdrop-filter:blur(10px);color:#f4fafc}
      #rc7Onboarding.on{display:flex}
      #rc7Onboarding .card{width:min(90vw,390px);text-align:center}
      #rc7Onboarding h2{font:800 clamp(28px,8vw,46px)/.95 var(--face);letter-spacing:.08em;margin:0 0 20px;margin-right:-.08em}
      #rc7Onboarding .rules{display:grid;gap:9px;text-align:left;margin:0 0 18px}
      #rc7Onboarding .rule{display:grid;grid-template-columns:78px 1fr;gap:12px;align-items:start;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)}
      #rc7Onboarding .rule b{font:700 10px/1.4 var(--face);letter-spacing:.15em;color:#fff}
      #rc7Onboarding .rule span{font:700 10px/1.45 var(--face);letter-spacing:.04em;opacity:.72}
      #rc7Onboarding .ghost{display:flex;align-items:center;justify-content:space-between;margin:15px 0 18px;padding:11px 12px;border:1px solid rgba(255,255,255,.14)}
      #rc7Onboarding .ghost span{font:700 10px/1 var(--face);letter-spacing:.15em}
      #rc7Onboarding button{appearance:none;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#f7fbfd;cursor:pointer;font:700 11px/1 var(--face);letter-spacing:.2em}
      #rc7Onboarding .toggle{padding:8px 10px;min-width:62px}
      #rc7Onboarding .start{width:100%;padding:14px}

      /* A portrait-sized centered card clips on short landscape screens. Use
         horizontal space instead: two compact rule columns, smaller headline,
         and scroll only as a final fallback on unusually shallow viewports. */
      @media (orientation:landscape) and (max-height:620px){
        #rc7Onboarding{align-items:flex-start;overflow-y:auto;padding:max(10px,env(safe-area-inset-top,0px)) max(20px,calc(env(safe-area-inset-right,0px) + 20px)) max(10px,env(safe-area-inset-bottom,0px)) max(20px,calc(env(safe-area-inset-left,0px) + 20px))}
        #rc7Onboarding .card{width:min(92vw,900px);margin:auto;text-align:center}
        #rc7Onboarding h2{font-size:clamp(20px,4.5vw,30px);line-height:1;margin:0 0 10px}
        #rc7Onboarding .rules{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin:0 0 8px}
        #rc7Onboarding .rule{grid-template-columns:90px minmax(0,1fr);gap:10px;padding:6px 0;min-height:34px}
        #rc7Onboarding .rule b{font-size:9px;line-height:1.3}
        #rc7Onboarding .rule span{font-size:9px;line-height:1.35}
        #rc7Onboarding .ghost{margin:6px 0 8px;padding:8px 10px}
        #rc7Onboarding .toggle{padding:7px 9px}
        #rc7Onboarding .start{padding:10px}
      }
      @media (orientation:landscape) and (max-height:430px){
        #rc7Onboarding h2{font-size:18px;margin-bottom:6px}
        #rc7Onboarding .rules{column-gap:18px;margin-bottom:5px}
        #rc7Onboarding .rule{padding:4px 0;min-height:29px}
        #rc7Onboarding .ghost{margin:4px 0 6px;padding:6px 9px}
        #rc7Onboarding .start{padding:8px}
      }
    `;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.id = 'rc7Onboarding';
    this.root.dataset.rc7Ui = '1';
    const touch = (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer:coarse)').matches;
    const confirm = touch ? 'TAP' : 'SPACE';
    const dash = touch ? 'HOLD DASH' : 'HOLD F';
    this.root.innerHTML = `
      <div class="card">
        <h2>READ FAST</h2>
        <div class="rules">
          <div class="rule"><b>${confirm}</b><span>IF THE SPELLING IS REAL</span></div>
          <div class="rule"><b>PASS</b><span>IF IT IS NOT</span></div>
          <div class="rule"><b>SPEED</b><span>RIGHT READS RUN FASTER</span></div>
          <div class="rule dash"><b>${dash}</b><span>THE DASH. CLEAN READS CHARGE IT</span></div>
          <div class="rule"><b>♥ ♥ ♥</b><span>EVERY WRONG READ COSTS ONE</span></div>
          <div class="rule"><b>STREAK</b><span>CLEAN READS WIN THEM BACK</span></div>
        </div>
        <div class="ghost"><span>BEST RUN</span><button class="toggle" data-act="ghost"></button></div>
        <button class="start" data-act="start">BEGIN RUN</button>
      </div>`;
    document.getElementById('app').appendChild(this.root);
    this.toggle = this.root.querySelector('[data-act="ghost"]');
    this.startButton = this.root.querySelector('[data-act="start"]');
    this._sync();

    this.root.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'ghost') {
        this.setGhost(!this.ghostEnabled);
        this.onGhostChange?.(this.ghostEnabled);
      } else if (act === 'start') {
        if (this.helpMode) {
          this.hide();
          return;
        }
        this.hide();
        this.onStart?.();
      }
    });

    document.addEventListener('dictiondash:show-how', () => this.showHelp());
  }

  _sync() { this.toggle.textContent = this.ghostEnabled ? 'ON' : 'OFF'; }
  setGhost(on) { this.ghostEnabled = !!on; this._sync(); }

  show() {
    this.helpMode = false;
    this.startButton.textContent = 'BEGIN RUN';
    this.root.classList.add('on');
  }

  showHelp() {
    this.helpMode = true;
    this.startButton.textContent = 'BACK';
    this.root.classList.add('on');
  }

  hide() { this.root.classList.remove('on'); }
  get visible() { return this.root.classList.contains('on'); }
}

export default OnboardingUI;
