/**
 * DICTION DASH player-facing UI.
 * Tiny vocabulary, deadpan delivery. The game is already funny.
 */

import TUNING from '../TUNING.js';
import { corruptionIntensity, veilOpacity } from '../render/corruption-curve.js';
import { ACCESS } from './access.js';
import { bandForDistance } from '../render/art-direction.js';

const $ = (id) => document.getElementById(id);

const PITCH_LABEL = {
  open: 'OPEN FACE',
  trees: 'THE TREES',
  cliffs: 'DROP LINE',
  moguls: 'BUMPY',
};

export class UI {
  constructor() {
    this.hud = $('hud');
    this.dist = $('dist');
    this.bestVal = $('bestVal');
    this.meterWrap = $('meterWrap');
    this.meter = $('meter');
    this.dread = $('dread');
    this.dreadRed = $('dreadRed');
    this.fur = $('fur');
    this.staticVeil = $('staticVeil');
    this.flash = $('flash');
    this.titleScreen = $('titleScreen');
    this.titleHint = $('titleHint');
    this.seedLine = $('seedLine');
    this.deathScreen = $('deathScreen');
    this.finalDist = $('finalDist');
    this.pbTag = $('pbTag');
    this.deathStats = $('deathStats');
    this.deathSeed = $('deathSeed');
    this.deathTag = $('deathTag');
    this.mute = $('mute');
    this.chain = $('chain');
    this.courage = $('courage');
    this.pitchName = $('pitchName');
    this.bandName = $('bandName');
    this.styleWord = $('styleWord');
    this.coach = $('coach');
    this.powerHint = $('powerHint');
    this.tell = $('tell');
    this.shot = $('shot');
    this.saveShot = $('saveShot');
    this.titleStreak = $('titleStreak');
    this.titleGoalRow = $('titleGoalRow');
    this.deathRecap = $('deathRecap');
    this.drainEl = $('drain');
    this.drainDimEl = $('drainDim');
    this._drainT = 0;

    this._lastDist = -1;
    this._flash = 0;
    this._furPhase = 0;
    this._lastChain = -1;
    this._chainLostT = 0;
    this._popT = 0;
    this._lastPitch = null;
    this._pitchT = 0;
    this._lastBand = null;
    this._bandT = 0;
    this._styleT = 0;
    this._powerT = 0;
    this._wasArmed = false;
    this._lastLanded = 0;
    this._lastFlubbed = 0;
    this._lastHits = 0;
    this._firstRun = true;
    this._showedChargeLesson = false;

    this.touch = (navigator.maxTouchPoints || 0) > 0 ||
      'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
    this.titleHint.textContent = 'HOW FAR CAN YOU GO?';
  }

  setSeed(seedString, best, runs) {
    this._firstRun = runs === 0;
    // A challenge link re-titles the line: the track is someone's dare,
    // not today's shared draft (functional label, not a sixth name).
    this.seedLine.textContent = this._challenge
      ? `CHALLENGE · ${seedString}${this._challenge.goal > 0 ? ` · TARGET ${this._challenge.goal}M` : ''}`
      : `TODAY'S DRAFT · ${seedString}`;
    this.deathSeed.textContent = '';
    this.bestVal.textContent = best > 0 ? `${Math.floor(best)}M` : '—';
  }

  /** Challenge context (Phase 14), or null to clear. */
  setChallenge(challenge) { this._challenge = challenge || null; }

  /** Title card: today's three goals and the play streak (meta layer). */
  setDaily(card) {
    if (!this.titleGoalRow || !card) return;
    this.titleStreak.textContent = card.streak > 0
      ? `DAY ${card.streak}${card.playedToday ? '' : ' · RUN TODAY TO KEEP IT'}`
      : '';
    this.titleGoalRow.innerHTML = card.goals.map((g) =>
      `<span class="goalChip${g.done ? ' done' : ''}">${g.label}</span>`).join('');
  }

