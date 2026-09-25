"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {Avatar,Button,StatusPill} from "@/components/ui";
import {getFriendships,respondFriendRequest,searchUsers,sendFriendRequest,type Friendships,type FriendUser,type FriendshipStatus} from "@/lib/data/friends";

const statusLabel:Record<FriendshipStatus,string>={none:"Ajouter",incoming:"Demande reçue",outgoing:"Demande envoyée",accepted:"Ami",self:"Votre profil"};
export function FriendAction({userId,status,onChanged}:{userId:string;status:FriendshipStatus;onChanged?:()=>void}){
  const [state,setState]=useState(status);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function send(){setBusy(true);setError("");try{await sendFriendRequest(userId);setState("outgoing");onChanged?.();}catch(e){setError(e instanceof Error?e.message:"Action impossible.");}finally{setBusy(false);}}
  return <div>{state==="none"?<Button variant="secondary" disabled={busy} onClick={()=>void send()}>+ Ajouter en ami</Button>:<StatusPill tone={state==="accepted"?"success":"gold"}>{statusLabel[state]}</StatusPill>}{error&&<p role="alert" className="mt-2 text-xs text-danger">{error}</p>}</div>;
}

function Person({person,actions}:{person:FriendUser;actions?:React.ReactNode}){return <li className="flex flex-wrap items-center gap-3 rounded-panel border border-veil bg-surface p-4"><Avatar name={person.pseudo}/><Link href={`/profil/${encodeURIComponent(person.pseudo)}`} className="min-w-0 flex-1 font-display font-semibold hover:text-accent-gold">{person.pseudo}</Link>{actions}</li>;}

export function FriendsPanel(){
  const [data,setData]=useState<Friendships>();const [query,setQuery]=useState("");const [results,setResults]=useState<FriendUser[]>([]);const [error,setError]=useState("");const [searching,setSearching]=useState(false);
  async function load(){try{setData(await getFriendships());}catch(e){setError(e instanceof Error?e.message:"Chargement impossible.");}}
  useEffect(()=>{let active=true;void getFriendships().then(value=>{if(active)setData(value);},e=>{if(active)setError(e instanceof Error?e.message:"Chargement impossible.");});return()=>{active=false;};},[]);
  useEffect(()=>{if(query.trim().length<2)return;let active=true;const timer=window.setTimeout(()=>void searchUsers(query).then(value=>{if(active)setResults(value);},e=>{if(active)setError(e instanceof Error?e.message:"Recherche impossible.");}).finally(()=>{if(active)setSearching(false);}),250);return()=>{active=false;window.clearTimeout(timer);};},[query]);
  async function respond(id:string,accept:boolean){setError("");try{await respondFriendRequest(id,accept);await load();}catch(e){setError(e instanceof Error?e.message:"Action impossible.");}}
  const visibleResults=query.trim().length<2?[]:results;
  return <section className="space-y-7"><div><h3 className="yk-section-title">Ajouter un ami</h3><input aria-label="Rechercher un joueur par pseudo" value={query} onChange={e=>{const value=e.target.value;setQuery(value);setSearching(value.trim().length>=2);}} placeholder="Rechercher un pseudo…" className="auth-input mt-4"/><p className="mt-2 text-xs text-ink-3">Saisissez au moins deux caractères.</p>{searching&&<p className="mt-3 text-sm text-ink-3">Recherche…</p>}<ul className="mt-4 space-y-3">{visibleResults.map(person=><Person key={person.id} person={person} actions={<FriendAction key={`${person.id}:${person.status}`} userId={person.id} status={person.status??"none"} onChanged={()=>void load()}/>}/>)}</ul></div>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}{data?.incoming.length?<div><h3 className="yk-section-title">Demandes reçues</h3><ul className="mt-4 space-y-3">{data.incoming.map(person=><Person key={person.requestId} person={person} actions={<div className="flex gap-2"><Button onClick={()=>void respond(person.requestId!,true)}>Accepter</Button><Button variant="secondary" onClick={()=>void respond(person.requestId!,false)}>Refuser</Button></div>}/>)}</ul></div>:null}<div><h3 className="yk-section-title">Mes amis</h3>{data&&!data.friends.length?<p className="mt-4 text-sm text-ink-3">Votre liste d’amis est vide.</p>:<ul className="mt-4 space-y-3">{data?.friends.map(person=><Person key={person.id} person={person} actions={<StatusPill tone="success">Ami</StatusPill>}/>)}</ul>}</div>{data?.outgoing.length?<div><h3 className="yk-section-title">Demandes envoyées</h3><ul className="mt-4 space-y-3">{data.outgoing.map(person=><Person key={person.requestId} person={person} actions={<StatusPill>En attente</StatusPill>}/>)}</ul></div>:null}</section>;
}
