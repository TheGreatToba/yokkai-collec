import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function tradeApi(){
  const context={exports:{},require:name=>{
    if(name==="@/utils/supabase/client")return{createClient:()=>({})};
    if(name==="@/lib/data/cards")return{invalidatePlayerSnapshots(){},withLiveCardFranchises:async cards=>cards};
    assert.fail("Import inattendu: "+name);
  }};
  const source=ts.transpileModule(readFileSync(new URL("../lib/data/trades.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(source,context);
  return context.exports;
}

const offer=(status,id="trade-1")=>({id,status});

test("une seule transition distante pending vers accepted demande une réconciliation",()=>{
  const {hasNewAcceptedTrade}=tradeApi();
  assert.equal(hasNewAcceptedTrade([offer("pending")],[offer("accepted")]),true);
  assert.equal(hasNewAcceptedTrade([offer("accepted")],[offer("accepted")]),false);
  assert.equal(hasNewAcceptedTrade([], [offer("accepted")]),false);
  assert.equal(hasNewAcceptedTrade([offer("pending")],[offer("declined")]),false);
});

test("la page Échanges poll toutes les 3 s sans chevauchement et respecte la visibilité",()=>{
  const source=readFileSync(new URL("../components/trades.tsx",import.meta.url),"utf8");
  assert.match(source,/TRADE_POLL_INTERVAL_MS = 3000/);
  assert.match(source,/if\(loading\|\|document\.visibilityState==="hidden"\)return/);
  assert.match(source,/loading=true/);
  assert.match(source,/finally\{loading=false;\}/);
  assert.match(source,/window\.setInterval\(\(\)=>void refresh\(\),pollIntervalMs\)/);
  assert.match(source,/addEventListener\("visibilitychange",onVisible\)/);
  assert.match(source,/removeEventListener\("visibilitychange",onVisible\)/);
  assert.match(source,/adapter\.listOffers\(\)/);
  assert.match(source,/invalidatePlayerSnapshots\(\["collection","balance"\]\)/);
});
