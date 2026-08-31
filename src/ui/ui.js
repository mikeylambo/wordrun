/**
 * DICTION DASH player-facing UI.
 * Tiny vocabulary, deadpan delivery. The game is already funny.
 */

import TUNING from '../TUNING.js';
import { corruptionIntensity, veilOpacity } from '../render/corruption-curve.js';
import { ACCESS } from './access.js';
import { bandForDistance } from '../render/art-direction.js';
import { defineWord } from '../words/definitions.js';

const $ = (id) => document.getElementById(id);

/** One labelled recap row: a short key, then the words it describes. */
const row = (k, v) => `<div class="recapRow"><span class="k">${k}</span><span class="v">${v}</span></div>`;

export class UI {
  constructor() {
    this.hud = $('hud');
    this.dist = $('dist');
    this.bestVal = $('bestVal');
    this.meterWrap = $('meterWrap');
    this.meterZone = this.meterWrap?.closest('.meter-zone');
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
    this.bandName = $('bandName');
    this.coach = $('coach');
    this.powerHint = $('powerHint');
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
    this._lastBand = null;
    this._bandT = 0;
    this._powerT = 0;
    this._wasArmed = false;
    this._firstRun = true;
    this._showedChargeLesson = false;

    this.touch = (navigator.maxTouchPoints || 0) > 0 ||
      'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
    // Phase 19: the tagline is gone. A title screen that has to ask the
    // player a rhetorical question is a title screen that does not trust
    // its own wordmark. This line now carries the day's identity instead.
    this.titleHint.textContent = 'DAILY RUN';
  }

  setSeed(seedString, best, runs) {
    this._firstRun = runs === 0;
    // A challenge link re-titles the line: the track is someone's dare,
    // not today's shared draft (functional label, not a sixth name).
    // Two tiny lines, not one long one: WHAT this run is, then the numbers.
    this.titleHint.textContent = this._challenge ? 'CHALLENGE' : 'DAILY RUN';
    this.seedLine.textContent = this._challenge
      ? (this._challenge.goal > 0 ? `BEAT ${this._challenge.goal}M` : seedString)
      : seedString;
    this.deathSeed.textContent = '';
    this.bestVal.textContent = best > 0 ? `${Math.floor(best)}M` : '—';
  }

  /** Challenge context (Phase 14), or null to clear. */
  setChallenge(challenge) { this._challenge = challenge || null; }

  /** Title card: today's three goals and the play streak (meta layer). */
  setDaily(card) {
    if (!this.titleGoalRow || !card) return;
    this.titleStreak.textContent = card.streak > 0
      ? `DAY ${card.streak}${card.playedToday ? '' : ' · KEEP IT'}`
      : '';
    this.titleGoalRow.innerHTML = card.goals.map((g) =>
      `<span class="goalChip${g.done ? ' done' : ''}">${g.label}</span>`).join('');
  }

  showTitle(on) { this.titleScreen.classList.toggle('on', on); }
  showDeath(on) { this.deathScreen.classList.toggle('on', on); }
  showHud(on) { this.hud.classList.toggle('on', on); }

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
    // The whole zone carries the state so the label lights with the cells.
    this.meterZone?.classList.toggle('armed', armed);
    this.meterZone?.classList.toggle('spending', p.overdrive);

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

    if (running) {
      const band = bandForDistance(sim.distance);
      if (band.id !== this._lastBand) {
        this._lastBand = band.id;
        // Bands are unnamed by design (Phase 6). Only a band that carries
        // one of the four approved names — in practice, FINISH at 30K —
        // may ever surface a transition title.
        if (this.bandName && band.name) {
          this.bandName.textContent = band.name;
          this.bandName.classList.add('on');
          this._bandT = 2.6;
        }
      }
    }

