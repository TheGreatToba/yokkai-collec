export type CinematicRarity = "SSR";

// The files stay untouched on disk; adapt only the document inside the sandbox.
export function cardCinematicDocument(
  source: string,
  params: URLSearchParams,
  parentOrigin: string,
  rarity: CinematicRarity
) {
  if (rarity !== "SSR") throw new Error("Invalid rarity");
  const label = (key: string) => {
    const value = params.get(key) ?? "";
    if (value.length > 240) throw new Error("Invalid card label");
    return value;
  };
  const image = params.get("image");
  if (!image || image.length > 4096) throw new Error("Invalid card image");
  const url = new URL(image);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    !(url.protocol === "https:" || (loopback && url.protocol === "http:"))
  ) {
    throw new Error("Invalid card image");
  }
  const data = {
    name: label("name"),
    category: label("category"),
    license: label("license"),
    rank: rarity,
    image: url.href,
    // These are the site's existing CSS rarity borders; no invented frame URL.
    borderColor: "#FF4FB6"
  };
  const json = (value: unknown) =>
    JSON.stringify(value).replace(
      /[<>&\u2028\u2029]/g,
      character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
    );
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const policy = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: https: http://localhost:* http://127.0.0.1:* http://[::1]:*",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join("; ");
  const initial = source.indexOf("// Host page can inject JSON");
  const scriptEnd = source.indexOf("</script>", initial);
  if (initial < 0 || scriptEnd < 0) throw new Error("Invalid cinematic asset");
  // Replace the permissive standalone bridge and demo startup, not its visuals.
  let document = source.slice(0, initial) + source.slice(scriptEnd);
  const preload =
    /const prefetchSiteImage=url=>new Promise\(resolve=>\{[\s\S]*?\n\}\);/;
  if (!preload.test(document)) throw new Error("Invalid cinematic preload");
  document = document.replace(
    preload,
    `const prefetchSiteImage=url=>new Promise(resolve=>{
    if(!url){resolve(false);return;}
    const img=new Image();
    let settled=false;
    const finish=ready=>{
      if(settled)return;
      settled=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(ready);
    };
    const timer=setTimeout(()=>finish(false),5000);
    img.onload=()=>finish(true);img.onerror=()=>finish(false);img.src=url;
    if(img.complete&&img.naturalWidth>0)finish(true);
  });`
  );
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
    const hostOrigin=${json(parentOrigin)};
    const hostCard=${json(data)};
    let hostState="loading";
    let hostPaused=false;
    const notifyHost=type=>parent.postMessage({type},hostOrigin);
    let playbackFrame=0;
    function startPlayback(){
      if(!document.getAnimations||!window.requestAnimationFrame)return;
      const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const animations=document.getAnimations();
      const introEnd=4300;
      const revealEnd=9520;
      let accelerated=!reduced;
      let elapsed=0;
      let previous=null;
      const setRate=rate=>animations.forEach(animation=>{animation.playbackRate=rate;});
      if(accelerated)setRate(1.4);
      const tick=now=>{
        const delta=previous===null?0:Math.max(0,now-previous);
        previous=now;
        if(!hostPaused)elapsed+=delta*(accelerated?1.4:1);
        if(accelerated&&elapsed>=introEnd){accelerated=false;setRate(1);}
        if(elapsed>=(reduced?700:revealEnd+700)){
          notifyHost("YOKKAI_CARD_COMPLETE");
          return;
        }
        playbackFrame=window.requestAnimationFrame(tick);
      };
      playbackFrame=window.requestAnimationFrame(tick);
    }
    const receive=event=>{
      if(event.source!==parent||event.origin!==hostOrigin)return;
      if(event.data?.type==="yokkai-card-status"){
        if(hostState!=="loading")notifyHost(hostState);
        return;
      }
      if(event.data?.type!=="yokkai-card-pause"||typeof event.data.paused!=="boolean")return;
      hostPaused=event.data.paused;
      document.documentElement.classList.toggle("preview-paused",event.data.paused);
    };
    window.addEventListener("message",receive);
    window.addEventListener("pagehide",()=>{
      window.cancelAnimationFrame(playbackFrame);
      window.removeEventListener("message",receive);
      document.getAnimations().forEach(animation=>animation.cancel());
    },{once:true});
    async function startSiteCard(){
      try{
        if(!await prefetchSiteImage(hostCard.image))throw new Error("Card image unavailable");
        if(!await window.setYokkaiCard(hostCard,{replay:false}))throw new Error("Card unavailable");
        hostState="YOKKAI_CARD_READY";notifyHost(hostState);
        startPlayback();
      }catch{hostState="YOKKAI_CARD_ERROR";notifyHost(hostState);}
    }
    void startSiteCard();
  </script>`;
  return document
    .replace('<html lang="fr">', '<html lang="en" class="yokkai-wait-card">')
    .replace(
      'aria-label="Animation de révélation de carte Yokkai"',
      `aria-label="Yokkai ${rarity} card reveal"`
    )
    .replace(
      "<head>",
      `<head><meta http-equiv="Content-Security-Policy" content="${escape(policy)}">`
    )
    .replace(
      "</head>",
      `<style>
      .preview-paused *, .preview-paused *::before, .preview-paused *::after {
        animation-play-state:paused!important;
      }
    </style></head>`
    )
    .replace("</body>", `${bridge}</body>`);
}
