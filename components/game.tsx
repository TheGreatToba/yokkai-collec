"use client";
import { packCountdown } from "@/lib/ui/pack-countdown";
import dynamic from "next/dynamic";
import { Topbar } from "@/components/topbar";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  createFolder,
  deleteFolder,
  discardCollectionCards as discardCollectionCardsRequest,
  discardPackCard,
  evolveSsrCard,
  getActiveAuctionCards,
  getDecisionPackStatus,
  getFolders,
  getGameInfo,
  getPaniniAlbumCardsPage,
  getPaniniAlbumsPage,
  getPackStatus,
  getUserCollection,
  keepDecisionPackCard,
  moveCardToFolder,
  moveCardsToFolder,
  openBooster,
  openBoosters,
  openDecisionPack,
  setPaniniAlbumFavorite,
  setCardCustomImage,
  setCollectionCardLocked,
  type ActiveAuctionCard,
  type CollectedCard,
  type DecisionPackStatus,
  type Folder,
  type PackStatus
} from "@/lib/data/cards";
import { createAuction } from "@/lib/data/market";
import { subscribePlayerSnapshotInvalidation } from "@/lib/data/player-state";
import { useSfx } from "@/hooks/use-sfx";
import { runPackOpeningOnce } from "@/lib/ui/pack-opening";
import { releaseBoostersBackground } from "@/components/boosters-load-priority";
import { startVisiblePolling } from "@/lib/ui/visible-polling";
import { SiteFooter } from "@/components/site-footer";

const CollectionView = dynamic(
  () => import("@/components/collection").then(module => module.CollectionView),
  { loading: () => <p role="status">Loading collection…</p> }
);

const Boosters = dynamic(
  () => import("@/components/boosters").then(module => module.Boosters),
  { loading: () => <p role="status">Loading packs…</p> }
);

