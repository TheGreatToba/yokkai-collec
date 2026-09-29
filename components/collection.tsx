"use client";
/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";
import { useState } from "react";
import type { CollectedCard, Folder, Rarity } from "@/lib/data/cards";
import { Button, Chip, Feedback, Karas, Modal, Pagination } from "@/components/ui";
import { YokaiCard } from "@/components/yokai-card";
import { CardShell } from "@/components/card-shell";
import { CARD_PAGE_SIZES } from "@/lib/ui/pagination";

// Optional display metadata, separate from the existing business types.
export type CollectionPresentation = { number?: string; isNew?: boolean; frozen?: { remaining: string }; marketValue?: number | null; destructionValue?: number };
const rarityOrder: Rarity[] = ["LR","SSR","SR","R","C"];
const rarityText = { C:"text-rarity-c", R:"text-rarity-r", SR:"text-rarity-sr", SSR:"text-rarity-ssr", LR:"text-rarity-lr" };
// Karas credited by a single destruction, as already announced in the confirmation modal.
const DESTRUCTION_KARAS: Record<Rarity, number> = { C:1, R:2, SR:3, SSR:4, LR:5 };
const formatDate = (value: string, long = false) => new Date(value).toLocaleDateString("fr-FR", {dateStyle:long ? "long" : "medium"});

