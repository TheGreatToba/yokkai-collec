"use client";
import { AmbientGlow } from "@/components/ambient-glow";
import { ReferralReminder } from "@/components/referral-reminder";
import { packCopySnapshot, packCopyLabels, packRevealWindow } from "@/lib/ui/pack-opening";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  Card,
  CollectedCard,
  DecisionPackStatus,
  Folder,
  PackStatus,
  Rarity
} from "@/lib/data/cards";
import dynamic from "next/dynamic";
import { CardShareButton } from "@/components/card-sharing";
import {
  Button,
  Modal,
  SelectionBar,
  SelectionModeButton,
  StatusPill
} from "@/components/ui";
import { CardBack, YokaiCard } from "@/components/yokai-card";
import type { SfxName } from "@/hooks/use-sfx";
import { animation } from "@/lib/ui/animations";
import { runPackOpeningSequence, runFinalBoosterOpening } from "@/lib/ui/pack-opening";

const CollectionView = dynamic(
  () => import("@/components/collection").then(module => module.CollectionView),
  { loading: () => <p role="status">Loading collection…</p> }
);

const LocalLrCinematic = dynamic(
  () => import("@/components/local-card-cinematic").then(module => module.LocalCardCinematic),
  { loading: () => <p role="status">Loading cinematic…</p> }
);

const CardCinematic = dynamic(
  () => import("@/components/card-cinematic").then(module => module.CardCinematic),
  { loading: () => <p role="status">Loading cinematic…</p> }
);

const BoosterOpening = dynamic(
  () => import("@/components/booster-opening").then(module => module.BoosterOpening),
  { loading: () => <p role="status">Preparing your pack…</p> }
);

