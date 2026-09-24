"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, CollectedCard, PackStatus } from "@/lib/data/cards";
import { Button, Modal, StatusPill } from "@/components/ui";
import { CardBack, YokaiCard } from "@/components/yokai-card";
import { useSfx, type SfxName } from "@/hooks/use-sfx";
import "@/styles/boosters.css";

export type RevealCard = Card & { instanceId: string; shiny?: boolean; isNew?: boolean; copies?: number };
type Sound = SfxName;
type Decision = { onKeep: (instanceId: string) => Promise<void>; keptId?: string; busy?: boolean };

export function BoosterReveal({ cards, revealed, onReveal, onRevealAll, onReturn, decision, onSound }: {
  cards: RevealCard[]; revealed: number; onReveal: (index: number) => void; onRevealAll: () => void;
  onReturn: () => void; decision?: Decision; onSound?: (sound: Sound) => void;
}) {
  const [faceUp, setFaceUp] = useState(false);
  const [spot, setSpot] = useState<RevealCard | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const keepLock = useRef(false);
  const next = useRef<HTMLButtonElement>(null);
  const completeLink = useRef<HTMLAnchorElement>(null);
  const current = cards[revealed];
  const done = revealed >= cards.length;
  const choosing = !!decision && done && !decision.keptId;
  const chosen = cards.find(c => c.instanceId === pick);
  const deposit = useCallback(() => { onSound?.("slide"); setFaceUp(false); onReveal(revealed); }, [onReveal, onSound, revealed]);
  useEffect(() => {
    if (!faceUp || spot) return;
    const timer = window.setTimeout(deposit, 1400);
    return () => clearTimeout(timer);
  }, [faceUp, spot, deposit]);
  useEffect(() => { if (done && !choosing) completeLink.current?.focus({preventScroll:true}); else next.current?.focus({preventScroll:true}); }, [done, choosing]);
  function flip() {
    if (!current) return;
    if (faceUp) { deposit(); return; }
    setFaceUp(true);
    onSound?.("flip");
    const shiny = current.shiny && (current.rarity === "SSR" || current.rarity === "LR");
    if (shiny || current.rarity === "LR") { setSpot(current); onSound?.(shiny ? "shiny" : "lr"); }
    else if (current.rarity === "SSR" || current.rarity === "SR") onSound?.(current.rarity === "SSR" ? "ssr" : "sr");
  }
  async function keep() {
    if (!chosen || !decision || keepLock.current) return;
    keepLock.current = true; setConfirming(true); setError("");
    try { await decision.onKeep(chosen.instanceId); setConfirm(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de confirmer ce choix."); }
    finally { keepLock.current = false; setConfirming(false); }
  }
  return <section aria-label="Cartes du pack" className="mt-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><p role="status" aria-atomic="true" className="text-sm text-ink-2">Révélées <strong className="text-ink">{revealed} / {cards.length}</strong></p>{!done && <Button variant="secondary" onClick={() => { setFaceUp(false); setSpot(null); onSound?.("flutter"); onRevealAll(); }}>Tout révéler ▸▸</Button>}</div>
    {!done && <div className={`yk-reveal-stage ${faceUp && current?.rarity === "SSR" ? "yk-reveal-ssr" : ""} ${faceUp && current?.rarity === "SR" ? "yk-reveal-sr" : ""}`}>
      {faceUp && current?.rarity === "SSR" && <p className="yk-callout">SUPER SUPER RARE</p>}
      {faceUp && (current?.rarity === "SSR" || current?.rarity === "SR") && <div className="yk-burst" aria-hidden="true" />}
      <div className="yk-deck">{cards.slice(revealed + 1).map((card, i, remaining) => <div className="yk-stacked-back" key={card.instanceId} style={{ transform: `translate(${(remaining.length-i)*3}px,${-(remaining.length-i)*4}px) rotate(${(remaining.length-i)*1.3}deg)`, filter: `brightness(${1-(remaining.length-i)*.045})` }}><CardBack /></div>)}
        <button type="button" ref={next} onClick={flip} aria-label={faceUp ? `Ranger ${current.name}` : `Révéler la carte ${revealed + 1} sur ${cards.length}`} className={`yk-deck-button ${faceUp ? "yk-face-up" : ""}`}><span className="yk-flip"><span className="yk-flip-back" aria-hidden="true"><CardBack /></span><span className="yk-flip-front" aria-hidden="true">{faceUp && <YokaiCard {...current} />}</span></span></button>
      </div>
      <p className="mt-8 text-center text-xs text-ink-3">{faceUp ? "Touchez pour ranger la carte" : "Touchez le paquet pour révéler une carte"}</p>
    </div>}
    {choosing && <div className="my-8 rounded-panel border border-rarity-ssr/40 bg-rarity-ssr/10 p-5 text-center"><p className="font-semibold text-rarity-ssr">Choisissez UNE carte à garder</p><p className="mt-2 text-sm text-ink-2">Les {cards.length - 1} autres seront perdues définitivement.</p></div>}
    <ol className="yk-reveal-grid">{cards.map((card,i) => {
      const lost = !!decision?.keptId && decision.keptId !== card.instanceId;
      const kept = decision?.keptId === card.instanceId;
      return <li key={card.instanceId} className={`yk-reveal-slot ${i < revealed ? "yk-filled" : ""} ${pick === card.instanceId && choosing ? "yk-picked" : ""} ${lost ? "yk-lost" : ""}`}>
        {i < revealed ? <><button type="button" disabled={!choosing || confirming} aria-pressed={choosing ? pick === card.instanceId : undefined} aria-label={choosing ? `Choisir ${card.name}` : `${card.name}, ${card.rarity}`} onClick={() => setPick(card.instanceId)} className="block w-full rounded-card text-left disabled:cursor-default" style={choosing && pick && pick !== card.instanceId ? {opacity:.55} : undefined}><YokaiCard {...card} />{lost && <span className="yk-lost-stamp">PERDUE</span>}</button><div className="mt-2 flex min-h-6 justify-center gap-1">{kept ? <StatusPill>GARDÉE</StatusPill> : choosing && pick === card.instanceId ? <StatusPill>À GARDER</StatusPill> : card.isNew ? <StatusPill>NEW</StatusPill> : card.copies && card.copies > 1 ? <span className="text-[10px] text-ink-3">Doublon ×{card.copies}</span> : null}</div></> : <span className="yk-slot-number">{String(i + 1).padStart(2,"0")}</span>}
      </li>;
    })}</ol>
    {choosing && <div className="mt-8 text-center"><Button disabled={!chosen || decision.busy || confirming} onClick={() => setConfirm(true)}>Garder cette carte</Button></div>}
    {done && !choosing && <div className="mt-8 rounded-panel border border-veil bg-surface p-6 text-center"><h2 className="font-display text-2xl">{decision ? "Votre choix est fait" : "Votre invocation est complète"}</h2><div className="my-5 flex flex-wrap justify-center gap-2">{[...new Set(cards.map(c => c.rarity))].map(r => <StatusPill key={r}>{r} ×{cards.filter(c=>c.rarity===r).length}</StatusPill>)}</div>{cards.every(c => c.isNew !== undefined) && <p className="mb-5 text-sm text-ink-2">{cards.filter(c => c.isNew && (!decision || c.instanceId === decision.keptId)).length} nouvelle(s) carte(s)</p>}<div className="flex flex-wrap justify-center gap-3"><Link ref={completeLink} href="/collection" className="yk-button yk-button-primary">Voir ma collection</Link><Button variant="secondary" onClick={onReturn}>Retour aux boosters</Button></div></div>}
    <Modal open={!!spot} onClose={() => setSpot(null)} title={spot?.shiny ? "✦ Invocation Shiny ✦" : "Invocation légendaire"} className={`yk-invocation ${spot?.shiny ? "yk-invocation-shiny" : ""}`}>
      {spot && <div className="relative z-10 flex flex-col items-center gap-6"><div className="yk-invoked-card"><YokaiCard {...spot} /></div><h3 className="font-display text-[clamp(28px,4vw,44px)]">{spot.name}</h3>{spot.isNew && <StatusPill>NEW</StatusPill>}<Button variant="secondary" onClick={() => setSpot(null)}>Toucher pour continuer</Button></div>}
    </Modal>
    <Modal open={confirm} onClose={() => { if (!confirming) setConfirm(false); }} title={`Garder ${chosen?.name || "cette carte"} ?`}>{chosen && <><div className="mx-auto w-40"><YokaiCard {...chosen} /></div><p className="my-6 text-center text-sm text-ink-2">Les autres cartes seront perdues définitivement.</p>{error && <p role="alert" className="mb-4 text-danger">{error}</p>}<div className="flex flex-wrap justify-center gap-3"><Button variant="secondary" disabled={confirming} onClick={() => setConfirm(false)}>Revoir mon choix</Button><Button disabled={decision?.busy || confirming} onClick={keep}>{confirming ? "Confirmation…" : "Confirmer"}</Button></div></>}</Modal>
  </section>;
}

export function Boosters({ status, countdown, rates, busy, draw, collection, revealed, onOpen, onReveal, onRevealAll, onSound }: {
  status: PackStatus | null; countdown: string; rates?: {rarity: Card["rarity"]; percent: number}[];
  busy: boolean; draw: CollectedCard[]; collection: CollectedCard[]; revealed: number; onOpen: () => Promise<void>;
  onReveal: (index: number) => void; onRevealAll: () => void; onSound?: (sound: Sound) => void;
}) {
  const [tearing, setTearing] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const [priorCopies, setPriorCopies] = useState<Record<string,number>>({});
  const sound = useSfx();
  const playSound = onSound ?? sound.play;
  useEffect(() => {
    if (!tearing) return;
    const timer = window.setTimeout(() => { setTearing(false); playSound("tear"); }, 900);
    return () => clearTimeout(timer);
  }, [tearing, playSound]);
  function start() {
    setPriorCopies(collection.reduce<Record<string,number>>((counts,card) => { counts[card.id] = (counts[card.id] || 0) + 1; return counts; }, {}));
    setShowDraw(true); setTearing(true); playSound("rumble"); void onOpen();
  }
  const counts = { ...priorCopies };
  const revealCards = draw.map(card => {
    const previous = counts[card.id] || 0;
    counts[card.id] = previous + 1;
    return { ...card, isNew: previous === 0, copies: previous + 1 };
  });
  const revealing = showDraw && draw.length > 0 && !tearing && !busy;
  return <>
    <div className="mt-6 flex justify-end"><button type="button" onClick={sound.toggle} aria-pressed={sound.enabled} aria-label={sound.enabled ? "Désactiver les sons" : "Activer les sons"} className="inline-flex items-center gap-2 rounded-full border border-veil px-4 py-2 text-xs text-ink-2"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 9h4l5-4v14l-5-4H4z"/>{sound.enabled ? <path d="M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/> : <path d="m17 9 5 6m0-6-5 6"/>}</svg>{sound.enabled ? "Son activé" : "Son coupé"}</button></div>
    {tearing || busy ? <div className="yk-tearing-stage" role="status"><div className="yk-tearing-pack">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/booster-pack.png" alt="" width={240} height={360} /></div><p className="mt-8 text-sm text-ink-2">Le sceau se brise…</p></div> : revealing ? <BoosterReveal key={draw[0].instanceId} cards={revealCards} revealed={revealed} onReveal={onReveal} onRevealAll={onRevealAll} onReturn={() => setShowDraw(false)} onSound={playSound} /> : <div className="yk-pack-grid">
      <article className="yk-pack-panel"><div className="yk-pack-art-stage"><span className="yk-pack-orbit" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/booster-pack.png" alt="Regular Pack Yokkai Collec’" width={220} height={330} className="yk-pack-image" /></div><div className="p-7 pt-0"><div className="flex items-center justify-between gap-2"><h2 className="font-display text-[26px] font-semibold">Regular Pack</h2><StatusPill>10 cartes</StatusPill></div><p className="mt-3 text-sm leading-6 text-ink-2">Dix cartes, dix rencontres. Découvrez ce que le destin vous réserve.</p><div className="mt-6 flex justify-between gap-3 text-xs"><span className="text-ink-2">Packs disponibles</span><strong className="text-karas">{status ? `${status.available} / ${status.maximum}` : "—"}</strong></div><div className="my-3 h-1 overflow-hidden rounded-full bg-void"><div className="h-full rounded-full bg-accent-gold" style={{width:status && status.maximum ? `${status.available/status.maximum*100}%` : "0%"}} /></div><p className="mb-6 text-xs text-ink-3">{status ? status.nextPackAt === null ? "Votre réserve est pleine" : `Prochain pack dans ${countdown}` : "Chargement des packs…"}</p><Button className="w-full" disabled={!status || status.available === 0 || busy} onClick={start}>{status?.available === 0 ? `Disponible dans ${countdown}` : "Ouvrir le pack ✦"}</Button><div className="mt-5 flex flex-wrap justify-center gap-2">{rates?.map(r => <span className={`yk-rate yk-rate-${r.rarity}`} key={r.rarity}><b>{r.rarity}</b> {r.percent.toLocaleString("fr-FR")}%</span>)}</div></div></article>
      <article className="yk-pack-panel yk-decision-panel"><div className="yk-pack-art-stage"><span className="yk-pack-orbit" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/booster-pack.png" alt="Decision Pack" width={220} height={330} className="yk-pack-image yk-decision-image" /></div><div className="p-7 pt-0"><div className="flex items-center justify-between gap-2"><h2 className="font-display text-[26px] font-semibold">Decision Pack</h2><StatusPill tone="info">Choix unique</StatusPill></div><p className="mt-3 text-sm leading-6 text-ink-2">Dix cartes se dévoilent. Une seule rejoindra votre collection. À vous de choisir.</p><div className="my-6 rounded-input border border-veil bg-void p-4 text-xs leading-5 text-ink-3">Une nouvelle façon d’invoquer vos cartes arrive bientôt.</div><Button disabled className="w-full">Bientôt disponible</Button></div></article>
    </div>}
  </>;
}