    if (this._bandT > 0) {
      this._bandT = Math.max(0, this._bandT - dt);
      if (this._bandT === 0 && this.bandName) this.bandName.classList.remove('on');
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

  renderDeath({ distance, best, isPb, shotUrl, recap, daily, objectives, review, lifetime, continued, challengeResult }) {
    this._deathExtras = { continued: !!continued, challengeResult: challengeResult || null };
    this.finalDist.textContent = Math.floor(distance);
    this.pbTag.style.visibility = isPb ? 'visible' : 'hidden';
    this.pbTag.textContent = isPb ? 'NEW BEST' : '';
    this.deathTag.textContent = 'RUN OVER';
    this.bestVal.textContent = best > 0 ? `${Math.floor(best)}M` : '—';
    this.deathStats.innerHTML = '';
    this.deathStats.style.display = 'none';
    this.deathSeed.style.display = 'none';
    this.deathScreen.classList.add('rc2Poster');
    this._renderRecap(recap, daily, objectives, review, lifetime);

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
  _renderRecap(recap, daily, objectives, review, lifetime) {
    if (!this.deathRecap) return;
    const parts = [];
    const extras = this._deathExtras || {};

    if (extras.challengeResult?.goal > 0) {
      parts.push(row('TARGET', `${extras.challengeResult.goal}M · ${extras.challengeResult.beaten ? 'BEATEN' : 'NOT YET'}`));
    }
    if (extras.continued) parts.push(row('CONTINUED', 'BEST UNCHANGED'));

    // Phase 19: this used to be one full sentence per wrong read — four
    // lines of the same slipped-by sentence stacked under a seven-word
    // heading. The teaching is unchanged (a slipped word is named; a
    // tapped fake still shows the true spelling beside the misspelling
    // that lost it) but the words carrying it moved into two labels.
    if (recap?.length) {
      const slipped = recap.filter((m) => m.reason !== 'picked_fake');
      const tapped = recap.filter((m) => m.reason === 'picked_fake');
      // Phase 21: the section that teaches gets a real heading rather than a
      // caption. UNCAUGHT pairs with NOT A WORD and drops the awkward
      // "slipped by a list of words" construction the old label produced.
      parts.push('<div class="recapHead">MISSED WORDS</div>');
      if (slipped.length) {
        const shown = slipped.slice(0, 4).map((m) => m.shown).join('  ');
        const more = slipped.length > 4 ? ` <em>+${slipped.length - 4}</em>` : '';
        parts.push(row('UNCAUGHT', shown + more));
      }
      if (tapped.length) {
        const shown = tapped.slice(0, 3)
          .map((m) => `<s>${m.shown}</s><b>${m.answer}</b>`).join('  ');
        const more = tapped.length > 3 ? ` <em>+${tapped.length - 3}</em>` : '';
        parts.push(row('NOT A WORD', shown + more));
      }
      // The literacy loop closes here (Phase 21). Every word game will tell
      // you which spelling was right; none of them tell you what the word
      // means, which is the only part a player carries away from the run.
      // Two at most — the card is read in about two seconds and a wall of
      // definitions is a wall. For a tapped fake the lesson is the TRUE
      // word, not the misspelling that caught them out.
      const taught = [];
      for (const m of recap) {
        const word = m.reason === 'picked_fake' ? m.answer : m.shown;
        if (!word || taught.some((t) => t.word === word)) continue;
        const meaning = defineWord(word);
        if (meaning) taught.push({ word, meaning });
        if (taught.length === 2) break;
      }
      for (const t of taught) {
        parts.push(`<div class="defRow"><b>${t.word}</b> ${t.meaning}</div>`);
      }
    } else if (recap) {
      parts.push('<div class="clean">PERFECT RUN</div>');
    }

    if (daily?.goals) {
      parts.push(`<div class="goalRow">${daily.goals.map((g) =>
        `<span class="goalChip${g.done ? ' done' : ''}">${g.label}</span>`).join('')}</div>`);
    }

    // The run itself, as a shape (Phase 21). The speed curve recovered from
    // the ghost track, with every wrong read hung at the distance it
    // happened. It says the one thing a list of missed words cannot: not
    // that four went wrong, but that three of them came inside 200 m.
    if (review?.bins?.length > 1 && review.peak > 0) {
      const H = 30;
      const pts = review.bins
        .map((b) => `${(b.x * 100).toFixed(2)},${(H - (b.speed / review.peak) * (H - 3)).toFixed(2)}`)
        .join(' ');
      const marks = review.marks.map((m) => {
        const x = (m.x * 100).toFixed(2);
        return `<line class="rm ${m.kind}" x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
      }).join('');
      parts.push('<div class="recapHead">THE RUN</div>');
      parts.push(
        `<svg class="runPlot" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">`
        + `<polygon class="rf" points="0,${H} ${pts} 100,${H}"/>`
        + `<polyline class="rl" points="${pts}"/>${marks}</svg>`
      );
      if (review.worst) {
        parts.push(`<div class="runNote">${review.worst.from}–${review.worst.to} M`
          + ` · ${review.worst.count} MISSED</div>`);
      }
    }

    // The rotating queue (Phase 21). Cleared first — that is the payoff —
    // then the three now live with the progress this run actually made
    // against them. A freshly drawn objective reports zero by construction:
    // showing it part-filled would draw the retroactive credit the queue
    // exists to refuse.
    if (objectives?.live?.length) {
      const bits = [];
      for (const c of objectives.cleared || []) {
        bits.push(`<div class="objRow done"><span class="ol">${c.label}</span>`
          + '<span class="ob"><i style="width:100%"></i></span>'
          + `<span class="ov">◆${c.reward}</span></div>`);
      }
      for (const o of objectives.live) {
        const pct = Math.round(Math.max(0, Math.min(1, o.progress || 0)) * 100);
        bits.push(`<div class="objRow"><span class="ol">${o.label}</span>`
          + `<span class="ob"><i style="width:${pct}%"></i></span>`
          + `<span class="ov">◆${o.reward}</span></div>`);
      }
      parts.push('<div class="recapHead">OBJECTIVES</div>');
      parts.push(`<div class="objList">${bits.join('')}</div>`);
    }

    // The lifetime numbers as a broadcast stat bar: figure over label.
    if (lifetime) {
      const read = (lifetime.correct || 0) + (lifetime.wrong || 0);
      const acc = read > 0 ? Math.round((lifetime.correct || 0) / read * 100) : 0;
      const km = ((lifetime.metres || 0) / 1000).toFixed(1);
      const runs = lifetime.runs || 0;
      parts.push(`<div class="statBar">${[
        [runs, runs === 1 ? 'RUN' : 'RUNS'],
        [km, 'KM'],
        [`${acc}%`, 'TRUE READS'],
      ].map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>`);
    }

    this.deathRecap.innerHTML = parts.join('');
  }

  clearRun() {
    this.chain.classList.remove('on', 'lost', 'pop');
    if (this.bandName) this.bandName.classList.remove('on');
    if (this.powerHint) this.powerHint.classList.remove('on', 'spending', 'teaching');
    if (this.coach) this.coach.classList.remove('on');
    this._lastChain = -1;
    this._chainLostT = 0;
    this._lastBand = null;
    this._wasArmed = false;
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
