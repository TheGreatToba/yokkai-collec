"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Card, CollectedCard, DecisionPackStatus, PackStatus } from "@/lib/data/cards";
import { Button, Modal, SelectionBar, SelectionModeButton, StatusPill } from "@/components/ui";
import { CardBack, YokaiCard } from "@/components/yokai-card";
import type { SfxName } from "@/hooks/use-sfx";
import { animation } from "@/lib/ui/animations";
import { runPackOpeningSequence } from "@/lib/ui/pack-opening";

export type RevealCard = Card & { instanceId: string; shiny?: boolean; isEvolved?: boolean; isNew?: boolean; copies?: number; discarded?: boolean; destructionValue?: number; locked?: boolean };
type Sound = SfxName;
const noopSound = () => {};
// Formats the server-provided `nextPackAt`; the countdown itself stays computed by Game.
function decisionReturnLabel(nextPackAt: number) {
  const date = new Date(nextPackAt);
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return `Revient aujourd’hui à ${time}`;
  if (days === 1) return `Revient demain à ${time}`;
  return `Revient le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${time}`;
}
type Decision = { onKeep: (instanceId: string) => Promise<number>; keptId?: string; busy?: boolean; karasReward?: number };

export function BoosterReveal({ cards, revealed, onReveal, onReturn, onNext, nextDisabled = false, nextLabel = "Prochain booster", decision, onDiscard, onAuction, onSetLocked, onComplete, onSound }: {
  cards: RevealCard[]; revealed: number; onReveal: (index: number) => void;
  onReturn: () => void; onNext?: () => void; nextDisabled?: boolean; nextLabel?: string; decision?: Decision; onDiscard?: (instanceId: string) => Promise<void>; onAuction?: (instanceId:string,startingPrice:number,durationMinutes:number)=>Promise<void>; onSetLocked?: (instanceId:string,locked:boolean)=>Promise<void>; onComplete?: () => void; onSound?: (sound: Sound) => void;
}) {
  const [faceUp, setFaceUp] = useState(false);
  const [revealLocked, setRevealLocked] = useState(false);
  const [spot, setSpot] = useState<RevealCard | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [discarded, setDiscarded] = useState(() => new Set(cards.filter(card => card.discarded).map(card => card.instanceId)));
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState(() => new Set<string>());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDiscarding, setBulkDiscarding] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [discardCandidate, setDiscardCandidate] = useState<RevealCard | null>(null);
  const [locked,setLocked]=useState(()=>new Set(cards.filter(card=>card.locked).map(card=>card.instanceId)));
  const [lockBusy,setLockBusy]=useState(false);
  const [lockError,setLockError]=useState("");
  const [auctionCandidate,setAuctionCandidate]=useState<RevealCard|null>(null);
  const [auctioned,setAuctioned]=useState(()=>new Set<string>());
  const [auctionPrice,setAuctionPrice]=useState("10");
  const [auctionDuration,setAuctionDuration]=useState("60");
  const [auctionBusy,setAuctionBusy]=useState(false);
  const [auctionDone,setAuctionDone]=useState(false);
  const [auctionError,setAuctionError]=useState("");
  const keepLock = useRef(false);
  const revealTimer = useRef<number | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const completeLink = useRef<HTMLAnchorElement>(null);
  const nextBooster = useRef<HTMLButtonElement>(null);
  const current = cards[revealed];
  const done = revealed >= cards.length;
  // Summary counts only the cards that stay in the collection (not destroyed, not lost in a Decision Pack).
  const keptCards = cards.filter(c => !discarded.has(c.instanceId) && (!decision?.keptId || decision.keptId === c.instanceId));
  const visibleCards = decision ? cards : cards.filter(card => !discarded.has(card.instanceId));
  const selectedCards = cards.filter(card => selection.has(card.instanceId) && !discarded.has(card.instanceId) && !auctioned.has(card.instanceId) && !locked.has(card.instanceId));
  const selectedValue = selectedCards.length && selectedCards.every(card=>card.destructionValue!=null) ? selectedCards.reduce((sum,card)=>sum+card.destructionValue!,0) : undefined;
  const choosing = !!decision && done && !decision.keptId;
  const chosen = cards.find(c => c.instanceId === pick && !discarded.has(c.instanceId));
  const decisionReward = (keptId:string) => {const lost=cards.filter(card=>card.instanceId!==keptId&&!discarded.has(card.instanceId));return lost.every(card=>card.destructionValue!=null)?lost.reduce((sum,card)=>sum+card.destructionValue!,0):undefined;};
  const deposit = useCallback(() => { if (revealTimer.current) window.clearTimeout(revealTimer.current); revealTimer.current = null; setRevealLocked(false); onSound?.("slide"); setFaceUp(false); onReveal(revealed); }, [onReveal, onSound, revealed]);
  useEffect(() => {
    if (!faceUp || spot || revealLocked) return;
    const timer = window.setTimeout(deposit, 1400);
    return () => clearTimeout(timer);
  }, [faceUp, spot, revealLocked, deposit]);
  useEffect(() => () => { if (revealTimer.current) window.clearTimeout(revealTimer.current); }, []);
  useEffect(() => { if (done && !choosing) (nextBooster.current && !nextBooster.current.disabled ? nextBooster.current : completeLink.current)?.focus({preventScroll:true}); else next.current?.focus({preventScroll:true}); }, [done, choosing]);
  function flip() {
    if (!current) return;
    if (faceUp) { if (!revealLocked) deposit(); return; }
    setFaceUp(true);
    onSound?.("flip");
    const isLR = current.rarity === "LR";
    const isSSR = current.rarity === "SSR";
    const shiny = current.shiny && (isSSR || isLR);
    const revealDuration = isLR ? 4400 : isSSR ? 3200 : current.rarity === "SR" ? 520 : 0;
    if (revealDuration) {
      setRevealLocked(true);
      revealTimer.current = window.setTimeout(() => {
        setRevealLocked(false);
        if (shiny || isLR) setSpot(current);
        revealTimer.current = null;
      }, revealDuration);
    }
    if (shiny || isLR) onSound?.(shiny ? "shiny" : "lr");
    else if (isSSR || current.rarity === "SR") onSound?.(isSSR ? "ssr" : "sr");
  }
  async function keep() {
    if (!chosen || !decision || keepLock.current) return;
    keepLock.current = true; setConfirming(true); setError("");
    try { await decision.onKeep(chosen.instanceId); setConfirm(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de confirmer ce choix."); }
    finally { keepLock.current = false; setConfirming(false); }
  }
  function toggleSelection(instanceId:string) {setSelection(current=>{const next=new Set(current);if(next.has(instanceId))next.delete(instanceId);else next.add(instanceId);return next;});}
  async function discard(instanceId:string) {
    if(!onDiscard||discarding||discarded.has(instanceId))return;
    setDiscarding(instanceId);setError("");
    try{await onDiscard(instanceId);setDiscarded(current=>new Set(current).add(instanceId));setDiscardCandidate(null);}
    catch(e){setError(e instanceof Error?e.message:"Impossible de détruire cette carte.");}
    finally{setDiscarding(null);}
  }
  async function discardSelection() {
    if (!onDiscard || !selectedCards.length || bulkDiscarding) return;
    const destroyingAll=selectedCards.length===visibleCards.length;
    setBulkDiscarding(true); setError("");
    try {
      for(const card of selectedCards){await onDiscard(card.instanceId);setDiscarded(current=>new Set(current).add(card.instanceId));setSelection(current=>{const next=new Set(current);next.delete(card.instanceId);return next;});}
      setBulkConfirm(false);setSelecting(false);
      if(destroyingAll)onReturn();
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de détruire la sélection."); }
    finally { setBulkDiscarding(false); }
  }
  async function toggleLock(){if(!auctionCandidate||!onSetLocked||lockBusy)return;const next=!locked.has(auctionCandidate.instanceId);setLockBusy(true);setLockError("");try{await onSetLocked(auctionCandidate.instanceId,next);setLocked(current=>{const updated=new Set(current);if(next)updated.add(auctionCandidate.instanceId);else updated.delete(auctionCandidate.instanceId);return updated;});setSelection(current=>{const updated=new Set(current);if(next)updated.delete(auctionCandidate.instanceId);return updated;});}catch(reason){setLockError(reason instanceof Error?reason.message:"Verrouillage impossible.");}finally{setLockBusy(false);}}
  function openAuction(card:RevealCard){setAuctionCandidate(card);setAuctionPrice("10");setAuctionDuration("60");setAuctionDone(false);setAuctionError("");setLockError("");}
  function closeAuction(){if(auctionBusy||lockBusy)return;setAuctionCandidate(null);setAuctionDone(false);setAuctionError("");setLockError("");}
  async function auction(){if(!auctionCandidate||!onAuction||auctionBusy||locked.has(auctionCandidate.instanceId))return;const price=Number(auctionPrice);if(!Number.isInteger(price)||price<10)return;setAuctionBusy(true);setAuctionError("");try{await onAuction(auctionCandidate.instanceId,price,Number(auctionDuration));setAuctioned(current=>new Set(current).add(auctionCandidate.instanceId));setSelection(current=>{const next=new Set(current);next.delete(auctionCandidate.instanceId);return next;});setAuctionDone(true);}catch(reason){setAuctionError(reason instanceof Error?reason.message:"Mise en vente impossible.");}finally{setAuctionBusy(false);}}
  return <section aria-label="Cartes du pack" className="yk-reveal-screen">
    <header className="yk-reveal-header"><div className="yk-reveal-copy"><p className="eyebrow">{decision ? "Booster Décisif" : "Booster Régulier"}</p><h2 className="mt-2 font-display text-2xl">{decision ? choosing ? "Fais ton choix décisif" : "Un seul choix" : "Révèle tes cartes"}</h2><p role="status" aria-atomic="true" className="mt-2 text-sm text-ink-2">{choosing ? "Toutes les cartes sont révélées · garde celle de ton choix" : done ? `${revealed} cartes révélées` : `Touche le paquet pour retourner chaque carte · ${revealed} / ${cards.length}`}</p></div>
      {done&&!decision&&visibleCards.length>0&&<SelectionModeButton active={selecting} inactiveLabel="Sélectionner" activeLabel="Annuler" className="yk-reveal-selection-mode" onClick={()=>{setSelecting(current=>!current);setSelection(new Set());}}/>}
      <ol className="yk-reveal-progress" aria-hidden="true">{cards.map((card, i) => <li key={card.instanceId} className={i < revealed ? "yk-progress-done" : i === revealed ? "yk-progress-current" : undefined} />)}</ol></header>
    {!done && <div className={`yk-reveal-stage ${faceUp && current?.rarity === "SSR" ? "yk-reveal-ssr" : ""} ${faceUp && current?.rarity === "SR" ? "yk-reveal-sr" : ""} ${faceUp && current?.rarity === "LR" ? "yk-reveal-lr" : ""} ${faceUp && current?.shiny ? "yk-reveal-shiny" : ""}`}>
      {faceUp && current?.rarity === "SSR" && <p className="yk-callout yk-ssr-callout">✦ Rareté Exceptionnelle ✦</p>}
      {faceUp && current?.rarity === "LR" && <p className="yk-callout yk-lr-callout">✦ Invocation Légendaire ✦</p>}
      {faceUp && current?.shiny && <p className="yk-shiny-callout">✨ Version Shiny !</p>}
      {faceUp && current?.rarity === "SR" && <div className="yk-sr-flash" aria-hidden="true" />}
      {faceUp && current?.rarity === "SSR" && (
        <div className="yk-ssr-cinematic-stage" aria-hidden="true">
          <div className="yk-ssr-backdrop">
            <div className="yk-ssr-nebula" />
            <div className="yk-ssr-cosmic-dust-field">
              {Array.from({ length: 20 }, (_, i) => (
                <span key={i} style={{ "--dust-i": i } as CSSProperties} className="yk-ssr-cosmic-dust" />
              ))}
            </div>
          </div>
          <div className="yk-ssr-backlight" />
          <div className="yk-ssr-ribbon-stage">
            <svg className="yk-ssr-ribbon-svg" viewBox="0 0 300 400" fill="none">
              <defs>
                <linearGradient id="ssr-ribbon-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff77bb" stopOpacity="0" />
                  <stop offset="35%" stopColor="#ff3d8b" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#ff99d6" stopOpacity="1" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="ssr-ribbon-grad2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0" />
                  <stop offset="45%" stopColor="#f43f5e" stopOpacity="0.9" />
                  <stop offset="80%" stopColor="#fbcfe8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
                </linearGradient>
              </defs>
              <path className="yk-ssr-ribbon-path yk-ssr-ribbon-1" d="M 40 370 C 15 280, 80 200, 165 180 C 255 160, 275 80, 205 30" stroke="url(#ssr-ribbon-grad1)" strokeWidth="6" strokeLinecap="round" />
              <path className="yk-ssr-ribbon-path yk-ssr-ribbon-2" d="M 260 360 C 285 270, 220 210, 135 190 C 45 170, 25 90, 95 35" stroke="url(#ssr-ribbon-grad2)" strokeWidth="5.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="yk-ssr-godrays">
            {Array.from({ length: 20 }, (_, i) => (
              <span key={i} style={{ "--ray-i": i } as CSSProperties} className="yk-ssr-godray" />
            ))}
          </div>
          <div className="yk-ssr-supernova">
            <div className="yk-ssr-flare-core" />
            <div className="yk-ssr-flare-beam" />
            <div className="yk-ssr-shockwave" />
          </div>
          <div className="yk-ssr-petals-explosion">
            {Array.from({ length: 36 }, (_, i) => (
              <span
                key={i}
                style={{
                  "--p-idx": i,
                  "--p-angle": `${(i * 360) / 36}deg`,
                  "--p-dist": `${130 + (i % 5) * 35}px`,
                  "--p-size": `${3 + (i % 3) * 1.5}px`,
                  "--p-delay": `${(i % 4) * 30}ms`
                } as CSSProperties}
                className="yk-ssr-petal"
              />
            ))}
          </div>
          <div className="yk-ssr-ambient-petals">
            {Array.from({ length: 22 }, (_, i) => (
              <span
                key={i}
                style={{
                  "--petal-i": i,
                  "--petal-angle": `${(i * 360) / 22}deg`,
                  "--petal-dist": `${135 + (i % 4) * 30}px`,
                  "--petal-delay": `${i * 90}ms`
                } as CSSProperties}
                className="yk-ssr-ambient-petal"
              />
            ))}
          </div>
        </div>
      )}
      {faceUp && current?.rarity === "LR" && (
        <div className="yk-lr-cinematic-stage" aria-hidden="true">
          <div className="yk-lr-backdrop">
            <div className="yk-lr-nebula" />
            <div className="yk-lr-cosmic-dust-field">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} style={{ "--dust-i": i } as CSSProperties} className="yk-lr-cosmic-dust" />
              ))}
            </div>
          </div>
          <div className="yk-lr-backlight" />
          <div className="yk-lr-lightning-stage">
            <svg className="yk-lr-lightning-svg" viewBox="0 0 240 340" fill="none">
              <path className="yk-lr-bolt yk-lr-bolt-1" d="M20 50 L10 90 L25 100 L5 160 L20 180 L8 240 L25 250 L15 300" stroke="#ffd700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path className="yk-lr-bolt yk-lr-bolt-2" d="M220 40 L230 85 L215 110 L235 170 L218 200 L232 260 L215 285 L225 310" stroke="#ffe57f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path className="yk-lr-bolt yk-lr-bolt-3" d="M40 15 L90 8 L105 20 L150 5 L175 18 L210 10" stroke="#fff176" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path className="yk-lr-bolt yk-lr-bolt-4" d="M35 325 L85 332 L110 320 L160 335 L190 322 L215 330" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path className="yk-lr-bolt yk-lr-bolt-5" d="M15 70 L30 110 L12 150 L28 190" stroke="#d8b4fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path className="yk-lr-bolt yk-lr-bolt-6" d="M225 60 L210 120 L228 160 L212 210" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="yk-lr-godrays">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} style={{ "--ray-i": i } as CSSProperties} className="yk-lr-godray" />
            ))}
          </div>
          <div className="yk-lr-supernova">
            <div className="yk-lr-flare-core" />
            <div className="yk-lr-flare-beam" />
            <div className="yk-lr-shockwave" />
          </div>
          <div className="yk-lr-spark-explosion">
            {Array.from({ length: 48 }, (_, i) => (
              <span
                key={i}
                style={{
                  "--p-idx": i,
                  "--p-angle": `${(i * 360) / 48}deg`,
                  "--p-dist": `${140 + (i % 6) * 45}px`,
                  "--p-size": `${2.5 + (i % 3) * 1.5}px`,
                  "--p-delay": `${(i % 5) * 35}ms`
                } as CSSProperties}
                className="yk-lr-spark"
              />
            ))}
          </div>
          <div className="yk-lr-stardust-ring">
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                style={{
                  "--star-i": i,
                  "--star-angle": `${(i * 360) / 28}deg`,
                  "--star-dist": `${145 + (i % 4) * 35}px`,
                  "--star-delay": `${i * 80}ms`
                } as CSSProperties}
                className="yk-lr-stardust"
              />
            ))}
          </div>
        </div>
      )}
      <div className="yk-deck">{cards.slice(revealed + 1).map((card, i, remaining) => <div className="yk-stacked-back" key={card.instanceId} style={{ transform: `translate(${(remaining.length-i)*3}px,${-(remaining.length-i)*4}px) rotate(${(remaining.length-i)*1.3}deg)`, filter: `brightness(${1-(remaining.length-i)*.045})` }}><CardBack /></div>)}
        <button type="button" ref={next} onClick={flip} aria-disabled={revealLocked} aria-label={revealLocked ? `Révélation de ${current.name} en cours` : faceUp ? `Ranger ${current.name}` : `Révéler la carte ${revealed + 1} sur ${cards.length}`} className={`yk-deck-button ${faceUp ? "yk-face-up" : ""}`}><span className="yk-flip"><span className="yk-flip-back" aria-hidden="true"><CardBack /></span><span className="yk-flip-front" aria-hidden="true">{faceUp && <YokaiCard {...current} />}</span></span></button>
      </div>
      <p className="mt-8 text-center text-xs text-ink-3">{revealLocked ? "L’énergie s’accumule…" : faceUp ? "Touchez pour ranger la carte" : "Touchez le paquet pour révéler une carte"}</p>
    </div>}
    {choosing && <div className="yk-decision-banner"><p className="font-display text-lg text-karas">Choisis ta carte décisive</p><p className="mt-1 text-sm text-ink-2">Une seule rejoindra ta collection — les {cards.length - 1} autres seront perdues.</p></div>}
    <ol className={`yk-reveal-grid ${choosing ? "yk-reveal-grid-choosing" : ""}`}>{visibleCards.map((card,i) => {
      const isDiscarded = discarded.has(card.instanceId);
      const lost = isDiscarded || (!!decision?.keptId && decision.keptId !== card.instanceId);
      const kept = decision?.keptId === card.instanceId;
      return <li key={card.instanceId} style={{ "--slot-i": i } as CSSProperties} className={`yk-reveal-slot ${i < revealed ? "yk-filled" : ""} ${i === revealed && !done ? "yk-slot-next" : ""} ${pick === card.instanceId && choosing ? "yk-picked" : ""} ${lost ? "yk-lost" : ""} ${kept ? "yk-kept" : ""}`}>
        {i < revealed ? <><button type="button" disabled={confirming||isDiscarded||auctioned.has(card.instanceId)||(!choosing&&!selecting&&!onAuction&&!onSetLocked)} aria-pressed={choosing?pick===card.instanceId:selecting?selection.has(card.instanceId):undefined} aria-label={choosing?`Choisir ${card.name}`:selecting?`Sélectionner ${card.name}, ${card.rarity}`:(onAuction||onSetLocked)?`Gérer ${card.name}`:`${card.name}, ${card.rarity}`} onClick={()=>choosing?setPick(card.instanceId):selecting?toggleSelection(card.instanceId):openAuction(card)} className={`yk-reveal-card block w-full rounded-card text-left disabled:cursor-default ${selecting&&selection.has(card.instanceId)?"yk-selected-card":""}`} style={choosing&&pick&&pick!==card.instanceId?{opacity:.55}:undefined}><YokaiCard {...card}/>{selecting&&<span className={`yk-selection-check ${selection.has(card.instanceId)?"yk-checked":""}`}>{selection.has(card.instanceId)?"✓":""}</span>}{lost&&<span className="yk-lost-stamp">{isDiscarded?"DÉTRUITE":"PERDUE"}</span>}</button>
          <div className="yk-reveal-actions">{auctioned.has(card.instanceId)?<StatusPill tone="info">EN VENTE</StatusPill>:kept?<StatusPill>GARDÉE</StatusPill>:choosing?<Button variant={pick===card.instanceId?"primary":"secondary"} disabled={decision.busy||confirming} onClick={()=>{setPick(card.instanceId);setConfirm(true);}} className="yk-slot-button">Garder celle-ci</Button>:!selecting&&onDiscard?<><Button variant="secondary" disabled={!!discarding} onClick={()=>openAuction(card)} className="yk-slot-button">Mettre en vente</Button><Button variant="danger" disabled={!!discarding} onClick={()=>setDiscardCandidate(card)} className="yk-slot-button">{discarding===card.instanceId?"Défausse…":"Défausser"}</Button></>:!selecting&&(card.isNew?<StatusPill>NEW</StatusPill>:card.copies&&card.copies>1?<span className="text-[10px] text-ink-3">Doublon ×{card.copies}</span>:null)}</div></> : <span className="yk-slot-placeholder"><span className="yk-slot-number">{String(i + 1).padStart(2,"0")}</span><span className="yk-slot-hint">{i === revealed ? "Suivante" : "En attente"}</span></span>}
      </li>;
    })}</ol>
    {selecting&&<SelectionBar count={selectedCards.length} value={selectedValue} busy={bulkDiscarding} error={error} onAll={()=>setSelection(new Set(visibleCards.filter(card=>!auctioned.has(card.instanceId)&&!locked.has(card.instanceId)).map(card=>card.instanceId)))} onNone={()=>setSelection(new Set())} onDestroy={()=>setBulkConfirm(true)} onClose={()=>{setSelecting(false);setSelection(new Set());setError("");}}/>}
    {error && <p role="alert" className="mt-5 text-center text-sm text-danger">{error}</p>}
    {done && !choosing && <div className={`yk-reveal-summary ${decision ? "yk-reveal-summary-decision" : ""}`}><h2 className="font-display text-2xl">{decision ? `Carte ajoutée à ta collection · +${decision.karasReward ?? 0} Karas depuis les cartes non conservées` : "L’invocation est complète"}</h2><div className="my-5 flex flex-wrap justify-center gap-2">{[...new Set(keptCards.map(c => c.rarity))].map(r => <StatusPill key={r}>{r} ×{keptCards.filter(c=>c.rarity===r).length}</StatusPill>)}</div>{cards.every(c => c.isNew !== undefined) && <p className="mb-5 text-sm text-ink-2">{keptCards.filter(c => c.isNew).length} nouvelle(s) carte(s)</p>}<div className="flex flex-wrap justify-center gap-3">{onNext&&<button type="button" ref={nextBooster} disabled={nextDisabled} onClick={onNext} className="yk-button yk-button-primary">{nextLabel}</button>}{onComplete?<Button variant={onNext?"secondary":"primary"} onClick={onComplete}>{decision?"Voir ma collection":"Continuer"}</Button>:<Link ref={completeLink} href="/collection" className={`yk-button ${onNext ? "yk-button-secondary" : "yk-button-primary"}`}>Voir ma collection</Link>}<Button variant="secondary" onClick={onReturn}>Retour aux boosters</Button></div></div>}
    <Modal open={!!spot} onClose={() => setSpot(null)} title={spot?.shiny ? "✦ Invocation Shiny ✦" : "Invocation légendaire"} className={`yk-invocation ${spot?.shiny ? "yk-invocation-shiny" : ""}`}>
      {spot && <div className="relative z-10 flex flex-col items-center gap-6"><div className="yk-invoked-card"><YokaiCard {...spot} /></div><h3 className="font-display text-[clamp(28px,4vw,44px)]">{spot.name}</h3>{spot.isNew && <StatusPill>NEW</StatusPill>}<Button variant="secondary" onClick={() => setSpot(null)}>Toucher pour continuer</Button></div>}
    </Modal>
    <Modal open={confirm} onClose={() => { if (!confirming) setConfirm(false); }} title={`Garder ${chosen?.name || "cette carte"} ?`}>{chosen && <><div className="mx-auto w-40"><YokaiCard {...chosen} /></div><p className="mt-6 text-center font-semibold text-ink">Garder cette carte et perdre les {cards.length - 1} autres ?</p>{decisionReward(chosen.instanceId)!=null&&<p className="mt-2 text-center text-sm text-karas">+{decisionReward(chosen.instanceId)} Karas depuis les cartes non conservées</p>}<p className="mb-6 mt-2 text-center text-xs text-ink-3">Ce choix est définitif.</p>{error && <p role="alert" className="mb-4 text-center text-danger">{error}</p>}<div className="flex flex-wrap justify-center gap-3"><Button variant="secondary" disabled={confirming} onClick={() => setConfirm(false)}>Revenir au choix</Button><Button disabled={decision?.busy || confirming} aria-busy={confirming || undefined} onClick={keep}>{confirming ? "Confirmation…" : "Garder cette carte"}</Button></div></>}</Modal>
    <Modal open={!!discardCandidate} onClose={()=>{if(!discarding)setDiscardCandidate(null);}} title="Défausser cette carte ?">{discardCandidate&&<><div className="mx-auto w-32"><YokaiCard {...discardCandidate}/></div><p className="mb-6 mt-5 text-center text-sm text-ink-2">{discardCandidate.name} sera retirée de ta collection.{discardCandidate.destructionValue!=null&&<> Tu recevras <strong className="text-karas">{discardCandidate.destructionValue} Kara{discardCandidate.destructionValue===1?"":"s"}</strong>.</>}</p><div className="flex flex-wrap justify-center gap-3"><Button variant="secondary" disabled={!!discarding} onClick={()=>setDiscardCandidate(null)}>Annuler</Button><Button variant="danger" disabled={!!discarding} onClick={()=>void discard(discardCandidate.instanceId)}>{discarding?"Défausse…":"Défausser"}</Button></div></>}</Modal>
    <Modal open={!!auctionCandidate} onClose={closeAuction} title={auctionDone?"Carte mise aux enchères":"Actions sur cette carte"} className="yk-auction-modal yk-booster-action-modal">{auctionCandidate&&(auctionDone?<><p role="status" className="text-center text-sm text-success">{auctionCandidate.name} est maintenant en vente.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button variant="secondary" onClick={closeAuction}>Continuer</Button><Link href="/marche" className="yk-button yk-button-primary">Voir le marché</Link></div></>:<div className="yk-booster-action-grid"><div className="yk-booster-action-art"><YokaiCard {...auctionCandidate}/></div><div className="yk-booster-action-controls"><div className="yk-booster-card-actions"><Button variant="secondary" disabled={lockBusy||auctionBusy} onClick={()=>void toggleLock()}>{lockBusy?"Enregistrement…":locked.has(auctionCandidate.instanceId)?"Déverrouiller la carte":"Verrouiller la carte"}</Button><p>Une carte verrouillée ne peut pas être vendue, échangée ou détruite.</p>{lockError&&<p role="alert" className="text-danger">{lockError}</p>}</div><h3 className="yk-booster-auction-title">Mettre aux enchères</h3>{locked.has(auctionCandidate.instanceId)&&<p role="status" className="mt-3 text-sm text-warning">Déverrouille cette carte avant de la mettre en vente.</p>}<label className="mt-5 block text-xs font-semibold tracking-wider text-ink-3 uppercase" htmlFor="booster-auction-price">Prix de départ</label><input id="booster-auction-price" type="number" inputMode="numeric" min="10" value={auctionPrice} onChange={event=>setAuctionPrice(event.target.value)} className="auth-input mt-2"/><p className="mt-2 text-xs text-ink-3">Minimum 10 Karas.</p><label className="mt-5 block text-xs font-semibold tracking-wider text-ink-3 uppercase" htmlFor="booster-auction-duration">Durée</label><select id="booster-auction-duration" value={auctionDuration} onChange={event=>setAuctionDuration(event.target.value)} className="auth-input mt-2"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 heure</option><option value="240">4 heures</option><option value="720">12 heures</option><option value="1440">24 heures</option></select>{auctionError&&<p role="alert" className="mt-4 text-sm text-danger">{auctionError}</p>}<div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={auctionBusy||lockBusy} onClick={closeAuction}>Fermer</Button><Button variant="danger" disabled={auctionBusy||lockBusy||locked.has(auctionCandidate.instanceId)||!Number.isInteger(Number(auctionPrice))||Number(auctionPrice)<10} onClick={()=>void auction()}>{auctionBusy?"Publication…":"Mettre en vente"}</Button></div></div></div>)}</Modal>
    <Modal open={bulkConfirm} onClose={()=>{if(!bulkDiscarding)setBulkConfirm(false);}} title="Détruire la sélection ?"><p className="text-sm leading-6 text-ink-2">La destruction de <strong className="text-ink">{selectedCards.length} carte{selectedCards.length===1?"":"s"}</strong> est définitive.{selectedValue!=null&&<> Tu recevras <strong className="text-karas">{selectedValue} Kara{selectedValue===1?"":"s"}</strong>.</>}</p>{error&&<p role="alert" className="mt-4 text-sm text-danger">{error}</p>}<div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={bulkDiscarding} onClick={()=>setBulkConfirm(false)}>Annuler</Button><Button variant="danger" disabled={bulkDiscarding||selectedValue==null} onClick={()=>void discardSelection()}>{bulkDiscarding?"Destruction…":"Détruire la sélection"}</Button></div></Modal>
  </section>;
}

