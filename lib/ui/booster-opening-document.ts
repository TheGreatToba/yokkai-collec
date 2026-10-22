export type BoosterKind = "regular" | "decision";

// Preserve the supplied artwork/keyframes, adapt only its standalone startup.
export function boosterOpeningDocument(
  source: string,
  parentOrigin: string,
  kind: BoosterKind
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
  document = document
    .replace('<html lang="fr">', '<html lang="en" class="yokkai-wait-booster">')
    .replace(/<title>[^<]*<\/title>/, "<title>Yokkai booster opening</title>")
    .replace(/(<img id="packBody" alt="") src="[^"]*"/, "$1")
    .replace("Rejouer l'ouverture du booster", "Replay booster opening")
    .replace("↻ Rejouer", "↻ Replay");
  const policy =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: http://localhost:* http://127.0.0.1:* http://[::1]:*; connect-src 'none'; base-uri 'none'; form-action 'none'";
  const bridge = `<script>
    const hostOrigin=${json(origin.origin)};
    const booster=${json(booster)};
    let hostState='loading';
    let finished=false;
    let completionTimer;
    let startedAt=0;
    let advancedBy=0;
    const notify=type=>parent.postMessage({type},hostOrigin);
    const complete=()=>{
      if(finished)return;
      finished=true;clearTimeout(completionTimer);notify('YOKKAI_BOOSTER_COMPLETE');
    };
    window.addEventListener('message',event=>{
      if(event.source!==parent||event.origin!==hostOrigin)return;
      if(event.data?.type==='yokkai-booster-status'&&hostState!=='loading')notify(hostState);
      if(event.data?.type==='yokkai-booster-next-step'&&hostState==='YOKKAI_BOOSTER_READY'&&!finished){
        const elapsed=performance.now()-startedAt+advancedBy;
        const next=[2680,3740,5200].find(time=>time>elapsed+50);
        if(next===undefined){complete();return;}
        const jump=next-elapsed;
        for(const animation of document.getAnimations()){
          if(animation.currentTime!==null)animation.currentTime=Number(animation.currentTime)+jump;
        }
        advancedBy+=jump;
        clearTimeout(completionTimer);
        if(next===5200)complete();
        else completionTimer=setTimeout(complete,5200-next);
      }
    });
    document.addEventListener('animationstart',event=>{
      if(event.animationName==='foil-peel')notify('YOKKAI_BOOSTER_TEAR');
    });
    async function startBooster(){
      try{
        if(!await window.setYokkaiBooster(booster))throw new Error('Booster unavailable');
        document.documentElement.classList.remove('yokkai-wait-booster');
        startedAt=performance.now();
        hostState='YOKKAI_BOOSTER_READY';notify(hostState);
        // The last finite effect ends at 5s. Keep a short final hold, not the idle loop.
        const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        completionTimer=setTimeout(complete,reduced?500:5200);
      }catch{hostState='YOKKAI_BOOSTER_ERROR';notify(hostState);}
    }
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
      .yokkai-wait-booster .scene{visibility:hidden}
      .yokkai-wait-booster *, .yokkai-wait-booster *::before, .yokkai-wait-booster *::after{animation-play-state:paused!important}
      .scene:not(.running) *, .scene:not(.running) *::before, .scene:not(.running) *::after{animation-name:none!important}
    </style></head>`
    )
    .replace("</body>", `${bridge}</body>`);
}
