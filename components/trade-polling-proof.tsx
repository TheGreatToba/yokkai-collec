"use client";

import { useState } from "react";
import { TradesPanel, type TradesPanelAdapter } from "@/components/trades";
import type { CollectedCard } from "@/lib/data/cards";
import type { TradeOffer } from "@/lib/data/trades";

const card: CollectedCard = { id:"card-1",instanceId:"instance-1",name:"Luffy",anime:"One Piece",category:"Anime/Manga",rarity:"SSR",image:"/images/card-placeholder.svg",catalogueImage:"/images/card-placeholder.svg",customImageUrl:null,obtainedAt:"2026-09-30T00:00:00Z",shiny:false,isEvolved:false,isFirstOwner:true,folderId:null };

class TradeProofBackend {
  status: TradeOffer["status"] = "pending";
  offer(incoming:boolean):TradeOffer { return {id:"trade-proof",fromUser:"proposer",toUser:"recipient",fromPseudo:"Proposeur",toPseudo:"Destinataire",incoming,offeredCards:[card],offeredKaras:25,requestedCards:[],requestedKaras:0,status:this.status,parentOfferId:null,createdAt:"2026-09-30T00:00:00Z"}; }
  accept(){this.status="accepted";}
}

function adapter(backend:TradeProofBackend,role:"proposer"|"recipient"):TradesPanelAdapter {
  const friend=role==="proposer"?{id:"recipient",pseudo:"Destinataire"}:{id:"proposer",pseudo:"Proposeur"};
  return {
    friendships:async()=>({friends:[friend],incoming:[],outgoing:[]}),
    listOffers:async()=>[backend.offer(role==="recipient")],
    context:async()=>({friend,balance:role==="proposer"?475:525,ownCards:[card],friendCards:[]}),
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
