/**
 * RC10.4 — let the title PAINT before the game loads.
 *
 * The title screen is written out in index.html and styled by the inline
 * stylesheet, and needs no JavaScript at all to be looked at — and yet the
 * first contentful paint measured 2.7 SECONDS on a throttled phone, with the
 * screen blank the whole time. The reason is boring and entirely fixable: a
 * deferred module runs as soon as the parser is done, and evaluating this one
 * means three.js, the renderer, the scene, the audio graph and the word bank.
 * On a 4x-throttled CPU that is one unbroken task, and a browser cannot paint
 * in the middle of a task. The player watched an empty screen while the game
 * built a world nobody had asked for yet.
 *
 * So the entry point is now this file, which does nothing except wait for a
 * real frame and then import the game. Two `requestAnimationFrame`s rather
 * than one: the first schedules against the frame currently being assembled,
 * the second guarantees that frame was actually presented. The cost is two
 * frames of load time. The gain is the title arriving when it is ready
 * instead of when the engine is.
 *
 * This is not a lazy-loading scheme and must not grow into one. There is no
 * splitting here, no progressive boot, nothing conditional — the same modules
 * load in the same order, one paint later.
 */

const load = () => {
  import('./main.js');
  import('./v1-mobile-ui.js');
};

// A tab opened in the background never gets a frame, so rAF would never fire
// and the game would never load. Fall back to a timer for that case only.
if (typeof requestAnimationFrame === 'function' && document.visibilityState !== 'hidden') {
  requestAnimationFrame(() => requestAnimationFrame(load));
} else {
  setTimeout(load, 0);
}
