"use client";

import { BoosterReveal, type RevealCard } from "@/components/boosters";

const base=(id:string,name:string,rarity:RevealCard["rarity"],destructionValue:number):RevealCard=>({id:`card-${id}`,instanceId:id,name,category:"Yokai",anime:"Spirit Realm",rarity,image:"/assets/booster-pack.png",destructionValue});
const regular=[base("regular-c","Kumo","C",1),base("regular-r","Aoi","R",2),base("regular-sr","Kuro","SR",3),base("regular-ssr","Ren","SSR",4),base("regular-lr","Yuki","LR",5)];
const decision=[base("decision-1","Kitsune","SR",3),base("decision-2","Oni","SR",3),base("decision-3","Dragon","SSR",4),base("decision-4","Hikari","LR",5),base("decision-5","Mochi","SR",3)];

export function BoosterKarasProof({disabled=false}:{disabled?:boolean}) {
  const cards=(items:RevealCard[])=>disabled?items.map(card=>({...card,destructionValue:undefined})):items;
  return <div className="flex flex-col gap-12" data-proof-mode={disabled?"counterproof":"enabled"}>
    <section data-proof="regular"><div className={`yk-feedback ${disabled?"":"yk-feedback-success"}`}><strong>3a · Défausse Regular Pack</strong><span>{disabled?"Contre-preuve : valeur serveur absente":"Valeur serveur présente avant confirmation"}</span></div><BoosterReveal cards={cards(regular)} revealed={5} onReveal={()=>{}} onReturn={()=>{}} onDiscard={async()=>{}}/></section>
    <section data-proof="decision"><div className={`yk-feedback ${disabled?"":"yk-feedback-success"}`}><strong>3b · Choix Decision Pack</strong><span>{disabled?"Contre-preuve : valeurs serveur absentes":"Total des quatre cartes perdues présent avant validation"}</span></div><BoosterReveal cards={cards(decision)} revealed={5} onReveal={()=>{}} onReturn={()=>{}} decision={{onKeep:async()=>15}}/></section>
  </div>;
}
