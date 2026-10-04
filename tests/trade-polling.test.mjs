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

test("les onglets répartissent les offres sans mélanger sens et historique",()=>{
  const {filterTradeOffers}=tradeApi();
  const offers=[
    {id:"received",incoming:true,status:"pending"},
    {id:"sent",incoming:false,status:"pending"},
    {id:"accepted",incoming:true,status:"accepted"},
    {id:"declined",incoming:false,status:"declined"},
    {id:"countered",incoming:true,status:"countered"},
  ];

  assert.deepEqual(Array.from(filterTradeOffers(offers,"received"),item=>item.id),["received"]);
  assert.deepEqual(Array.from(filterTradeOffers(offers,"sent"),item=>item.id),["sent"]);
  assert.deepEqual(Array.from(filterTradeOffers(offers,"history"),item=>item.id),["accepted","declined","countered"]);
  assert.ok(!filterTradeOffers(offers,"received").some(item=>!item.incoming||item.status!=="pending"));
  assert.ok(!filterTradeOffers(offers,"sent").some(item=>item.incoming||item.status!=="pending"));
  assert.ok(!filterTradeOffers(offers,"history").some(item=>item.status==="pending"));
});

test("un contexte d’ami obsolète ne peut pas remplacer le choix le plus récent",async()=>{
  const {loadTradeContextIfCurrent}=tradeApi();
  const pending=new Map();
  const load=id=>new Promise(resolve=>pending.set(id,resolve));
  let current={friendId:"ami-a",requestId:1};

  const first=loadTradeContextIfCurrent(load,"ami-a",1,()=>current);
  current={friendId:"ami-b",requestId:2};
  const second=loadTradeContextIfCurrent(load,"ami-b",2,()=>current);
  pending.get("ami-b")({friend:{id:"ami-b"}});
  assert.equal((await second).friend.id,"ami-b");
  pending.get("ami-a")({friend:{id:"ami-a"}});
  assert.equal(await first,undefined);

  current={friendId:"ami-a",requestId:3};
  const currentRequest=loadTradeContextIfCurrent(async()=>({friend:{id:"ami-a"}}),"ami-a",3,()=>current);
  assert.equal((await currentRequest).friend.id,"ami-a");
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
  assert.match(source,/pruneUnavailableSelection\(offeredRef\.current,nextContext\.ownCards\)/);
  assert.match(source,/pruneUnavailableSelection\(requestedRef\.current,nextContext\.friendCards\)/);
  assert.match(source,/setSelectionNotice\(/);
});

test("la soumission conserve l’orientation des lots sans inverser les identifiants",()=>{
  const {tradeSubmission}=tradeApi();
  const submission=tradeSubmission({friendId:"ami",offered:new Set(["donne-1","donne-2"]),offeredKaras:"25",requested:new Set(["recois-1"]),requestedKaras:"40",parent:null});
  assert.deepEqual(Array.from(submission.offeredCardIds),["donne-1","donne-2"]);
  assert.deepEqual(Array.from(submission.requestedCardIds),["recois-1"]);
  assert.equal(submission.offeredKaras,25);
  assert.equal(submission.requestedKaras,40);
  assert.notDeepEqual(Array.from(submission.offeredCardIds),Array.from(submission.requestedCardIds));
});

test("le verrou d’envoi refuse un double clic et les lots entièrement vides",()=>{
  const {tryStartTradeSubmission}=tradeApi();
  const lock={current:false};
  assert.equal(tryStartTradeSubmission(lock,false),false);
  assert.equal(lock.current,false);
  assert.equal(tryStartTradeSubmission(lock,true),true);
  assert.equal(lock.current,true);
  assert.equal(tryStartTradeSubmission(lock,true),false);
});

test("les erreurs d’échange sont traduites sans exposer le message serveur",()=>{
  const {tradeErrorMessage}=tradeApi();
  assert.match(tradeErrorMessage("TRADE_INSUFFICIENT_KARAS"),/ami.*Karas/i);
  assert.match(tradeErrorMessage("TRADE_CARD_UNAVAILABLE"),/plus disponible/i);
  assert.match(tradeErrorMessage("CARD_LOCKED"),/verrouillée/i);
  assert.equal(tradeErrorMessage("détail SQL sensible"),"Impossible de traiter cet échange. Réessayez.");
});

test("une erreur d’envoi ne déclenche aucun effacement du brouillon",()=>{
  const source=readFileSync(new URL("../components/trades.tsx",import.meta.url),"utf8");
  const submit=source.slice(source.indexOf("async function submit()"),source.indexOf("async function respond"));
  const failure=submit.slice(submit.indexOf("catch"));
  assert.doesNotMatch(failure,/updateOffered\(new Set\(\)\)|updateRequested\(new Set\(\)\)|setOfferedKaras\("0"\)|setRequestedKaras\("0"\)/);
});

test("un envoi réussi vide le brouillon et ouvre les propositions envoyées",()=>{
  const source=readFileSync(new URL("../components/trades.tsx",import.meta.url),"utf8");
  const submit=source.slice(source.indexOf("async function submit()"),source.indexOf("async function respond"));
  const success=submit.slice(submit.indexOf("await reload()"),submit.indexOf("catch"));
  assert.match(success,/updateOffered\(new Set\(\)\)/);
  assert.match(success,/updateRequested\(new Set\(\)\)/);
  assert.match(success,/setOfferedKaras\("0"\)/);
  assert.match(success,/setRequestedKaras\("0"\)/);
  assert.match(success,/setTab\("sent"\)/);
  assert.doesNotMatch(submit,/requestedCardIds:\[\.\.\.offered\]|offeredCardIds:\[\.\.\.requested\]/);
});