  showTitle(on) { this.titleScreen.classList.toggle('on', on); }
  showDeath(on) { this.deathScreen.classList.toggle('on', on); }
  showHud(on) { this.hud.classList.toggle('on', on); }

  _say(text, kind = '', hold = 0.72) {
    if (!this.styleWord) return;
    this.styleWord.textContent = text;
    this.styleWord.className = `on ${kind}`.trim();
    this._styleT = hold;
  }

  stunt(name) {
    this._say('GONE!', 'clean', 0.95);
    if (this.pitchName) {
      this.pitchName.textContent = name;
      this.pitchName.classList.add('on');
      this._pitchT = 1.8;
    }
  }

  _updateCoach(sim, running) {
    if (!this.coach) return;
    if (!running || !this._firstRun) {
      this.coach.classList.remove('on');
      return;
    }

    const p = sim.player;
    const d = sim.distance;
    let text = '';
    if (d < 220) text = this.touch ? 'TAP IF THE WORD IS REAL' : 'SPACE IF THE WORD IS REAL';
    else if (d < 390) text = 'LET FAKES PASS';
    else if (d < 560) text = 'RIGHT READS RUN FASTER';
    else if (p.gatesThreaded > 0 && !this._showedChargeLesson) {
      // Where the dash comes from. The line that used to sit here ("STYLE
      // MAKES POWER") named a system this game no longer has and told
      // nobody what to do about it.
      text = 'CLEAN READS CHARGE THE DASH';
      this._showedChargeLesson = true;
    }

    if (text) {
      this.coach.textContent = text;
      this.coach.classList.add('on');
    } else this.coach.classList.remove('on');
  }

