/**
 * DICTION DASH player-facing UI.
 * Tiny vocabulary, deadpan delivery. The game is already funny.
 */

import TUNING from '../TUNING.js';
import { HEARTS } from '../design/bells.js';
import { corruptionIntensity, veilOpacity } from '../render/corruption-curve.js';
import { ACCESS } from './access.js';
import { bandForDistance } from '../render/art-direction.js';
import { defineWord } from '../words/definitions.js';
import { dangerFor, dangerBand } from '../words/danger.js';
import { COUNT_BEATS, FALLBACK_BPS, countValue } from './results-motion.js';

const $ = (id) => document.getElementById(id);

/** One labelled recap row: a short key, then the words it describes. */
const row = (k, v) => `<div class="recapRow"><span class="k">${k}</span><span class="v">${v}</span></div>`;

export class UI {
  constructor() {
    this.hud = $('hud');
    this.dist = $('dist');
    this.bestVal = $('bestVal');
    this.distSub = $('distSub');
    this.meterWrap = $('meterWrap');
    this.meterZone = this.meterWrap?.closest('.meter-zone');
    this.barLevel = document.getElementById('barLevel');
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

    // The answer vignette (playtest: "the visual for correct/incorrect
    // selection needs to be more visible"). At speed the eye is already on
    // the NEXT word, so the verdict has to arrive peripherally: one brief
    // screen-edge wash in the semantic right/wrong colour — the same pair
    // the colour-vision modes remap, so the verdict survives every mode.
    // Acted answers only (a passive pass stays quiet), REDUCED FLASH skips.
    this.answerGlow = document.createElement('div');
    this.answerGlow.id = 'answerGlow';
    this.answerGlow.style.cssText =
      'position:fixed;inset:0;z-index:5;pointer-events:none;opacity:0;';
    document.body.appendChild(this.answerGlow);
    this._ansT = 0;

    // Hearts — the fail state (Phase 0: folded in from the deleted rc5.js's
    // second HUD). One pip per life in the HUD column's vitals slot, so they
    // stack under the score instead of racing its clamped height. The pips are
    // synced from the sim every frame in update(); a restored heart pulses.
    // `this.vitals` is the element other layers reach for (mobile UI classes
    // it, the ship-polish streak widget hangs off it) via window.__UI.
    this.vitals = document.createElement('div');
    this.vitals.id = 'vitals';
    this.vitals.setAttribute('aria-label', 'Health');
    this.heartPips = [];
    for (let i = 0; i < HEARTS.MAX; i++) {
      const h = document.createElement('span');
      h.className = 'heartPip';
      h.textContent = '♥';
      this.vitals.appendChild(h);
      this.heartPips.push(h);
    }
    ($('vitalsSlot') || this.hud || document.body).appendChild(this.vitals);
    this._lastHearts = HEARTS.MAX;

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
    // Playtest: the date-seed line came off the title — DAILY RUN already
    // says what today's course is; the string was inventory, not identity.
    // A challenge keeps its line: the dare's target is the whole point.
    this.seedLine.textContent = this._challenge
      ? (this._challenge.goal > 0 ? `BEAT ${this._challenge.goal}M` : seedString)
      : '';
    this.deathSeed.textContent = '';
    this.bestVal.textContent = best > 0 ? Math.floor(best).toLocaleString('en-US') : '—';
  }

  /** Challenge context (Phase 14), or null to clear. */
  setChallenge(challenge) { this._challenge = challenge || null; }

  /** Title card: the play streak only (meta layer). Playtest: the three
   *  goal chips (metres, chain, reads) came off the title — they are judged
   *  at the run's end and shown on the results card, where the numbers
   *  mean something; on the menu they were clutter before the first tap.
   *  The goalChip rendering lives on in the recap. */
  setDaily(card) {
    if (!this.titleGoalRow || !card) return;
    this.titleStreak.textContent = card.streak > 0
      ? `DAY ${card.streak}${card.playedToday ? '' : ' · KEEP IT'}`
      : '';
    this.titleGoalRow.innerHTML = '';
  }

  showTitle(on) { this.titleScreen.classList.toggle('on', on); }
  showDeath(on) { this.deathScreen.classList.toggle('on', on); }
  showHud(on) { this.hud.classList.toggle('on', on); }

