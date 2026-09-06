/**
 * V1 release shell: make standalone/mobile fullscreen layers own the complete
 * dynamic viewport, including the iOS home-indicator region. No runtime loop.
 *
 * RC9.3 splits the #app rule by aspect. On a screen taller than it is wide the
 * app fills the window exactly as it always has. On a screen WIDER than it is
 * tall it is framed as a vertical cabinet, and this file must not force it
 * back to 100vw — the fill rules carried `!important` (they exist to beat a
 * standalone browser's own layout) and would otherwise win against the frame
 * unconditionally. The frame's own box lives in index.html with the rest of
 * the cabinet; what belongs here is the decision to stop filling.
 *
 * The shell colour also became a token. It was a hard-coded slate grey that
 * only ever showed during a rubber-band overscroll; framed, it IS the bezel
 * and surrounds the screen the whole time, so both read `--bezel`.
 */

if (typeof document !== 'undefined' && !document.getElementById('v1-viewport-style')) {
  const style = document.createElement('style');
  style.id = 'v1-viewport-style';
  style.textContent = `
    html,body{
      width:100%!important;
      height:100%!important;
      min-height:100dvh!important;
      background:var(--bezel,#080c10)!important;
    }
    body{
      position:fixed!important;
      inset:0!important;
      overflow:hidden!important;
    }
    #app{
      position:fixed!important;
      background:var(--bezel,#080c10)!important;
    }
    @media (max-aspect-ratio: 1/1){
      #app{
        inset:0!important;
        width:100vw!important;
        height:100dvh!important;
        min-height:100dvh!important;
      }
      .screen,#rc2Pause,#rc7Onboarding{
        min-height:100dvh!important;
      }
    }
    /* Framed: the screens fill the CABINET, which is what #app now is. */
    @media (min-aspect-ratio: 1/1){
      .screen,#rc2Pause,#rc7Onboarding{
        min-height:100%!important;
      }
    }
    #rc2Pause,#rc7Onboarding{
      position:absolute!important;
      inset:0!important;
    }
    #rc2Pause{
      padding-bottom:max(24px,env(safe-area-inset-bottom,0px))!important;
    }
  `;
  document.head.appendChild(style);
}

globalThis.__DASH_V1_VIEWPORT = {
  dynamicViewportFill: true,
  standaloneSafeAreaFill: true,
  noExtraRaf: true,
};