// Share initial/polling reads, while post-mutation reconciliation still requests
// a fresh server status even when a previous initial read is pending.
export const gameReads = {
  getGameInfo,
  getPackStatus: () => getPackStatus(true),
  getDecisionPackStatus: () => getDecisionPackStatus(false),
  getUserCollection,
  getFolders: () => getFolders(true),
  getActiveAuctionCards: () => getActiveAuctionCards(true)
};
type Info = Awaited<ReturnType<typeof getGameInfo>>;
export function Game({
  view,
  account,
  previewData,
  discordEnabled = false
}: {
  view: "packs" | "collection";
  account?: ReactNode;
  previewData?: typeof gameReads;
  discordEnabled?: boolean;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [decisionStatus, setDecisionStatus] =
    useState<DecisionPackStatus | null>(null);
  const [collection, storeCollection] = useState<CollectedCard[]>([]);
  const [activeAuctionCards, setActiveAuctionCards] = useState<
    ActiveAuctionCard[]
  >([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [draw, setDraw] = useState<CollectedCard[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [drawKind, setDrawKind] = useState<"regular" | "decision">("regular");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [collectionReady, setCollectionReady] = useState(false);
  const setCollection = useCallback((cards: CollectedCard[]) => {
    storeCollection(cards);
    setCollectionReady(true);
  }, []);
  const retries = useRef<Record<string, () => void>>({});
  const reads = previewData ?? gameReads;
  const opening = useRef(false);
  const sound = useSfx();
  useEffect(() => {
    let active = true;
    let backgroundStarted = false;
    const pending = new Map<string, Promise<unknown>>();
    const failed = new Set<string>();
    function load<T>(
      key: string,
      read: () => Promise<T>,
      apply: (value: T) => void
    ) {
      if (pending.has(key)) return pending.get(key)!;
      if (key === "collection") setCollectionReady(false);
      setLoadErrors(current => ({ ...current, [key]: "" }));
      const request = read()
        .then(
          value => {
            if (!active) return;
            failed.delete(key);
            apply(value);
            if (key === "collection") setCollectionReady(true);
          },
          failure => {
            failed.add(key);
            if (active)
              setLoadErrors(current => ({
                ...current,
                [key]:
                  failure instanceof Error
                    ? failure.message
                    : "Couldn't load this data."
              }));
          }
        )
        .finally(() => pending.delete(key));
      pending.set(key, request);
      retries.current[key] = () => {
        void load(key, read, apply);
      };
      return request;
    }
    function background() {
      if (!active || document.hidden) return;
      backgroundStarted = true;
      void load("collection", reads.getUserCollection, setCollection);
      void load("folders", reads.getFolders, setFolders);
      void load("auctions", reads.getActiveAuctionCards, setActiveAuctionCards);
      releaseBoostersBackground();
    }
    function refresh(full: boolean) {
      for (const key of failed) retries.current[key]?.();
      void load("info", reads.getGameInfo, setInfo);
      const packs =
        full || view === "packs"
          ? load("regular", reads.getPackStatus, setStatus)
          : Promise.resolve();
      const decision =
        full || view === "packs"
          ? load("decision", reads.getDecisionPackStatus, setDecisionStatus)
          : Promise.resolve();
      if (!backgroundStarted)
        void Promise.all([packs, decision]).then(() => {
          if (!backgroundStarted) background();
        });
      else if (full) background();
      else if (view === "collection")
        void load(
          "auctions",
          reads.getActiveAuctionCards,
          setActiveAuctionCards
        );
    }
    const timer = window.setTimeout(() => {
      if (!backgroundStarted) background();
    }, 1000);
    const stop = startVisiblePolling(refresh, 30_000);
    return () => {
      active = false;
      clearTimeout(timer);
      stop();
      retries.current = {};
    };
  }, [view, reads, setCollection]);
  useEffect(() => {
    return startVisiblePolling(() => setNow(Date.now()), 1000);
  }, []);
  useEffect(() => {
    if (view !== "packs" || !decisionStatus?.resetAt) return;
    // Re-read the server at the shared reset, in addition to background polling.
    // nextPackAt is corrected for the browser clock; resetAt is absolute metadata.
    const timer = window.setTimeout(
      () => {
        if (!document.hidden) retries.current.decision?.();
      },
      Math.max(0, decisionStatus.nextPackAt - Date.now()) + 100
    );
    return () => window.clearTimeout(timer);
  }, [view, decisionStatus?.resetAt, decisionStatus?.nextPackAt]);
  useEffect(() => {
    let active = true;
    if (previewData) return;
    const unsubscribe = subscribePlayerSnapshotInvalidation(scopes => {
      if (document.hidden) return;
      if (scopes.includes("balance"))
        void getGameInfo().then(
          game => {
            if (active) setInfo(game);
          },
          () => undefined
        );
      if (scopes.includes("collection")) {
        setCollectionReady(false);
        void Promise.all([getUserCollection(), getActiveAuctionCards()]).then(
          ([cards, auctions]) => {
            if (active) {
              setCollection(cards);
              setActiveAuctionCards(auctions);
              setCollectionReady(true);
            }
          },
          () => undefined
        );
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [previewData, setCollection]);
  async function open(kind: "regular" | "decision", count: 1 | 5 | 10 = 1) {
    if (draw.length > 0 && revealed < draw.length) return [];
    return await runPackOpeningOnce(opening, async () => {
      setBusy(true);
      setError("");
      try {
        const cards =
          kind === "regular" && count > 1
            ? await openBoosters(count)
            : kind === "regular"
              ? await openBooster()
              : await openDecisionPack();
        setDraw(cards);
        setDrawKind(kind);
        setRevealed(0);
        setBusy(false);
        void Promise.all([
          getPackStatus(),
          getDecisionPackStatus(),
          getUserCollection()
        ]).then(
          ([packs, decision, cards]) => {
            setStatus(packs);
            setDecisionStatus(decision);
            setCollection(cards);
          },
          () => undefined
        );
        return cards;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't open this pack.");
        throw e;
      } finally {
        setBusy(false);
        if (count > 1) void getPackStatus().then(setStatus, () => undefined);
      }
    });
  }
  async function evolve(instanceIds: string[]) {
    if (previewData)
      throw new Error("This action is unavailable in the simulation.");
    const evolved = await evolveSsrCard(instanceIds);
    setCollection(await getUserCollection());
    return evolved;
  }
  async function keepDecision(instanceId: string) {
    const kept = await keepDecisionPackCard(instanceId);
    const [decision, cards] = await Promise.all([
      getDecisionPackStatus(),
      getUserCollection()
    ]);
    setDecisionStatus(decision);
    setCollection(cards);
    setInfo(current =>
      current
        ? { ...current, karasBalance: current.karasBalance + kept.karasReward }
        : current
    );
    return kept.karasReward;
  }
  async function discard(instanceId: string) {
    const balance = await discardPackCard(instanceId, drawKind);
    if (drawKind === "regular") {
      setCollection(await getUserCollection());
      setInfo(current =>
        current && balance !== null
          ? { ...current, karasBalance: balance }
          : current
      );
    } else {
      const [decision, game] = await Promise.all([
        getDecisionPackStatus(),
        getGameInfo()
      ]);
      setDecisionStatus(decision);
      setInfo(game);
    }
  }
  async function discardCollectionCard(instanceId: string) {
    const balance = await discardPackCard(instanceId, "regular");
    setCollection(await getUserCollection());
    setInfo(current =>
      current && balance !== null
        ? { ...current, karasBalance: balance }
        : current
    );
  }
  async function discardCollectionCards(instanceIds: string[]) {
    try {
      await discardCollectionCardsRequest(instanceIds);
    } finally {
      // Reconcile if the response is lost after the atomic transaction commits.
      const [cards, game] = await Promise.all([
        getUserCollection(),
        getGameInfo()
      ]);
      setCollection(cards);
      setInfo(game);
    }
  }
  async function addFolder(name: string) {
    const folder = await createFolder(name);
    setFolders(current =>
      [...current, folder].sort((a, b) => a.name.localeCompare(b.name, "fr"))
    );
  }
  async function removeFolder(folderId: string) {
    await deleteFolder(folderId);
    const [nextFolders, cards] = await Promise.all([
      getFolders(),
      getUserCollection()
    ]);
    setFolders(nextFolders);
    setCollection(cards);
  }
  async function moveCard(instanceId: string, folderId: string | null) {
    if (previewData)
      throw new Error("This action is unavailable in the simulation.");
    await moveCardToFolder(instanceId, folderId);
    setCollection(await getUserCollection());
  }
  async function moveCards(instanceIds: string[], folderId: string | null) {
    await moveCardsToFolder(instanceIds, folderId);
    setCollection(await getUserCollection());
  }
  async function lockCard(instanceId: string, locked: boolean) {
    if (previewData)
      throw new Error("This action is unavailable in the simulation.");
    await setCollectionCardLocked(instanceId, locked);
    setCollection(await getUserCollection());
  }
  async function auctionCard(
    instanceId: string,
    price: number,
    duration: number
  ) {
    if (previewData)
      throw new Error("This action is unavailable in the simulation.");
    await createAuction(instanceId, price, duration);
    const [cards, auctions] = await Promise.all([
      getUserCollection(),
      getActiveAuctionCards()
    ]);
    setCollection(cards);
    setActiveAuctionCards(auctions);
  }
  async function customizeCard(instanceId: string, imageUrl: string | null) {
    if (previewData)
      throw new Error("This action is unavailable in the simulation.");
    await setCardCustomImage(instanceId, imageUrl);
    setCollection(await getUserCollection());
  }
  const revealCard = useCallback(
    (index: number) =>
      setRevealed(current => (current === index ? current + 1 : current)),
    []
  );
  const countdown = packCountdown(status?.nextPackAt, now);
  const decisionSeconds = decisionStatus?.nextPackAt
    ? Math.max(0, Math.ceil((decisionStatus.nextPackAt - now) / 1000))
    : 0;
  const decisionCountdown = `${Math.floor(decisionSeconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((decisionSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(decisionSeconds % 60).toString().padStart(2, "0")}`;
  const collectionHeading = (
    <div>
      <p className="eyebrow">Every card you own</p>
      <h1 className="yk-title mt-3">Collection</h1>
    </div>
  );
  return (
    <div
      className={view === "packs" ? "flex min-h-dvh w-full flex-col" : "w-full"}
    >
      {!previewData && (
        <Topbar
          view={view}
          account={account}
          name={info?.user.name}
          karas={info?.karasBalance}
          collection={collection}
          infoError={loadErrors.info}
          onRetryInfo={() => retries.current.info?.()}
        />
      )}
      <main
        id="main-content"
        className={`yk-game-main mx-auto px-6 ${view === "collection" ? "max-w-[var(--layout-collection-max)] py-6" : "w-full max-w-6xl flex-1 py-10"}`}
      >
        {view === "packs" ? (
          <header className="yk-pack-page-heading">
            <h1 className="yk-title mt-3">Your next great pull.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-ink-2">
              New Yokkai, new stories, always something to discover.
            </p>
          </header>
        ) : (
          !status && collectionHeading
        )}
        {error && (
          <p
            role="alert"
            className="my-6 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger-ink"
          >
            {error}
          </p>
        )}
        {Object.entries(loadErrors)
          .filter(
            ([key, message]) =>
              message && !["regular", "decision", "info"].includes(key)
          )
          .map(([key, message]) => (
            <p key={key} role="alert" className="my-4 text-sm text-danger-ink">
              {key === "collection"
                ? "Collection"
                : key === "folders"
                  ? "Folders"
                  : "Auctions"}{" "}
              : {message}{" "}
              <button
                className="yk-button yk-button-secondary"
                onClick={() => retries.current[key]?.()}
              >
                Try again
              </button>
            </p>
          ))}
        {previewData && info && (
          <p data-proof="info">
            {info.user.name} · {info.karasBalance} Karas
          </p>
        )}
        {previewData && loadErrors.info && (
          <p data-proof="info-error" role="alert">
            {loadErrors.info}{" "}
            <button onClick={() => retries.current.info?.()}>Try again</button>
          </p>
        )}
        {!status && !error && !loadErrors.regular && (
          <p role="status" className="mt-10">
            Loading…
          </p>
        )}
        {view === "packs" && (
          <Boosters
            releasedOpening
            clickToOpen
            onOpenMany={
              previewData ? undefined : count => open("regular", count)
            }
            status={status}
            statusError={loadErrors.regular}
            decisionError={loadErrors.decision}
            onRetryRegular={() => retries.current.regular?.()}
            onRetryDecision={() => retries.current.decision?.()}
            collectionReady={collectionReady}
            countdown={countdown}
            decisionStatus={decisionStatus}
            decisionCountdown={decisionCountdown}
            dropRates={info?.dropRates}
            decisionDropRates={info?.decisionDropRates}
            shinyRate={info?.shinyRate}
            busy={busy}
            draw={draw}
            drawKind={drawKind}
            collection={collection}
            folders={folders}
            revealed={revealed}
            onOpen={
              previewData
                ? async kind => {
                    const cards: CollectedCard[] = [
                      {
                        id: "proof-card",
                        instanceId: "proof-instance",
                        name: "Carte de preuve",
                        rarity: "C",
                        category: "Anime",
                        image: "/assets/booster-pack.png",
                        catalogueImage: "/assets/booster-pack.png",
                        customImageUrl: null,
                        obtainedAt: new Date().toISOString(),
                        shiny: false,
                        isEvolved: false,
                        isFirstOwner: true,
                        folderId: null
                      }
                    ];
                    setDraw(cards);
                    setDrawKind(kind);
                    setRevealed(0);
                    return cards;
                  }
                : open
            }
            onKeepDecision={previewData ? async () => 0 : keepDecision}
            onDiscard={previewData ? async () => {} : discard}
            onAuction={auctionCard}
            onMoveCard={moveCard}
            onSetLocked={lockCard}
            onEvolve={evolve}
            onSetCustomImage={customizeCard}
            onReveal={revealCard}
            onSound={sound.play}
          />
        )}

        {view === "collection" && status && (
          <CollectionView
            pageHeading={collectionHeading}
            cards={collection}
            categories={info?.categories || []}
            loadPaniniAlbums={getPaniniAlbumsPage}
            loadPaniniAlbumCards={getPaniniAlbumCardsPage}
            onSetPaniniAlbumFavorite={setPaniniAlbumFavorite}
            presentation={Object.fromEntries(
              activeAuctionCards.map(auction => [
                auction.instanceId,
                {
                  frozen: { remaining: auction.endsAt },
                  auctionId: auction.auctionId
                }
              ])
            )}
            folders={folders}
            onCreateFolder={addFolder}
            onDeleteFolder={removeFolder}
            onMoveCard={moveCard}
            onMoveCards={moveCards}
            onSetLocked={lockCard}
            onCreateAuction={auctionCard}
            onEvolve={evolve}
            onSetCustomImage={customizeCard}
            onDiscard={discardCollectionCard}
            onDiscardMany={discardCollectionCards}
          />
        )}
      </main>
      <SiteFooter
        note="Your collection is saved to your account"
        discordEnabled={discordEnabled}
      />
    </div>
  );
}
