// V1 release shell: make standalone/mobile fullscreen layers own the complete
// dynamic viewport, including the iOS home-indicator region. No runtime loop.

if (typeof document !== 'undefined' && !document.getElementById('v1-viewport-style')) {
  const style = document.createElement('style');
  style.id = 'v1-viewport-style';
  style.textContent = `
    html,body{
      width:100%!important;
      height:100%!important;
      min-height:100dvh!important;
      background:#596774!important;
    }
    body{
      position:fixed!important;
      inset:0!important;
      overflow:hidden!important;
    }
    #app{
      position:fixed!important;
      inset:0!important;
      width:100vw!important;
      height:100dvh!important;
      min-height:100dvh!important;
      background:#596774!important;
    }
    .screen,#rc2Pause,#rc7Onboarding{
      min-height:100dvh!important;
    }
    #rc2Pause,#rc7Onboarding{
      position:fixed!important;
      inset:0!important;
    }
    #rc2Pause{
      padding-bottom:max(24px,env(safe-area-inset-bottom,0px))!important;
    }
  `;
  document.head.appendChild(style);
}

globalThis.__DESCENT_V1_VIEWPORT = {
  dynamicViewportFill: true,
  standaloneSafeAreaFill: true,
  noExtraRaf: true,
};
