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
import {
  MODALITY, confirmLesson, rejectLesson, barLesson, dashReadyLine, PASS_LESSON,
} from './teach-copy.js';
import { setBandLine } from './guided.js';

const $ = (id) => document.getElementById(id);

/** The heart, drawn once and shared by all three layers of every pip. */
const HEART_PATH = 'M12 21.2 3.6 12.6a5.6 5.6 0 0 1 0-7.9 5.4 5.4 0 0 1 7.7 0l.7.7.7-.7a5.4 5.4 0 0 1 7.7 0 5.6 5.6 0 0 1 0 7.9Z';

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
    this.barMarks = $('barMarks');
    this.barPips = this.barMarks ? [...this.barMarks.querySelectorAll('i')] : [];
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
    // RC6.2: drawn hearts, not a font glyph. '♥' rendered at whatever weight
    // and shape each platform's emoji or symbol font happened to have — a
    // different silhouette on every device, for the piece of HUD that says
    // whether you are alive. These are one path, stroked and filled by us.
    //
    // The fill is also the streak: the NEXT empty heart fills from the
    // bottom as the clean run climbs toward the reads that win one back
    // (HEARTS.STREAK_REPAIR_*). "Five in a row wins a heart" is drawn inside
    // the heart it wins, so the run needs no second widget to say it, and a
    // full row says nothing extra at all.
    this.heartPips = [];
    for (let i = 0; i < HEARTS.MAX; i++) {
      const h = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      h.setAttribute('class', 'heartPip');
      h.setAttribute('viewBox', '0 0 24 22');
      h.setAttribute('aria-hidden', 'true');
      // One clip per heart, so a partial fill is clipped to the heart's own
      // shape rather than drawn as a rectangle over it.
      const uid = `heartClip${i}`;
      h.innerHTML =
        `<defs><clipPath id="${uid}"><path d="${HEART_PATH}"/></clipPath></defs>` +
        `<path class="hFill" d="${HEART_PATH}"/>` +
        `<rect class="hStreak" x="0" y="22" width="24" height="22" clip-path="url(#${uid})"/>` +
        `<path class="hLine" d="${HEART_PATH}"/>`;
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

    this.touch = (navigator.maxTouchPoints || 0) > 0 ||
      'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
    // Phase 19: the tagline is gone. A title screen that has to ask the
    // player a rhetorical question is a title screen that does not trust
    // its own wordmark. This line now carries the day's identity instead.
    // RC-5: no caption under the wordmark — the mode chips below already
    // say which run this is, and a label under the title read as a
    // subtitle for the GAME rather than a name for the mode.
    this.titleHint.textContent = '';
  }

  setSeed(seedString, best, runs) {
    // A challenge link re-titles the line: the track is someone's dare,
    // not today's shared draft (functional label, not a sixth name).
    // Two tiny lines, not one long one: WHAT this run is, then the numbers.
    this.titleHint.textContent = this._challenge ? 'CHALLENGE' : '';
    // Playtest: the date-seed line came off the title — DAILY RUN already
    // says what today's course is; the string was inventory, not identity.
    // A challenge keeps its line: the dare's target is the whole point.
    this.seedLine.textContent = this._challenge
      ? (this._challenge.goal > 0 ? `BEAT ${this._challenge.goal}M` : seedString)
      : '';
    this.deathSeed.textContent = '';
    this.bestVal.textContent = best > 0 ? Math.floor(best).toLocaleString('en-US') : '—';
  }

  /** The approved name for the day's course. It labels the MODE (the chip
   *  that selects it, and any copy that has to say which run this is) — it
   *  is no longer printed under the wordmark, where it read as a subtitle
   *  for the game itself. One of the four names; there is no fifth. */
  static get DAILY_NAME() { return 'DAILY RUN'; }

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

  /** RC7: while the three stops own the fundamentals, the coach skips those
   *  rungs; with GUIDED TIPS off there are no stops, so it teaches them as
   *  it always did. `setStopActive` silences it outright for a frozen frame —
   *  a stop is one line on one band, and nothing else speaks over it. */
  setGuidedActive(on) { this._guidedActive = !!on; }
  setStopActive(on) { this._stopActive = !!on; }
  /** RC7.1: the dash line, after its stop has let go without a dash. The
   *  coach carries it for as long as the charge is there and the hold is
   *  still unlearned — the ring stays lit on the control beside it. */
  setDashLine(line) { this._dashLine = line || ''; }

  /** RC8.1: the device the copy speaks to. One source (ui/teach-copy.js)
   *  feeds the coach, the charged hint and the stops, so the three cannot
   *  drift apart or name a control this player does not have. */
  setModality(m) { this._modality = m || (this.touch ? MODALITY.TOUCH : MODALITY.KEY); }
  get modality() { return this._modality || (this.touch ? MODALITY.TOUCH : MODALITY.KEY); }

  _updateCoach(sim, running) {
    if (!this.coach) return;
    if (!running) {
      this.coach.classList.remove('on');
      return;
    }

    const p = sim.player;
    const d = sim.distance;
    const L = this._lessons || {};
    // A stopped frame carries ONE line, on the teach band. The coach is
    // silent through it — not merely skipping a rung.
    if (this._stopActive) {
      this.coach.classList.remove('on');
      return;
    }
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
    // RC7: while the stops are running they teach these three at the first
    // instance of each, and the coach does not pre-empt them. Switch GUIDED
    // TIPS off and there are no stops — then these rungs are the teaching,
    // exactly as they were. The bar is the coach's either way: no stop
    // covers it, because it is not a fundamental.
    const stopsTeach = !!this._guidedActive;
    // The dash stop's line outlives the freeze: it moves here.
    const m = this.modality;
    if (this._dashLine) {
      text = this._dashLine;
    } else if (!stopsTeach && !L.confirm) {
      text = confirmLesson(m);
    } else if (!stopsTeach && !L.reject) {
      text = d < 300 ? PASS_LESSON : rejectLesson(m);
    } else if (!stopsTeach && !L.dash && p.boostMeter >= TUNING.BOOST.MIN_ACTIVATE && !p.overdrive) {
      // The line the game never had. "CLEAN READS CHARGE THE DASH" said where
      // the charge comes from and then left the player holding a full meter
      // with nothing telling them what to press. RC8.1: it is THE charged
      // phrase, read from teach-copy.js — the same bytes the stop and the
      // HUD hint show, so a player never meets two names for one press.
      text = dashReadyLine(m);
    } else if (!L.bar && p.compressionLevel === 0 && p.chain >= 4) {
      // Phase R: the compression hold joins the lesson set. Taught only to a
      // player already reading cleanly (a four-link chain) — the bar is the
      // reward knob for someone who has stopped needing the other lessons —
      // and retired for good the first time they actually raise it. RC8.1
      // says what it buys as well as what to hold: it is a bargain, not a
      // button, and a line that only named the button taught half of it.
      text = barLesson(m);
    }
    // RC-5: the value and charge asides are gone. "ANSWERING EARLY IS WORTH
    // MORE" and "CLEAN READS CHARGE THE DASH" described the economy at a
    // player who was busy reading a word — commentary, not instruction, and
    // it fired on every first run of a day forever. What remains is only the
    // teaching a player cannot proceed without: the two verbs, the dash when
    // the charge is actually full, and the bar for someone already chaining.
    // Each still retires for good the moment its action is performed.

    // Phase L HUD pass: one instruction at a time. The dash hint is the
    // louder, more contextual line — while it is up, the coach yields, so
    // two teaching sentences never share the frame with the word.
    if (this.powerHint?.classList.contains('on')) text = '';

    if (text) {
      if (text !== this._lastCoach) { this._lastCoach = text; setBandLine(this.coach, text); }
      this.coach.classList.add('on');
    } else this.coach.classList.remove('on');
  }

  /**
   * Paint the heart pips for a life count; `restored` pulses the survivors.
   * `streakFrac` (0..1) fills the NEXT empty heart — the clean run climbing
   * toward the one that wins it back. Nothing fills when the row is full.
   */
  setHearts(n, restored = false, streakFrac = 0) {
    this.heartPips.forEach((h, i) => {
      h.classList.toggle('empty', i >= n);
      // The next empty heart is the one being earned; the rest stay empty.
      const filling = i === n ? Math.max(0, Math.min(1, streakFrac)) : 0;
      const rect = h.querySelector('.hStreak');
      // The rect grows upward from the heart's base, clipped to its outline.
      if (rect) {
        rect.setAttribute('y', (22 - filling * 22).toFixed(2));
        rect.setAttribute('height', (filling * 22).toFixed(2));
      }
    });
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
    // The streak-to-heart ladder shortens as hearts are lost — the same
    // table the sim repairs from, read here so the two can never disagree.
    const full = n >= (sim.maxHearts ?? HEARTS.MAX);
    const need = HEARTS.STREAK_REPAIR_BY_HEARTS[n] ?? HEARTS.STREAK_REPAIR_DEFAULT;
    const streak = sim.wordGates?.streak || 0;
    const frac = !live || full || need <= 0 ? 0 : (streak % need) / need;
    this.setHearts(n, live && n > this._lastHearts, frac);
    this._lastHearts = n;
    this.vitals.setAttribute('aria-label', full
      ? `Hearts ${n} of ${sim.maxHearts ?? HEARTS.MAX}, full`
      : `Hearts ${n}, clean streak ${streak % need} of ${need} to the next`);
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
    // RC8.1: the marks left the HUD column. Riding with the DASH meter put
    // them at the very bottom of a column the touch build then hides, so on
    // the device most people play on they sat behind the DASH button — a
    // readout for a mechanic the same pass is teaching, invisible exactly
    // where it is taught. They are their own row now, three marks directly
    // above the DASH button, centred, and they appear on the first raise.
    const lvl = p.compressionLevel | 0;
    if (lvl !== this._lastBar && this.barMarks) {
      this._lastBar = lvl;
      const max = this.barPips.length;
      this.barPips.forEach((pip, i) => pip.classList.toggle('lit', i < lvl));
      this.barMarks.classList.toggle('set', lvl > 0);
      this.barMarks.setAttribute('aria-label', `Reward bar ${lvl} of ${max}`);
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
    // RC7: a stopped frame carries the band's line and the ring, and nothing
    // else — the dash stop IS this hint's teaching moment, said louder and
    // with the world held still, so the hint stands down for it.
    if ((this._stopActive || this._dashLine) && this.powerHint) {
      this.powerHint.classList.remove('on', 'spending', 'teaching');
      this._powerT = 0;
    } else if (running && this.powerHint) {
      const teaching = !this._dashLearned;
      // RC8.1: ONE phrase for the charged state. The rising-edge flash used
      // to say 'DASH READY' and the teaching hold said 'DASH READY · HOLD F'
      // — two strings for one state, and the louder of them named a control
      // the dash stopped needing when it became a press. Both are the phrase
      // now, and the phrase is built from the control token.
      const charged = dashReadyLine(this.modality);
      if (armed && !this._wasArmed) {
        setBandLine(this.powerHint, charged);
        this.powerHint.classList.add('on');
        this._powerT = teaching ? Infinity : 1.25;
      }
      if (teaching && armed) {
        setBandLine(this.powerHint, charged);
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
      setBandLine(this.powerHint, 'DASH');
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
    seconds = 0, gates = 0, routeGates = 0, retired = [], best, isPb, shotUrl, recap, daily, objectives, review, lifetime, continued, challengeResult, endFlow = 0, standout = null, finished = false,
    correct = 0, wrong = 0, bestChain = 0, reward = 0 }) {
    this._runCorrect = correct;
    this._runWrong = wrong;
    this._bestChain = bestChain;
    this._reward = Math.floor(reward);
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
    // RC-2: every card opens folded — MORE STATS is a per-card choice.
    this.deathScreen.classList.remove('deepOpen');
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
      // PD-2 (why go again): a run that missed the best says by how much —
      // a target for the AGAIN tap, in the place NEW BEST would celebrate.
      // RC-2: EXCEPT at zero. A giant 0 over "134,168 TO BEST" reads as
      // mockery, and worse, it leaves WHY unexplained — a new player who ran
      // far but read nothing deserves the cause, not the gap.
      const gap = !isPb && best > 0
        ? Math.max(0, Math.floor(best) - Math.floor(score ?? 0)) : 0;
      if (!isPb && Math.floor(score ?? 0) === 0) {
        this.pbTag.style.visibility = 'visible';
        this.pbTag.textContent = `${this._deathDistance ?? Math.floor(distance)} M · READS MAKE THE SCORE`;
      } else {
        this.pbTag.style.visibility = isPb || gap > 0 ? 'visible' : 'hidden';
        this.pbTag.textContent = isPb ? 'NEW BEST'
          : gap > 0 ? `${gap.toLocaleString('en-US')} TO BEST` : '';
      }
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
    // RC-2 (on-device playtest): the card carried ~15 pieces of information
    // and every one of them competed with the score. The default card is now
    // FIVE moments — score, celebration, goals, misses, play again — and
    // nothing is deleted: everything analytical is intact one tap deeper,
    // behind MORE STATS. Nintendo clarity inside the same black/cyan skin.
    const core = [];
    const deep = [];
    const extras = this._deathExtras || {};

    if (extras.challengeResult?.goal > 0) {
      core.push(row('TARGET', `${extras.challengeResult.goal.toLocaleString('en-US')} · ${extras.challengeResult.beaten ? 'BEATEN' : 'NOT YET'}`));
    }
    if (extras.continued) core.push(row('CONTINUED', 'BEST UNCHANGED'));
    // E4: at most ONE standout, chosen by rarity in meta/standout.js — an
    // ordinary run shows nothing here, and that is the point.
    if (extras.standout) core.push(row(extras.standout.k, extras.standout.v));

    // RC6: today's goals, the objective queue and the ◆ takings all moved to
    // PROFILE. This card is the high-score moment — the number, whether it
    // beat the best, the shape of the run and the one standout. Progression
    // is a thing a player goes to look at between runs, not a ledger served
    // over the score they just set.

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
      core.push(`<button class="missedOpen" id="missedOpen" data-rc2-ui>`
        + `${recap.length} MISSED · REVIEW</button>`);
    } else if (recap) {
      core.push('<div class="clean">PERFECT RUN</div>');
    }

    // ── Everything below lives behind MORE STATS ─────────────────────────

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
      core.push('<div class="recapHead">THE RUN</div>');
      core.push(
        `<svg class="runPlot" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">`
        + `<polygon class="rf" points="0,${H} ${pts} 100,${H}"/>`
        + `<polyline class="rl" points="${pts}"/>${marks}</svg>`
      );
      if (review.worst) {
        // The count is already on the REVIEW button on the card; this line
        // exists to say WHERE, which is the thing the button cannot say.
        core.push(`<div class="runNote">WORST STRETCH ${review.worst.from}–${review.worst.to} M</div>`);
      }
    }

    // The run's numbers as a broadcast stat bar: figure over label.
    // PD-2: the accuracy here is THIS RUN's — the card is a scorecard for
    // the attempt just made; the lifetime ledger lives in PROFILE.
    if (lifetime) {
      const read = (this._runCorrect || 0) + (this._runWrong || 0);
      const acc = read > 0 ? Math.round((this._runCorrect || 0) / read * 100) : 0;
      // Phase B adds exactly one figure: how fast the reading was. It replaces
      // the lifetime kilometres, which said the least of the three now that
      // distance is not a board metric.
      const avgRead = this._avgReadMs > 0 ? `${(this._avgReadMs / 1000).toFixed(2)}s` : '—';
      // A word the player has beaten. This is the one line on the card that
      // is about them rather than about the run, and it is the payoff for the
      // whole per-word ledger: a word missed four times, then read clean three
      // times running, is gone from the lane for good.
      for (const r of (this._retired || []).slice(0, 2)) {
        deep.push(`<div class="defRow"><b>BEATEN</b>${r.word} — ` +
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
      deep.push(`<div class="statBar four">${[
        first,
        [`${acc}%`, 'TRUE READS'],
        [avgRead, 'AVG READ'],
        [clock, 'TIME'],
      ].map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>`);

      // 1.0-RC scoring-comprehension audit: the chain is the score's
      // dominant multiplier and was invisible on the card unless it
      // happened to be the standout. ONE line names the cause.
      if ((this._bestChain || 0) >= 2) {
        deep.push(`<div class="defRow"><b>BEST CHAIN ${this._bestChain}</b>` +
          'unbroken reads multiply the score</div>');
      }
    }

    // The fold. Present only when there is something under it.
    if (deep.length) {
      core.push('<button class="moreStats" id="moreStats" data-rc2-ui>MORE STATS ›</button>');
      core.push(`<div id="deepStats" hidden>${deep.join('')}</div>`);
    }

    this.deathRecap.innerHTML = core.join('');
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
