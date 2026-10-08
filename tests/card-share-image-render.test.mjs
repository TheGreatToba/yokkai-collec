import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require=createRequire(import.meta.url);
const sharingContext={exports:{},URL,require(name){
  if(name==="server-only")return {};
  if(name==="@/utils/supabase/config")return {getSupabaseConfig:()=>({url:"https://catalogue.example",key:"test"})};
  if(name==="@supabase/supabase-js")return {};
  throw new Error(`Unexpected sharing import: ${name}`);
}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/server/card-sharing.ts",import.meta.url),"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,sharingContext);
const source=ts.transpileModule(readFileSync(new URL("../lib/server/card-share-image.tsx",import.meta.url),"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
}).outputText;
const art=readFileSync(new URL("../public/assets/booster-pack.png",import.meta.url));
const fetchImage=async()=>new Response(art,{headers:{"Content-Type":"image/png","Content-Length":String(art.length)}});
const context={exports:{},process,Buffer,URL,Response,fetch:fetchImage,AbortSignal,TextDecoder,Uint8Array,Promise,
  require(name){
    if(name==="server-only")return {};
    if(name==="@/lib/server/card-sharing")return sharingContext.exports;
    if(name.startsWith("@/"))return {};
    return require(name);
  },
};
vm.runInNewContext(source,context);
const {renderSharedCardImage}=context.exports;
const expected={og:[1200,630],story:[1080,1920],square:[1080,1080]};

test("ImageResponse génère chaque rareté et format, y compris les variantes Shiny",async()=>{
  for(const rarity of ["C","R","SR","SSR","LR"]){
    for(const format of Object.keys(expected)){
      const bytes=await renderSharedCardImage({cardName:`Carte ${rarity}`,franchise:"Franchise",rarity,shiny:false,
        catalogueImageUrl:"https://catalogue.example/storage/v1/object/public/card-images/test"},format);
      assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      assert.deepEqual([view.getUint32(16),view.getUint32(20)],expected[format]);
    }
  }
  for(const rarity of ["SSR","LR"])for(const format of Object.keys(expected)){
    const bytes=await renderSharedCardImage({cardName:`Carte ${rarity} Shiny`,franchise:"Franchise",rarity,shiny:true,
      catalogueImageUrl:"https://catalogue.example/storage/v1/object/public/card-images/test"},format);
    assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
  }
});

test("illustration expirée ou non autorisée : cadre de remplacement, sans échec",async()=>{
  const started=performance.now();
  const bytes=await renderSharedCardImage({cardName:"Cadre de remplacement",franchise:"Franchise",rarity:"SSR",shiny:false,
    catalogueImageUrl:"https://evil.example/internal"},"og");
  assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(performance.now()-started<1000,"le fallback local ne doit pas attendre le délai réseau");
});