  /** Which controls this player has ever actually used. Persisted, so the
   *  teaching follows the player rather than the calendar. */
  setLessons(learned) { this._lessons = learned || {}; }

  /** PD-1: while the centered TEACH surface owns the fundamentals, the
   *  coach line skips those rungs — one instruction at a time, everywhere. */
  setGuidedActive(on) { this._guidedActive = !!on; }

  _updateCoach(sim, running) {
    if (!this.coach) return;
    if (!running) {
      this.coach.classList.remove('on');
      return;
    }

    const p = sim.player;
    const d = sim.distance;
    const L = this._lessons || {};
    let text = '';
    // Playtest: "L/R works but we have no player onboarding to teach them
    // that." There was teaching — it just stopped existing after the first
    // run of the DAY (`runs === 0`), which for anyone past their first sitting
    // is never, and no line in the game ever named the dash control at all.
    // A lesson now runs until the player has performed the action it teaches,
    // and then goes quiet for good. Someone who already taps REAL on instinct
    // never sees a word of it; someone who has not found the left zone keeps
    // being told it exists.
    //
    // Phase C teaches the right zone first, because it is the whole game
    // without the left one. The left zone arrives as an option, not a rule —
    // a player who never uses it plays exactly the game they already knew.
    if (!L.confirm) {
      // PD-1: the TEACH surface owns this rung when guided tips are on.
      text = this._guidedActive ? ''
        : (this.touch ? 'TAP RIGHT IF THE WORD IS REAL' : 'RIGHT ARROW IF THE WORD IS REAL');
    } else if (!L.reject) {
      text = this._guidedActive ? ''
        : (d < 300
          ? 'A MISSPELLED WORD CAN SIMPLY PASS'
          : (this.touch ? 'OR TAP LEFT TO CALL IT OUT SOONER' : 'OR LEFT ARROW TO CALL IT OUT SOONER'));
    } else if (!L.dash && p.boostMeter >= TUNING.BOOST.MIN_ACTIVATE && !p.overdrive) {
      // The line the game never had. "CLEAN READS CHARGE THE DASH" said where
      // the charge comes from and then left the player holding a full meter
      // with nothing telling them what to press.
      text = this.touch ? 'TAP DASH — THE BAR IS FULL' : 'SPACE TO DASH — THE BAR IS FULL';
    } else if (!L.bar && p.compressionLevel === 0 && p.chain >= 4) {
      // Phase R: the compression hold joins the lesson set. Taught only to a
      // player already reading cleanly (a four-link chain) — the bar is the
      // reward knob for someone who has stopped needing the other lessons —
      // and retired for good the first time they actually raise it.
      text = this.touch ? 'HOLD RIGHT TO RAISE THE BAR' : 'UP ARROW TO RAISE THE BAR';
    } else if (this._firstRun) {
      if (d < 720) text = 'ANSWERING EARLY IS WORTH MORE';
      else if (p.gatesThreaded > 0 && !this._showedChargeLesson) {
        text = 'CLEAN READS CHARGE THE DASH';
        this._showedChargeLesson = true;
      }
    }

    // Phase L HUD pass: one instruction at a time. The dash hint is the
    // louder, more contextual line — while it is up, the coach yields, so
    // two teaching sentences never share the frame with the word.
    if (this.powerHint?.classList.contains('on')) text = '';

    if (text) {
      this.coach.textContent = text;
      this.coach.classList.add('on');
    } else this.coach.classList.remove('on');
  }

  /** Paint the heart pips for a life count; `restored` pulses the survivors. */
  setHearts(n, restored = false) {
    this.heartPips.forEach((h, i) => h.classList.toggle('empty', i >= n));
    if (restored) {
      this.vitals.classList.remove('pulse');
      void this.vitals.offsetWidth;
      this.vitals.classList.add('pulse');
    }
  }

  /** Keep the hearts in step with the sim: hidden off the run, and a pulse the
   *  frame a heart comes back (the loss is carried by the sound + drain). */
  _syncHearts(sim) {
    const live = sim.phase === 'running';
    this.vitals.style.opacity = live ? '1' : '0';
    const n = sim.hearts ?? HEARTS.MAX;
    this.setHearts(n, live && n > this._lastHearts);
    this._lastHearts = n;
  }

