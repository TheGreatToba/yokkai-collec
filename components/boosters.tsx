"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Card, CollectedCard, DecisionPackStatus, PackStatus } from "@/lib/data/cards";
import { Button, Modal, StatusPill } from "@/components/ui";
import { CardBack, YokaiCard } from "@/components/yokai-card";
import { CardFranchise } from "@/components/card-franchise";
import type { SfxName } from "@/hooks/use-sfx";
import "@/styles/boosters.css";

export type RevealCard = Card & { instanceId: string; shiny?: boolean; isEvolved?: boolean; isNew?: boolean; copies?: number; discarded?: boolean };
type Sound = SfxName;
const noopSound = () => {};
type Decision = { onKeep: (instanceId: string) => Promise<number>; keptId?: string; busy?: boolean; karasReward?: number };

export function BoosterReveal({ cards, revealed, onReveal, onReturn, onNext, nextDisabled = false, nextLabel = "Prochain booster", decision, onDiscard, onSound }: {
  cards: RevealCard[]; revealed: number; onReveal: (index: number) => void;
  onReturn: () => void; onNext?: () => void; nextDisabled?: boolean; nextLabel?: string; decision?: Decision; onDiscard?: (instanceId: string) => Promise<void>; onSound?: (sound: Sound) => void;
}) {
  const [faceUp, setFaceUp] = useState(false);
  const [revealLocked, setRevealLocked] = useState(false);
  const [spot, setSpot] = useState<RevealCard | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [discardCandidate, setDiscardCandidate] = useState<RevealCard | null>(null);
  const [discarded, setDiscarded] = useState(() => new Set(cards.filter(card => card.discarded).map(card => card.instanceId)));
  const keepLock = useRef(false);
  const revealTimer = useRef<number | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const completeLink = useRef<HTMLAnchorElement>(null);
  const current = cards[revealed];
  const done = revealed >= cards.length;
  const choosing = !!decision && done && !decision.keptId;
  const chosen = cards.find(c => c.instanceId === pick && !discarded.has(c.instanceId));
  const deposit = useCallback(() => { if (revealTimer.current) window.clearTimeout(revealTimer.current); revealTimer.current = null; setRevealLocked(false); onSound?.("slide"); setFaceUp(false); onReveal(revealed); }, [onReveal, onSound, revealed]);
  useEffect(() => {
    if (!faceUp || spot || revealLocked) return;
    const timer = window.setTimeout(deposit, 1400);
    return () => clearTimeout(timer);
  }, [faceUp, spot, revealLocked, deposit]);
  useEffect(() => () => { if (revealTimer.current) window.clearTimeout(revealTimer.current); }, []);
  useEffect(() => { if (done && !choosing) completeLink.current?.focus({preventScroll:true}); else next.current?.focus({preventScroll:true}); }, [done, choosing]);
  function flip() {
    if (!current) return;
    if (faceUp) { if (!revealLocked) deposit(); return; }
    setFaceUp(true);
    onSound?.("flip");
    const shiny = current.shiny && (current.rarity === "SSR" || current.rarity === "LR");
    const revealDuration = current.rarity === "LR" ? 1900 : current.rarity === "SSR" ? 1100 : current.rarity === "SR" ? 520 : 0;
    if (revealDuration) {
      setRevealLocked(true);
      revealTimer.current = window.setTimeout(() => {
        setRevealLocked(false);
        if (shiny || current.rarity === "LR") setSpot(current);
        revealTimer.current = null;
      }, revealDuration);
    }
    if (shiny || current.rarity === "LR") onSound?.(shiny ? "shiny" : "lr");
    else if (current.rarity === "SSR" || current.rarity === "SR") onSound?.(current.rarity === "SSR" ? "ssr" : "sr");
  }
  async function keep() {
    if (!chosen || !decision || keepLock.current) return;
    keepLock.current = true; setConfirming(true); setError("");
    try { await decision.onKeep(chosen.instanceId); setConfirm(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de confirmer ce choix."); }
    finally { keepLock.current = false; setConfirming(false); }
  }
  async function discard(instanceId: string) {
    if (!onDiscard || discarding || discarded.has(instanceId)) return;
    setDiscarding(instanceId); setError("");
    try { await onDiscard(instanceId); setDiscarded(current => new Set(current).add(instanceId)); if (pick === instanceId) setPick(null); setDiscardCandidate(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de détruire cette carte."); }
    finally { setDiscarding(null); }
  }
  return <section aria-label="Cartes du pack" className="mt-8">
    <div><h2 className="font-display text-2xl">{decision ? "Un seul choix" : "Révèle tes cartes"}</h2><p role="status" aria-atomic="true" className="mt-2 text-sm text-ink-2">{done ? `${revealed} cartes révélées` : `Touche chaque carte pour la retourner · ${revealed} / ${cards.length}`}</p></div>
    {!done && <div className={`yk-reveal-stage ${faceUp && current?.rarity === "SSR" ? "yk-reveal-ssr" : ""} ${faceUp && current?.rarity === "SR" ? "yk-reveal-sr" : ""} ${faceUp && current?.rarity === "LR" ? "yk-reveal-lr" : ""} ${faceUp && current?.shiny ? "yk-reveal-shiny" : ""}`}>
      {faceUp && (current?.rarity === "SSR" || current?.rarity === "LR") && <p className="yk-callout">Rareté exceptionnelle !</p>}
      {faceUp && current?.shiny && <p className="yk-shiny-callout">✨ Version Shiny !</p>}
      {faceUp && current?.rarity === "SR" && <div className="yk-sr-flash" aria-hidden="true" />}
      {faceUp && (current?.rarity === "SSR" || current?.rarity === "LR") && <div className="yk-burst" aria-hidden="true" />}
      {faceUp && (current?.rarity === "SSR" || current?.rarity === "LR") && <div className="yk-reveal-rays" aria-hidden="true" />}
      {faceUp && (current?.rarity === "SSR" || current?.rarity === "LR") && <div className="yk-reveal-particles" aria-hidden="true">{Array.from({length: current.rarity === "LR" ? 22 : 12},(_,i)=><span key={i} style={{"--particle":i} as CSSProperties}/>)}</div>}
      <div className="yk-deck">{cards.slice(revealed + 1).map((card, i, remaining) => <div className="yk-stacked-back" key={card.instanceId} style={{ transform: `translate(${(remaining.length-i)*3}px,${-(remaining.length-i)*4}px) rotate(${(remaining.length-i)*1.3}deg)`, filter: `brightness(${1-(remaining.length-i)*.045})` }}><CardBack /></div>)}
        <button type="button" ref={next} onClick={flip} aria-disabled={revealLocked} aria-label={revealLocked ? `Révélation de ${current.name} en cours` : faceUp ? `Ranger ${current.name}` : `Révéler la carte ${revealed + 1} sur ${cards.length}`} className={`yk-deck-button ${faceUp ? "yk-face-up" : ""}`}><span className="yk-flip"><span className="yk-flip-back" aria-hidden="true"><CardBack /></span><span className="yk-flip-front" aria-hidden="true">{faceUp && <YokaiCard {...current} />}</span></span></button>
      </div>
      <p className="mt-8 text-center text-xs text-ink-3">{revealLocked ? "L’énergie s’accumule…" : faceUp ? "Touchez pour ranger la carte" : "Touchez le paquet pour révéler une carte"}</p>
    </div>}
    {choosing && <div className="my-8 rounded-panel border border-rarity-ssr/40 bg-rarity-ssr/10 p-5 text-center"><p className="font-semibold text-rarity-ssr">Un seul choix</p><p className="mt-2 text-sm text-ink-2">Choisis la carte qui rejoindra ta collection — les {cards.length - 1} autres seront perdues.</p></div>}
    <ol className="yk-reveal-grid">{cards.map((card,i) => {
      const isDiscarded = discarded.has(card.instanceId);
      const lost = isDiscarded || (!!decision?.keptId && decision.keptId !== card.instanceId);
      const kept = decision?.keptId === card.instanceId;
      return <li key={card.instanceId} className={`yk-reveal-slot ${i < revealed ? "yk-filled" : ""} ${pick === card.instanceId && choosing ? "yk-picked" : ""} ${lost ? "yk-lost" : ""}`}>
        {i < revealed ? <><button type="button" disabled={!choosing || confirming || isDiscarded} aria-pressed={choosing ? pick === card.instanceId : undefined} aria-label={choosing ? `Choisir ${card.name}` : `${card.name}, ${card.rarity}`} onClick={() => setPick(card.instanceId)} className="block w-full rounded-card text-left disabled:cursor-default" style={choosing && pick && pick !== card.instanceId ? {opacity:.55} : undefined}><YokaiCard {...card} />{lost && <span className="yk-lost-stamp">{isDiscarded ? "DÉTRUITE" : "PERDUE"}</span>}</button><CardFranchise card={card}/><div className="mt-3 flex min-h-10 flex-wrap justify-center gap-1">{kept ? <StatusPill>GARDÉE</StatusPill> : choosing && pick === card.instanceId ? <StatusPill>À GARDER</StatusPill> : !isDiscarded && onDiscard ? <Button variant="danger" disabled={!!discarding} onClick={() => setDiscardCandidate(card)} className="px-4 py-2 text-xs">{discarding === card.instanceId ? "Destruction…" : "Détruire"}</Button> : card.isNew ? <StatusPill>NEW</StatusPill> : card.copies && card.copies > 1 ? <span className="text-[10px] text-ink-3">Doublon ×{card.copies}</span> : null}</div></> : <span className="yk-slot-number">{String(i + 1).padStart(2,"0")}</span>}
      </li>;
    })}</ol>
    {error && <p role="alert" className="mt-5 text-center text-sm text-danger">{error}</p>}
    {choosing && <div className="mt-8 text-center"><Button disabled={!chosen || decision.busy || confirming} onClick={() => setConfirm(true)}>Garder cette carte</Button></div>}
    {done && !choosing && <div className="mt-8 rounded-panel border border-veil bg-surface p-6 text-center"><h2 className="font-display text-2xl">{decision ? `Carte ajoutée à ta collection · +${decision.karasReward ?? 0} Karas depuis les cartes non conservées` : "L’invocation est complète"}</h2><div className="my-5 flex flex-wrap justify-center gap-2">{[...new Set(cards.map(c => c.rarity))].map(r => <StatusPill key={r}>{r} ×{cards.filter(c=>c.rarity===r).length}</StatusPill>)}</div>{cards.every(c => c.isNew !== undefined) && <p className="mb-5 text-sm text-ink-2">{cards.filter(c => c.isNew && (!decision || c.instanceId === decision.keptId)).length} nouvelle(s) carte(s)</p>}<div className="flex flex-wrap justify-center gap-3">{onNext&&<Button disabled={nextDisabled} onClick={onNext}>{nextLabel}</Button>}<Link ref={completeLink} href="/collection" className="yk-button yk-button-secondary">Voir ma collection</Link><Button variant="secondary" onClick={onReturn}>Retour aux boosters</Button></div></div>}
    <Modal open={!!spot} onClose={() => setSpot(null)} title={spot?.shiny ? "✦ Invocation Shiny ✦" : "Invocation légendaire"} className={`yk-invocation ${spot?.shiny ? "yk-invocation-shiny" : ""}`}>
      {spot && <div className="relative z-10 flex flex-col items-center gap-6"><div className="yk-invoked-card"><YokaiCard {...spot} /></div><h3 className="font-display text-[clamp(28px,4vw,44px)]">{spot.name}</h3>{spot.isNew && <StatusPill>NEW</StatusPill>}<Button variant="secondary" onClick={() => setSpot(null)}>Toucher pour continuer</Button></div>}
    </Modal>
    <Modal open={confirm} onClose={() => { if (!confirming) setConfirm(false); }} title={`Garder ${chosen?.name || "cette carte"} ?`}>{chosen && <><div className="mx-auto w-40"><YokaiCard {...chosen} /></div><p className="my-6 text-center text-sm text-ink-2">Garder définitivement cette carte et perdre les {cards.length - 1} autres ?</p>{error && <p role="alert" className="mb-4 text-danger">{error}</p>}<div className="flex flex-wrap justify-center gap-3"><Button variant="secondary" disabled={confirming} onClick={() => setConfirm(false)}>Retour</Button><Button disabled={decision?.busy || confirming} onClick={keep}>{confirming ? "Confirmation…" : "Confirmer mon choix"}</Button></div></>}</Modal>
    <Modal open={!!discardCandidate} onClose={() => { if (!discarding) setDiscardCandidate(null); }} title="Détruire cette carte ?">{discardCandidate && <><p className="mb-6 text-sm text-ink-2">Cette action est définitive.</p><div className="flex justify-end gap-3"><Button variant="secondary" disabled={!!discarding} onClick={() => setDiscardCandidate(null)}>Annuler</Button><Button variant="danger" disabled={!!discarding} onClick={() => void discard(discardCandidate.instanceId)}>{discarding ? "Destruction…" : "Détruire"}</Button></div></>}</Modal>
  </section>;
}

export function Boosters({ status, countdown, decisionStatus, decisionCountdown, busy, draw, drawKind, collection, revealed, onOpen, onKeepDecision, onDiscard, onReveal, onSound }: {
  status: PackStatus | null; countdown: string;
  decisionStatus: DecisionPackStatus | null; decisionCountdown: string; busy: boolean;
  draw: RevealCard[]; drawKind: "regular" | "decision"; collection: CollectedCard[]; revealed: number;
  onOpen: (kind: "regular" | "decision") => Promise<void>; onKeepDecision: (instanceId: string) => Promise<number>;
  onDiscard: (instanceId: string) => Promise<void>;
  onReveal: (index: number) => void; onSound?: (sound: Sound) => void;
}) {
  const [tearing, setTearing] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const [priorCopies, setPriorCopies] = useState<Record<string,number>>({});
  const [keptId, setKeptId] = useState<string>();
  const [decisionKaras, setDecisionKaras] = useState<number>();
  const playSound = onSound ?? noopSound;
  useEffect(() => {
    if (!tearing) return;
    const timer = window.setTimeout(() => { setTearing(false); playSound("tear"); }, 900);
    return () => clearTimeout(timer);
  }, [tearing, playSound]);
  function start(kind: "regular" | "decision") {
    setPriorCopies(collection.reduce<Record<string,number>>((counts,card) => { counts[card.id] = (counts[card.id] || 0) + 1; return counts; }, {}));
    setKeptId(undefined); setDecisionKaras(undefined); setShowDraw(true); setTearing(true); playSound("rumble"); void onOpen(kind);
  }
  const counts = { ...priorCopies };
  const revealCards = draw.map(card => {
    const previous = counts[card.id] || 0;
    counts[card.id] = previous + 1;
    return { ...card, isNew: previous === 0, copies: previous + 1 };
  });
  const revealing = showDraw && draw.length > 0 && !tearing && !busy;
  return <>
    {tearing || busy ? <div className="yk-tearing-stage" role="status"><div className="yk-tearing-pack">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/booster-pack.png" alt="" width={240} height={360} /></div><p className="mt-8 text-sm text-ink-2">Le sceau se brise…</p></div> : revealing ? <BoosterReveal key={draw[0].instanceId} cards={revealCards} revealed={revealed} onReveal={onReveal} onReturn={() => setShowDraw(false)} onNext={drawKind === "regular" ? () => start("regular") : undefined} nextDisabled={!status || status.available === 0 || busy} nextLabel={status?.available === 0 ? `Prochain dans ${countdown}` : "Prochain booster"} onDiscard={drawKind === "regular" ? onDiscard : undefined} decision={drawKind === "decision" ? { keptId, busy, karasReward: decisionKaras, onKeep: async id => { const reward = await onKeepDecision(id); setDecisionKaras(reward); setKeptId(id); return reward; } } : undefined} onSound={playSound} /> : <div className="yk-pack-grid">
      <article className="yk-pack-panel"><div className="yk-pack-art-stage"><span className="yk-pack-orbit" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/booster-pack.png" alt="Booster Régulier Yokkai Collec’" width={220} height={330} className="yk-pack-image" /></div><div className="p-7 pt-0"><div className="flex items-center justify-between gap-2"><h2 className="font-display text-[26px] font-semibold">Booster Régulier</h2><StatusPill>5 cartes</StatusPill></div><p className="mt-3 text-sm leading-6 text-ink-2">Cinq cartes, cinq rencontres. Découvre ce que le destin te réserve.</p><div className="mt-6 flex justify-between gap-3 text-xs"><span className="text-ink-2">Boosters en réserve</span><strong className="text-karas">{status ? `${status.available} / ${status.maximum}` : "—"}</strong></div><div className="my-3 h-1 overflow-hidden rounded-full bg-void"><div className="h-full rounded-full bg-accent-gold" style={{width:status && status.maximum ? `${status.available/status.maximum*100}%` : "0%"}} /></div><p className="mb-6 text-xs text-ink-3">{status ? status.nextPackAt === null ? "Ta réserve est pleine" : `Prochain dans ${countdown}` : "Chargement des boosters…"}</p><Button className="w-full" disabled={!status || status.available === 0 || busy} onClick={() => start("regular")}>{status?.available === 0 ? `Prochain dans ${countdown}` : "Ouvrir"}</Button></div></article>
      <article className="yk-pack-panel yk-decision-panel"><div className="yk-pack-art-stage"><span className="yk-pack-orbit" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/booster-pack.png" alt="Booster Décisif" width={220} height={330} className="yk-pack-image yk-decision-image" /></div><div className="p-7 pt-0"><div className="flex items-center justify-between gap-2"><h2 className="font-display text-[26px] font-semibold">Booster Décisif</h2><StatusPill tone="info">Choix unique</StatusPill></div><p className="mt-3 text-sm leading-6 text-ink-2">1 carte à garder parmi 5 — taux augmentés.</p><Button disabled={!decisionStatus || (!decisionStatus.available && decisionStatus.pending.length === 0) || busy} onClick={() => start("decision")} className="mt-6 w-full">{decisionStatus?.pending.length ? "Reprendre mon choix" : decisionStatus?.available ? "Ouvrir" : `Revient dans ${decisionCountdown}`}</Button></div></article>
    </div>}
  </>;
}
