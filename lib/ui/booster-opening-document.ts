export type BoosterKind = "regular" | "decision";

// Preserve the supplied artwork; adapt startup and composite-only playback.
export function boosterOpeningDocument(
  source: string,
  parentOrigin: string,
  kind: BoosterKind,
  waitForClick = false
) {
  if (kind !== "regular" && kind !== "decision")
    throw new Error("Invalid pack kind");
  const origin = new URL(parentOrigin);
  if (
    origin.protocol !== "https:" &&
    !(
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    )
  ) {
    throw new Error("Invalid origin");
  }
  const json = (value: unknown) =>
    JSON.stringify(value).replace(
      /[<>&\u2028\u2029]/g,
      character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
    );
  const booster = {
    boosterImage: new URL(`/assets/chrome-${kind}-booster-v1.png`, origin).href,
    tearAt: 11,
    accentColor: kind === "decision" ? "#ff69be" : "#8dbdff"
  };
  const startup = source.indexOf("  // Embedded default image:");
  const end = source.indexOf("})();", startup);
  const readyStart = source.indexOf("  async function ready(img) {");
  const readyEnd = source.indexOf("\n  /**", readyStart);
  if (startup < 0 || end < 0 || readyStart < 0 || readyEnd < 0)
    throw new Error("Invalid booster asset");
  let document = source.slice(0, startup) + source.slice(end);
  document =
    document.slice(0, readyStart) +
    `  async function ready(img) {
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=ok=>{
        if(settled)return;
        settled=true;clearTimeout(timer);
        img.removeEventListener('load',loaded);img.removeEventListener('error',failed);
        ok?resolve(img):reject(new Error('Booster image unavailable'));
      };
      const loaded=()=>finish(img.naturalWidth>0&&img.naturalHeight>0);
      const failed=()=>finish(false);
      const timer=setTimeout(failed,5000);
      img.addEventListener('load',loaded);img.addEventListener('error',failed);
      if(img.complete)loaded();
    });
  }
` +
    document.slice(readyEnd);
  document = document.replace(
    "  window.addEventListener('resize', handleResize, {passive:true});",
    `  window.addEventListener('pagehide',()=>{
      if(resizeFrame)cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize',handleResize);
      window.visualViewport?.removeEventListener('resize',handleResize);
    },{once:true});
    window.addEventListener('resize', handleResize, {passive:true});`
  );
  document = document
    .replace('<html lang="fr">', '<html lang="en" class="yokkai-wait-booster">')
    .replace(/<title>[^<]*<\/title>/, "<title>Yokkai booster opening</title>")
    .replace(/(<img id="packBody" alt="") src="[^"]*"/, "$1")
    .replace(/<img /g, '<img draggable="false" ')
    .replace("Rejouer l'ouverture du booster", "Replay booster opening")
    .replace("↻ Rejouer", "↻ Replay");
  const policy =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: http://localhost:* http://127.0.0.1:* http://[::1]:*; connect-src 'none'; base-uri 'none'; form-action 'none'";
  const bridge = `<script>
    // Keep paint-heavy artwork static; animate only composited properties.
    const optimizeRules=rules=>{
      for(const rule of rules){
        if(rule.type===CSSRule.KEYFRAMES_RULE){
          for(const frame of rule.cssRules){
            for(const property of Array.from(frame.style)){
              if(property!=="transform"&&property!=="opacity")frame.style.removeProperty(property);
            }
          }
        }else if(rule.cssRules)optimizeRules(rule.cssRules);
        rule.style?.removeProperty("will-change");
      }
    };
    for(const sheet of document.styleSheets)optimizeRules(sheet.cssRules);
    const hostOrigin=${json(origin.origin)};
    const booster=${json(booster)};
    const waitForClick=${json(waitForClick)};
    let hostState='loading';
    let openRequested=!waitForClick;
    const CUT_START_MS=2680;
    const OPENING_END_MS=5200;
    const CUT_SPEED_MULTIPLIER=3;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let stage='waiting';
    let pendingSkips=0;
    let completionTimer;
    let startedAt=0;
    let timelineOffset=0;
    const notify=type=>parent.postMessage({type},hostOrigin);
    const complete=()=>{
      if(stage==='complete'||stage==='disposed')return;
      stage='complete';clearTimeout(completionTimer);notify('YOKKAI_BOOSTER_COMPLETE');
    };
    const advance=()=>{
      if(reduced||stage==='complete'||stage==='disposed'||stage==='accelerated')return;
      if(stage==='waiting'){
        if(openRequested)pendingSkips=Math.min(2,pendingSkips+1);
        return;
      }
      const elapsed=performance.now()-startedAt+timelineOffset;
      clearTimeout(completionTimer);
      if(stage==='intro'&&elapsed<CUT_START_MS){
        stage='cutting';
        // Finish the intro on the existing timeline; never mount or replay a layer.
        for(const animation of document.getAnimations()){
          if(animation.currentTime!==null)animation.currentTime=CUT_START_MS;
        }
        timelineOffset=CUT_START_MS;
        startedAt=performance.now();
        completionTimer=setTimeout(complete,OPENING_END_MS-CUT_START_MS);
      }else{
        stage='accelerated';
        for(const animation of document.getAnimations())animation.playbackRate=CUT_SPEED_MULTIPLIER;
        completionTimer=setTimeout(complete,Math.max(0,OPENING_END_MS-elapsed)/CUT_SPEED_MULTIPLIER);
      }
    };
    const beginOpening=()=>{
      if(stage!=='waiting'||!openRequested||hostState!=='YOKKAI_BOOSTER_READY')return;
      stage='intro';
      startedAt=performance.now();
      if(waitForClick){
        document.documentElement.classList.remove('yokkai-await-click');
        window.replayYokkaiBooster();
      }
      // No completion clock runs while the closed pack waits for a gesture.
      completionTimer=setTimeout(complete,reduced?500:OPENING_END_MS);
      while(pendingSkips>0){pendingSkips--;advance();}
    };
    const receive=event=>{
      if(event.source!==parent||event.origin!==hostOrigin)return;
      if(event.data?.type==='yokkai-booster-status'&&hostState!=='loading')notify(hostState);
      if(waitForClick&&event.data?.type==='yokkai-booster-open'){
        openRequested=true;beginOpening();
      }
      if(event.data?.type==='yokkai-booster-next-step')advance();
    };
    window.addEventListener('message',receive);
    const onAnimationStart=event=>{
      if(event.animationName==='foil-peel'&&stage!=='disposed'&&stage!=='complete'){
        if(stage==='intro')stage='cutting';
        notify('YOKKAI_BOOSTER_TEAR');
      }
    };
    document.addEventListener('animationstart',onAnimationStart);
    window.addEventListener('pagehide',()=>{
      stage='disposed';pendingSkips=0;
      clearTimeout(completionTimer);
      window.removeEventListener('message',receive);
      document.removeEventListener('animationstart',onAnimationStart);
      document.getAnimations().forEach(animation=>animation.cancel());
    },{once:true});
    async function startBooster(){
      try{
        const loaded=await window.setYokkaiBooster(booster);
        if(stage==='disposed')return;
        if(!loaded)throw new Error('Booster unavailable');
        document.documentElement.classList.remove('yokkai-wait-booster');
        hostState='YOKKAI_BOOSTER_READY';notify(hostState);
        // The last finite effect ends at 5s. Keep a short final hold, not the idle loop.
        beginOpening();
      }catch{if(stage!=='disposed'){hostState='YOKKAI_BOOSTER_ERROR';notify(hostState);}}
    }
    if(waitForClick)document.documentElement.classList.add('yokkai-await-click');
    void startBooster();
  </script>`;
  return document
    .replace(
      "<head>",
      `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`
    )
    .replace(
      "</head>",
      `<style>
      body{background:#070b13 url(${json(new URL(`/assets/${kind}-opening-nebula.webp`, origin).href)}) center / cover no-repeat}
      .replay{display:none!important}
      html,body,.scene{-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
      .yokkai-wait-booster .scene{visibility:hidden}
      .yokkai-wait-booster *, .yokkai-wait-booster *::before, .yokkai-wait-booster *::after{animation-play-state:paused!important}
      .scene:not(.running) *, .scene:not(.running) *::before, .scene:not(.running) *::after{animation-name:none!important}
      .yokkai-await-click .scene *, .yokkai-await-click .scene *::before, .yokkai-await-click .scene *::after{animation:none!important}
      .yokkai-await-click .stage,.yokkai-await-click .ambient{opacity:1!important}
      .yokkai-await-click .pack-entrance{opacity:1!important;transform:none!important}
      .yokkai-await-click .foil-body{transform:none!important}
      .yokkai-await-click .foil-lid{display:block!important;opacity:1!important;transform:none!important}
      .yokkai-await-click .foil-edge,.yokkai-await-click .foil-opening,.yokkai-await-click .sheen-behind{opacity:0!important}
    </style></head>`
    )
    .replace("</body>", `${bridge}</body>`);
}
