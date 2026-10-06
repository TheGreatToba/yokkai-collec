"use client";
import { CollectionView } from "@/components/collection";
import { Boosters } from "@/components/boosters";
import { Topbar } from "@/components/topbar";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createFolder, deleteFolder, discardPackCard, evolveSsrCard, getActiveAuctionCards, getDecisionPackStatus, getFolders, getGameInfo, getPackStatus, getUserCollection, keepDecisionPackCard, moveCardToFolder, openBooster, openDecisionPack, setCardCustomImage, setCollectionCardLocked, type ActiveAuctionCard, type CollectedCard, type DecisionPackStatus, type Folder, type PackStatus } from "@/lib/data/cards";
import { createAuction } from "@/lib/data/market";
import { subscribePlayerSnapshotInvalidation } from "@/lib/data/player-state";
import { useSfx } from "@/hooks/use-sfx";
import { runPackOpeningOnce } from "@/lib/ui/pack-opening";

type Info = Awaited<ReturnType<typeof getGameInfo>>;
export function Game({ view, account }: { view: "packs" | "collection"; account?: ReactNode }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<DecisionPackStatus | null>(null);
  const [collection, setCollection] = useState<CollectedCard[]>([]);
  const [activeAuctionCards, setActiveAuctionCards] = useState<ActiveAuctionCard[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [draw, setDraw] = useState<CollectedCard[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [drawKind, setDrawKind] = useState<"regular" | "decision">("regular");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const opening = useRef(false);
  const sound = useSfx();
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const [game, packs, decision, cards, cardFolders, auctions] = await Promise.all([getGameInfo(), getPackStatus(), getDecisionPackStatus(), getUserCollection(), getFolders(), getActiveAuctionCards()]);
        if (active) { setInfo(game); setStatus(packs); setDecisionStatus(decision); setCollection(cards); setFolders(cardFolders); setActiveAuctionCards(auctions); setNow(Date.now()); setError(""); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Impossible de charger la partie."); }
    }
    void refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => { active = false; clearInterval(interval); };
  }, []);
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribePlayerSnapshotInvalidation(scopes => {
      if (scopes.includes("balance")) void getGameInfo().then(game => { if (active) setInfo(game); }, () => undefined);
      if (scopes.includes("collection")) void Promise.all([getUserCollection(), getActiveAuctionCards()]).then(([cards, auctions]) => { if (active) { setCollection(cards); setActiveAuctionCards(auctions); } }, () => undefined);
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  async function open(kind: "regular" | "decision") {
    if (draw.length > 0 && revealed < draw.length) return [];
    return await runPackOpeningOnce(opening, async () => {
      setBusy(true); setError("");
      try {
      const cards = kind === "regular" ? await openBooster() : await openDecisionPack();
      setDraw(cards);
      setDrawKind(kind); setRevealed(0);
      setBusy(false);
      void Promise.all([getPackStatus(), getDecisionPackStatus(), getUserCollection()]).then(([packs, decision, cards]) => { setStatus(packs); setDecisionStatus(decision); setCollection(cards); }, () => undefined);
      return cards;
      } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’ouvrir le pack."); throw e; }
      finally { setBusy(false); }
    });
  }
  async function evolve(instanceIds: string[]) {
    const evolved = await evolveSsrCard(instanceIds);
    setCollection(await getUserCollection());
    return evolved;
  }
  async function keepDecision(instanceId: string) {
    const kept = await keepDecisionPackCard(instanceId);
    const [decision, cards] = await Promise.all([getDecisionPackStatus(), getUserCollection()]);
    setDecisionStatus(decision); setCollection(cards); setInfo(current => current ? { ...current, karasBalance: current.karasBalance + kept.karasReward } : current);
    return kept.karasReward;
  }
  async function discard(instanceId: string) {
    const balance = await discardPackCard(instanceId, drawKind);
    if (drawKind === "regular") {
      setCollection(await getUserCollection());
      setInfo(current => current && balance !== null ? { ...current, karasBalance: balance } : current);
    } else {
      const [decision, game] = await Promise.all([getDecisionPackStatus(), getGameInfo()]);
      setDecisionStatus(decision); setInfo(game);
    }
  }
  async function discardCollectionCard(instanceId: string) {
    const balance = await discardPackCard(instanceId, "regular");
    setCollection(await getUserCollection());
    setInfo(current => current && balance !== null ? { ...current, karasBalance: balance } : current);
  }
  async function discardCollectionCards(instanceIds: string[]) {
    try {
      for (const instanceId of instanceIds) await discardPackCard(instanceId, "regular");
    } finally {
      // Also reconcile after a partial network failure: completed destructions
      // must disappear and their credited balance must remain visible.
      const [cards, game] = await Promise.all([getUserCollection(), getGameInfo()]);
      setCollection(cards); setInfo(game);
    }
  }
  async function addFolder(name: string) { const folder = await createFolder(name); setFolders(current => [...current, folder].sort((a,b)=>a.name.localeCompare(b.name,"fr"))); }
  async function removeFolder(folderId: string) { await deleteFolder(folderId); const [nextFolders,cards]=await Promise.all([getFolders(),getUserCollection()]);setFolders(nextFolders);setCollection(cards); }
  async function moveCard(instanceId: string, folderId: string | null) { await moveCardToFolder(instanceId,folderId);setCollection(await getUserCollection()); }
  async function lockCard(instanceId:string,locked:boolean){await setCollectionCardLocked(instanceId,locked);setCollection(await getUserCollection());}
  async function auctionCard(instanceId:string,price:number,duration:number){await createAuction(instanceId,price,duration);const [cards,auctions]=await Promise.all([getUserCollection(),getActiveAuctionCards()]);setCollection(cards);setActiveAuctionCards(auctions);}
  async function customizeCard(instanceId:string,imageUrl:string|null){await setCardCustomImage(instanceId,imageUrl);setCollection(await getUserCollection());}
  const revealCard = useCallback((index: number) => setRevealed(current => current === index ? current + 1 : current), []);
  const seconds = status?.nextPackAt ? Math.max(0, Math.ceil((status.nextPackAt - now) / 1000)) : 0;
  const countdown = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const decisionSeconds = decisionStatus?.nextPackAt ? Math.max(0, Math.ceil((decisionStatus.nextPackAt - now) / 1000)) : 0;
  const decisionCountdown = `${Math.floor(decisionSeconds / 3600).toString().padStart(2, "0")}:${Math.floor(decisionSeconds % 3600 / 60).toString().padStart(2, "0")}:${(decisionSeconds % 60).toString().padStart(2, "0")}`;
  return <div className="w-full">
    <Topbar view={view} account={account} name={info?.user.name} karas={info?.karasBalance} collection={collection} />
    <main id="main-content" className={`mx-auto px-6 ${view === "collection" ? "max-w-[var(--layout-collection-max)] py-6" : "max-w-6xl py-10"}`}>{view === "packs"?<><p className="eyebrow">Une ouverture. Cinq destins.</p><h1 className="yk-title mt-3">Tes boosters</h1><p className="mt-4 max-w-xl text-sm leading-6 text-ink-2">Brise le sceau. Révèle les cartes qui rejoindront ta collection.</p></>:<h1 className="text-2xl font-semibold tracking-tight text-ink">Ma collection</h1>}
    {error && <p role="alert" className="my-6 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger-ink">{error}</p>}{!status && !error && <p role="status" className="mt-10">Chargement…</p>}
    {view === "packs" && <Boosters status={status} countdown={countdown} decisionStatus={decisionStatus} decisionCountdown={decisionCountdown} busy={busy} draw={draw} drawKind={drawKind} collection={collection} folders={folders} revealed={revealed} onOpen={open} onKeepDecision={keepDecision} onDiscard={discard} onAuction={auctionCard} onMoveCard={moveCard} onSetLocked={lockCard} onEvolve={evolve} onSetCustomImage={customizeCard} onReveal={revealCard} onSound={sound.play} />}

    {view === "collection" && status && <CollectionView cards={collection} categories={info?.categories || []} presentation={Object.fromEntries(activeAuctionCards.map(auction=>[auction.instanceId,{frozen:{remaining:auction.endsAt},auctionId:auction.auctionId}]))} folders={folders} onCreateFolder={addFolder} onDeleteFolder={removeFolder} onMoveCard={moveCard} onSetLocked={lockCard} onCreateAuction={auctionCard} onEvolve={evolve} onSetCustomImage={customizeCard} onDiscard={discardCollectionCard} onDiscardMany={discardCollectionCards} />}

    </main><footer className={`mx-auto mt-6 flex w-full ${view === "collection" ? "max-w-[var(--layout-collection-max)]" : "max-w-6xl"} flex-wrap justify-between gap-3 border-t border-veil px-6 py-6 text-xs text-ink-3`}><span>Yokkai Collec’ · v0.2</span><span>Collection sauvegardée sur votre compte</span></footer>
  </div>;
}
