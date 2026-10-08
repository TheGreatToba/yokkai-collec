"use client";
/* eslint-disable @next/next/no-img-element -- GIPHY previews must remain animated. */

import { useEffect, useRef, useState } from "react";

export type GifChoice={id:string;url:string;previewUrl:string;title:string;width:number;height:number};
type GiphyImage={url:string;width:string;height:string};
type GiphyItem={id:string;title:string;images:{fixed_width_small?:GiphyImage;fixed_width?:GiphyImage;original:GiphyImage}};
type GiphyResponse={data:GiphyItem[];pagination?:{count:number;offset:number;total_count:number}};

const PAGE_SIZE=18;
const QUICK_SEARCHES=["Réaction","Anime","Bravo","Rire","Choqué","Merci"];

const toChoice=(item:GiphyItem):GifChoice=>{
  const preview=item.images.fixed_width_small??item.images.fixed_width??item.images.original;
  return {id:item.id,url:item.images.original.url,previewUrl:preview.url,title:item.title||"GIF",width:Number(item.images.original.width)||1,height:Number(item.images.original.height)||1};
};

export function GifPicker({disabled,onSelect}:{disabled?:boolean;onSelect:(gif:GifChoice)=>void}) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [debouncedQuery,setDebouncedQuery]=useState("");
  const [gifs,setGifs]=useState<GifChoice[]>([]);
  const [offset,setOffset]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [selected,setSelected]=useState<GifChoice|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const panelRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!panelRef.current?.contains(event.target as Node)){setOpen(false);setSelected(null);}};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[open]);
  useEffect(()=>{const timer=window.setTimeout(()=>{setDebouncedQuery(query.trim());setOffset(0);setSelected(null);},300);return()=>window.clearTimeout(timer);},[query]);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    const load=async()=>{
      const key=process.env.NEXT_PUBLIC_GIPHY_API_KEY;
      if(!key){setError("La recherche GIF n’est pas configurée.");setGifs([]);return;}
      setLoading(true);setError("");
      try{
        const endpoint=debouncedQuery?"search":"trending";
        const params=new URLSearchParams({api_key:key,limit:String(PAGE_SIZE),offset:String(offset),rating:"pg-13",lang:"fr",bundle:"messaging_non_clips"});
        if(debouncedQuery)params.set("q",debouncedQuery.slice(0,50));
        const response=await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params}`,{signal:controller.signal});
        if(!response.ok)throw new Error("GIPHY_UNAVAILABLE");
        const body=await response.json() as GiphyResponse;
        const next=body.data.map(toChoice);
        setGifs(current=>offset===0?next:[...new Map([...current,...next].map(gif=>[gif.id,gif])).values()]);
        const count=body.pagination?.count??next.length;
        const total=body.pagination?.total_count;
        setHasMore(typeof total==="number"?offset+count<total:count===PAGE_SIZE);
      }catch(reason){if(!(reason instanceof DOMException&&reason.name==="AbortError"))setError("Impossible de charger les GIF.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    };
    void load();
    return()=>controller.abort();
  },[open,debouncedQuery,offset]);

  const choose=(term:string)=>{setQuery(term);setDebouncedQuery(term);setOffset(0);};
  const sendSelected=()=>{if(!selected)return;onSelect(selected);setOpen(false);setSelected(null);setQuery("");setDebouncedQuery("");setOffset(0);};

  return <div ref={panelRef} className="yk-gif-picker">
    <button type="button" className="yk-gif-trigger" disabled={disabled} aria-expanded={open} aria-controls="auction-gif-panel" onClick={()=>{setOpen(value=>!value);setSelected(null);}}>GIF</button>
    {open&&<section id="auction-gif-panel" className="yk-gif-panel" aria-label="Choisir un GIF">
      <header><div><strong>Choisir un GIF</strong><span>{debouncedQuery?`Résultats pour « ${debouncedQuery} »`:"Tendances du moment"}</span></div><button type="button" aria-label="Fermer" onClick={()=>setOpen(false)}>×</button></header>
      <label className="sr-only" htmlFor="auction-gif-search">Rechercher un GIF</label>
      <div className="yk-gif-search"><span aria-hidden="true">⌕</span><input id="auction-gif-search" type="search" autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Rechercher sur GIPHY…"/>{query&&<button type="button" aria-label="Effacer la recherche" onClick={()=>setQuery("")}>×</button>}</div>
      {!query&&<div className="yk-gif-suggestions" aria-label="Recherches rapides">{QUICK_SEARCHES.map(term=><button type="button" key={term} onClick={()=>choose(term)}>{term}</button>)}</div>}
      <div className="yk-gif-results" aria-busy={loading&&offset===0}>{gifs.map(gif=><button type="button" key={gif.id} aria-label={`Aperçu : ${gif.title}`} onClick={()=>setSelected(gif)}><img src={gif.previewUrl} alt={gif.title} loading="lazy"/></button>)}</div>
      {loading&&offset===0&&<div className="yk-gif-loading" role="status">Chargement des GIF…</div>}
      {!loading&&!error&&!gifs.length&&<p>Aucun GIF trouvé.</p>}
      {error&&<p role="alert">{error}</p>}
      {hasMore&&!error&&<button type="button" className="yk-gif-more" disabled={loading} onClick={()=>setOffset(value=>value+PAGE_SIZE)}>{loading?"Chargement…":"Charger plus"}</button>}
      {selected&&<div className="yk-gif-preview" role="dialog" aria-label="Aperçu du GIF"><img src={selected.previewUrl} alt={selected.title}/><div><button type="button" onClick={()=>setSelected(null)}>Annuler</button><button type="button" onClick={sendSelected}>Envoyer ce GIF</button></div></div>}
      <a href="https://giphy.com" target="_blank" rel="noreferrer">Powered by GIPHY</a>
    </section>}
  </div>;
}