export function Boosters({ status, countdown, decisionStatus, decisionCountdown, busy, draw, drawKind, collection, revealed, onOpen, onKeepDecision, onDiscard, onAuction, onSetLocked, onReveal, onSound }: {
  status: PackStatus | null; countdown: string;
  decisionStatus: DecisionPackStatus | null; decisionCountdown: string; busy: boolean;
  draw: RevealCard[]; drawKind: "regular" | "decision"; collection: CollectedCard[]; revealed: number;
  onOpen: (kind: "regular" | "decision") => Promise<RevealCard[] | undefined>; onKeepDecision: (instanceId: string) => Promise<number>;
  onDiscard: (instanceId: string) => Promise<void>;
  onAuction?: (instanceId:string,startingPrice:number,durationMinutes:number)=>Promise<void>;
  onSetLocked?: (instanceId:string,locked:boolean)=>Promise<void>;
  onReveal: (index: number) => void; onSound?: (sound: Sound) => void;
}) {
  const [openingPhase, setOpeningPhase] = useState<"idle" | "tension" | "seal">("idle");
  const [waiting, setWaiting] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const [priorCopies, setPriorCopies] = useState<Record<string,number>>({});
  const [keptId, setKeptId] = useState<string>();
  const [decisionKaras, setDecisionKaras] = useState<number>();
  const openingLock = useRef(false);
  const skipSeal = useRef<(() => void) | null>(null);
  const playSound = onSound ?? noopSound;
  const finishSeal = () => skipSeal.current?.();
  function preload(cards: RevealCard[]) {
    const decoding = Promise.allSettled(cards.map(card => {
      const image = new Image();
      image.src = card.image;
      return image.decode();
    }));
    void Promise.race([decoding, new Promise(resolve => window.setTimeout(resolve, animation.packOpening.preload))]);
  }
  function start(kind: "regular" | "decision") {
    if (openingLock.current) return;
    openingLock.current = true;
    setPriorCopies(collection.reduce<Record<string,number>>((counts,card) => { counts[card.id] = (counts[card.id] || 0) + 1; return counts; }, {}));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setKeptId(undefined); setDecisionKaras(undefined); setShowDraw(true); setWaiting(false); setOpeningPhase("tension"); playSound("rumble");
    const waitingTimer = window.setTimeout(() => setWaiting(true), animation.packOpening.slowResponse);
    void runPackOpeningSequence({
      open: () => onOpen(kind),
      onResponse: cards => { clearTimeout(waitingTimer); setWaiting(false); if (cards) preload(cards); },
      onSeal: () => { setOpeningPhase("seal"); playSound("tear"); },
      wait: duration => duration !== animation.packOpening.seal ? new Promise(resolve => window.setTimeout(resolve, duration)) : new Promise(resolve => {
        const timer = window.setTimeout(resolve, reducedMotion ? animation.packOpening.fade : duration);
        skipSeal.current = () => { window.clearTimeout(timer); resolve(); };
      }),
    }).then(() => setOpeningPhase("idle"), () => { setShowDraw(false); setOpeningPhase("idle"); }).finally(() => { clearTimeout(waitingTimer); setWaiting(false); skipSeal.current = null; openingLock.current = false; });
  }
  const counts = { ...priorCopies };
  const revealCards = draw.map(card => {
    const previous = counts[card.id] || 0;
    counts[card.id] = previous + 1;
    return { ...card, isNew: previous === 0, copies: previous + 1 };
  });
  const revealing = showDraw && draw.length > 0 && openingPhase === "idle" && !busy;
  const opening = openingPhase !== "idle";
  return <>
    {opening ? <div className={`yk-opening-stage yk-opening-${openingPhase}`} role={openingPhase === "seal" ? "button" : "status"} tabIndex={openingPhase === "seal" ? 0 : -1} aria-label={openingPhase === "seal" ? "Passer l’animation d’ouverture" : undefined} onClick={finishSeal} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();finishSeal();}}}><div className="yk-opening-pack">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/booster-pack.png" alt="" width={240} height={360} /></div><p className="mt-8 text-sm text-ink-2">{openingPhase === "seal" ? "Le sceau se brise…" : waiting ? "L’ouverture prend un peu plus de temps…" : "Ouverture du pack…"}</p></div> : revealing ? <BoosterReveal key={draw[0].instanceId} cards={revealCards} revealed={revealed} onReveal={onReveal} onReturn={() => setShowDraw(false)} onNext={drawKind === "regular" ? () => start("regular") : undefined} nextDisabled={!status || status.available === 0 || busy} nextLabel={status?.available === 0 ? `Prochain dans ${countdown}` : "Prochain booster"} onDiscard={drawKind === "regular" ? onDiscard : undefined} onAuction={drawKind === "regular" ? onAuction : undefined} onSetLocked={drawKind === "regular" ? onSetLocked : undefined} decision={drawKind === "decision" ? { keptId, busy, karasReward: decisionKaras, onKeep: async id => { const reward = await onKeepDecision(id); setDecisionKaras(reward); setKeptId(id); return reward; } } : undefined} onSound={playSound} /> : <div className="yk-pack-grid">
      <article className="yk-pack-panel"><div className="yk-pack-art-stage"><span className="yk-pack-badge"><StatusPill>{status ? `${status.available}/${status.maximum} en réserve` : "Réserve…"}</StatusPill></span><span className="yk-pack-orbit" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/booster-pack.png" alt="Booster Régulier Yokkai Collec’" width={220} height={330} className="yk-pack-image" /></div><div className="yk-pack-body"><div className="yk-pack-title"><h2 className="font-display text-[26px] font-semibold">Booster Régulier</h2><StatusPill tone="info">5 cartes</StatusPill></div><p className="mt-3 text-sm leading-6 text-ink-2">Cinq cartes, cinq rencontres. Découvre ce que le destin te réserve.</p>
        <dl className="yk-pack-status"><div><dt>Réserve</dt><dd className="text-karas">{status ? `${status.available} / ${status.maximum}` : "—"}</dd></div><div className="yk-pack-gauge" aria-hidden="true"><span style={{width:status && status.maximum ? `${status.available/status.maximum*100}%` : "0%"}} /></div><div><dt>Statut</dt><dd className={!status ? "text-ink-3" : status.available > 0 ? "text-success" : "text-warning"}>{!status ? "Chargement des boosters…" : status.available > 0 ? "Disponible maintenant" : `Prochain dans ${countdown}`}</dd></div>{status && status.available > 0 && <div><dt>Recharge</dt><dd className="text-ink-2">{status.nextPackAt === null ? "Réserve pleine" : `Prochain dans ${countdown}`}</dd></div>}</dl>
        <Button className="w-full" disabled={!status || status.available === 0 || busy} onClick={() => start("regular")}>{status?.available === 0 ? `Prochain dans ${countdown}` : "Ouvrir"}</Button></div></article>
      <article className="yk-pack-panel yk-decision-panel"><div className="yk-pack-art-stage"><span className="yk-pack-badge"><StatusPill>Événement quotidien</StatusPill></span><span className="yk-pack-orbit" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/booster-pack.png" alt="Booster Décisif" width={220} height={330} className="yk-pack-image yk-decision-image" /></div><div className="yk-pack-body"><div className="yk-pack-title"><h2 className="font-display text-[26px] font-semibold">Booster Décisif</h2><StatusPill tone="info">Choix unique</StatusPill></div><p className="mt-3 text-sm leading-6 text-ink-2">Révèle 5 cartes, puis garde celle de ton choix — taux augmentés.</p>
        <dl className="yk-pack-status"><div><dt>Tirage</dt><dd className="text-karas">1 carte à garder parmi 5</dd></div><div><dt>Statut</dt><dd className={!decisionStatus ? "text-ink-3" : decisionStatus.pending.length ? "text-karas" : decisionStatus.available ? "text-success" : "text-warning"} suppressHydrationWarning>{!decisionStatus ? "Chargement…" : decisionStatus.pending.length ? "Choix en attente" : decisionStatus.available ? "Disponible maintenant" : decisionReturnLabel(decisionStatus.nextPackAt)}</dd></div></dl>
        <Button disabled={!decisionStatus || (!decisionStatus.available && decisionStatus.pending.length === 0) || busy} onClick={() => start("decision")} className="w-full">{decisionStatus?.pending.length ? "Reprendre mon choix" : decisionStatus?.available ? "Ouvrir" : `Revient dans ${decisionCountdown}`}</Button></div></article>
    </div>}
  </>;
}
