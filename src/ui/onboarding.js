import { HEARTS } from '../design/bells.js';
import { control, barControl, chargeNoun, modalityFor } from './teach-copy.js';

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
      /* Playtest: this read as a controls list, not as teaching. It is now
         sentences, with the control set as a highlighted key inside the
         sentence — you learn what the game wants and see which button does
         it in the same glance. */
      #rc7Onboarding .rules{display:grid;gap:0;text-align:left;margin:0 0 18px}
      #rc7Onboarding .rule{padding:11px 0;border-bottom:1px solid rgba(255,255,255,.08);
        font:500 13px/1.5 var(--face);letter-spacing:.005em;color:rgba(244,251,254,.8)}
      #rc7Onboarding .rule:last-child{border-bottom:0}
      #rc7Onboarding .rule b{display:inline-block;font:800 11px/1 var(--face);letter-spacing:.14em;
        color:#0b1218;background:#8be4ff;padding:5px 8px;border-radius:2px;margin:0 3px;
        transform:translateY(-1px)}
      #rc7Onboarding .rule i{font-style:normal;color:#8be4ff;font-weight:700}
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
    // RC8.1: every control token on this card is the one the in-run coach and
    // the stops use, read from ui/teach-copy.js. The card used to name its
    // own — TAP RIGHT / TAP LEFT for the buttons the game labels REAL and
    // FAKE, and a bare DASH for a press it called a hold — so a player who
    // read the card met different words for the same three controls the
    // moment they started running.
    const m = modalityFor({ touch });
    const yes = control('real', m);
    const no = control('fake', m);
    const dash = control('dash', m);
    const charge = chargeNoun(m);
    const bar = barControl(m);
    const HEART_STREAK = HEARTS.STREAK_REPAIR_DEFAULT;
    this.root.innerHTML = `
      <div class="card">
        <h2>HOW TO PLAY</h2>
        <div class="rules">
          <div class="rule"><b>${yes}</b> if the word is spelled correctly.
            A misspelled word can simply pass — or say so with <b>${no}</b>.</div>
          <div class="rule">Every word you read right makes you <i>faster</i>.
            Every one you get wrong slows you down.</div>
          <div class="rule">You have <i>three hearts</i>, and any wrong read costs one.
            Read <i>${HEART_STREAK} in a row</i> to win one back.</div>
          <div class="rule"><b>${dash}</b> when the ${charge} is full to tear down the track.</div>
          <div class="rule">The sooner you answer, the more the read is worth.</div>
          <div class="rule">Fakes look almost right — one letter out of place.</div>
          <div class="rule">${bar.verb} <b>${bar.control}</b> to raise the bar —
            a stricter window, a bigger multiplier.</div>
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
    // Playtest (RC): the condensed "essence" experiment made the fresh open
    // WORSE — the full six-rule card is the one that works, everywhere.
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
