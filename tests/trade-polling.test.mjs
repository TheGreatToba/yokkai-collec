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

test("une contre-proposition inverse exactement les lots et les Karas",()=>{
  const {counterTradeDraft,tradeSubmission}=tradeApi();
  const original={requestedCards:[{instanceId:"b-1"},{instanceId:"b-2"}],requestedKaras:30,offeredCards:[{instanceId:"a-1"}],offeredKaras:70};
  const context={ownCards:[{instanceId:"b-1"},{instanceId:"b-2"}],friendCards:[{instanceId:"a-1"}]};
  const draft=counterTradeDraft(original,context);
  assert.deepEqual(Array.from(draft.offered),["b-1","b-2"]);
  assert.deepEqual(Array.from(draft.requested),["a-1"]);
  assert.equal(draft.offeredKaras,"30");
  assert.equal(draft.requestedKaras,"70");
  assert.notDeepEqual(Array.from(draft.offered),["a-1"]);
  const submitted=tradeSubmission({...draft,friendId:"A",parent:"offre-A-vers-B"});
  assert.equal(submitted.toUser,"A");
  assert.equal(submitted.parentOfferId,"offre-A-vers-B");
  assert.deepEqual(Array.from(submitted.offeredCardIds),["b-1","b-2"]);
  assert.deepEqual(Array.from(submitted.requestedCardIds),["a-1"]);
});

test("le préremplissage retire les instances devenues indisponibles",()=>{
  const {counterTradeDraft}=tradeApi();
  const original={requestedCards:[{instanceId:"b-ok"},{instanceId:"b-vendue"}],requestedKaras:0,offeredCards:[{instanceId:"a-ok"},{instanceId:"a-verrouillee"}],offeredKaras:0};
  const draft=counterTradeDraft(original,{ownCards:[{instanceId:"b-ok"}],friendCards:[{instanceId:"a-ok"}]});
  assert.deepEqual(Array.from(draft.offered),["b-ok"]);
  assert.deepEqual(Array.from(draft.requested),["a-ok"]);
  assert.equal(draft.removed,2);
  assert.ok(!draft.offered.has("b-vendue")&&!draft.requested.has("a-verrouillee"));
});

test("les actions d’examen sont désactivées dès que l’offre change ou disparaît",()=>{
  const {tradeOfferIsActionable}=tradeApi();
  assert.equal(tradeOfferIsActionable("offre",[{id:"offre",status:"pending"}]),true);
  assert.equal(tradeOfferIsActionable("offre",[{id:"offre",status:"accepted"}]),false);
  assert.equal(tradeOfferIsActionable("offre",[{id:"offre",status:"declined"}]),false);
  assert.equal(tradeOfferIsActionable("offre",[]),false);
  assert.equal(tradeOfferIsActionable("offre",[{id:"autre",status:"pending"}]),false);
  const source=readFileSync(new URL("../components/trades.tsx",import.meta.url),"utf8");
  assert.match(source,/setAccepting\(current=>current&&tradeOfferIsActionable\(current.id,history\)/);
  assert.match(source,/const actionable=offer\?\.incoming&&offer.status==="pending"/);
  assert.match(source,/\{actionable&&<>/);
});

test("l’identifiant d’examen survit au passage dans l’historique et résout la liste complète",()=>{
  const {resolveTradeReview,filterTradeOffers}=tradeApi();
  const id="seconde";
  for(const status of ["pending","accepted","declined","countered"]){
    const all=[{id:"premiere",status:"pending",incoming:true},{id,status,incoming:true}];
    assert.equal(resolveTradeReview(id,all).status,status);
    for(const tab of ["received","sent","history"]){
      filterTradeOffers(all,tab);
      assert.equal(resolveTradeReview(id,all).id,id);
    }
    if(status!=="pending")assert.equal(resolveTradeReview(id,filterTradeOffers(all,"received")),undefined);
  }
  assert.equal(resolveTradeReview("absente",[{id,status:"pending"}]),undefined);
});

test("les pastilles reflètent le statut réel sans transformer une réponse en indisponibilité",()=>{
  const {tradeStatusPresentation}=tradeApi();
  for(const [status,label,tone] of [["pending","En attente","gold"],["accepted","Acceptée","success"],["declined","Refusée","danger"],["countered","Contre-proposée","info"],["expired","Indisponible","neutral"],[undefined,"Indisponible","neutral"]]){
    const presentation=tradeStatusPresentation(status);
    assert.equal(presentation.label,label);assert.equal(presentation.tone,tone);
    if(["accepted","declined","countered"].includes(status))assert.notEqual(presentation.label,"Indisponible");
  }
});

test("le popover dépend uniquement de son ID et les liens conservent ami et carte",()=>{
  const source=readFileSync(new URL("../components/trades.tsx",import.meta.url),"utf8");
  assert.match(source,/Modal open=\{!!reviewedId\}/);
  assert.match(source,/resolveTradeReview\(reviewedId,offers\)/);
  assert.doesNotMatch(source,/resolveTradeReview\(reviewedId,received\)|open=\{!!reviewedOffer\}/);
  const route=readFileSync(new URL("../components/community-views.tsx",import.meta.url),"utf8");
  for(const param of ["offre","ami","carte"])assert.ok(route.includes(`searchParams.get("${param}")`));
  const modal=readFileSync(new URL("../components/ui/index.tsx",import.meta.url),"utf8");
  assert.match(modal,/open && !ref.current\?\.open/);
  assert.match(modal,/event.shiftKey/);
  assert.match(modal,/trigger\?\.isConnected/);
});