  update(dt, sim, running, clock = null) {
    const p = sim.player;
    this._syncHearts(sim);
    this._updateCount(dt, clock);
    // Phase 25: the headline is the SCORE. Distance only ever said how long
    // you ran; score says how well, because every metre and every read is
    // worth the chain multiplier you were holding. Distance stays on screen
    // as the sub-line — it is still the spine of the run and still what the
    // goals and objectives ask for, it just stops being the brag.
    const sc = sim.score;
    if (sc !== this._lastScore) {
      this._lastScore = sc;
      this.dist.textContent = sc.toLocaleString('en-US');
    }
    // The sub-line answers whichever question the mode actually poses. On the
    // DAILY RUN's fixed route every finisher travels the same ground, so
    // metres say nothing about the player; progress through the hundred gates
    // is the real position, and it is what two players can compare. ENDLESS
    // has no route to be partway through, so distance stays the honest
    // endurance figure there.
    const routeGates = sim.rules?.GATES | 0;
    const sub = routeGates > 0
      ? `${Math.min(sim.wordGates.next, routeGates)} / ${routeGates}`
      : `${Math.floor(sim.distance)} M`;
    if (sub !== this._lastSub) {
      this._lastSub = sub;
      if (this.distSub) this.distSub.textContent = sub;
    }

    const pct = (p.boostMeter / TUNING.BOOST.METER_MAX) * 100;
    this.meter.style.width = `${pct.toFixed(1)}%`;
    // The compression level, as marks. No label: it is the player's own bar,
    // and naming it would spend the fifth name the game does not have.
    const lvl = p.compressionLevel | 0;
    if (lvl !== this._lastBar && this.barLevel) {
      this._lastBar = lvl;
      const max = TUNING.WORDS.COMPRESSION_MULT.length - 1;
      this.barLevel.textContent = '▰'.repeat(lvl) + '▱'.repeat(Math.max(0, max - lvl));
      this.barLevel.classList.toggle('set', lvl > 0);
      this.barLevel.setAttribute('aria-label', `Reward bar ${lvl} of ${max}`);
    }

    const armed = p.boostMeter >= TUNING.BOOST.MIN_ACTIVATE;
    // Playtest: filling the meter is the run's best moment and it happened in
    // silence. Announce the rising edge once — a sound and a single flash of
    // the cells — and never again until it empties and refills.
    if (armed && !this._wasArmed && running) {
      // REDUCED FLASH keeps the sound and drops the pulse, the same bargain
      // the dash hint makes.
      if (!ACCESS.reducedFlash) {
        this.meterZone?.classList.remove('justArmed');
        void this.meterZone?.offsetWidth;      // restart the animation
        this.meterZone?.classList.add('justArmed');
      }
      document.dispatchEvent(new CustomEvent('dictiondash:dash-ready'));
    }
    if (!armed) this.meterZone?.classList.remove('justArmed');
    this._wasArmed = armed;
    // The whole zone carries the state so the label lights with the cells.
    this.meterZone?.classList.toggle('armed', armed);
    this.meterZone?.classList.toggle('spending', p.overdrive);
    // Phase I: while spending, the rim's hue steps with the dash chain. A
    // colour, never a label — the cap holds at four names.
    if (p.overdrive) {
      const hues = TUNING.BOOST.DASH.CHAIN_HUES;
      const hue = hues[Math.max(0, Math.min(hues.length - 1, p.dashChain | 0))];
      if (hue !== this._lastDashHue) { this._lastDashHue = hue; this.meterZone?.style.setProperty('--dashHue', String(hue)); }
    }

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

    // The answer vignette: sharp onset, fast decay — a verdict, not a glow.
    if (this._ansT > 0) {
      this._ansT = Math.max(0, this._ansT - dt * 4.5);
      this.answerGlow.style.opacity = (this._ansT * this._ansT).toFixed(3);
    }
  }

  /** One peripheral wash of the verdict's own colour. Acted answers only. */
  answerFlash(ok) {
    if (ACCESS.reducedFlash) return;
    const c = ok ? ACCESS.right : ACCESS.wrong;
    this.answerGlow.style.background =
      `radial-gradient(130% 100% at 50% 52%, transparent 58%, ${c}${ok ? '30' : '3d'} 100%)`;
    this._ansT = 1;
  }

