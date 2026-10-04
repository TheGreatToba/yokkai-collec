"use client";

import { useState } from "react";
import { TradesPanel, type TradesPanelAdapter } from "@/components/trades";
import type { CollectedCard } from "@/lib/data/cards";
import type { TradeOffer } from "@/lib/data/trades";

const card=(instanceId:string,{id="card-luffy",name="Luffy",anime="One Piece",rarity="SSR",shiny=false,obtainedAt="2026-09-30T00:00:00Z",customImageUrl=null,folderId=null}:{id?:string;name?:string;anime?:string;rarity?:CollectedCard["rarity"];shiny?:boolean;obtainedAt?:string;customImageUrl?:string|null;folderId?:string|null}={}):CollectedCard=>({id,instanceId,name,anime,category:"Anime/Manga",rarity,image:"/images/card-placeholder.svg",catalogueImage:"/images/card-placeholder.svg",customImageUrl,obtainedAt,shiny,isEvolved:false,isFirstOwner:true,folderId});
const proposerCards=[card("luffy-custom",{obtainedAt:"2026-09-01T00:00:00Z",customImageUrl:"https://i.imgur.com/custom.png"}),card("luffy-old",{obtainedAt:"2026-09-02T00:00:00Z",folderId:"folder-proof"}),card("luffy-new",{obtainedAt:"2026-09-03T00:00:00Z"}),card("luffy-shiny",{shiny:true}),card("zoro",{id:"card-zoro",name:"Zoro",rarity:"SR"})];
const recipientCards=[card("nami-old",{id:"card-nami",name:"Nami",rarity:"R",obtainedAt:"2026-08-01T00:00:00Z"}),card("nami-new",{id:"card-nami",name:"Nami",rarity:"R",obtainedAt:"2026-08-02T00:00:00Z"}),card("sanji",{id:"card-sanji",name:"Sanji",rarity:"SR"})];

class TradeProofBackend {
  status: TradeOffer["status"] = "pending";
  offer(incoming:boolean):TradeOffer { return {id:"trade-proof",fromUser:"proposer",toUser:"recipient",fromPseudo:"Proposeur",toPseudo:"Destinataire",incoming,offeredCards:[proposerCards[1]],offeredKaras:25,requestedCards:[],requestedKaras:0,status:this.status,parentOfferId:null,createdAt:"2026-09-30T00:00:00Z"}; }
  accept(){this.status="accepted";}
}

function adapter(backend:TradeProofBackend,role:"proposer"|"recipient"):TradesPanelAdapter {
  const friend=role==="proposer"?{id:"recipient",pseudo:"Destinataire"}:{id:"proposer",pseudo:"Proposeur"};
  return {
    friendships:async()=>({friends:[friend],incoming:[],outgoing:[]}),
    listOffers:async()=>[backend.offer(role==="recipient")],
    context:async()=>({friend,balance:role==="proposer"?475:525,ownCards:role==="proposer"?proposerCards:recipientCards,friendCards:role==="proposer"?recipientCards:proposerCards}),
    create:async()=>"",
    respond:async(_id,action)=>{if(role==="recipient"&&action==="accept")backend.accept();return true;},
  };
}

export function TradePollingProof({disabled=false}:{disabled?:boolean}) {
  const [proof]=useState(()=>{const backend=new TradeProofBackend();return{proposer:adapter(backend,"proposer"),recipient:adapter(backend,"recipient")};});
  return <div className="grid gap-8 xl:grid-cols-2">
    <section data-proof-actor="proposer"><p className="eyebrow mb-4">Compte proposeur</p><TradesPanel adapter={proof.proposer} pollIntervalMs={disabled?null:1200}/></section>
    <section data-proof-actor="recipient"><p className="eyebrow mb-4">Compte destinataire</p><TradesPanel adapter={proof.recipient} pollIntervalMs={null}/></section>
  </div>;
}
