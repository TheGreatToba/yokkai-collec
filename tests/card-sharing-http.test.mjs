import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file,globals={}) {
  const source=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const context={exports:{},Response,Uint8Array,...globals,require:name=>{throw new Error(`Unexpected import: ${name}`);}};
  vm.runInNewContext(source,context);
  return context.exports;
}

const {cardShareImageResponse}=load("lib/server/card-share-image-route.ts");
const id="a".repeat(32);
const card={cardName:"Kitsune",franchise:"Yokkai",rarity:"SSR",shiny:false,catalogueImageUrl:"https://example.test/card.png"};

test("une image inconnue ou un identifiant invalide rend 404 avant tout rendu",async()=>{
  for(const [shareId,getShare] of [["bad",async()=>assert.fail("invalid must not query")],[id,async()=>null]]){
    let renders=0;
    const response=await cardShareImageResponse(shareId,"og",{
      getShare,cache:{getOrRender:async(_key,render)=>render()},render:async()=>{renders+=1;return new Uint8Array([1]);},
    });
    assert.equal(response.status,404);
    assert.equal(renders,0);
  }
});

test("une suppression gagne contre une image encore présente dans le cache",async()=>{
  let cacheReads=0;
  const response=await cardShareImageResponse(id,"og",{
    getShare:async()=>null,
    cache:{getOrRender:async()=>{cacheReads+=1;return new Uint8Array([1]);}},
    render:async()=>assert.fail("must not render"),
  });
  assert.equal(response.status,404);
  assert.equal(cacheReads,0);
});

test("une image valide est un PNG public immutable",async()=>{
  const response=await cardShareImageResponse(id,"square",{
    getShare:async()=>card,
    cache:{getOrRender:async(key,render)=>{assert.equal(key,`${id}:square`);return render();}},
    render:async(value,format)=>{assert.equal(value,card);assert.equal(format,"square");return new Uint8Array([137,80,78,71]);},
  });
  assert.equal(response.status,200);
  assert.equal(response.headers.get("content-type"),"image/png");
  assert.match(response.headers.get("cache-control"),/public.*immutable/);
});

test("une panne de rendu ne devient jamais une erreur 500",async()=>{
  const response=await cardShareImageResponse(id,"story",{
    getShare:async()=>card,
    cache:{getOrRender:async(_key,render)=>render()},
    render:async()=>{throw new Error("renderer failed");},
  });
  assert.equal(response.status,204);
});

test("la page et ses métadonnées restent strictement publiques",()=>{
  const page=readFileSync(new URL("../app/partage/[id]/page.tsx",import.meta.url),"utf8");
  assert.match(page,/Rejoindre Yokkai Collec/);
  assert.match(page,/href="\/inscription"/);
  assert.match(page,/robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
  assert.match(page,/summary_large_image/);
  assert.match(page,/NEXT_PUBLIC_SITE_URL/);
  assert.doesNotMatch(page,/customImage|custom_image|ownerId|instanceId|auction|chat|gif/i);
});
