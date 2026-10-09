/**
 * The global input routing — what a tap or a key does when it is not aimed at
 * a control: end the attract loop, enter initials, pause, open the dev panel,
 * go full screen, or ADVANCE (start the run, skip the kill cam, retry).
 *
 * It was the block of window listeners in main.js. `app` is main's view: the
 * systems these keys reach, the actions they call, and live getters for the
 * run flags they check. One rule holds throughout — a tap on a button is that
 * button's, and nothing here starts a run under an open sheet.
 */

import { PHASE } from '../sim/sim.js';
import { toggleFullscreen } from '../ui/access.js';

export function installInputRouting(app) {
  const { sim, audio, attract, initials, continueOffer, devTools } = app;

  function onAdvance({ deliberate = false } = {}) {
    if (app.running || app.paused || app.onboarding?.visible || continueOffer.active || app.launchPending) return;
    // PD-2: ONE modal rule for every overlay — a tap on or around ANY open
    // sheet (settings, shop, profile) can never start a run underneath it.
    // The pause menu and the continue offer are covered by the flags above.
    if (document.querySelector('#accessPanel.on, #shopPanel.on, #curveScreen.on')) return;
    // A tap during the kill cam cuts straight to the card — but only once the
    // share frame has been taken, so skipping never costs the player the image
    // of how it ended. (Before this, every death cost the full 1.5 s.)
    if (sim.phase === PHASE.KILL) {
      if (app.shotTaken) sim.skipKillCam();
      return;
    }
    // The same settle guard covers both ways a card can appear: a death (phase
    // DEAD) and a finished route (phase still RUNNING, sim.escaped set). It
    // exists to stop a tap aimed at the dying run from starting the next one;
    // R is the retry key and cannot be an accident, so it is not held back.
    if (!deliberate && (sim.phase === PHASE.DEAD || sim.escaped) &&
        performance.now() - app.deathShownAt < 350) return;
    audio.uiTap();
    // RC6: BEGIN RUN starts the run — for everyone, on the first tap of the
    // first session included. A card between the player and the game is the
    // wrong first beat for a cabinet, and the teaching is already in the run:
    // TEACH carries the fundamentals and the study stop waits for the first
    // answer of each verb. The six-rule sheet is a REFERENCE now, reachable
    // whenever it is wanted (HOW TO PLAY, and the pause menu) and never
    app.startRun({ instant: deliberate });
  }

  window.addEventListener('pointerup', (e) => {
    // RC6: the first touch of an attract loop belongs to ending it — it puts
    // the machine back in the player's hands and starts nothing by surprise.
    // A tap on a button still reaches that button's own handler.
    if (attract.active) { attract.exit(); return; }
    if (e.target.closest?.('[data-rc2-ui],[data-rc7-ui],button')) return;
    onAdvance();
  });
  window.addEventListener('keydown', (e) => {
    // Backtick opens the tuning panel — first, so it works from the title, a
    // live run or a pause. Never while a field has focus: the panel's own
    // search box and JSON box are places you type a backtick on purpose.
    if (e.code === 'Backquote' && !e.repeat && !/^(INPUT|TEXTAREA)$/.test(e.target?.tagName || '')) {
      e.preventDefault();
      devTools.toggleDevPanel();
      return;
    }
    // F is the arcade convention and the one key a desktop player tries. Not
    // while a field has focus, and not while onboarding owns the screen.
    if (e.code === 'KeyF' && !e.repeat && !/^(INPUT|TEXTAREA)$/.test(e.target?.tagName || '')) {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (app.onboarding?.visible) return;
    // Any key ends the attract loop, exactly as any touch does.
    if (attract.active) { attract.exit(); return; }
    // RC13.7: while initials are being entered, the letters are theirs.
    if (initials.isOpen && initials.key(e)) { e.preventDefault(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (sim.phase === PHASE.RUNNING) {
        e.preventDefault();
        app.paused ? app.resumeGame() : app.pauseGame();
      }
      return;
    }
    if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'KeyR') return;
    onAdvance({ deliberate: e.code === 'KeyR' && !e.repeat });
  });
  return { onAdvance };
}

export default installInputRouting;