export type RevealCard = Card & {
  instanceId: string;
  shiny?: boolean;
  isEvolved?: boolean;
  isNew?: boolean;
  copies?: number;
  discarded?: boolean;
  destructionValue?: number;
  locked?: boolean;
};
type Sound = SfxName;
type DropRate = { rarity: Rarity; percent: number };
const DECISION_DROP_RATES: DropRate[] = [{ rarity: "SR", percent: 96.5 }, { rarity: "SSR", percent: 3 }, { rarity: "LR", percent: 0.5 }];
const noopSound = () => {};
// Formats the server-provided `nextPackAt`; the countdown itself stays computed by Game.
function decisionReturnLabel(nextPackAt: number) {
  const date = new Date(nextPackAt);
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const days = Math.round(
    (new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      86_400_000
  );
  if (days <= 0) return `Available today at ${time}`;
  if (days === 1) return `Available tomorrow at ${time}`;
  return `Available on ${date.toLocaleDateString("en-US", { day: "numeric", month: "long" })} at ${time}`;
}
type Decision = {
  onKeep: (instanceId: string) => Promise<number>;
  keptId?: string;
  busy?: boolean;
  karasReward?: number;
};

export function BoosterReveal({
  previewOnly = false,
  finalCinematics = false,
  releasedCinematics = false,
  packCount = 1,
  cards,
  collection = [],
  folders = [],
  revealed,
  onReveal,
  onReturn,
  onNext,
  nextDisabled = false,
  nextLabel = "Next pack",
  decision,
  onDiscard,
  onAuction,
  onMoveCard,
  onSetLocked,
  onEvolve,
  onSetCustomImage,
  onComplete,
  onSound
}: {
  previewOnly?: boolean;
  finalCinematics?: boolean;
  releasedCinematics?: boolean;
  packCount?: number;
  cards: RevealCard[];
  revealed: number;
  onReveal: (index: number) => void;
  collection?: CollectedCard[];
  folders?: Folder[];
  onReturn: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  decision?: Decision;
  onDiscard?: (instanceId: string) => Promise<void>;
  onAuction?: (
    instanceId: string,
    startingPrice: number,
    durationMinutes: number
  ) => Promise<void>;
  onMoveCard?: (instanceId: string, folderId: string | null) => Promise<void>;
  onSetLocked?: (instanceId: string, locked: boolean) => Promise<void>;
  onEvolve?: (instanceIds: string[]) => Promise<CollectedCard>;
  onSetCustomImage?: (
    instanceId: string,
    imageUrl: string | null
  ) => Promise<void>;
  onComplete?: () => void;
  onSound?: (sound: Sound) => void;
}) {
  const localPreview = process.env.NODE_ENV === "development" && previewOnly;
  const [faceUp, setFaceUp] = useState(false);
  const [revealLocked, setRevealLocked] = useState(false);
  const [spot, setSpot] = useState<RevealCard | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [discarded, setDiscarded] = useState(
    () =>
      new Set(cards.filter(card => card.discarded).map(card => card.instanceId))
  );
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState(() => new Set<string>());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDiscarding, setBulkDiscarding] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [discardCandidate, setDiscardCandidate] = useState<RevealCard | null>(
    null
  );
  const [locked, setLocked] = useState(
    () =>
      new Set(cards.filter(card => card.locked).map(card => card.instanceId))
  );
  const [detailCard, setDetailCard] = useState<RevealCard | null>(null);
  const [auctioned, setAuctioned] = useState(() => new Set<string>());
  const [batchReview, setBatchReview] = useState<{ at: number; page: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [inspected, setInspected] = useState<RevealCard | null>(null);
  const keepLock = useRef(false);
  const revealTimer = useRef<number | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const completeLink = useRef<HTMLAnchorElement>(null);
  const nextBooster = useRef<HTMLButtonElement>(null);
  const revealAllLock = useRef(false);
  const current = cards[revealed];
  const done = revealed >= cards.length;
  // Summary counts only the cards that stay in the collection (not destroyed, not lost in a Decision Pack).
  const keptCards = cards.filter(
    c =>
      !discarded.has(c.instanceId) &&
      (!decision?.keptId || decision.keptId === c.instanceId)
  );
  const visibleCards = decision
    ? cards
    : cards.filter(card => !discarded.has(card.instanceId));
  const batch = !decision && packCount > 1 && cards.length > 5;
  const overview = batch && showAll;
  const overviewCards = overview ? [...visibleCards].sort((a, b) => {
    const priority = { LR: 4, SSR: 3, SR: 2, R: 1, C: 0 };
    return priority[b.rarity] - priority[a.rarity];
  }) : visibleCards;
  const batchWindow = batch && !overview
    ? packRevealWindow(cards.length, revealed, batchReview?.at === revealed ? batchReview.page : undefined)
    : { page: 0, pages: 1, latest: 0, start: 0, end: cards.length };
  const replayCards = overview ? [] : batch ? cards.slice(batchWindow.start, batchWindow.end) : cards;
  const selectedCards = cards.filter(
    card =>
      selection.has(card.instanceId) &&
      !discarded.has(card.instanceId) &&
      !auctioned.has(card.instanceId) &&
      !locked.has(card.instanceId)
  );
  const selectedValue =
    selectedCards.length &&
    selectedCards.every(card => card.destructionValue != null)
      ? selectedCards.reduce((sum, card) => sum + card.destructionValue!, 0)
      : undefined;
  const choosing = !!decision && done && !decision.keptId;
  const chosen = cards.find(
    c => c.instanceId === pick && !discarded.has(c.instanceId)
  );
  const liveDetailCard = detailCard
    ? (collection.find(card => card.instanceId === detailCard.instanceId) ??
      (detailCard as CollectedCard))
    : null;
  const detailCards = liveDetailCard
    ? collection.some(card => card.instanceId === liveDetailCard.instanceId)
      ? collection
      : [...collection, liveDetailCard]
    : collection;
  const decisionReward = (keptId: string) => {
    const lost = cards.filter(
      card => card.instanceId !== keptId && !discarded.has(card.instanceId)
    );
    return lost.every(card => card.destructionValue != null)
      ? lost.reduce((sum, card) => sum + card.destructionValue!, 0)
      : undefined;
  };
  const deposit = useCallback(() => {
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    revealTimer.current = null;
    setRevealLocked(false);
    onSound?.("slide");
    setFaceUp(false);
    onReveal(revealed);
  }, [onReveal, onSound, revealed]);
  useEffect(() => {
    if (!faceUp || spot || revealLocked) return;
    const timer = window.setTimeout(deposit, 1400);
    return () => clearTimeout(timer);
  }, [faceUp, spot, revealLocked, deposit]);
  useEffect(
    () => () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
    },
    []
  );
  useEffect(() => {
    if (done && !choosing)
      (nextBooster.current && !nextBooster.current.disabled
        ? nextBooster.current
        : completeLink.current
      )?.focus({ preventScroll: true });
    else next.current?.focus({ preventScroll: true });
  }, [done, choosing]);
  function flip() {
    if (!current) return;
    if (faceUp) {
      if (!revealLocked) deposit();
      return;
    }
    setFaceUp(true);
    onSound?.("flip");
    const isLR = current.rarity === "LR";
    const isSSR = current.rarity === "SSR";
    const shiny = current.shiny && (isSSR || isLR);
    if (process.env.NODE_ENV === "development" && isLR) {
      setSpot(current);
      onSound?.(shiny ? "shiny" : "lr");
      return;
    }
    if (process.env.NODE_ENV === "development" && finalCinematics && isSSR) {
      setSpot(current);
      onSound?.(shiny ? "shiny" : "ssr");
      return;
    }
    if (releasedCinematics && (isLR || isSSR)) {
      setSpot(current);
      onSound?.(shiny ? "shiny" : isLR ? "lr" : "ssr");
      return;
    }
    const revealDuration = isLR
      ? 4400
      : isSSR
        ? 3200
        : current.rarity === "SR"
          ? 520
          : 0;
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
  function revealAll() {
    if (!batch || done || revealAllLock.current) return;
    revealAllLock.current = true;
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    revealTimer.current = null;
    setRevealLocked(false);
    setFaceUp(false);
    setSpot(null);
    setShowAll(true);
    // Reveal only the already-awarded draw; never request or reroll a pack here.
    for (let index = revealed; index < cards.length; index++) onReveal(index);
  }
  async function keep() {
    if (!chosen || !decision || keepLock.current) return;
    keepLock.current = true;
    setConfirming(true);
    setError("");
    try {
      await decision.onKeep(chosen.instanceId);
      setConfirm(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't confirm this choice."
      );
    } finally {
      keepLock.current = false;
      setConfirming(false);
    }
  }
  function toggleSelection(instanceId: string) {
    setSelection(current => {
      const next = new Set(current);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  }
  async function discard(instanceId: string) {
    if (!onDiscard || discarding || discarded.has(instanceId)) return;
    setDiscarding(instanceId);
    setError("");
    try {
      await onDiscard(instanceId);
      setDiscarded(current => new Set(current).add(instanceId));
      setDiscardCandidate(null);
      setDetailCard(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't destroy this card.");
    } finally {
      setDiscarding(null);
    }
  }
  async function discardSelection() {
    if (!onDiscard || !selectedCards.length || bulkDiscarding) return;
    const destroyingAll = selectedCards.length === visibleCards.length;
    setBulkDiscarding(true);
    setError("");
    try {
      for (const card of selectedCards) {
        await onDiscard(card.instanceId);
        setDiscarded(current => new Set(current).add(card.instanceId));
        setSelection(current => {
          const next = new Set(current);
          next.delete(card.instanceId);
          return next;
        });
      }
      setBulkConfirm(false);
      setSelecting(false);
      if (destroyingAll) onReturn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't destroy the selected cards."
      );
    } finally {
      setBulkDiscarding(false);
    }
  }
  async function auction(instanceId: string, price: number, duration: number) {
    if (!onAuction) return;
    await onAuction(instanceId, price, duration);
    setAuctioned(current => new Set(current).add(instanceId));
    setSelection(current => {
      const next = new Set(current);
      next.delete(instanceId);
      return next;
    });
  }
  async function lock(instanceId: string, next: boolean) {
    if (!onSetLocked) return;
    await onSetLocked(instanceId, next);
    setLocked(current => {
      const updated = new Set(current);
      if (next) updated.add(instanceId);
      else updated.delete(instanceId);
      return updated;
    });
    setSelection(current => {
      const updated = new Set(current);
      if (next) updated.delete(instanceId);
      return updated;
    });
  }
  return (
    <section
      aria-label="Pack cards"
      data-pack-kind={decision ? "decision" : "regular"}
      data-reveal-state={done ? "complete" : "revealing"}
      className={`yk-reveal-screen ${done && !choosing ? "yk-reveal-complete" : ""} ${batch ? "yk-reveal-batch" : ""} ${overview ? "yk-reveal-instant" : ""}`}
      style={overview ? {
        "--overview-rows-small": Math.max(1, Math.ceil(visibleCards.length / 5)),
        "--overview-columns-medium": visibleCards.length > 25 ? 10 : 7,
        "--overview-rows-medium": Math.max(1, Math.ceil(visibleCards.length / (visibleCards.length > 25 ? 10 : 7))),
        "--overview-columns-wide": visibleCards.length > 25 ? 13 : 10,
        "--overview-rows-wide": Math.max(1, Math.ceil(visibleCards.length / (visibleCards.length > 25 ? 13 : 10)))
      } as CSSProperties : undefined}
    >
      <header className="yk-reveal-header">
        <div className="yk-reveal-copy">
          <p className={`eyebrow ${!done && !batch ? "sr-only" : ""}`}>
            {decision ? "Decision Pack" : packCount > 1 ? `${packCount} Regular Packs` : "Regular Pack"}
          </p>
          <h2 className={done || batch ? "mt-2 font-display text-2xl" : "sr-only"}>
            {decision
              ? choosing
                ? "Make your choice"
                : "One choice"
              : "Reveal your cards"}
          </h2>
          <p
            role="status"
            aria-atomic="true"
            className="mt-2 text-sm text-ink-2"
          >
            {choosing
              ? "All cards revealed · choose one to keep"
              : done
                ? `${revealed} ${revealed === 1 ? "card" : "cards"} revealed`
                : batch ? "Tap the card to reveal the next one." : `Tap the pack to reveal each card · ${revealed} / ${cards.length}`}
          </p>
        </div>
        {overview && <p className="yk-batch-highlights" role="status">
          <span className="yk-batch-lr-count">✦ {keptCards.filter(card => card.rarity === "LR").length} LR</span>
          <span className="yk-batch-ssr-count">✦ {keptCards.filter(card => card.rarity === "SSR").length} SSR</span>
          <span>All {cards.length} cards · No cinematics</span>
          <span>Select a card for a closer look.</span>
        </p>}
        {!localPreview && done && !decision && visibleCards.length > 0 && (
          <SelectionModeButton
            active={selecting}
            inactiveLabel="Select"
            activeLabel="Cancel"
            className="yk-reveal-selection-mode"
            onClick={() => {
              setSelecting(current => !current);
              setSelection(new Set());
            }}
          />
        )}
        {batch ? <div className="yk-batch-progress">
          <p><strong>{revealed.toLocaleString("en-US")}</strong> / {cards.length.toLocaleString("en-US")} <span>cards revealed</span></p>
          <div role="progressbar" aria-label="Cards revealed" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={revealed} className="yk-batch-meter">
            <span style={{ width: `${Math.min(100, revealed / cards.length * 100)}%` }} />
          </div>
        </div> : <ol className={`yk-reveal-progress ${packCount > 1 ? "yk-reveal-progress-batch" : ""}`} aria-hidden="true">
          {cards.map((card, i) => (
            <li
              key={card.instanceId}
              className={
                i < revealed
                  ? "yk-progress-done"
                  : i === revealed
                    ? "yk-progress-current"
                    : undefined
              }
            />
          ))}
        </ol>}
      </header>
    {!done && <div className={`yk-reveal-stage ${faceUp && current?.rarity === "SSR" ? "yk-reveal-ssr" : ""} ${faceUp && current?.rarity === "SR" ? "yk-reveal-sr" : ""} ${faceUp && current?.rarity === "LR" ? "yk-reveal-lr" : ""} ${faceUp && current?.shiny ? "yk-reveal-shiny" : ""}`}>
      {faceUp && current?.rarity === "SSR" && <p className="yk-callout yk-ssr-callout">✦ Exceptional Rarity ✦</p>}
      {faceUp && current?.rarity === "LR" && <p className="yk-callout yk-lr-callout">✦ Legendary Summon ✦</p>}
      {faceUp && current?.shiny && <p className="yk-shiny-callout">✨ Shiny Version!</p>}
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
        <button type="button" ref={next} onClick={flip} aria-disabled={revealLocked} aria-label={revealLocked ? `Revealing ${current.name} in progress` : faceUp ? `Place ${current.name}` : `Reveal card ${revealed + 1} of ${cards.length}`} className={`yk-deck-button ${faceUp ? "yk-face-up" : ""}`}><span className="yk-flip"><span className="yk-flip-back" aria-hidden="true"><CardBack /></span><span className="yk-flip-front" aria-hidden="true">{faceUp && <YokaiCard {...current} />}</span></span></button>
      </div>
      <p className="mt-8 text-center text-xs text-ink-3">{revealLocked ? "The energy is building…" : faceUp ? "Tap to place the card" : "Tap the pack to reveal a card"}</p>
    </div>}
    {choosing && <div className="yk-decision-banner"><p className="font-display text-lg text-karas">Choose your card</p><p className="mt-1 text-sm text-ink-2">Only one will join your collection — the other {cards.length - 1} {cards.length - 1 === 1 ? "card will" : "cards will"} be lost.</p></div>}
    <ol className={`yk-reveal-grid ${choosing ? "yk-reveal-grid-choosing" : ""}`} aria-label={overview ? "All batch cards" : undefined}>
        {overviewCards.map((card, visibleIndex) => {
          const i = batch ? cards.indexOf(card) : visibleIndex;
          if (batch && (i < batchWindow.start || i >= batchWindow.end)) return null;
          const isDiscarded = discarded.has(card.instanceId);
          const lost =
            isDiscarded ||
            (!!decision?.keptId && decision.keptId !== card.instanceId);
          const kept = decision?.keptId === card.instanceId;
          return (
            <li
              key={card.instanceId}
              style={{ "--slot-i": batch ? i - batchWindow.start : i } as CSSProperties}
              className={`yk-reveal-slot ${i < revealed ? "yk-filled" : ""} ${i === revealed && !done ? "yk-slot-next" : ""} ${pick === card.instanceId && choosing ? "yk-picked" : ""} ${lost ? "yk-lost" : ""} ${kept ? "yk-kept" : ""}`}
              data-batch-rarity={overview ? card.rarity : undefined}
            >
              {i < revealed ? (
                <>
              <button
                    type="button"
                    disabled={
                      !done ||
                      confirming ||
                      isDiscarded ||
                      auctioned.has(card.instanceId) ||
                      (!overview && !choosing && !selecting && !onAuction && !onSetLocked)
                    }
                    aria-pressed={
                      choosing
                        ? pick === card.instanceId
                        : selecting
                          ? selection.has(card.instanceId)
                          : undefined
                    }
                    aria-label={
                      choosing
                        ? `Choose ${card.name}`
                        : selecting
                          ? `Select ${card.name}, ${card.rarity}`
                          : overview
                            ? `Inspect ${card.name}, ${card.rarity}`
                          : onAuction || onSetLocked
                            ? `Manage ${card.name}`
                            : `${card.name}, ${card.rarity}`
                    }
                    onClick={() =>
                      choosing
                        ? setPick(card.instanceId)
                        : selecting
                          ? toggleSelection(card.instanceId)
                          : overview && localPreview ? setInspected(card) : setDetailCard(card)
                    }
                    className={`yk-reveal-card block w-full rounded-card text-left disabled:cursor-default ${selecting && selection.has(card.instanceId) ? "yk-selected-card" : ""}`}
                    style={
                      choosing && pick && pick !== card.instanceId
                        ? { opacity: 0.55 }
                        : undefined
                    }
                  >
                    <YokaiCard {...card} animated={overview ? false : undefined} />
                    {selecting && (
                      <span
                        className={`yk-selection-check ${selection.has(card.instanceId) ? "yk-checked" : ""}`}
                      >
                        {selection.has(card.instanceId) ? "✓" : ""}
                      </span>
                    )}
                    {lost && (
                      <span className="yk-lost-stamp">
                        {isDiscarded ? "DESTROYED" : "PERDUE"}
                      </span>
                    )}
                  </button>
                  {overview && (card.rarity === "SSR" || card.rarity === "LR") && <span className="yk-batch-rarity-label" title={card.rarity === "LR" ? "Legendary pull" : "Exceptional pull"}>✦ {card.rarity}</span>}
                  {overview && <span className="yk-batch-copy-label">{auctioned.has(card.instanceId) ? "LISTED" : card.isNew ? "NEW" : card.copies && card.copies > 1 ? `×${card.copies}` : ""}</span>}
                  {done && !overview && <div className="yk-reveal-actions">
                    {auctioned.has(card.instanceId) ? (
                      <StatusPill tone="info">LISTED</StatusPill>
                    ) : kept ? (
                      <StatusPill>KEPT</StatusPill>
                    ) : choosing ? (
                      <Button
                        variant={
                          pick === card.instanceId ? "primary" : "secondary"
                        }
                        disabled={decision.busy || confirming}
                        onClick={() => {
                          setPick(card.instanceId);
                          setConfirm(true);
                        }}
                        className="yk-slot-button"
                      >
                        Keep this one
                      </Button>
                    ) : !selecting && onDiscard ? (
                      <Button
                        variant="danger"
                        disabled={!!discarding}
                        onClick={() => setDiscardCandidate(card)}
                        className="yk-slot-button yk-reveal-discard"
                      >
                        {discarding === card.instanceId
                          ? "Discarding…"
                          : "Discard"}
                      </Button>
                    ) : (
                      !selecting &&
                      (card.isNew ? (
                        <StatusPill>NEW</StatusPill>
                      ) : card.copies && card.copies > 1 ? (
                        <span className="text-[10px] text-ink-3">
                          Duplicate ×{card.copies}
                        </span>
                      ) : null)
                    )}
                  </div>}
                </>
              ) : (
                <span className="yk-slot-placeholder">
                  <span className="yk-slot-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="yk-slot-hint">
                    {i === revealed ? "Next" : "Pending"}
                  </span>
                </span>
              )}
              {!overview && !localPreview && done &&
                !choosing &&
                !lost &&
                !selecting &&
                !auctioned.has(card.instanceId) &&
                (card.rarity === "SSR" ||
                  card.rarity === "LR" ||
                  card.shiny) && (
                  <CardShareButton
                    instanceId={card.instanceId}
                    name={card.name}
                  />
                )}
            </li>
          );
        })}
      </ol>
      {batch && !done && <button type="button" className="yk-button yk-button-secondary yk-reveal-all" onClick={revealAll}>Reveal all</button>}
      {batch && !overview && <nav className="yk-batch-pagination" aria-label="Batch card groups">
        <button type="button" aria-label="Previous five cards" disabled={batchWindow.page === 0} onClick={() => setBatchReview({ at: revealed, page: batchWindow.page - 1 })}>‹ Previous</button>
        <div aria-live="polite">
          <strong>Cards {batchWindow.start + 1}–{batchWindow.end}</strong>
          <span>Group {batchWindow.page + 1} of {batchWindow.pages}</span>
        </div>
        <button type="button" aria-label="Next five cards" disabled={batchWindow.page >= batchWindow.latest} onClick={() => setBatchReview({ at: revealed, page: batchWindow.page + 1 })}>Next ›</button>
      </nav>}
      {batch && done && !visibleCards.some(card => { const i = cards.indexOf(card); return i >= batchWindow.start && i < batchWindow.end; }) && <p className="yk-batch-empty" role="status">All cards in this group have been discarded.</p>}
      {selecting && (
        <SelectionBar
          count={selectedCards.length}
          value={selectedValue}
          busy={bulkDiscarding}
          error={error}
          onAll={() =>
            setSelection(
              new Set(
                visibleCards
                  .filter(
                    card =>
                      !auctioned.has(card.instanceId) &&
                      !locked.has(card.instanceId)
                  )
                  .map(card => card.instanceId)
              )
            )
          }
          onNone={() => setSelection(new Set())}
          onDestroy={() => setBulkConfirm(true)}
          onClose={() => {
            setSelecting(false);
            setSelection(new Set());
            setError("");
          }}
        />
      )}
      {error && (
        <p role="alert" className="mt-5 text-center text-sm text-danger">
          {error}
        </p>
      )}
      {done && !choosing && (
        <div
          className={`yk-reveal-summary ${decision ? "yk-reveal-summary-decision" : ""}`}
        >
          <h2 className="mb-5 font-display text-2xl">
            {decision
              ? `Card added to your collection · +${(decision.karasReward ?? 0).toLocaleString("en-US")} Karas from the cards you didn't keep`
              : "Summon complete"}
          </h2>
          {cards.every(c => c.isNew !== undefined) && (
            <p className="mb-5 text-sm text-ink-2">
              {keptCards.filter(c => c.isNew).length.toLocaleString("en-US")}{" "}
              {keptCards.filter(c => c.isNew).length === 1
                ? "new card"
                : "new cards"}
            </p>
          )}
          <div className="yk-reveal-navigation flex flex-wrap justify-center gap-3">
            {onNext && (
              <span className="yk-reveal-next">
                <button
                  type="button"
                  ref={nextBooster}
                  disabled={nextDisabled}
                  onClick={onNext}
                  className="yk-button yk-button-primary"
                >
                  {nextLabel}
                </button>
              </span>
            )}
            {onComplete ? (
              <Button
                variant={onNext ? "secondary" : "primary"}
                onClick={onComplete}
              >
                {decision ? "View my collection" : "Continue"}
              </Button>
            ) : (
              <Link
                ref={completeLink}
                href="/collection"
                className={`yk-button ${onNext ? "yk-button-secondary" : "yk-button-primary"}`}
              >
                View my collection
              </Link>
            )}
            <Button variant="secondary" onClick={onReturn}>
              Back to packs
            </Button>
            {process.env.NODE_ENV === "development" &&
              replayCards.filter(card => card.rarity === "LR").map(card => (
                <Button key={card.instanceId} variant="secondary" onClick={() => setSpot(card)}>
                  Replay cinematic: {card.name}
                </Button>
              ))}
            {process.env.NODE_ENV === "development" && finalCinematics &&
              replayCards.filter(card => card.rarity === "SSR").map(card => (
                <Button key={card.instanceId} variant="secondary" onClick={() => setSpot(card)}>
                  Replay cinematic: {card.name}
                </Button>
              ))}
            {process.env.NODE_ENV !== "development" && releasedCinematics &&
              replayCards.filter(card => card.rarity === "LR" || card.rarity === "SSR").map(card => (
                <Button key={card.instanceId} variant="secondary" onClick={() => setSpot(card)}>
                  Replay cinematic: {card.name}
                </Button>
              ))}
          </div>
        </div>
      )}
      <Modal open={!!inspected} onClose={() => setInspected(null)} title={inspected?.name ?? "Card preview"} className="yk-batch-inspection">
        {inspected && <div className="yk-batch-card-preview">
          <YokaiCard {...inspected} animated={false} />
          <p>{inspected.rarity}{inspected.shiny ? " · Shiny" : ""} · {inspected.anime || inspected.category}</p>
          {inspected.isNew ? <StatusPill>NEW</StatusPill> : inspected.copies && inspected.copies > 1 ? <p>Duplicate ×{inspected.copies}</p> : null}
          <Button variant="secondary" onClick={() => setInspected(null)}>Back to results</Button>
        </div>}
      </Modal>
      <Modal
        open={!!spot}
        onClose={() => setSpot(null)}
        title={spot?.shiny ? "✦ Shiny Summon ✦" : spot?.rarity === "SSR" ? "SSR summon" : "Legendary summon"}
        className={`yk-invocation ${spot?.shiny ? "yk-invocation-shiny" : ""} ${(process.env.NODE_ENV === "development" || releasedCinematics) && (spot?.rarity === "LR" || spot?.rarity === "SSR") ? "yk-lr-file-modal" : ""}`}
      >
        {spot && process.env.NODE_ENV === "development" && spot.rarity === "LR" ? (
          <LocalLrCinematic card={spot} controls={false} onContinue={() => setSpot(null)} />
        ) : spot && process.env.NODE_ENV === "development" && spot.rarity === "SSR" ? (
          <LocalLrCinematic card={spot} controls={false} onContinue={() => setSpot(null)} />
        ) : spot && releasedCinematics && (spot.rarity === "LR" || spot.rarity === "SSR") ? (
          <CardCinematic card={spot} onContinue={() => setSpot(null)} />
        ) : spot && (
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="yk-invoked-card">
              <YokaiCard {...spot} />
            </div>
            <h3 className="font-display text-[clamp(28px,4vw,44px)]">
              {spot.name}
            </h3>
            {spot.isNew && <StatusPill>NEW</StatusPill>}
            <Button variant="secondary" onClick={() => setSpot(null)}>
              Tap to continue
            </Button>
          </div>
        )}
      </Modal>
      <Modal
        open={confirm}
        onClose={() => {
          if (!confirming) setConfirm(false);
        }}
        title={`Keep ${chosen?.name || "this card"}?`}
      >
        {chosen && (
          <>
            <div className="mx-auto w-40">
              <YokaiCard {...chosen} />
            </div>
            <p className="mt-6 text-center font-semibold text-ink">
              Keep this card and lose the other {cards.length - 1}{" "}
              {cards.length - 1 === 1 ? "card" : "cards"}?
            </p>
            {decisionReward(chosen.instanceId) != null && (
              <p className="mt-2 text-center text-sm text-karas">
                +{decisionReward(chosen.instanceId)?.toLocaleString("en-US")}{"  "}
                Karas from the cards you didn&apos;t keep
              </p>
            )}
            <p className="mb-6 mt-2 text-center text-xs text-ink-3">
              This choice is final.
            </p>
            {error && (
              <p role="alert" className="mb-4 text-center text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="secondary"
                disabled={confirming}
                onClick={() => setConfirm(false)}
              >
                Back to choices
              </Button>
              <Button
                disabled={decision?.busy || confirming}
                aria-busy={confirming || undefined}
                onClick={keep}
              >
                {confirming ? "Confirming…" : "Keep this card"}
              </Button>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={!!discardCandidate}
        onClose={() => {
          if (!discarding) setDiscardCandidate(null);
        }}
        title="Discard this card?"
      >
        {discardCandidate && (
          <>
            <div className="mx-auto w-32">
              <YokaiCard {...discardCandidate} />
            </div>
            <p className="mb-6 mt-5 text-center text-sm text-ink-2">
              {discardCandidate.name}{"  "}will be removed from your collection.
              {discardCandidate.destructionValue != null && (
                <>
                  {"  "}
                  You&apos;ll receive{" "}
                  <strong className="text-karas">
                    {discardCandidate.destructionValue.toLocaleString("en-US")}{" "}
                    Karas
                  </strong>
                  .
                </>
              )}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="secondary"
                disabled={!!discarding}
                onClick={() => setDiscardCandidate(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!!discarding}
                onClick={() => void discard(discardCandidate.instanceId)}
              >
                {discarding ? "Discarding…" : "Discard"}
              </Button>
            </div>
          </>
        )}
      </Modal>
      {detailCard && (
        <CollectionView
          key={detailCard.instanceId}
          cards={detailCards}
          categories={[]}
          folders={folders}
          detailOnly
          initialSelectedId={detailCard.instanceId}
          onDetailClose={() => setDetailCard(null)}
          onMoveCard={onMoveCard}
          onCreateAuction={auction}
          onSetLocked={lock}
          onEvolve={onEvolve}
          onSetCustomImage={onSetCustomImage}
          onDiscard={onDiscard}
        />
      )}
      <Modal
        open={bulkConfirm}
        onClose={() => {
          if (!bulkDiscarding) setBulkConfirm(false);
        }}
        title="Destroy selected cards?"
      >
        <p className="text-sm leading-6 text-ink-2">
          Destroying{" "}
          <strong className="text-ink">
            {selectedCards.length}{"  "}card{selectedCards.length === 1 ? "" : "s"}
          </strong>{"  "}
          is permanent.
          {selectedValue != null && (
            <>
              {"  "}
              You&apos;ll receive{" "}
              <strong className="text-karas">
                {selectedValue.toLocaleString("en-US")} Karas
              </strong>
              .
            </>
          )}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            disabled={bulkDiscarding}
            onClick={() => setBulkConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={bulkDiscarding || selectedValue == null}
            onClick={() => void discardSelection()}
          >
            {bulkDiscarding ? "Destroying…" : "Destroy selected"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}

export function Boosters({
  previewOnly = false,
  releasedOpening = false,
  clickToOpen = false,
  statusError,
  decisionError,
  onRetryRegular,
  onRetryDecision,
  collectionReady = true,
  status,
  countdown,
  decisionStatus,
  decisionCountdown,
  dropRates = [],
  decisionDropRates = DECISION_DROP_RATES,
  shinyRate = 0.1,
  busy,
  draw,
  drawKind,
  collection,
  folders = [],
  revealed,
  onOpen,
  onOpenMany,
  onKeepDecision,
  onDiscard,
  onAuction,
  onMoveCard,
  onSetLocked,
  onEvolve,
  onSetCustomImage,
  onReveal,
  onSound
}: {
  previewOnly?: boolean;
  releasedOpening?: boolean;
  clickToOpen?: boolean;
  statusError?: string;
  decisionError?: string;
  onRetryRegular?: () => void;
  onRetryDecision?: () => void;
  collectionReady?: boolean;
  status: PackStatus | null;
  countdown: string;
  decisionStatus: DecisionPackStatus | null;
  decisionCountdown: string;
  busy: boolean;
  dropRates?: DropRate[];
  decisionDropRates?: DropRate[];
  shinyRate?: number;
  draw: RevealCard[];
  drawKind: "regular" | "decision";
  collection: CollectedCard[];
  folders?: Folder[];
  revealed: number;
  onOpen: (kind: "regular" | "decision") => Promise<RevealCard[] | undefined>;
  onOpenMany?: (count: 1 | 5 | 10) => Promise<RevealCard[] | undefined>;
  onKeepDecision: (instanceId: string) => Promise<number>;
  onDiscard: (instanceId: string) => Promise<void>;
  onAuction?: (
    instanceId: string,
    startingPrice: number,
    durationMinutes: number
  ) => Promise<void>;
  onMoveCard?: (instanceId: string, folderId: string | null) => Promise<void>;
  onSetLocked?: (instanceId: string, locked: boolean) => Promise<void>;
  onEvolve?: (instanceIds: string[]) => Promise<CollectedCard>;
  onSetCustomImage?: (
    instanceId: string,
    imageUrl: string | null
  ) => Promise<void>;
  onReveal: (index: number) => void;
  onSound?: (sound: Sound) => void;
}) {
  const localPreview = process.env.NODE_ENV === "development" && previewOnly;
  const [openingPhase, setOpeningPhase] = useState<"idle" | "tension" | "seal">(
    "idle"
  );
  const [openingKind, setOpeningKind] = useState<"regular" | "decision">(
    "regular"
  );
  const [tearRequested, setTearRequested] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const [priorCopies, setPriorCopies] = useState<Record<string, number> | null>(
    null
  );
  const [keptId, setKeptId] = useState<string>();
  const [decisionKaras, setDecisionKaras] = useState<number>();
  const [ratesKind, setRatesKind] = useState<"regular" | "decision" | null>(
    null
  );
  const [regularCount, setRegularCount] = useState<1 | 5 | 10>(1);
  const [activePackCount, setActivePackCount] = useState(1);
  const batchEnabled = releasedOpening && !!onOpenMany;
  const selectedCount = batchEnabled && status && status.available >= regularCount ? regularCount : 1;
  const openingLock = useRef(false);
  const openingStage = useRef<HTMLDivElement>(null);
  const openingTrigger = useRef<HTMLElement | null>(null);
  const requestSeal = useRef<(() => void) | null>(null);
  const accelerateSeal = useRef<(() => void) | null>(null);
  const preloading = useRef<Promise<void>>(Promise.resolve());
  const finishOpening = useRef<(() => void) | null>(null);
  const openingClicked = useRef(false);
  const playSound = onSound ?? noopSound;
  const speedUpSeal = () => {
    if (releasedOpening && clickToOpen) {
      if (!openingClicked.current) {
        openingClicked.current = true;
        setTearRequested(true);
      } else if (openingPhase === "seal") {
        finishOpening.current?.();
      }
      return;
    }
    if (releasedOpening) {
      openingStage.current?.querySelector("iframe")?.contentWindow?.postMessage(
        { type: "yokkai-booster-next-step" }, "*"
      );
      return;
    }
    if (openingPhase === "seal") {
      accelerateSeal.current?.();
      return;
    }
    if (!requestSeal.current) return;
    const beginTear = requestSeal.current;
    requestSeal.current = null;
    setTearRequested(true);
    beginTear();
  };
  function preload(cards: RevealCard[]) {
    const decoding = Promise.allSettled(
      cards.map(card => {
        const image = new Image();
        image.src = card.image;
        return image.decode();
      })
    );
    preloading.current = Promise.race([
      decoding,
      new Promise(resolve =>
        window.setTimeout(resolve, animation.packOpening.seal)
      )
    ]).then(() => undefined);
  }
  function start(kind: "regular" | "decision", trigger?: HTMLElement) {
    if (openingLock.current) return;
    openingTrigger.current = trigger ?? (document.activeElement instanceof HTMLElement && document.activeElement.tabIndex >= 0 ? document.activeElement : null);
    openingLock.current = true;
    const count = kind === "regular" ? selectedCount : 1;
    setActivePackCount(count);
    setOpeningKind(kind);
    setPriorCopies(packCopySnapshot(collection, collectionReady));
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    setKeptId(undefined);
    setDecisionKaras(undefined);
    setShowDraw(true);
    setWaiting(false);
    setTearRequested(false);
    openingClicked.current = false;
    setOpeningPhase("tension");
    playSound("rumble");
    const waitingTimer = window.setTimeout(
      () => setWaiting(true),
      animation.packOpening.slowResponse
    );
    if (releasedOpening) {
      const finished = new Promise<void>(resolve => { finishOpening.current = resolve; });
      void runFinalBoosterOpening({
        open: count > 1 && onOpenMany ? () => onOpenMany(count) : () => onOpen(kind),
        finished,
        onResponse: cards => {
          clearTimeout(waitingTimer);
          setWaiting(false);
          if (cards?.length) preload(cards);
        },
        preload: () => reducedMotion ? Promise.resolve() : preloading.current
      }).then(
        success => {
          if (!success) setShowDraw(false);
          setOpeningPhase("idle");
        },
        () => { setShowDraw(false); setOpeningPhase("idle"); }
      ).finally(() => {
        clearTimeout(waitingTimer);
        setWaiting(false);
        finishOpening.current = null;
        openingLock.current = false;
      });
      return;
    }
    const tear = new Promise<void>(resolve => {
      requestSeal.current = resolve;
    });
    void runPackOpeningSequence({
      open: () => onOpen(kind),
      onResponse: cards => {
        clearTimeout(waitingTimer);
        setWaiting(false);
        if (cards) preload(cards);
      },
      onSeal: async () => {
        await tear;
        setOpeningPhase("seal");
        playSound("tear");
      },
      wait: duration =>
        duration !== animation.packOpening.seal
          ? new Promise(resolve => window.setTimeout(resolve, duration))
          : new Promise(resolve => {
              const startedAt = performance.now();
              const finish = () => {
                void (
                  reducedMotion ? Promise.resolve() : preloading.current
                ).then(resolve);
              };
              let timer = window.setTimeout(
                finish,
                reducedMotion ? 0 : duration
              );
              accelerateSeal.current = () => {
          accelerateSeal.current = null;
          if (reducedMotion) return;
          openingStage.current?.getAnimations({ subtree: true }).forEach(effect => effect.updatePlaybackRate(3));
          window.clearTimeout(timer);
          timer = window.setTimeout(finish, Math.max(0, duration - (performance.now() - startedAt)) / 3);
        };
            })
    })
      .then(
        () => setOpeningPhase("idle"),
        () => {
          setShowDraw(false);
          setOpeningPhase("idle");
        }
      )
      .finally(() => {
        clearTimeout(waitingTimer);
        setWaiting(false);
        setTearRequested(false);
        requestSeal.current = null;
        accelerateSeal.current = null;
        openingLock.current = false;
      });
  }
  const revealCards = packCopyLabels(draw, priorCopies);
  const revealing =
    showDraw && draw.length > 0 && openingPhase === "idle" && !busy;
  const opening = openingPhase !== "idle";
  useEffect(() => {
    const stage = openingStage.current;
    if (!opening || !stage) return;
    const trigger = openingTrigger.current;
    const main = stage.closest("main");
    const background: { element: HTMLElement; inert: boolean }[] = [];
    stage.focus({ preventScroll: true });
    for (
      let branch: HTMLElement = stage;
      branch.parentElement;
      branch = branch.parentElement
    ) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
        const element = sibling;
        background.push({ element, inert: element.inert });
        element.inert = true;
      }
      if (branch.parentElement === document.body) break;
    }
    return () => {
      for (const { element, inert } of background) element.inert = inert;
      const target =
        trigger?.isConnected && !trigger.matches(":disabled")
          ? trigger
          : (main ?? document).querySelector<HTMLElement>(
              'button:not(:disabled), a[href], [tabindex="0"]'
            );
      target?.focus({ preventScroll: true });
    };
  }, [opening]);
  useEffect(() => {
    if (openingPhase === "seal")
      openingStage.current?.focus({ preventScroll: true });
  }, [openingPhase]);
  useEffect(() => () => { finishOpening.current?.(); }, []);
  const shownRates = ratesKind === "decision" ? decisionDropRates : dropRates;
  const rateDetails = <>
        <p className="text-sm leading-6 text-ink-2">
          {ratesKind === "decision"
            ? "Reveal 5 cards and choose one to keep — with boosted drop rates."
            : "Open a Regular Pack and add all 5 cards to your collection."}
        </p>
        <p className="mt-4 text-sm text-ink-2">
          Chance for each card revealed.
        </p>
        <dl className="yk-drop-rates">
          {shownRates.map(rate => (
            <div key={rate.rarity}>
              <dt>{rate.rarity}</dt>
              <dd>
                {rate.percent.toLocaleString("en-US", {
                  maximumFractionDigits: 2
                })}
                %
              </dd>
            </div>
          ))}
        </dl>
        <p className="yk-drop-shiny">
          An LR card then has a{" "}
          <strong>
            {shinyRate.toLocaleString("en-US", { maximumFractionDigits: 2 })}%
          </strong>{"  "}
          chance of being Shiny.
        </p>

  </>;
  return (
    <>
      {opening ? (
        <div
          ref={openingStage}
          className={`yk-opening-stage yk-opening-${openingPhase} yk-opening-kind-${openingKind}`}
          role="button" tabIndex={0}
          aria-label={
            releasedOpening && clickToOpen && !tearRequested
              ? "Tear open the pack"
              : releasedOpening && clickToOpen && openingPhase !== "seal"
                ? "Opening pack"
                : releasedOpening && clickToOpen ? "Skip booster opening" : releasedOpening ? "Next opening step" : openingPhase === "seal"
              ? "Speed up the opening animation"
              : tearRequested
                ? "Opening pack"
                : "Tear open the pack"
          }
          aria-busy={
            tearRequested && openingPhase !== "seal" ? true : undefined
          }
          onClick={speedUpSeal}
          onKeyDown={event => {
            if (event.repeat) {
              event.preventDefault();
              return;
            }
            if (event.key === "Tab") {
              event.preventDefault();
            } else if (event.key==="Enter"||event.key===" ") {
              event.preventDefault();
              speedUpSeal();
            }
          }}
        >
          {releasedOpening ? (
            <>
              <BoosterOpening
                kind={openingKind}
                openRequested={clickToOpen ? tearRequested : undefined}
                onComplete={() => finishOpening.current?.()}
                onTear={() => { setOpeningPhase("seal"); playSound("tear"); }}
              />
              {activePackCount > 1 && <p className="yk-opening-batch-count">{activePackCount} Regular Packs · {activePackCount * 5} cards</p>}
              {waiting && (!clickToOpen || tearRequested) && <p className="yk-opening-server-status" role="status">Your pack is still being prepared…</p>}
            </>
          ) : <>
          <div className="yk-opening-pack yk-pack-tear" aria-hidden="true">
            <div className="yk-pack-tear-sparks">
              {[
                [11, 8],
                [85, 12],
                [5, 28],
                [97, 34],
                [9, 49],
                [91, 53],
                [2, 75],
                [96, 80],
                [19, 94],
                [80, 97],
                [14, 64],
                [83, 69],
                [23, 20],
                [77, 26],
                [48, 3],
                [51, 101]
              ].map(([x, y], i) => (
                <span
                  key={i}
                  className="yk-pack-tear-spark"
                  style={
                    {
                      left: `${x}%`,
                      top: `${y}%`,
                      "--spark-delay": `${-i * 0.41}s`,
                      "--spark-duration": `${2.7 + (i % 5) * 0.35}s`,
                      "--spark-length": i % 4 === 0 ? "18px" : "10px"
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="yk-pack-tear-body" src={drawKind === "decision" ? "/assets/chrome-decision-booster-v1.png" : "/assets/chrome-regular-booster-v1.png"}
              alt=""
              width={941}
              height={1672}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="yk-pack-tear-top" src={drawKind === "decision" ? "/assets/chrome-decision-booster-v1.png" : "/assets/chrome-regular-booster-v1.png"}
              alt=""
              width={941}
              height={1672}
            />
            <div className="yk-pack-tear-glow" />
          </div>
          <p className="mt-8 text-sm text-ink-2">
            {openingPhase === "seal"
              ? "The seal is breaking…"
              : tearRequested
                ? waiting
                  ? "Your pack is still being prepared…"
                  : "Getting your cards ready…"
                : "Click the pack to tear it open."}
          </p>
          </>}
        </div>
      ) : revealing ? (
        <BoosterReveal
          finalCinematics={process.env.NODE_ENV === "development"}
          releasedCinematics
          packCount={drawKind === "regular" ? activePackCount : 1}
          previewOnly={localPreview}
          onComplete={localPreview ? () => setShowDraw(false) : undefined}
          key={draw[0].instanceId}
          cards={revealCards}
          collection={collection}
          folders={folders}
          revealed={revealed}
          onReveal={onReveal}
          onReturn={() => setShowDraw(false)}
          onNext={drawKind === "regular" ? () => start("regular") : undefined}
          nextDisabled={!status || status.available < selectedCount || busy}
          nextLabel={
            status?.available === 0 ? `Next in ${countdown}` : selectedCount > 1 ? `Next ${selectedCount} packs` : "Next pack"
          }
          onDiscard={!localPreview && drawKind === "regular" ? onDiscard : undefined}
          onAuction={drawKind === "regular" ? onAuction : undefined}
          onMoveCard={drawKind === "regular" ? onMoveCard : undefined}
          onSetLocked={drawKind === "regular" ? onSetLocked : undefined}
          onEvolve={drawKind === "regular" ? onEvolve : undefined}
          onSetCustomImage={
            drawKind === "regular" ? onSetCustomImage : undefined
          }
          decision={
            drawKind === "decision"
              ? {
                  keptId,
                  busy,
                  karasReward: decisionKaras,
                  onKeep: async id => {
                    const reward = await onKeepDecision(id);
                    setDecisionKaras(reward);
                    setKeptId(id);
                    return reward;
                  }
                }
              : undefined
          }
          onSound={playSound}
        />
      ) : (
        <div className="yk-pack-grid">
          <AmbientGlow />
          <article
            className="yk-pack-panel"
            data-unavailable={!status || status.available === 0}
          >
            <div className="yk-pack-art-stage">
              <span className="yk-pack-aura" aria-hidden="true" />
              <span className="yk-pack-floor" aria-hidden="true" />
              <div className="yk-pack-info-trigger" onMouseEnter={() => setRatesKind("regular")} onMouseLeave={() => setRatesKind(null)} onKeyDown={event => { if(event.key === "Escape") { event.stopPropagation(); setRatesKind(null); } }}>
<button
                type="button"
                className="yk-pack-info"
                aria-label="View Regular Pack drop rates"
                onClick={() => setRatesKind("regular")}
                onFocus={() => setRatesKind("regular")}
                onBlur={() => setRatesKind(null)}
                aria-describedby={ratesKind === "regular" ? "regular-drop-rates" : undefined}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6M12 7h.01" />
                </svg>
              </button>
{ratesKind === "regular" && <div id="regular-drop-rates" role="tooltip" className="yk-pack-info-popover">{rateDetails}</div>}
</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/chrome-regular-booster-v1.png" alt="Yokkai Collec’ Regular Pack"
                width={941}
                height={1672}
                className="yk-pack-image"
              />
            </div>
            <div className="yk-pack-body">
              <h2 className="font-display text-[26px] font-semibold">
                Regular Pack
              </h2>
              <div className="yk-pack-status">
                {status ? (
                  <div className="yk-pack-reserve"
                    role="img"
                    aria-label={`${status.reserve ?? status.available} of ${status.maximum} packs in reserve${status.bonus ? ` plus ${status.bonus} bonus packs` : ""}`}
                  >
                    <span className="yk-pack-dots" aria-hidden="true">
                      {Array.from({ length: status.maximum }, (_, index) => (
                        <span
                          key={index}
                          data-filled={index < (status.reserve ?? status.available)}
                        />
                      ))}
                    </span>
                    <span aria-hidden="true">
                      {status.reserve ?? status.available}/{status.maximum}
                      {status.bonus ? ` +${status.bonus} bonus` : ""}
                    </span>
                  </div>
                ) : (
                  <p>{statusError ? "Unavailable" : "Loading reserve…"}</p>
                )}
                {status?.available !== 0 && (
                  <p className="yk-pack-timing">
                    {status
                      ? status.nextPackAt === null
                        ? "Reserve full"
                        : `Next in ${countdown}`
                      : "5 cards per pack"}
                    {status && status.available > 0 && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="text-success">Available now</span>
                      </>
                    )}
                  </p>
                )}
              </div>
              {statusError && (
                <p role="alert" className="my-3 text-sm text-danger-ink">
                  {statusError}{" "}
                  <button
                    className="yk-button yk-button-secondary"
                    onClick={onRetryRegular}
                  >
                    Try again
                  </button>
                </p>
              )}
              {batchEnabled && <div className="yk-pack-batch-picker">
                <div className="yk-pack-quantity" role="group" aria-label="Regular Pack quantity">
                  {([1, 5, 10] as const).map(count => <button
                    key={count}
                    type="button"
                    aria-label={`Open ${count} ${count === 1 ? "Regular Pack" : "Regular Packs"}`}
                    aria-pressed={selectedCount === count}
                    disabled={busy || !status || status.available < count}
                    onClick={() => setRegularCount(count)}
                  >×{count}</button>)}
                </div>
                <p className="yk-pack-batch-details" aria-live="polite">{selectedCount * 5} cards · {selectedCount} {selectedCount === 1 ? "pack" : "packs"}</p>
              </div>}
              <Button
                className="w-full"
                disabled={!status || status.available === 0 || busy}
                onClick={event => start("regular", event.currentTarget)}
              >
                {status?.available === 0 ? `Next in ${countdown}` : selectedCount > 1 ? `Open ×${selectedCount}` : "Open"}
              </Button>
            </div>
          </article>
          <article
            className="yk-pack-panel yk-decision-panel"
            data-unavailable={
              !decisionStatus ||
              (!decisionStatus.available && decisionStatus.pending.length === 0)
            }
          >
            <div className="yk-pack-art-stage">
              <span className="yk-pack-aura" aria-hidden="true" />
              <span className="yk-pack-floor" aria-hidden="true" />
              <div className="yk-pack-info-trigger" onMouseEnter={() => setRatesKind("decision")} onMouseLeave={() => setRatesKind(null)} onKeyDown={event => { if(event.key === "Escape") { event.stopPropagation(); setRatesKind(null); } }}>
<button
                type="button"
                className="yk-pack-info"
                aria-label="View Decision Pack drop rates"
                onClick={() => setRatesKind("decision")}
                onFocus={() => setRatesKind("decision")}
                onBlur={() => setRatesKind(null)}
                aria-describedby={ratesKind === "decision" ? "decision-drop-rates" : undefined}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6M12 7h.01" />
                </svg>
              </button>
{ratesKind === "decision" && <div id="decision-drop-rates" role="tooltip" className="yk-pack-info-popover">{rateDetails}</div>}
</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/chrome-decision-booster-v1.png" alt="Decision Pack"
                width={941}
                height={1672}
                className="yk-pack-image yk-decision-image"
              />
            </div>
            <div className="yk-pack-body">
              <h2 className="font-display text-[26px] font-semibold">
                Decision Pack
              </h2>
              <div className="yk-pack-status">
                <p>Daily · Keep 1 of 5</p>
                <p className="yk-pack-timing" suppressHydrationWarning>
                  {!decisionStatus ? (
                    decisionError ? (
                      "Unavailable"
                    ) : (
                      "Loading…"
                    )
                  ) : decisionStatus.pending.length ? (
                    "Choice pending"
                  ) : decisionStatus.available ? (
                    <span className="text-success">Available now</span>
                  ) : decisionStatus.resetTimeZone === "Europe/Paris" ? (
                    "Available at 8:00 PM (Paris)"
                  ) : (
                    decisionReturnLabel(decisionStatus.nextPackAt)
                  )}
                </p>
                {decisionStatus?.maximum !== undefined && decisionStatus.remaining !== undefined && (
                  <p className="yk-pack-timing">
                    {decisionStatus.remaining}/{decisionStatus.maximum} packs left · Resets daily at 8:00 PM (Paris)
                  </p>
                )}
              </div>
              {decisionError && (
                <p role="alert" className="my-3 text-sm text-danger-ink">
                  {decisionError}{" "}
                  <button
                    className="yk-button yk-button-secondary"
                    onClick={onRetryDecision}
                  >
                    Try again
                  </button>
                </p>
              )}
              <Button
                disabled={
                  !decisionStatus ||
                  (!decisionStatus.available &&
                    decisionStatus.pending.length === 0) ||
                  busy
                }
                onClick={event => start("decision", event.currentTarget)}
                className="w-full"
              >
                {decisionStatus?.pending.length
                  ? "Resume my choice"
                  : decisionStatus?.available
                    ? "Open"
                    : `Available in ${decisionCountdown}`}
              </Button>
            </div>
          </article>
        </div>
      )}
      {!localPreview && !opening && !revealing && <ReferralReminder packChoices />}

    </>
  );
}
