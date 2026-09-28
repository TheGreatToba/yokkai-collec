"use client";
/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";
import { useState } from "react";
import type { CollectedCard, Folder, Rarity } from "@/lib/data/cards";
import { Button, Chip, Karas, Modal, Pagination } from "@/components/ui";
import { YokaiCard } from "@/components/yokai-card";
import "@/styles/collection.css";

// Optional display metadata, separate from the existing business types.
export type CollectionPresentation = { number?: string; isNew?: boolean; frozen?: { remaining: string }; marketValue?: number | null; destructionValue?: number };
const rarityOrder: Rarity[] = ["LR","SSR","SR","R","C"];
const rarityText = { C:"text-rarity-c", R:"text-rarity-r", SR:"text-rarity-sr", SSR:"text-rarity-ssr", LR:"text-rarity-lr" };
const formatDate = (value: string, long = false) => new Date(value).toLocaleDateString("fr-FR", {dateStyle:long ? "long" : "medium"});
const PAGE_SIZE = 20;

export function CollectionView({ cards, categories, presentation = {}, totals, readOnly = false, folders = [], onCreateFolder, onDeleteFolder, onMoveCard, onCreateAuction, onEvolve, onSetCustomImage, onDiscard, onDiscardMany }: {
  cards: CollectedCard[]; categories: string[]; presentation?: Record<string, CollectionPresentation>;
  totals?: Partial<Record<Rarity,number>>; readOnly?: boolean; folders?: Folder[];
  onCreateFolder?: (name: string) => Promise<void>; onDeleteFolder?: (folderId: string) => Promise<void>;
  onMoveCard?: (instanceId: string, folderId: string | null) => Promise<void>;
  onCreateAuction?: (instanceId:string,startingPrice:number,durationMinutes:number)=>Promise<void>;
  onEvolve?: (instanceId: string) => Promise<CollectedCard>;
  onSetCustomImage?: (instanceId: string, imageUrl: string | null) => Promise<void>;
  onDiscard?: (instanceId: string) => Promise<void>;
  onDiscardMany?: (instanceIds: string[]) => Promise<void>;
}) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [shinyOnly, setShinyOnly] = useState(false);
  const [folder, setFolder] = useState<string | "unfiled" | "">("");
  const [page, setPage] = useState(1);
  const [folderName, setFolderName] = useState("");
  const [showFolderCreator, setShowFolderCreator] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [auctionPrice,setAuctionPrice]=useState("10");
  const [auctionDuration,setAuctionDuration]=useState("60");
  const [auctionBusy,setAuctionBusy]=useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evolving, setEvolving] = useState(false);
  const [evolutionError, setEvolutionError] = useState("");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardError, setDiscardError] = useState("");
  const [bulkDiscardBusy, setBulkDiscardBusy] = useState(false);
  const [bulkDiscardError, setBulkDiscardError] = useState("");
  const selected = cards.find(c => c.instanceId === selectedId);
  const selectedMeta = selected ? presentation[selected.instanceId] : undefined;
  const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
  const filtered = cards.filter(c => (!normalizedQuery || [c.name,c.category,c.anime].some(value=>value?.toLocaleLowerCase("fr-FR").includes(normalizedQuery))) && (!category || c.category === category) && (!rarity || c.rarity === rarity) && (!shinyOnly || c.shiny)
      && (!folder || (folder === "unfiled" ? !c.folderId : c.folderId === folder)))
    .slice().sort((a,b) => rarityOrder.indexOf(a.rarity)-rarityOrder.indexOf(b.rarity) || Number(b.shiny)-Number(a.shiny));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const visibleCards = filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const selectedCards = cards.filter(c => selection.has(c.instanceId) && !presentation[c.instanceId]?.frozen);
  const total = totals && rarityOrder.every(r=>totals[r] != null) ? rarityOrder.reduce((sum,r)=>sum+(totals[r]||0),0) : undefined;
  const duplicates = cards.reduce<Record<string,number>>((counts,c)=>{ counts[c.id]=(counts[c.id]||0)+1; return counts; },{});
  const evolvableCopies = selected ? cards.filter(c => c.id === selected.id && c.rarity === "SSR" && !c.shiny).length : 0;
  const valueKnown = selectedCards.length > 0 && selectedCards.every(c=>presentation[c.instanceId]?.destructionValue != null);
  const selectedValue = valueKnown ? selectedCards.reduce((sum,c)=>sum+presentation[c.instanceId].destructionValue!,0) : undefined;
  function toggle(id:string) { setSelection(current=>{ const next = new Set(current); if(next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function evolveSelected() {
    if (!selected || !onEvolve || evolving) return;
    setEvolving(true); setEvolutionError("");
    try { const evolved = await onEvolve(selected.instanceId); setSelectedId(evolved.instanceId); }
    catch (error) { setEvolutionError(error instanceof Error ? error.message : "Impossible d’effectuer l’évolution."); }
    finally { setEvolving(false); }
  }
  async function addFolder() {
    if (!onCreateFolder || !folderName.trim() || folderBusy) return;
    setFolderBusy(true); setFolderError("");
    try { await onCreateFolder(folderName.trim()); setFolderName(""); setShowFolderCreator(false); }
    catch (error) { setFolderError(error instanceof Error ? error.message : "Impossible de créer le dossier."); }
    finally { setFolderBusy(false); }
  }
  async function auctionSelected(){if(!selected||!onCreateAuction||auctionBusy)return;setAuctionBusy(true);setEvolutionError("");try{await onCreateAuction(selected.instanceId,Number(auctionPrice),Number(auctionDuration));setSelectedId(null);}catch(error){setEvolutionError(error instanceof Error?error.message:"Impossible de créer l’enchère.");}finally{setAuctionBusy(false);}}
  async function saveCustomImage(imageUrl: string | null) {
    if (!selected || !onSetCustomImage || imageBusy) return;
    setImageBusy(true); setImageError("");
    try { await onSetCustomImage(selected.instanceId, imageUrl); setCustomImageUrl(""); }
    catch (error) { setImageError(error instanceof Error ? error.message : "Impossible de personnaliser l'image."); }
    finally { setImageBusy(false); }
  }
  async function discardSelected() {
    if (!selected || !onDiscard || discardBusy) return;
    setDiscardBusy(true); setDiscardError("");
    try { await onDiscard(selected.instanceId); setDiscardConfirm(false); setSelectedId(null); }
    catch (error) { setDiscardError(error instanceof Error ? error.message : "Impossible de détruire cette carte."); }
    finally { setDiscardBusy(false); }
  }
  async function discardSelection() {
    if (!onDiscardMany || !selectedCards.length || bulkDiscardBusy) return;
    setBulkDiscardBusy(true); setBulkDiscardError("");
    try {
      await onDiscardMany(selectedCards.map(card => card.instanceId));
      setSelection(new Set()); setSelecting(false);
    } catch (error) {
      setBulkDiscardError(error instanceof Error ? error.message : "Impossible de détruire la sélection.");
    } finally { setBulkDiscardBusy(false); }
  }
  return <section aria-label="Collection de cartes" className={selecting ? "pb-28" : ""}>
    <div className="my-3 flex items-center justify-between gap-4"><div className="min-w-0 flex-1"><p role="status" className="text-xs leading-5 text-ink-2"><strong className="text-ink">{cards.length}</strong>{total == null ? " cartes possédées" : ` possédées / ${total} du catalogue`} · Page {activePage} sur {pageCount} · Les plus rares en premier · Les doublons sont conservés</p>{total != null && total > 0 && <div className="mt-1.5 h-1 max-w-48 overflow-hidden rounded-full bg-void" role="progressbar" aria-label="Complétion du catalogue" aria-valuenow={cards.length} aria-valuemin={0} aria-valuemax={total}><div className="h-full bg-accent-gold" style={{width:`${Math.min(100,cards.length/total*100)}%`}} /></div>}</div>{!readOnly && <Button className="shrink-0" variant="secondary" onClick={()=>{setSelecting(!selecting);setSelection(new Set());}}>{selecting ? "Quitter la sélection" : "Sélection multiple"}</Button>}</div>
    <div className="mb-4 rounded-panel border border-veil bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="collection-query">Rechercher dans la collection</label><input id="collection-query" type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Rechercher dans ma collection…" className="auth-input min-w-64 flex-1 py-2 text-sm"/>
        <label className="sr-only" htmlFor="collection-category">Filtrer par catégorie</label><select id="collection-category" value={category} onChange={event=>setCategory(event.target.value)} className="min-h-10 min-w-48 rounded-input border border-veil bg-night px-3 py-2 text-xs text-ink-2"><option value="">Toutes les catégories</option>{categories.map(item=><option key={item} value={item}>{item}</option>)}</select>
        {!readOnly&&<><label className="sr-only" htmlFor="collection-folder">Filtrer par dossier</label><select id="collection-folder" value={folder} onChange={event=>{setFolder(event.target.value);setPage(1);}} className="min-h-10 min-w-44 rounded-input border border-veil bg-night px-3 py-2 text-xs text-ink-2"><option value="">Tous les dossiers</option><option value="unfiled">Sans dossier</option>{folders.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{onCreateFolder&&<button type="button" aria-label="Créer un dossier" aria-expanded={showFolderCreator} className="flex size-10 shrink-0 items-center justify-center rounded-input border border-veil text-lg leading-none text-ink-2 transition-colors hover:border-accent-gold hover:text-accent-gold" onClick={()=>{setShowFolderCreator(current=>!current);setFolderError("");}}>+</button>}{onDeleteFolder&&folder&&folder!=="unfiled"&&<button type="button" aria-label="Supprimer le dossier sélectionné" className="h-10 px-2 text-xs text-danger" onClick={()=>void onDeleteFolder(folder)}>Supprimer</button>}</>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Filtrer par rareté"><button type="button" aria-pressed={!rarity} className={`border-b py-1 text-xs font-semibold transition-colors ${!rarity?"border-accent-gold text-ink":"border-transparent text-ink-3 hover:text-ink"}`} onClick={()=>setRarity("")}>Toutes <span className="ml-1 font-normal text-ink-3">{cards.length}</span></button>{rarityOrder.map(r=><button type="button" key={r} aria-pressed={rarity===r} className={`border-b py-1 text-xs font-semibold transition-colors ${rarity===r?`border-current ${rarityText[r]}`:`border-transparent ${rarityText[r]} opacity-70 hover:opacity-100`}`} onClick={()=>setRarity(r)}>{r}<span className="ml-1 font-normal text-ink-3">{cards.filter(c=>c.rarity===r).length}</span></button>)}<button type="button" aria-pressed={shinyOnly} className={`border-b py-1 text-xs transition-colors ${shinyOnly?"border-accent-neon text-accent-neon":"border-transparent text-ink-2 hover:text-ink"}`} onClick={()=>setShinyOnly(!shinyOnly)}>✦ Shiny uniquement</button></div>
      {onCreateFolder&&showFolderCreator&&<div className="mt-3 flex gap-2"><input autoFocus value={folderName} maxLength={40} onChange={event=>setFolderName(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void addFolder();}if(event.key==="Escape"){setShowFolderCreator(false);setFolderName("");}}} placeholder="Nouveau dossier" aria-label="Nom du nouveau dossier" className="auth-input min-w-0"/><Button variant="secondary" disabled={folderBusy||!folderName.trim()} onClick={()=>void addFolder()}>{folderBusy?"Création…":"Créer"}</Button></div>}{folderError&&<p role="alert" className="mt-2 text-xs text-danger">{folderError}</p>}
    </div>
    {(query||rarity||category||shinyOnly||folder)&&<div className="mb-6 flex justify-end"><button type="button" className="text-xs text-accent-gold" onClick={()=>{setQuery("");setRarity("");setCategory("");setShinyOnly(false);setFolder("");setPage(1);}}>Réinitialiser les filtres</button></div>}
    {filtered.length===0&&<div className="rounded-panel border border-dashed border-veil-strong px-6 py-16 text-center"><p className="font-display text-xl">{cards.length===0?"Ta collection est vide pour l’instant — ouvre ton premier booster.":"Aucune carte ne correspond à ces filtres."}</p>{cards.length===0?<Link href="/boosters" className="yk-button yk-button-primary mt-6">Ouvrir mon premier booster</Link>:<p className="mt-3 text-sm text-ink-2">Essaie une autre rareté ou catégorie.</p>}</div>}
    <ul className="yk-collection-grid" aria-label="Cartes obtenues">{visibleCards.map(card=>{const meta=presentation[card.instanceId];const checked=selection.has(card.instanceId);return <li key={card.instanceId} className="min-w-0"><button type="button" disabled={selecting&&!!meta?.frozen} className={`yk-collection-card ${selecting&&checked?"yk-selected-card":""}`} aria-label={`${selecting?"Sélectionner":"Voir"} ${card.name}, ${card.rarity}`} aria-pressed={selecting?checked:undefined} aria-haspopup={selecting?undefined:"dialog"} onClick={()=>selecting?toggle(card.instanceId):setSelectedId(card.instanceId)}><YokaiCard {...card} image={readOnly?card.catalogueImage:card.image} {...meta} />{selecting&&!meta?.frozen&&<span className={`yk-selection-check ${checked?"yk-checked":""}`}>{checked?"✓":""}</span>}{meta?.isNew&&<span className="absolute top-3 left-3 rounded-badge bg-accent-gold px-2 py-1 text-[10px] font-bold text-void">NEW</span>}{duplicates[card.id]>1&&<span className="absolute right-2 bottom-2 rounded-full border border-veil bg-void/90 px-2 py-1 text-xs text-ink-2">×{duplicates[card.id]}</span>}{meta?.frozen&&<span className="yk-frozen-overlay"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg><strong>EN ENCHÈRE</strong><span>{meta.frozen.remaining}</span></span>}</button>{card.isFirstOwner?<p className="mt-3 text-[11px] font-semibold text-rarity-lr">Premier propriétaire, obtenu le {formatDate(card.obtainedAt)}</p>:<><p className="mt-3 text-[11px] tracking-wider text-ink-3 uppercase">Obtenue le</p><time dateTime={card.obtainedAt} className="mt-1 block text-[13px] text-ink-2">{formatDate(card.obtainedAt)}</time></>}</li>;})}</ul>
    <Pagination page={activePage} pageCount={pageCount} onPageChange={setPage} label="Pagination de la collection" />
    {selecting&&<div className="yk-selection-bar"><span className="text-sm"><strong>{selectedCards.length}</strong> sélectionnée(s)</span><Karas amount={selectedValue}/><button type="button" disabled={bulkDiscardBusy} className="text-xs text-ink-2" onClick={()=>setSelection(new Set(filtered.filter(c=>!presentation[c.instanceId]?.frozen).map(c=>c.instanceId)))}>Tout</button><button type="button" disabled={bulkDiscardBusy} className="text-xs text-ink-2" onClick={()=>setSelection(new Set())}>Aucune</button>{bulkDiscardError&&<span role="alert" className="text-xs text-danger">{bulkDiscardError}</span>}<Button variant="danger" disabled={!onDiscardMany||!selectedCards.length||bulkDiscardBusy} onClick={()=>void discardSelection()}>{bulkDiscardBusy?"Destruction…":"Détruire la sélection"}</Button><button type="button" disabled={bulkDiscardBusy} aria-label="Quitter la sélection multiple" title="Quitter la sélection multiple" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-veil text-lg leading-none text-ink-2 transition-colors hover:border-veil-strong hover:bg-veil hover:text-ink" onClick={()=>{setSelecting(false);setSelection(new Set());}}>×</button></div>}
    <Modal open={!!selected&&!discardConfirm} onClose={()=>setSelectedId(null)} title="Détail de la carte">{selected&&<><div className="yk-detail-grid">
      <div className="flex h-full flex-col gap-4"><div className="yk-detail-art"><YokaiCard {...selected} image={readOnly?selected.catalogueImage:selected.image} {...selectedMeta} fallbackImage={selected.catalogueImage}/></div>{!readOnly&&onMoveCard&&<section className="mt-auto rounded-panel border border-veil bg-void p-3"><label htmlFor="detail-card-folder" className="yk-section-title">Dossier</label><select id="detail-card-folder" value={selected.folderId??""} onChange={event=>void onMoveCard(selected.instanceId,event.target.value||null)} className="mt-2 w-full rounded-input border border-veil bg-night px-3 py-2 text-sm text-ink-2"><option value="">Sans dossier</option>{folders.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></section>}{!readOnly&&onSetCustomImage&&selected.rarity==="SSR"&&<section className="rounded-panel border border-veil bg-void p-3"><p className="yk-section-title">Personnaliser l'image</p><p className="mt-2 text-xs leading-5 text-ink-3">Lien Imgur personnalisé</p><input type="url" value={customImageUrl} onChange={event=>{setCustomImageUrl(event.target.value);setImageError("");}} placeholder="https://i.imgur.com/image.jpg" aria-label="Lien Imgur personnalisé" className="auth-input mt-2"/><div className="mt-2 grid gap-2"><Button className="w-full" disabled={imageBusy||!customImageUrl.trim()} onClick={()=>void saveCustomImage(customImageUrl.trim())}>{imageBusy?"Enregistrement...":"Appliquer l'image"}</Button>{selected.customImageUrl&&<Button className="w-full" variant="secondary" disabled={imageBusy} onClick={()=>void saveCustomImage(null)}>Réinitialiser</Button>}</div>{imageError&&<p role="alert" className="mt-2 text-xs text-danger">{imageError}</p>}</section>}</div>
      <div className="flex h-full min-w-0 flex-col gap-4"><header className={`${selected.rarity==="SSR"&&!selected.shiny?"mt-auto":""} flex items-start justify-between gap-4 py-1`}><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-3"><span className={`text-base font-bold tracking-widest ${rarityText[selected.rarity]}`}>{selected.rarity}{selected.shiny?" ✦":""}</span><h3 className="font-display text-[28px] leading-tight">{selected.name}</h3>{selected.isEvolved&&<span className="text-[10px] font-semibold tracking-wider text-accent-gold">ÉVOLUÉE</span>}</div><p className="mt-2 text-sm text-ink-2">{selected.category}</p><p className="mt-2 text-xs text-ink-3">Obtenue le {formatDate(selected.obtainedAt,true)} · {duplicates[selected.id]} exemplaire(s)</p></div>{!readOnly&&onDiscard&&<button type="button" aria-label={`Détruire ${selected.name}`} title={selectedMeta?.frozen?"Cette carte est actuellement en enchère":"Détruire la carte"} disabled={discardBusy||!!selectedMeta?.frozen} onClick={()=>{setDiscardError("");setDiscardConfirm(true);}} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-danger/40 bg-danger/10 text-danger transition-colors hover:border-danger hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-40"><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button>}</header>
      {!readOnly&&selected.rarity==="SSR"&&!selected.shiny&&<section className="rounded-panel border border-accent-neon/30 bg-accent-neon/5 p-4"><p className="text-sm text-ink-2"><strong className="text-accent-neon">Évolution Shiny</strong> · {evolvableCopies} / 3 exemplaires SSR non-Shiny</p><Button className="mt-3 w-full" disabled={evolvableCopies<3||evolving||!onEvolve} onClick={evolveSelected}>{evolving?"Évolution…":"Évoluer en Shiny (consomme 3 exemplaires)"}</Button></section>}
      {!readOnly&&onCreateAuction&&<section className={`${selected.rarity==="SSR"&&!selected.shiny?"":"mt-auto"} rounded-panel border border-veil bg-void p-4`}><p className="yk-section-title mb-4">Mettre aux enchères</p><label className="text-xs text-ink-3">Prix de départ<input type="number" min="10" value={auctionPrice} onChange={e=>setAuctionPrice(e.target.value)} className="auth-input mt-2"/></label><fieldset className="mt-4"><legend className="mb-2 text-xs text-ink-3">Durée</legend><div className="grid grid-cols-3 gap-2">{[["15","15 min"],["30","30 min"],["60","1 h"],["240","4 h"],["720","12 h"],["1440","24 h"]].map(([value,label])=><Chip key={value} active={auctionDuration===value} className="justify-center" onClick={()=>setAuctionDuration(value)}>{label}</Chip>)}</div></fieldset><p className="mt-4 text-xs leading-5 text-ink-3">La carte sera gelée jusqu’à la fin de l’enchère.</p><Button className="mt-4 w-full" disabled={auctionBusy||Number(auctionPrice)<10} onClick={()=>void auctionSelected()}>{auctionBusy?"Publication…":"Mettre aux enchères"}</Button></section>}
      {evolutionError&&<p role="alert" className="text-xs text-danger">{evolutionError}</p>}</div>
    </div>{!readOnly&&onSetCustomImage&&selected.rarity!=="SSR"&&<section className="mt-4 rounded-panel border border-veil bg-void p-4"><p className="yk-section-title">Personnaliser l'image</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><div className="min-w-0 flex-1"><p className="mb-2 text-xs leading-5 text-ink-3">Collez un lien https://i.imgur.com/... ou https://imgur.com/...</p><input type="url" value={customImageUrl} onChange={event=>{setCustomImageUrl(event.target.value);setImageError("");}} placeholder="https://i.imgur.com/image.jpg" aria-label="Lien Imgur personnalisé" className="auth-input"/></div><div className="flex shrink-0 items-end gap-2"><Button disabled={imageBusy||!customImageUrl.trim()} onClick={()=>void saveCustomImage(customImageUrl.trim())}>{imageBusy?"Enregistrement...":"Appliquer l'image"}</Button>{selected.customImageUrl&&<Button variant="secondary" disabled={imageBusy} onClick={()=>void saveCustomImage(null)}>Réinitialiser</Button>}</div></div>{imageError&&<p role="alert" className="mt-3 text-xs text-danger">{imageError}</p>}</section>}</>}
    </Modal>
    <Modal open={discardConfirm&&!!selected} onClose={()=>{if(!discardBusy){setDiscardConfirm(false);setDiscardError("");}}} title="Détruire cette carte ?">{selected&&<><p className="text-sm leading-6 text-ink-2">La destruction de <strong className="text-ink">{selected.name}</strong> est définitive. Tu recevras <strong className="text-karas">{{C:1,R:2,SR:3,SSR:4,LR:5}[selected.rarity]} Kara{selected.rarity==="C"?"":"s"}</strong>.</p>{discardError&&<p role="alert" className="mt-4 text-sm text-danger">{discardError}</p>}<div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={discardBusy} onClick={()=>setDiscardConfirm(false)}>Annuler</Button><Button variant="danger" disabled={discardBusy} onClick={()=>void discardSelected()}>{discardBusy?"Destruction…":"Détruire"}</Button></div></>}</Modal>
  </section>;
}