function FilterSection({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return <details className="yk-filter-section" open={open}><summary>{title}<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m7 10 5 5 5-5"/></svg></summary><div className="yk-filter-section-content">{children}</div></details>;
}

function FilterIcon({ colorClass }: { colorClass: string }) {
  return <svg aria-hidden="true" className={colorClass} width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.45 6.1L21 10.5l-5.25 4.05L16 21l-4-3.55L8 21l.25-6.45L3 10.5l6.55-2.4L12 2Z"/></svg>;
}

export function CollectionView({ cards, categories, presentation = {}, readOnly = false, folders = [], onCreateFolder, onDeleteFolder, onMoveCard, onCreateAuction, onEvolve, onSetCustomImage, onDiscard, onDiscardMany }: {
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
  const [pageSize, setPageSize] = useState<number>(CARD_PAGE_SIZES[0]);
  const [folderName, setFolderName] = useState("");
  const [showFolderCreator, setShowFolderCreator] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [auctionPrice,setAuctionPrice]=useState("10");
  const [auctionDuration,setAuctionDuration]=useState("60");
  const [auctionBusy,setAuctionBusy]=useState(false);
  const [auctionOpen,setAuctionOpen]=useState(false);
  const [auctionDone,setAuctionDone]=useState(false);
  const [auctionError,setAuctionError]=useState("");
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const selected = cards.find(c => c.instanceId === selectedId);
  const selectedMeta = selected ? presentation[selected.instanceId] : undefined;
  const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
  const filtered = cards.filter(c => (!normalizedQuery || [c.name,c.category,c.anime].some(value=>value?.toLocaleLowerCase("fr-FR").includes(normalizedQuery))) && (!category || c.category === category) && (!rarity || c.rarity === rarity) && (!shinyOnly || c.shiny)
      && (!folder || (folder === "unfiled" ? !c.folderId : c.folderId === folder)))
    .slice().sort((a,b) => rarityOrder.indexOf(a.rarity)-rarityOrder.indexOf(b.rarity) || Number(b.shiny)-Number(a.shiny));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const visibleCards = filtered.slice((activePage - 1) * pageSize, activePage * pageSize);
  const selectedCards = cards.filter(c => selection.has(c.instanceId) && !presentation[c.instanceId]?.frozen);
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
  async function auctionSelected(){if(!selected||!onCreateAuction||auctionBusy)return;setAuctionBusy(true);setAuctionError("");try{await onCreateAuction(selected.instanceId,Number(auctionPrice),Number(auctionDuration));setAuctionDone(true);}catch(error){setAuctionError(error instanceof Error?error.message:"Impossible de créer l’enchère.");}finally{setAuctionBusy(false);}}
  function closeAuction(){if(auctionBusy)return;setAuctionOpen(false);setAuctionError("");if(auctionDone){setAuctionDone(false);setSelectedId(null);}}
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
  const resetFilters = () => { setQuery(""); setRarity(""); setCategory(""); setShinyOnly(false); setFolder(""); setPage(1); };
  const filters = <>
    <div className="yk-filter-search"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><label className="sr-only" htmlFor="collection-query">Rechercher dans la collection</label><input id="collection-query" type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Rechercher…"/></div>
    <FilterSection title="Rareté">
      <button type="button" className="yk-filter-option" aria-pressed={!rarity} onClick={()=>{setRarity("");setPage(1);}}><span className="yk-filter-check"/><span>Toutes</span><strong>{cards.length}</strong></button>
      {rarityOrder.map(r=><button type="button" key={r} className="yk-filter-option" aria-pressed={rarity===r} onClick={()=>{setRarity(r);setPage(1);}}><span className="yk-filter-check"/><FilterIcon colorClass={rarityText[r]}/><span className={rarityText[r]}>{r}</span><strong>{cards.filter(c=>c.rarity===r).length}</strong></button>)}
    </FilterSection>
    <FilterSection title="Catégorie">
      <button type="button" className="yk-filter-option" aria-pressed={!category} onClick={()=>{setCategory("");setPage(1);}}><span className="yk-filter-check"/><span>Toutes les catégories</span><strong>{cards.length}</strong></button>
      {categories.map(item=><button type="button" key={item} className="yk-filter-option" aria-pressed={category===item} onClick={()=>{setCategory(item);setPage(1);}}><span className="yk-filter-check"/><span>{item}</span><strong>{cards.filter(card=>card.category===item).length}</strong></button>)}
    </FilterSection>
    {!readOnly&&<FilterSection title="Dossier">
      <button type="button" className="yk-filter-option" aria-pressed={!folder} onClick={()=>{setFolder("");setPage(1);}}><span className="yk-filter-check"/><span>Tous les dossiers</span><strong>{cards.length}</strong></button>
      <button type="button" className="yk-filter-option" aria-pressed={folder==="unfiled"} onClick={()=>{setFolder("unfiled");setPage(1);}}><span className="yk-filter-check"/><span>Sans dossier</span><strong>{cards.filter(card=>!card.folderId).length}</strong></button>
      {folders.map(item=><button type="button" key={item.id} className="yk-filter-option" aria-pressed={folder===item.id} onClick={()=>{setFolder(item.id);setPage(1);}}><span className="yk-filter-check"/><span>{item.name}</span><strong>{cards.filter(card=>card.folderId===item.id).length}</strong></button>)}
      {onCreateFolder&&<button type="button" className="yk-folder-create-toggle" aria-expanded={showFolderCreator} onClick={()=>{setShowFolderCreator(current=>!current);setFolderError("");}}>+ Créer un dossier</button>}
      {onCreateFolder&&showFolderCreator&&<div className="yk-folder-create"><input autoFocus value={folderName} maxLength={40} onChange={event=>setFolderName(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void addFolder();}if(event.key==="Escape"){setShowFolderCreator(false);setFolderName("");}}} placeholder="Nouveau dossier" aria-label="Nom du nouveau dossier"/><Button variant="secondary" disabled={folderBusy||!folderName.trim()} onClick={()=>void addFolder()}>{folderBusy?"Création…":"Créer"}</Button></div>}
      {onDeleteFolder&&folder&&folder!=="unfiled"&&<button type="button" className="yk-folder-delete" onClick={()=>void onDeleteFolder(folder)}>Supprimer ce dossier</button>}{folderError&&<p role="alert" className="text-xs text-danger">{folderError}</p>}
    </FilterSection>}
    <button type="button" className="yk-filter-reset" disabled={!(query||rarity||category||shinyOnly||folder)} onClick={resetFilters}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>Réinitialiser les filtres</button>
  </>;
  return <section aria-label="Collection de cartes" className={`yk-collection ${selecting ? "pb-28" : ""}`}>
    <button type="button" className="yk-mobile-filter-trigger" aria-expanded={filtersOpen} aria-controls="collection-filters" onClick={()=>setFiltersOpen(true)}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtres{(query||rarity||category||folder)?<span>•</span>:null}</button>
    {filtersOpen&&<button type="button" className="yk-filter-backdrop" aria-label="Fermer les filtres" onClick={()=>setFiltersOpen(false)}/>}
    <div className="yk-collection-layout">
      <aside id="collection-filters" className={`yk-collection-sidebar ${filtersOpen?"yk-sidebar-open":""}`} aria-label="Filtres de la collection"><div className="yk-sidebar-mobile-head"><strong>Filtres</strong><button type="button" aria-label="Fermer les filtres" onClick={()=>setFiltersOpen(false)}>×</button></div>{filters}</aside>
      <div className="yk-collection-main">
        <div className="yk-collection-toolbar">
          <div className="yk-collection-toolbar-actions">
            <div className="yk-sort-placeholder" aria-label="Tri non disponible dans cette phase"><span>Trier par :</span><strong>Plus récentes</strong><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m7 10 5 5 5-5"/></svg></div>
            {!readOnly&&<Button variant="secondary" className="yk-selection-mode" onClick={()=>{setSelecting(!selecting);setSelection(new Set());}}>{selecting?"Quitter la sélection":"Sélection multiple"}</Button>}
          </div>
          <button type="button" role="switch" aria-checked={shinyOnly} className="yk-shiny-toggle" onClick={()=>{setShinyOnly(current=>!current);setPage(1);}}><span>Shiny uniquement</span><i/></button>
          <div className="yk-view-toggle" aria-label="Mode d’affichage"><button type="button" aria-label="Vue grille" aria-pressed={viewMode==="grid"} onClick={()=>setViewMode("grid")}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg></button><button type="button" aria-label="Vue liste" aria-pressed={viewMode==="list"} onClick={()=>setViewMode("list")}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg></button></div>
        </div>
        {filtered.length===0&&<div className="rounded-panel border border-dashed border-veil-strong px-6 py-16 text-center"><p className="font-display text-xl">{cards.length===0?"Ta collection est vide pour l’instant — ouvre ton premier booster.":"Aucune carte ne correspond à ces filtres."}</p>{cards.length===0?<Link href="/boosters" className="yk-button yk-button-primary mt-6">Ouvrir mon premier booster</Link>:<p className="mt-3 text-sm text-ink-2">Essaie une autre rareté ou catégorie.</p>}</div>}
        <ul className={`yk-card-grid yk-collection-grid ${viewMode==="list"?"yk-collection-grid-list":""}`} aria-label="Cartes obtenues">{visibleCards.map(card=>{const meta=presentation[card.instanceId];const checked=selection.has(card.instanceId);return <li key={card.instanceId} className="min-w-0"><button type="button" disabled={selecting&&!!meta?.frozen} className={`yk-collection-card ${selecting&&checked?"yk-selected-card":""}`} aria-label={`${selecting?"Sélectionner":"Voir"} ${card.name}, ${card.rarity}`} aria-pressed={selecting?checked:undefined} aria-haspopup={selecting?undefined:"dialog"} onClick={()=>selecting?toggle(card.instanceId):setSelectedId(card.instanceId)}><CardShell><YokaiCard {...card} image={readOnly?card.catalogueImage:card.image} {...meta}/></CardShell>{selecting&&!meta?.frozen&&<span className={`yk-selection-check ${checked?"yk-checked":""}`}>{checked?"✓":""}</span>}{meta?.isNew&&<span className="absolute top-3 left-3 rounded-badge bg-accent-gold px-2 py-1 text-[10px] font-bold text-void">NEW</span>}{duplicates[card.id]>1&&<span className="absolute right-2 bottom-2 rounded-full border border-veil bg-void/90 px-2 py-1 text-xs text-ink-2">×{duplicates[card.id]}</span>}{meta?.frozen&&<span className="yk-frozen-overlay"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg><strong>EN ENCHÈRE</strong><span>{meta.frozen.remaining}</span></span>}</button><div className="yk-collection-card-meta">{card.isFirstOwner?<p className="text-[11px] font-semibold text-rarity-lr">Premier propriétaire, obtenu le {formatDate(card.obtainedAt)}</p>:<><p className="text-[11px] tracking-wider text-ink-3 uppercase">Obtenue le</p><time dateTime={card.obtainedAt} className="mt-1 block text-[13px] text-ink-2">{formatDate(card.obtainedAt)}</time></>}</div></li>;})}</ul>
        <div className="yk-collection-pagination"><Pagination page={activePage} pageCount={pageCount} onPageChange={setPage} label="Pagination de la collection"/><label>Cartes par page<select value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1);}}>{CARD_PAGE_SIZES.map(size=><option key={size} value={size}>{size}</option>)}</select></label></div>
        {selecting&&<div className="yk-selection-bar"><span className="text-sm"><strong>{selectedCards.length}</strong> sélectionnée(s)</span><Karas amount={selectedValue}/><button type="button" disabled={bulkDiscardBusy} className="text-xs text-ink-2" onClick={()=>setSelection(new Set(filtered.filter(c=>!presentation[c.instanceId]?.frozen).map(c=>c.instanceId)))}>Tout</button><button type="button" disabled={bulkDiscardBusy} className="text-xs text-ink-2" onClick={()=>setSelection(new Set())}>Aucune</button>{bulkDiscardError&&<span role="alert" className="text-xs text-danger">{bulkDiscardError}</span>}<Button variant="danger" disabled={!onDiscardMany||!selectedCards.length||bulkDiscardBusy} onClick={()=>void discardSelection()}>{bulkDiscardBusy?"Destruction…":"Détruire la sélection"}</Button><button type="button" disabled={bulkDiscardBusy} aria-label="Quitter la sélection multiple" title="Quitter la sélection multiple" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-veil text-lg leading-none text-ink-2 transition-colors hover:border-veil-strong hover:bg-veil hover:text-ink" onClick={()=>{setSelecting(false);setSelection(new Set());}}>×</button></div>}
      </div>
    </div>
    <Modal open={!!selected&&!discardConfirm&&!auctionOpen} onClose={()=>setSelectedId(null)} title="Détail de la carte" className="yk-card-detail-modal">{selected&&<div className="yk-detail-grid">
      <div className="yk-detail-side"><div className="yk-detail-art"><YokaiCard {...selected} image={readOnly?selected.catalogueImage:selected.image} {...selectedMeta} fallbackImage={selected.catalogueImage}/></div>
        {!readOnly&&onMoveCard&&<div className="yk-detail-folder"><label htmlFor="detail-card-folder" className="yk-section-title">Dossier</label><select id="detail-card-folder" value={selected.folderId??""} onChange={event=>void onMoveCard(selected.instanceId,event.target.value||null)}><option value="">Sans dossier</option>{folders.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
      </div>
      <div className="yk-detail-info">
        <header><div className="flex flex-wrap items-center gap-2"><span className={`text-sm font-bold tracking-widest ${rarityText[selected.rarity]}`}>{selected.rarity}{selected.shiny?" ✦ Shiny":""}</span>{selected.isEvolved&&<span className="text-[10px] font-semibold tracking-wider text-accent-gold">ÉVOLUÉE</span>}</div><h3 className="mt-1 font-display text-[28px] leading-tight">{selected.name}</h3></header>
        <dl className="yk-detail-facts"><div><dt>Catégorie</dt><dd>{selected.category}</dd></div><div><dt>Obtenue le</dt><dd>{formatDate(selected.obtainedAt,true)}</dd></div><div><dt>Exemplaires</dt><dd>{duplicates[selected.id]}</dd></div>{selectedMeta?.marketValue!=null&&<div><dt>Valeur de marché</dt><dd><Karas amount={selectedMeta.marketValue}/></dd></div>}</dl>
        {!readOnly&&(onCreateAuction||(selected.rarity==="SSR"&&!selected.shiny))&&<div className="yk-detail-actions">
          {onCreateAuction&&<Button className="w-full" disabled={!!selectedMeta?.frozen} onClick={()=>{setAuctionError("");setAuctionDone(false);setAuctionOpen(true);}}>{selectedMeta?.frozen?"Déjà en vente":"Mettre aux enchères"}</Button>}
          {selected.rarity==="SSR"&&!selected.shiny&&<div className="yk-detail-evolve"><Button variant="secondary" className="w-full" disabled={evolvableCopies<3||evolving||!onEvolve} onClick={evolveSelected}>{evolving?"Évolution…":"Évoluer en Shiny (consomme 3 exemplaires)"}</Button><p><strong className="text-accent-neon">Évolution Shiny</strong> · {evolvableCopies} / 3 exemplaires SSR non-Shiny</p></div>}
          {evolutionError&&<p role="alert" className="text-xs text-danger">{evolutionError}</p>}
        </div>}
        {!readOnly&&onSetCustomImage&&<div className="yk-detail-image"><label htmlFor="detail-custom-image" className="yk-section-title">Personnaliser l'image</label><div className="yk-detail-image-row"><input id="detail-custom-image" type="url" value={customImageUrl} onChange={event=>{setCustomImageUrl(event.target.value);setImageError("");}} placeholder="https://i.imgur.com/image.jpg" aria-label="Lien Imgur personnalisé" className="auth-input"/><Button variant="secondary" disabled={imageBusy||!customImageUrl.trim()} onClick={()=>void saveCustomImage(customImageUrl.trim())}>{imageBusy?"Enregistrement…":"Appliquer"}</Button></div><p className="yk-detail-hint">Lien https://i.imgur.com/… ou https://imgur.com/…{selected.customImageUrl&&<> · <button type="button" className="yk-detail-link" disabled={imageBusy} onClick={()=>void saveCustomImage(null)}>Revenir à l’image d’origine</button></>}</p>{imageError&&<p role="alert" className="mt-2 text-xs text-danger">{imageError}</p>}</div>}
        {!readOnly&&onDiscard&&<div className="yk-detail-danger"><Button variant="danger" className="w-full" title={selectedMeta?.frozen?"Cette carte est actuellement en enchère":undefined} disabled={discardBusy||!!selectedMeta?.frozen} onClick={()=>{setDiscardError("");setDiscardConfirm(true);}}>Détruire la carte (+{DESTRUCTION_KARAS[selected.rarity]} Kara{selected.rarity==="C"?"":"s"})</Button></div>}
      </div>
    </div>}
    </Modal>
    <Modal open={discardConfirm&&!!selected} onClose={()=>{if(!discardBusy){setDiscardConfirm(false);setDiscardError("");}}} title="Détruire cette carte ?">{selected&&<><p className="text-sm leading-6 text-ink-2">La destruction de <strong className="text-ink">{selected.name}</strong> est définitive. Tu recevras <strong className="text-karas">{DESTRUCTION_KARAS[selected.rarity]} Kara{selected.rarity==="C"?"":"s"}</strong>.</p>{discardError&&<p role="alert" className="mt-4 text-sm text-danger">{discardError}</p>}<div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={discardBusy} onClick={()=>setDiscardConfirm(false)}>Annuler</Button><Button variant="danger" disabled={discardBusy} onClick={()=>void discardSelected()}>{discardBusy?"Destruction…":"Détruire"}</Button></div></>}</Modal>
    <Modal open={auctionOpen&&!!selected} onClose={closeAuction} title={auctionDone?"Carte mise aux enchères":"Mettre aux enchères"} className="yk-auction-modal">{selected&&(auctionDone?<><Feedback tone="success" title="Carte mise aux enchères — verrouillée jusqu’à la fin de la vente">Elle apparaît dès maintenant sur le marché.</Feedback><div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={closeAuction}>Fermer</Button><Link href="/marche" className="yk-button yk-button-primary">Voir le marché</Link></div></>:<form onSubmit={event=>{event.preventDefault();if(Number(auctionPrice)>=10)void auctionSelected();}}><div className="yk-auction-modal-grid"><div className="yk-auction-modal-art"><YokaiCard {...selected} image={selected.image} fallbackImage={selected.catalogueImage}/></div><div className="min-w-0"><p className={`text-sm font-bold tracking-widest ${rarityText[selected.rarity]}`}>{selected.rarity}{selected.shiny?" ✦":""}</p><h3 className="mt-1 font-display text-2xl leading-tight">{selected.name}</h3><label className="mt-5 block text-xs font-semibold tracking-wider text-ink-3 uppercase" htmlFor="auction-price">Prix de départ</label><input id="auction-price" type="number" inputMode="numeric" min="10" value={auctionPrice} onChange={e=>setAuctionPrice(e.target.value)} aria-invalid={Number(auctionPrice)<10||undefined} className="auth-input mt-2"/><p className={`mt-2 text-xs ${Number(auctionPrice)<10?"text-danger-ink":"text-ink-3"}`}>Minimum 10 Karas.</p><fieldset className="mt-5"><legend className="mb-2 text-xs font-semibold tracking-wider text-ink-3 uppercase">Durée</legend><div className="grid grid-cols-3 gap-2">{[["15","15 min"],["30","30 min"],["60","1 h"],["240","4 h"],["720","12 h"],["1440","24 h"]].map(([value,label])=><Chip key={value} active={auctionDuration===value} className="justify-center" onClick={()=>setAuctionDuration(value)}>{label}</Chip>)}</div></fieldset></div></div><ul className="yk-auction-modal-notes"><li>La carte sera verrouillée jusqu’à la fin de la vente : impossible de l’échanger ou de la détruire.</li>{selected.customImageUrl&&<li>L’image personnalisée de cette carte sera réinitialisée.</li>}</ul>{auctionError&&<p role="alert" className="mt-4 text-sm text-danger">{auctionError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={auctionBusy} onClick={closeAuction}>Annuler</Button><Button type="submit" disabled={auctionBusy||Number(auctionPrice)<10} aria-busy={auctionBusy||undefined}>{auctionBusy?"Publication…":"Mettre en vente"}</Button></div></form>)}</Modal>
  </section>;
}
