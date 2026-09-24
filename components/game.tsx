"use client";
import { CollectionView } from "@/components/collection";
import { Boosters } from "@/components/boosters";
import { Topbar } from "@/components/topbar";
import { useCallback, useEffect, useRef, useState } from "react";
import { getGameInfo, getPackStatus, getUserCollection, openBooster, type CollectedCard, type PackStatus } from "@/lib/data/cards";

type Info = Awaited<ReturnType<typeof getGameInfo>>;
export function Game({ view }: { view: "packs" | "collection" }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [collection, setCollection] = useState<CollectedCard[]>([]);
  const [draw, setDraw] = useState<CollectedCard[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const opening = useRef(false);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const [game, packs, cards] = await Promise.all([getGameInfo(), getPackStatus(), getUserCollection()]);
        if (active) { setInfo(game); setStatus(packs); setCollection(cards); setNow(Date.now()); setError(""); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Impossible de charger la partie."); }
    }
    void refresh();
    const interval = window.setInterval(refresh, 1000);
    window.addEventListener("storage", refresh);
    return () => { active = false; clearInterval(interval); window.removeEventListener("storage", refresh); };
  }, []);
  async function open() {
    if (opening.current || (draw.length > 0 && revealed < draw.length)) return;
    opening.current = true; setBusy(true); setError("");
    try {
      setDraw(await openBooster()); setRevealed(0);
      setStatus(await getPackStatus()); setCollection(await getUserCollection());
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’ouvrir le pack."); }
    finally { opening.current = false; setBusy(false); }
  }
  const revealCard = useCallback((index: number) => setRevealed(current => current === index ? current + 1 : current), []);
  const revealAll = useCallback(() => setRevealed(draw.length), [draw.length]);
  const seconds = status?.nextPackAt ? Math.max(0, Math.ceil((status.nextPackAt - now) / 1000)) : 0;
  const countdown = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return <div className="w-full">
    <Topbar view={view} name={info?.user.name} collection={collection} />
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-10"><p className="eyebrow">{view === "packs" ? "Une ouverture. Dix découvertes." : "Grimoire"}</p><h1 className="yk-title mt-3">{view === "packs" ? "Invoquez votre destin." : "Ma collection"}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-ink-2">{view === "packs" ? "Anime, sport ou cinéma : ouvrez votre pack et découvrez les cartes qui rejoindront votre collection." : `${collection.length} cartes obtenues · Les plus rares en premier · Les doublons sont conservés.`}</p>
    {error && <p role="alert" className="my-6 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger-ink">{error}</p>}{!status && !error && <p role="status" className="mt-10">Chargement…</p>}
    {view === "packs" && <Boosters status={status} countdown={countdown} rates={info?.dropRates} busy={busy} draw={draw} collection={collection} revealed={revealed} onOpen={open} onReveal={revealCard} onRevealAll={revealAll} />}

    {view === "collection" && status && <CollectionView cards={collection} categories={info?.categories || []} />}

    </main><footer className="mx-auto mt-6 flex w-full max-w-6xl flex-wrap justify-between gap-3 border-t border-veil px-6 py-6 text-xs text-ink-3"><span>Yokkai Collec’ · Prototype v0.1</span><span>Sauvegarde dans ce navigateur · Illustrations temporaires</span></footer>
  </div>;
}