  /** Phase Q: step the results headline up the count-up curve. Beats come
   *  from the music clock when it is playing; otherwise frame time advances
   *  them at FALLBACK_BPS, so a muted player sees the same reveal and the
   *  same final number. Each whole beat nudges the headline — REDUCED FLASH
   *  drops the nudge and keeps the count. */
  _updateCount(dt, clock) {
    const c = this._count;
    if (!c || c.done || !this.deathScreen.classList.contains('on')) return;
    if (clock?.playing) {
      if (c.lastBeat != null) c.beats += Math.max(0, clock.beat - c.lastBeat);
      c.lastBeat = clock.beat;
    } else {
      c.lastBeat = null;
      c.beats += dt * FALLBACK_BPS;
    }
    if (c.beats >= COUNT_BEATS) {
      c.done = true;
      this.finalDist.textContent = c.score.toLocaleString('en-US');
      this.deathScreen.classList.add('settled');
      return;
    }
    this.finalDist.textContent = countValue(c.score, c.beats).toLocaleString('en-US');
    const tick = Math.floor(c.beats);
    if (tick !== c.lastTick && !ACCESS.reducedFlash) {
      c.lastTick = tick;
      const big = this.finalDist.parentElement;
      big?.classList.remove('tick');
      void big?.offsetWidth; // restart the nudge on every beat
      big?.classList.add('tick');
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

  /** The continue's price, shown where the number actually is. The score
   *  drops mid-run now rather than at the recap, so the drop needs to be
   *  seen happening — otherwise it reads as a glitch in the counter. */
  flashScoreCut(amount) {
    if (!this.dist || !(amount > 0)) return;
    this.dist.classList.remove('cut');
    void this.dist.offsetWidth; // restart the animation on a second continue
    this.dist.classList.add('cut');
    const tag = document.createElement('div');
    tag.className = 'scoreCut';
    tag.textContent = `−${Math.floor(amount).toLocaleString('en-US')}`;
    // Beside the score, not under it: under it is where the distance line
    // already lives, and two numbers in one place is the overlap this card
    // has been reported for before.
    tag.style.left = `${this.dist.offsetWidth + 14}px`;
    this.dist.parentElement?.appendChild(tag);
    setTimeout(() => { tag.remove(); this.dist.classList.remove('cut'); }, 1500);
  }

  renderDeath({ distance, score, scoreLost = 0, continuesUsed = 0, failedRoute = false, avgReadMs = 0,
    seconds = 0, gates = 0, routeGates = 0, retired = [], best, isPb, shotUrl, recap, daily, objectives, review, lifetime, continued, challengeResult, endFlow = 0, standout = null, finished = false }) {
    this._deathExtras = { continued: !!continued, challengeResult: challengeResult || null, standout };
    // Phase Q: the headline counts up from zero on the beat clock — update()
    // steps it each frame via _updateCount and lands it exactly on the score.
    this._count = { score: Math.floor(score ?? 0), beats: 0, lastBeat: null, lastTick: -1, done: false };
    this.finalDist.textContent = '0';
    // The card enters in the flow band the run ended on: the headline's glow
    // carries the earned brightness, and main.js holds the world behind the
    // card at the same level.
    this.deathScreen.style.setProperty('--endFlow', Math.max(0, Math.min(1, endFlow)).toFixed(3));
    this.deathScreen.classList.remove('settled');
    this._deathDistance = Math.floor(distance);
    // A continued run banks less than it earned. Say so on the card, where the
    // number is, rather than only refusing the record quietly.
    if (scoreLost > 0) {
      this.pbTag.style.visibility = 'visible';
      const why = continuesUsed > 0
        ? `${continuesUsed} CONTINUE${continuesUsed > 1 ? 'S' : ''}`
        : 'ROUTE UNFINISHED';
      this.pbTag.textContent = `−${Math.floor(scoreLost).toLocaleString('en-US')} · ${why}`;
    } else {
      this.pbTag.style.visibility = isPb ? 'visible' : 'hidden';
      this.pbTag.textContent = isPb ? 'NEW BEST' : '';
    }
    // A run that reached the end of the route earned the other name: the
    // card reads FINISH (an approved name), not RUN OVER — a completed
    // DAILY RUN is a victory screen, not a failure screen.
    this.deathTag.textContent = finished ? 'FINISH' : 'RUN OVER';
    this.bestVal.textContent = best > 0 ? Math.floor(best).toLocaleString('en-US') : '—';
    this.deathStats.innerHTML = '';
    this.deathStats.style.display = 'none';
    this.deathSeed.style.display = 'none';
    this.deathScreen.classList.add('rc2Poster');
    this._avgReadMs = avgReadMs;
    this._seconds = seconds;
    this._retired = retired;
    this._gates = gates;
    this._routeGates = routeGates;
    this._renderRecap(recap, daily, objectives, review, lifetime);

    if (shotUrl) {
      this.shot.src = shotUrl;
      this.shot.classList.remove('on');
      // Playtest: this gradient started at 8% opacity, so the run's last frame
      // — which at a death is the corruption at full strength, the busiest
      // image the game can produce — sat at nearly full contrast directly
      // behind the score and every label under it. The shot is context, not
      // content: it stays legible as a backdrop and stops competing with the
      // figures. The card is the thing being read.
      this.deathScreen.style.backgroundImage =
        `linear-gradient(180deg,rgba(6,10,13,.80) 0%,rgba(6,10,13,.90) 26%,rgba(6,10,13,.95) 55%,rgba(6,10,13,.985) 100%),url("${shotUrl}")`;
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
      parts.push(row('TARGET', `${extras.challengeResult.goal.toLocaleString('en-US')} · ${extras.challengeResult.beaten ? 'BEATEN' : 'NOT YET'}`));
    }
    if (extras.continued) parts.push(row('CONTINUED', 'BEST UNCHANGED'));
    // E4: at most ONE standout, chosen by rarity in meta/standout.js — an
    // ordinary run shows nothing here, and that is the point.
    if (extras.standout) parts.push(row(extras.standout.k, extras.standout.v));

    // Phase 19: this used to be one full sentence per wrong read — four
    // lines of the same slipped-by sentence stacked under a seven-word
    // heading. The teaching is unchanged (a slipped word is named; a
    // tapped fake still shows the true spelling beside the misspelling
    // that lost it) but the words carrying it moved into two labels.
    if (recap?.length) {
      // Playtest: this cluttered the results card. The teaching is the best
      // thing on the screen and it was competing with the score for it, so it
      // moved behind one line you choose to open. Nothing is lost — the panel
      // holds more than the card ever could, definitions included.
      const slipped = recap.filter((m) => m.reason !== 'picked_fake');
      const tapped = recap.filter((m) => m.reason === 'picked_fake');
      this._missed = { slipped, tapped, recap };
      parts.push(`<button class="missedOpen" id="missedOpen" data-rc2-ui>`
        + `${recap.length} MISSED · REVIEW</button>`);
    } else if (recap) {
      parts.push('<div class="clean">PERFECT RUN</div>');
    }

    // Playtest: the card was carrying TWO parallel goal systems in two places
    // — today's chips floating loose under the score, and the rotating queue
    // under its own heading much further down. Read together they looked like
    // six unrelated targets. They are built here and printed once, inside the
    // one OBJECTIVES block below, which is where a reader is already looking
    // for "what am I chasing".
    const dailyChips = daily?.goals?.length
      ? `<div class="goalRow">${daily.goals.map((g) =>
        `<span class="goalChip${g.done ? ' done' : ''}">${g.label}</span>`).join('')}</div>`
      : '';

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
        // The count is already on the REVIEW button directly above; this line
        // exists to say WHERE, which is the thing the button cannot say.
        parts.push(`<div class="runNote">WORST STRETCH ${review.worst.from}–${review.worst.to} M</div>`);
      }
    }

    // The rotating queue (Phase 21). Cleared first — that is the payoff —
    // then the three now live with the progress this run actually made
    // against them. A freshly drawn objective reports zero by construction:
    // showing it part-filled would draw the retroactive credit the queue
    // exists to refuse.
    if (objectives?.live?.length || dailyChips) {
      const bits = [];
      for (const c of objectives?.cleared || []) {
        bits.push(`<div class="objRow done"><span class="ol">${c.label}</span>`
          + '<span class="ob"><i style="width:100%"></i></span>'
          + `<span class="ov">◆${c.reward}</span></div>`);
      }
      for (const o of objectives.live || []) {
        const pct = Math.round(Math.max(0, Math.min(1, o.progress || 0)) * 100);
        bits.push(`<div class="objRow"><span class="ol">${o.label}</span>`
          + `<span class="ob"><i style="width:${pct}%"></i></span>`
          + `<span class="ov">◆${o.reward}</span></div>`);
      }
      parts.push('<div class="recapHead">OBJECTIVES</div>');
      if (bits.length) parts.push(`<div class="objList">${bits.join('')}</div>`);
      parts.push(dailyChips);
    }

    // The lifetime numbers as a broadcast stat bar: figure over label.
    if (lifetime) {
      const read = (lifetime.correct || 0) + (lifetime.wrong || 0);
      const acc = read > 0 ? Math.round((lifetime.correct || 0) / read * 100) : 0;
      const runs = lifetime.runs || 0;
      // Phase B adds exactly one figure: how fast the reading was. It replaces
      // the lifetime kilometres, which said the least of the three now that
      // distance is not a board metric.
      const avgRead = this._avgReadMs > 0 ? `${(this._avgReadMs / 1000).toFixed(2)}s` : '—';
      // A word the player has beaten. This is the one line on the card that
      // is about them rather than about the run, and it is the payoff for the
      // whole per-word ledger: a word missed four times, then read clean three
      // times running, is gone from the lane for good.
      for (const r of (this._retired || []).slice(0, 2)) {
        parts.push(`<div class="defRow"><b>BEATEN</b>${r.word} — ` +
          `missed ${r.misses} time${r.misses === 1 ? '' : 's'}, now retired</div>`);
      }

      // Four facts, and the first one is whichever the mode makes meaningful.
      // Time is here as a record of the run rather than as live pressure: a
      // clock on the HUD tells a player to hurry, and this game's whole
      // posture is that the word stays readable long enough to be read.
      const secs = Math.max(0, Math.round(this._seconds || 0));
      const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      const first = this._routeGates > 0
        ? [`${Math.min(this._gates, this._routeGates)}/${this._routeGates}`, 'GATES']
        : [`${this._deathDistance ?? 0}`, 'METRES'];
      parts.push(`<div class="statBar four">${[
        first,
        [`${acc}%`, 'TRUE READS'],
        [avgRead, 'AVG READ'],
        [clock, 'TIME'],
      ].map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>`);
    }

    this.deathRecap.innerHTML = parts.join('');
  }