  update(dt, sim, running) {
    const p = sim.player;
    const d = Math.floor(sim.distance);
    if (d !== this._lastDist) {
      this._lastDist = d;
      this.dist.innerHTML = `${d}<small>M</small>`;
    }

    const pct = (p.boostMeter / TUNING.BOOST.METER_MAX) * 100;
    this.meter.style.width = `${pct.toFixed(1)}%`;
    const armed = p.boostMeter >= TUNING.BOOST.MIN_ACTIVATE;
    this.meterWrap.classList.toggle('armed', armed);
    this.meterWrap.classList.toggle('spending', p.overdrive);

    // The DASH's charged state (Phase 16). A hint that appears for 1.25s
    // and never returns is a hint most players never see; while the dash
    // is still unlearned this holds for as long as the meter is charged,
    // and it names the input instead of describing a feeling. REDUCED
    // FLASH drops the pulse but keeps every word of the instruction.
    if (running && this.powerHint) {
      const teaching = !this._dashLearned;
      if (armed && !this._wasArmed) {
        this.powerHint.textContent = 'DASH READY';
        this.powerHint.classList.add('on');
        this._powerT = teaching ? Infinity : 1.25;
      }
      if (teaching && armed) {
        this.powerHint.textContent = `DASH READY · ${this.touch ? 'HOLD DASH' : 'HOLD F'}`;
        this.powerHint.classList.add('on');
        this.powerHint.classList.toggle('teaching', !ACCESS.reducedFlash);
        this._powerT = Infinity;
      } else if (teaching && !armed) {
        // The lesson waits for the meter rather than expiring mid-charge.
        this.powerHint.classList.remove('on', 'teaching');
        this._powerT = 0;
      }
    }
    this._wasArmed = armed;
    if (p.overdrive && this.powerHint) {
      this.powerHint.textContent = 'DASH';
      this.powerHint.classList.add('on', 'spending');
      this.powerHint.classList.remove('teaching');
      this._powerT = 0.25;
    }
    if (this._powerT > 0 && this._powerT !== Infinity) {
      this._powerT = Math.max(0, this._powerT - dt);
      if (this._powerT === 0 && this.powerHint) {
        this.powerHint.classList.remove('on', 'spending', 'teaching');
      }
    }

    if (this._chainLostT > 0) {
      this._chainLostT = Math.max(0, this._chainLostT - dt);
      if (this._chainLostT === 0) {
        this.chain.classList.remove('lost', 'on');
        this._lastChain = -1;
      }
    } else if (p.chain !== this._lastChain) {
      this._lastChain = p.chain;
      if (p.chain > 0) {
        this.chain.textContent = `FLOW ×${p.chain}`;
        this.chain.classList.add('on', 'pop');
        this._popT = 0.16;
      } else this.chain.classList.remove('on');
    }
    if (this._popT > 0) {
      this._popT = Math.max(0, this._popT - dt);
      if (this._popT === 0) this.chain.classList.remove('pop');
    }

    if (p.tricksLanded > this._lastLanded) {
      const prox = sim.beast.proximityMult();
      this._say(prox > 1.35 ? 'TOO CLOSE' : 'CLEAN', prox > 1.35 ? 'danger' : 'clean');
    }
    if (p.tricksFlubbed > this._lastFlubbed) this._say('WOBBLE', 'danger');
    if (p.obstaclesHit > this._lastHits) this._say('BONK', 'danger');
    this._lastLanded = p.tricksLanded;
    this._lastFlubbed = p.tricksFlubbed;
    this._lastHits = p.obstaclesHit;

    if (this._styleT > 0) {
      this._styleT = Math.max(0, this._styleT - dt);
      if (this._styleT === 0 && this.styleWord) this.styleWord.className = '';
    }

    const earning = running && p.airborne && sim.beast.gap < TUNING.BOOST.PROX_RANGE;
    this.courage.classList.toggle('on', earning);
    if (earning) this.courage.textContent = `NO FEAR · ${sim.beast.proximityMult().toFixed(1)}×`;

    this.tell.style.opacity = running && sim.beast.lunge === 'tell'
      ? (0.45 + 0.55 * Math.abs(Math.sin(this._furPhase * 9))).toFixed(3) : '0';

    if (running) {
      const band = bandForDistance(sim.distance);
      if (band.id !== this._lastBand) {
        this._lastBand = band.id;
        // Bands are unnamed by design (Phase 6). Only a band that carries
        // one of the five approved names — in practice, PUBLISHED at the
        // finish — may ever surface a transition title.
        if (this.bandName && band.name) {
          this.bandName.textContent = band.name;
          this.bandName.classList.add('on');
          this._bandT = 2.6;
        }
      }
      const pn = sim.pitch.name;
      if (pn !== this._lastPitch) {
        this._lastPitch = pn;
        this.pitchName.textContent = PITCH_LABEL[pn] || pn;
        this.pitchName.classList.add('on');
        this._pitchT = 1.35;
      }
    }

    if (this._bandT > 0) {
      this._bandT = Math.max(0, this._bandT - dt);
      if (this._bandT === 0 && this.bandName) this.bandName.classList.remove('on');
    }
    if (this._pitchT > 0) {
      this._pitchT = Math.max(0, this._pitchT - dt);
      if (this._pitchT === 0) this.pitchName.classList.remove('on');
    }

    this._updateCoach(sim, running);

    const bands = running ? sim.beast.bands() : { roar: 0, footfall: 0, scream: 0, shake: 0 };
    // Continuous screen-space corruption, from the same gap the sim already
    // owns — visible escalation long before the close-range bands wake up.
    if (this.staticVeil) {
      const intensity = running ? corruptionIntensity(sim.beast.gap) : 0;
      const op = veilOpacity(intensity);
      this.staticVeil.style.opacity = op.toFixed(3);
      // Perf: the veil's steps() jitter animation repaints three full-screen
      // gradient layers forever — pause it whenever the layer is invisible.
      // REDUCED FLASH pauses the jitter outright (the texture still shows).
      this.staticVeil.style.animationPlayState =
        op > 0.005 && !ACCESS.reducedFlash ? 'running' : 'paused';
    }
    this.dread.style.opacity = (bands.footfall * 0.92).toFixed(3);
    this.dreadRed.style.opacity = (bands.scream * 0.9).toFixed(3);
    if (bands.footfall > 0.01) {
      this._furPhase += dt * (1.6 + bands.footfall * 3.4);
      const breath = 0.86 + Math.sin(this._furPhase) * 0.14;
      this.fur.style.opacity = (bands.footfall * 0.78).toFixed(3);
      this.fur.style.transform = `scaleY(${(breath * (0.55 + bands.footfall * 0.6)).toFixed(3)})`;
      this.fur.style.animationPlayState = 'running';
    } else {
      this.fur.style.opacity = '0';
      this.fur.style.animationPlayState = 'paused';
    }

    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 3.2);
      this.flash.style.opacity = (this._flash * 0.52).toFixed(3);
    }

    // The drain: sharp onset, ~0.6s recovery — the light comes back as the
    // world does. REDUCED FLASH halves its bite.
    if (this._drainT > 0) {
      this._drainT = Math.max(0, this._drainT - dt * 1.7);
      const k = this._drainT * this._drainT * (ACCESS.reducedFlash ? 0.5 : 1);
      if (this.drainEl) this.drainEl.style.opacity = (k * 0.85).toFixed(3);
      if (this.drainDimEl) this.drainDimEl.style.opacity = (k * 0.42).toFixed(3);
    }
  }

  /** Whether the player has ever dashed — retires the teaching beat. */
  setDashLearned(learned) { this._dashLearned = !!learned; }

  /** The player just dashed: the lesson is over, permanently. */
  dashFired() {
    this._dashLearned = true;
    this.powerHint?.classList.remove('teaching');
  }

  hitFlash() { this._flash = 1; }

  /** A wrong tap drains the world instead of flashing it (Phase 9). */
  drain() { this._drainT = 1; }

  chainLost(n) {
    if (n <= 0) return;
    this.chain.textContent = 'FLOW BROKEN';
    this.chain.classList.add('on', 'lost');
    this.chain.classList.remove('pop');
    this._chainLostT = 0.9;
  }

  renderDeath({ distance, best, isPb, shotUrl, recap, daily, lifetime, continued, challengeResult }) {
    this._deathExtras = { continued: !!continued, challengeResult: challengeResult || null };
    this.finalDist.textContent = Math.floor(distance);
    this.pbTag.style.visibility = isPb ? 'visible' : 'hidden';
    this.pbTag.textContent = isPb ? 'NEW BEST' : '';
    this.deathTag.textContent = 'REDACTED';
    this.bestVal.textContent = best > 0 ? `${Math.floor(best)}M` : '—';
    this.deathStats.innerHTML = '';
    this.deathStats.style.display = 'none';
    this.deathSeed.style.display = 'none';
    this.deathScreen.classList.add('rc2Poster');
    this._renderRecap(recap, daily, lifetime);

    if (shotUrl) {
      this.shot.src = shotUrl;
      this.shot.classList.remove('on');
      this.deathScreen.style.backgroundImage =
        `linear-gradient(180deg,rgba(6,10,13,.08) 25%,rgba(6,10,13,.28) 55%,rgba(6,10,13,.9) 100%),url("${shotUrl}")`;
      this.deathScreen.style.backgroundSize = 'cover';
      this.deathScreen.style.backgroundPosition = 'center';
      this.saveShot.style.display = '';
      this.saveShot.textContent = 'SAVE';
    } else {
      this.deathScreen.style.backgroundImage = '';
      this.saveShot.style.display = 'none';
    }
  }

  /**
   * The learning half of the death card (meta layer): which reads went
   * wrong and what the truth was, today's goal chips, and one lifetime
   * line. Teaches instead of only scolding — a wrong read always shows
   * the real spelling.
   */
  _renderRecap(recap, daily, lifetime) {
    if (!this.deathRecap) return;
    const parts = [];

    // Phase 14 result lines: the challenge verdict leads; a continued run
    // says plainly why the board didn't move.
    const extras = this._deathExtras || {};
    if (extras.challengeResult?.goal > 0) {
      parts.push(`<div class="metaLine">TARGET ${extras.challengeResult.goal}M · ${extras.challengeResult.beaten ? 'BEATEN' : 'NOT YET'}</div>`);
    }
    if (extras.continued) {
      parts.push('<div class="metaLine">CONTINUED · BEST + BEST RUN UNCHANGED</div>');
    }

    if (recap?.length) {
      const rows = recap.slice(0, 4).map((m) => m.reason === 'picked_fake'
        ? `<div class="miss"><s>${m.shown}</s> → <b>${m.answer}</b><small>NOT A WORD</small></div>`
        : `<div class="miss"><b>${m.shown}</b><small>WAS REAL — IT SLIPPED BY</small></div>`);
      const more = recap.length > 4 ? `<div class="metaLine">+${recap.length - 4} MORE</div>` : '';
      parts.push(`<div class="missHead">THE READS THAT WENT WRONG</div>${rows.join('')}${more}`);
    } else if (recap) {
      parts.push('<div class="missHead">EVERY READ WAS TRUE</div>');
    }

    if (daily?.goals) {
      parts.push(`<div class="goalRow">${daily.goals.map((g) =>
        `<span class="goalChip${g.done ? ' done' : ''}">${g.label}</span>`).join('')}</div>`);
    }

    if (lifetime) {
      const read = (lifetime.correct || 0) + (lifetime.wrong || 0);
      const acc = read > 0 ? Math.round((lifetime.correct || 0) / read * 100) : 0;
      const km = ((lifetime.metres || 0) / 1000).toFixed(1);
      const streak = daily?.streak > 0 ? `DAY ${daily.streak} · ` : '';
      const runs = lifetime.runs || 0;
      const bank = lifetime.currency > 0 ? ` · ◆ ${lifetime.currency}` : '';
      parts.push(`<div class="metaLine">${streak}${runs} ${runs === 1 ? 'RUN' : 'RUNS'} · ${km} KM · ${acc}% TRUE READS${bank}</div>`);
    }

    this.deathRecap.innerHTML = parts.join('');
  }

  clearRun() {
    this.chain.classList.remove('on', 'lost', 'pop');
    this.courage.classList.remove('on');
    this.pitchName.classList.remove('on');
    if (this.bandName) this.bandName.classList.remove('on');
    if (this.styleWord) this.styleWord.className = '';
    if (this.powerHint) this.powerHint.classList.remove('on', 'spending', 'teaching');
    if (this.coach) this.coach.classList.remove('on');
    this.tell.style.opacity = '0';
    this._lastChain = -1;
    this._chainLostT = 0;
    this._lastPitch = null;
    this._lastBand = null;
    this._lastLanded = 0;
    this._lastFlubbed = 0;
    this._lastHits = 0;
    this._wasArmed = false;
    this._styleT = 0;
    this._bandT = 0;
    this._powerT = 0;
    this._showedChargeLesson = false;
    this.deathScreen.classList.remove('rc2Poster');
    this.deathScreen.style.backgroundImage = '';
    this.deathStats.style.display = '';
    this.deathSeed.style.display = '';
    if (this.deathRecap) this.deathRecap.innerHTML = '';
    this._deathExtras = null;
  }

  clearDread() {
    this.dread.style.opacity = '0';
    this.dreadRed.style.opacity = '0';
    this.fur.style.opacity = '0';
    if (this.staticVeil) this.staticVeil.style.opacity = '0';
    this.flash.style.opacity = '0';
    this._flash = 0;
    if (this.drainEl) this.drainEl.style.opacity = '0';
    if (this.drainDimEl) this.drainDimEl.style.opacity = '0';
    this._drainT = 0;
  }
}
