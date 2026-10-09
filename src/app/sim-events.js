/**
 * The sim-event drain — where the headless sim's events become presentation.
 *
 * The sim (src/sim/) is deterministic and draws nothing; every frame it queues
 * what happened — a read landed, a heart went, the dash fired — and this turns
 * each into its sound, its judgment, its camera kick and its ledger entry, in
 * the same frame. It was the largest single block in main.js; it lives here so
 * the composition root wires systems and this file is where they react.
 *
 * `app` is main's view: the systems it built, the run's own tallies (`run`,
 * src/app/run-ledger.js), and getters/setters for the two values a drained
 * event writes back — the hit-stop and the dash-learned flag.
 */

import TUNING from '../TUNING.js';
import { Storage } from '../storage/storage.js';
import { ACCESS } from '../ui/access.js';
import { pulse as haptic } from '../ui/haptics.js';

export function createSimEventDrain(app) {
  const {
    sim, run, learn, audio, spray, ui, rig, windStreaks, music, streakBurst,
    editorialWorld, fakeTally, judgment, nemesis, mastery, wordGateActors,
  } = app;

  function drainSimEvents() {
    const events = sim.drainEvents();
    if (!events) return;
    for (const e of events) {
      switch (e.t) {
        // RC7: a stop is marked SHOWN the instant it begins, persisted beside
        // the other learned lessons. Shown, not performed — the fake stop's
        // correct answer is to do nothing, and a player who learns it that way
        // must not be stopped at the next fake for the rest of their life.
        case 'teach_stop':
          // RC7.1: the dash is NOT retired here — it retires on the hold
          // itself (the 'overdrive_on' case below), so a player who let the
          // stop time out is offered it again next run.
          if (e.which !== 'dash') learn(`Stop${e.which[0].toUpperCase()}${e.which.slice(1)}`);
          audio.uiTap();
          break;
        case 'hit':
          audio.hit();
          haptic('hit');
          spray.emit(e.x, e.y, -e.d, 18, 7, 3.2, 0);
          ui.hitFlash();
          break;
        case 'gate':
          audio.gate();
          if (e.chain > 0) audio.chainLink(e.chain);
          break;
        case 'chain_lost':
          // E2: a BIG chain dying is an event, not a counter reset — the hard
          // fall in the mix, and the camera goes still for a beat. The world's
          // layer falling (Phase M) is already frame-accurate with this.
          if (e.chain >= 25) {
            audio.chainBreak(e.chain);
            rig.settle();
          } else {
            audio.chainLost();
          }
          break;
        // Hearts and bells (Phase 0: driven by sim events now, not a frame-delta
        // poll in the deleted rc5 layer). The heart HUD itself is synced from
        // sim.hearts in ui.update; these are only the sounds.
        case 'heart_lost': audio.heartLost(); break;
        case 'heart_restore': audio.heartRestore(); break;
        // RC10.9: the string continues the chain chime's ladder, so the pitch
        // comes from the chain and the bell's place in its string — never from
        // how many bells this run has happened to pass.
        case 'overdrive_on':
          learn('Dash');
          // The DASH lands as one event across three channels (Phase 16):
          // its own sound, a camera punch that decays, and a burst of speed
          // lines. Firing it used to reuse the generic shove and read as
          // nothing in particular — which is how a whole verb went unseen.
          audio.dash();
          rig.dashKick();
          windStreaks.burst();
          ui.dashFired();
          if (!app.dashLearned) {
            app.dashLearned = true;
            globalThis.__DASH_LEARNED = true;
            Storage.setDashLearned(true);
          }
          break;
        case 'overdrive_off':
          audio.overdriveOff();
          // E2: a dash that climbed its ladder ends on an endpoint hit —
          // sized to the rung it died on, with the camera punch it earned.
          if ((e.rung | 0) >= 3) {
            audio.dashClimax(e.rung);
            rig.dashKick(0.55);
            windStreaks.burst();
          }
          break;
        case 'last_stand':
          // No label, by design. The world going quiet and the corruption
          // pinned at its worst is the whole announcement.
          audio.lastStand();
          if (music.gain) music.gain.gain.value = 0.10;
          break;
        case 'last_stand_held':
          audio.lastStandEnd(true);
          if (music.gain) music.gain.gain.value = 0.62;
          rig.dashKick(0.7);
          streakBurst.fire({ x: sim.player.x, y: sim.player.y, d: sim.player.d, chain: 8 });
          break;
        case 'last_stand_lost':
          audio.lastStandEnd(false);
          if (music.gain) music.gain.gain.value = 0.62;
          break;
        case 'kill': audio.kill(); haptic('kill'); break;
        case 'word_confirm': audio.uiTap(); break;
        // N1: a pre-arm answer was buffered — the plate shows the side-bar,
        // this is only the sound of it. Acknowledgment, not payoff.
        case 'word_held': audio.wordHeld(e.said === 'real'); break;
        // N4: the hundredth gate is an ARRIVAL — one rising breath, a swell
        // of ink, and the camera going still. The endgame layer's coast and
        // choice follow on their own clock; this is the moment itself.
        case 'route_finished':
          audio.finishArrival();
          editorialWorld.pulseInk();
          rig.settle();
          break;
        case 'word_correct': {
          run.gateTrail[e.index] = 1;
          if (!e.real) fakeTally.record({ family: e.family, fake: e.word, answer: e.answer, tapped: false });
          {
            const tier = judgment.read({ correct: true, answered: e.answered !== false,
              answerDistance: e.answerDistance, armM: sim.wordGates.armDistance(),
              chain: e.chain, real: e.real }, ACCESS.reducedFlash);
            judgment.pop(e.score || 0, 'right', ACCESS.reducedFlash);
            if (e.answered !== false) haptic('read');
            // RC13.5 — the PERFECT read lands with weight: the frame holds.
            if (tier.key === 'sharp') run.perfectsThisRun++;
            if (tier.key === 'sharp' && !ACCESS.reducedFlash) app.hitStop = TUNING.JUDGE.HITSTOP_S;
          }
          {
            const t = run.tierTally[e.tier] || (run.tierTally[e.tier] = { a: 0, c: 0 });
            t.a++; t.c++;
          }
          // E4: the brilliance ledgers ride the same event the score does.
          run.burstWindow.push(e.score || 0);
          if (run.burstWindow.length > 10) run.burstWindow.shift();
          run.burst10 = Math.max(run.burst10, run.burstWindow.reduce((a, b) => a + b, 0));
          if (e.answerDistance >= sim.wordGates.armDistance() * 0.5) {
            run.earlyStreak++;
            if (run.earlyStreak > run.bestEarlyStreak) run.bestEarlyStreak = run.earlyStreak;
          } else run.earlyStreak = 0;
          if (e.dashMult > 1) run.dashRungMax = Math.max(run.dashRungMax, (e.dashChain | 0) + 1);
          if (e.answer) {
            const before = nemesis.history(e.answer);
            const outcome = nemesis.record(e.answer, true, e.index);
            // RC10.3: after the ledger, not before — a word retiring on THIS
            // read stops being owed on this read, and is mastered on it too.
            if (mastery.mark(e.answer)) run.learnedWords++;
            if (outcome === 'retired' && before?.m > 0) {
              run.retiredThisRun.push({ word: e.answer, misses: before.m, attempts: before.a });
              // The retirement beat, AT the read (Phase 1) — not a text line two
              // screens later. Its own sound, an escalated burst reusing the
              // reserved escalation palette, a fuller spray and a camera tick.
              // The death-card mention stays, but now it recaps something the
              // player already felt.
              audio.wordRetired();
              streakBurst.fireRetire(e);
              spray.emit(e.x, e.y, -e.d, 34, 5.5, 4.2, 0);
              rig.dashKick(0.5);
            }
          }
          // Design pass (playtest: "words select themselves"): a word the
          // player never touched must never LOOK or SOUND selected. A passed
          // fake keeps its mechanics — the chain link, the small late score,
          // every ledger above — but the celebration language (the gate
          // melody, the typeset snap, the sparks, the burst) belongs to acted
          // answers alone. Silence gets a quiet page-settle and a dim fade.
          if (e.answered) {
            // Phase B: how early the answer landed, 0 at the line and 1 at the
            // arm edge, drives the sound's attack and the camera's tick. Never
            // a word on screen.
            const W = TUNING.WORDS;
            const early = Math.max(0, Math.min(1,
              ((e.latencyMult ?? W.LATE_MULT) - W.LATE_MULT) / (W.EARLY_MULT - W.LATE_MULT)));
            audio.gate(e.chain, early, e.dashChain);
            // The verdict, peripherally: one screen-edge wash in the right
            // colour, because at speed the eye is already on the next word.
            ui.answerFlash(true);
            // N1: the word typesets into the page — every correct read is a
            // construction event the world visibly answers (RF-guarded inside).
            editorialWorld.typesetSnap(early);
            if (early > 0.4) rig.dashKick(0.28 * early);
            if (e.chain > 0) audio.chainLink(e.chain);
            if (e.proxMult > 1.05) audio.courageBank(e.proxMult);
            // The payoff is where the vibrancy lives: sparks scale with the
            // chain, and the burst system escalates hue and reach with it.
            spray.emit(e.x, e.y, -e.d, 14 + Math.min(e.chain, 10) * 3, 4.0, 2.6 + Math.min(e.chain, 10) * 0.25, 0);
            streakBurst.fire(e);
          } else {
            audio.wordPass();
          }
          wordGateActors.onResolve(e);
          break;
        }
        case 'word_wrong': {
          run.gateTrail[e.index] = 0;
          if (e.reason === 'picked_fake') fakeTally.record({ family: e.family, fake: e.word, answer: e.answer, tapped: true });
          judgment.read({ correct: false, answered: e.answered !== false,
            answerDistance: e.answerDistance, armM: sim.wordGates.armDistance(),
            chain: 0, real: e.real, shown: e.word, answer: e.answer }, ACCESS.reducedFlash);
          const t = run.tierTally[e.tier] || (run.tierTally[e.tier] = { a: 0, c: 0 });
          t.a++;
          nemesis.record(e.answer, false, e.index);
          // RC10.3: a word being practised again is not a word mastered.
          mastery.unmark(e.answer);
          // Phase M: one layer of the architecture falls, frame-accurate with
          // the drain — the loss made spatial.
          editorialWorld.onWrongRead();
          // E4: a wrong read of any kind breaks the burst and the streak.
          run.burstWindow.length = 0;
          run.earlyStreak = 0;
        }
          // The rulebook asymmetry, felt: tapping a fake is the crash (hit
          // sound, red flash, the heart the sim already took). Missing a real
          // word is only a slowdown — a deflating cue, no crash language, so
          // the player learns hearts are never lost by hesitating.
          // The verdict wash in the wrong colour, for BOTH wrong reads — the
          // drain's darkness follows it and the two together are unmissable.
          ui.answerFlash(false);
          if (e.hit) {
            // The drain (Phase 9): a wrong tap pulls light and highs out of
            // the world for a beat — no bright crash-flash; loss is darkness.
            audio.hit();
            haptic('hit');
            audio.duck();
            spray.emit(e.x, e.y, -e.d, 18, 7, 3.2, 0);
            ui.drain();
          } else {
            audio.slip();
            // N1 (playtest: "stronger tells on missed word"): a missed real
            // now borrows the drain's darkness at the moment of the slip —
            // loss is darkness in this game's grammar, and the slip was the
            // one wrong read that had no visual weight at all.
            ui.drain();
          }
          wordGateActors.onResolve(e);
          break;
      }
    }
  }

  return drainSimEvents;
}

export default createSimEventDrain;