  /** The review panel: every missed word, with what it meant. */
  /** `evidenceFor` is optional and reads the per-word ledger, so a word this
   *  player keeps missing rates higher than its shape alone would say. */
  renderMissedPanel(evidenceFor = null) {
    const m = this._missed;
    const body = document.getElementById('missedBody');
    if (!body || !m) return;
    const parts = [];
    if (m.tapped.length) {
      parts.push('<div class="mHead">NOT A WORD</div>');
      for (const x of m.tapped) parts.push(this._missedRow(x.answer, x.shown, evidenceFor));
    }
    if (m.slipped.length) {
      parts.push('<div class="mHead">UNCAUGHT</div>');
      for (const x of m.slipped) parts.push(this._missedRow(x.shown, null, evidenceFor));
    }
    body.innerHTML = parts.join('');
  }

  _missedRow(word, wrongSpelling, evidenceFor = null) {
    const meaning = defineWord(word);
    // How hard this word is, as marks rather than a name — the same choice the
    // compression bar makes, and for the same reason. It answers the question
    // a review panel always raises: was that one on me, or is it just a
    // horrible word? Three pips means everybody struggles with it.
    const band = dangerBand(dangerFor(word, evidenceFor?.(word) || null));
    const pips = { low: 1, mid: 2, high: 3 }[band];
    const risk = `<span class="mRisk ${band}">${
      [0, 1, 2].map((i) => `<i${i < pips ? ' class="on"' : ''}></i>`).join('')}</span>`;
    return `<div class="mRow"><div class="mWord">`
      + (wrongSpelling ? `<s>${wrongSpelling}</s>` : '')
      + `<b>${word}</b>${risk}</div>`
      + (meaning ? `<div class="mDef">${meaning}</div>` : '')
      + '</div>';
  }

  clearRun() {
    document.getElementById('missedPanel')?.classList.remove('on');
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
    this._lastHearts = HEARTS.MAX;
    this.vitals?.classList.remove('pulse');
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
