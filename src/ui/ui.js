/**
 * DESCENT player-facing UI.
 * Tiny vocabulary, deadpan delivery. The game is already funny.
 */

import TUNING from '../TUNING.js';
import { corruptionIntensity, veilOpacity } from '../render/corruption-curve.js';
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
    this._showedPowerLesson = false;

    this.touch = (navigator.maxTouchPoints || 0) > 0 ||
      'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
    this.titleHint.textContent = 'HOW FAR CAN YOU GO?';
  }

  setSeed(seedString, best, runs) {
    this._firstRun = runs === 0;
    this.seedLine.textContent = `TODAY'S MOUNTAIN · ${seedString}`;
    this.deathSeed.textContent = '';
    this.bestVal.textContent = best > 0 ? `${Math.floor(best)}M` : '—';
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
    if (d < 60) text = this.touch ? 'DRAG — CARVE' : 'A / D — CARVE';
    else if (d < 220) text = this.touch ? 'TAP IF THE WORD IS REAL' : 'SPACE IF THE WORD IS REAL';
    else if (d < 390) text = 'LET FAKES PASS';
    else if (p.gatesThreaded > 0 && !this._showedPowerLesson) {
      text = 'STYLE MAKES POWER';
      this._showedPowerLesson = true;
      this._powerT = Math.max(this._powerT, 1.7);
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

    if (running && armed && !this._wasArmed && this.powerHint) {
      this.powerHint.textContent = 'POWER READY';
      this.powerHint.classList.add('on');
      this._powerT = 1.25;
    }
    this._wasArmed = armed;
    if (p.overdrive && this.powerHint) {
      this.powerHint.textContent = 'GO';
      this.powerHint.classList.add('on', 'spending');
      this._powerT = 0.25;
    }
    if (this._powerT > 0) {
      this._powerT = Math.max(0, this._powerT - dt);
      if (this._powerT === 0 && this.powerHint) this.powerHint.classList.remove('on', 'spending');
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
        if (this.bandName) {
          this.bandName.textContent = band.name;
          this.bandName.classList.add('on');
          this._bandT = band.id === 'slope' ? 1.4 : 2.6;
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
      this.staticVeil.style.opacity = veilOpacity(intensity).toFixed(3);
    }
    this.dread.style.opacity = (bands.footfall * 0.92).toFixed(3);
    this.dreadRed.style.opacity = (bands.scream * 0.9).toFixed(3);
    if (bands.footfall > 0.01) {
      this._furPhase += dt * (1.6 + bands.footfall * 3.4);
      const breath = 0.86 + Math.sin(this._furPhase) * 0.14;
      this.fur.style.opacity = (bands.footfall * 0.78).toFixed(3);
      this.fur.style.transform = `scaleY(${(breath * (0.55 + bands.footfall * 0.6)).toFixed(3)})`;
    } else this.fur.style.opacity = '0';

    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 3.2);
      this.flash.style.opacity = (this._flash * 0.52).toFixed(3);
    }
  }

  hitFlash() { this._flash = 1; }

  chainLost(n) {
    if (n <= 0) return;
    this.chain.textContent = 'FLOW BROKEN';
    this.chain.classList.add('on', 'lost');
    this.chain.classList.remove('pop');
    this._chainLostT = 0.9;
  }

  renderDeath({ distance, best, isPb, shotUrl }) {
    this.finalDist.textContent = Math.floor(distance);
    this.pbTag.style.visibility = isPb ? 'visible' : 'hidden';
    this.pbTag.textContent = isPb ? 'NEW BEST' : '';
    this.deathTag.textContent = 'CAUGHT';
    this.bestVal.textContent = best > 0 ? `${Math.floor(best)}M` : '—';
    this.deathStats.innerHTML = '';
    this.deathStats.style.display = 'none';
    this.deathSeed.style.display = 'none';
    this.deathScreen.classList.add('rc2Poster');

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

  clearRun() {
    this.chain.classList.remove('on', 'lost', 'pop');
    this.courage.classList.remove('on');
    this.pitchName.classList.remove('on');
    if (this.bandName) this.bandName.classList.remove('on');
    if (this.styleWord) this.styleWord.className = '';
    if (this.powerHint) this.powerHint.classList.remove('on', 'spending');
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
    this._showedPowerLesson = false;
    this.deathScreen.classList.remove('rc2Poster');
    this.deathScreen.style.backgroundImage = '';
    this.deathStats.style.display = '';
    this.deathSeed.style.display = '';
  }

  clearDread() {
    this.dread.style.opacity = '0';
    this.dreadRed.style.opacity = '0';
    this.fur.style.opacity = '0';
    if (this.staticVeil) this.staticVeil.style.opacity = '0';
    this.flash.style.opacity = '0';
    this._flash = 0;
  }
}
