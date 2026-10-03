import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const context={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/ui/collection-groups.ts",import.meta.url),"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,context);
const {collectionGroupKey,groupCollection,preservationOrder}=context.exports;

const copy=(instanceId,{id="card-a",rarity="SSR",shiny=false,obtainedAt="2026-01-01T00:00:00Z",customImageUrl=null,folderId=null}={})=>({
  id,instanceId,name:"Carte",category:"Anime",rarity,shiny,obtainedAt,customImageUrl,folderId,image:"/card.png",catalogueImage:"/card.png",isEvolved:false,isFirstOwner:false,
});

test("les groupes distinguent card_id, rareté et Shiny",()=>{
  const groups=groupCollection([copy("normal"),copy("shiny",{shiny:true}),copy("sr",{rarity:"SR"}),copy("other",{id:"card-b"})]);
  assert.equal(groups.length,4);
  assert.equal(new Set(groups.map(group=>group.key)).size,4);
  assert.notEqual(collectionGroupKey(groups[0].cards[0]),collectionGroupKey(copy("x",{shiny:true})));
});

test("un groupe garde tous les dossiers et affiche la copie personnalisée la plus récente",()=>{
  const old=copy("old",{obtainedAt:"2026-01-01T00:00:00Z",folderId:"favorites"});
  const custom=copy("custom",{obtainedAt:"2026-02-01T00:00:00Z",customImageUrl:"https://i.imgur.com/custom.png"});
  const latest=copy("latest",{obtainedAt:"2026-03-01T00:00:00Z",folderId:"trade"});
  const [group]=groupCollection([old,custom,latest]);
  assert.equal(group.cards.length,3);
  assert.equal(group.representative.instanceId,"custom");
  assert.equal(group.latestObtainedAt,latest.obtainedAt);
  assert.deepEqual(new Set(group.cards.map(card=>card.folderId)),new Set(["favorites",null,"trade"]));
});

test("destruction et évolution préservent les images perso puis prennent les plus anciennes",()=>{
  const cards=[copy("custom-old",{obtainedAt:"2025-01-01T00:00:00Z",customImageUrl:"https://i.imgur.com/custom.png"}),copy("plain-new",{obtainedAt:"2026-03-01T00:00:00Z"}),copy("plain-old",{obtainedAt:"2026-01-01T00:00:00Z"}),copy("plain-mid",{obtainedAt:"2026-02-01T00:00:00Z"})];
  assert.deepEqual(Array.from(preservationOrder(cards),card=>card.instanceId),["plain-old","plain-mid","plain-new","custom-old"]);
});
