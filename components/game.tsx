"use client";
import Link from "next/link";
import { Boosters } from "@/components/boosters";
import { Topbar } from "@/components/topbar";
import { YokaiCard } from "@/components/yokai-card";
import { useCallback, useEffect, useRef, useState } from "react";
import { getGameInfo, getPackStatus, getUserCollection, openBooster, type Card, type CollectedCard, type PackStatus } from "@/lib/data/cards";

type Info = Awaited<ReturnType<typeof getGameInfo>>;
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
function CardFace({ card }: { card: Card }) {
  return <YokaiCard rarity={card.rarity} name={card.name} image={card.image} category={card.category} />;
}
export function Game({ view }: { view: "packs" | "collection" }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [collection, setCollection] = useState<CollectedCard[]>([]);
  const [draw, setDraw] = useState<CollectedCard[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [category, setCategory] = useState("");
  const [rarity, setRarity] = useState("");
  const [selected, setSelected] = useState<CollectedCard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const opening = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const selectedTrigger = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    if (!selected) return;
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selected]);
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
  const filtered = collection.filter(c => (!category || c.category === category) && (!rarity || c.rarity === rarity));
  return <div className="w-full">
    <Topbar view={view} name={info?.user.name} collection={collection} />
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-10"><p className="eyebrow">{view === "packs" ? "Une ouverture. Dix découvertes." : "Chaque carte a son histoire."}</p><h1 className="yk-title mt-3">{view === "packs" ? "Invoquez votre destin." : "Ma collection"}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/50">{view === "packs" ? "Anime, sport ou cinéma : ouvrez votre pack et découvrez les cartes qui rejoindront votre collection." : `${collection.length} cartes obtenues · Les plus rares en premier · Les doublons sont conservés.`}</p>
    {error && <p role="alert" className="my-6 rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}{!status && !error && <p role="status" className="mt-10">Chargement…</p>}
    {view === "packs" && <Boosters status={status} countdown={countdown} rates={info?.dropRates} busy={busy} draw={draw} revealed={revealed} onOpen={open} onReveal={revealCard} onRevealAll={revealAll} />}

    {view === "collection" && status && <section aria-label="Collection de cartes">
      <div className="my-8 flex flex-wrap items-end gap-4">
        <label className="text-xs text-white/60">Catégorie
          <select value={category} onChange={e => setCategory(e.target.value)} aria-controls="collection-cards">
            <option value="">Toutes les catégories</option>
            {info?.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-xs text-white/60">Rareté
          <select value={rarity} onChange={e => setRarity(e.target.value)} aria-controls="collection-cards">
            <option value="">Toutes les raretés</option>
            {info?.rarities.slice().reverse().map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <button type="button" className="rounded-lg border border-white/20 px-4 py-3 text-sm disabled:opacity-40" disabled={!category && !rarity} onClick={() => { setCategory(""); setRarity(""); }}>
          Réinitialiser les filtres
        </button>
        <p role="status" aria-atomic="true" className="pb-3 text-xs text-white/60">
          {filtered.length} {filtered.length > 1 ? "cartes affichées" : "carte affichée"} sur {collection.length}
        </p>
      </div>
      {filtered.length === 0 && <div className="rounded-xl border border-dashed border-white/15 px-6 py-16 text-center">
        <p>{collection.length === 0 ? "Votre collection commence ici." : "Aucune carte ne correspond à ces filtres."}</p>
        {collection.length === 0
          ? <Link className="mt-4 inline-block text-sm text-lime-300" href="/">Ouvrir mon premier pack →</Link>
          : <p className="mt-3 text-sm text-white/60">Modifiez la catégorie ou la rareté, ou réinitialisez les filtres.</p>}
      </div>}
      <ul id="collection-cards" className="card-grid" aria-label="Cartes obtenues, des plus rares aux plus communes">
        {filtered.map(card => <li key={card.instanceId} className="flex min-w-0 flex-col">
          <button type="button" className="collection-card w-full flex-1 text-left" onClick={event => { selectedTrigger.current = event.currentTarget; setSelected(card); }} aria-haspopup="dialog" aria-controls="card-detail" aria-label={`Voir ${card.name}, ${card.rarity}`}>
            <CardFace card={card} />
          </button>
          <p className="mt-3 text-xs leading-5 text-white/60">Obtenue le <time dateTime={card.obtainedAt}>{date(card.obtainedAt)}</time></p>
        </li>)}
      </ul>
    </section>}

    </main><footer className="mt-6 flex flex-wrap justify-between gap-3 border-t border-white/10 py-6 text-xs text-white/35"><span>Yokkai Collec’ · Prototype v0.1</span><span>Sauvegarde dans ce navigateur · Illustrations temporaires</span></footer>
    <dialog
      id="card-detail"
      ref={dialog}
      onClose={() => {
        setSelected(null);
        selectedTrigger.current?.focus({ preventScroll: true });
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        // The dialog's own padding is part of the content, not the backdrop.
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) {
          event.currentTarget.close();
        }
      }}
      aria-labelledby="card-title"
      className="card-dialog"
    >
      {selected && <>
        <button type="button" autoFocus aria-label="Fermer le détail" className="mb-5 ml-auto block rounded-md px-3 py-2 text-sm text-white/80" onClick={() => dialog.current?.close()}>
          Fermer <span aria-hidden="true">✕</span>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selected.image} alt={`Illustration temporaire : ${selected.name}`} width={300} height={360} className="mx-auto w-full max-w-48 rounded-lg" />
        <h2 id="card-title" className="mt-5 text-xl font-bold">{selected.name}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><dt className="text-white/60">Catégorie</dt><dd>{selected.category}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/60">Rareté</dt><dd>{selected.rarity}</dd></div>
          <div><dt className="text-white/60">Date d’obtention</dt><dd className="mt-1"><time dateTime={selected.obtainedAt}>{date(selected.obtainedAt)}</time></dd></div>
        </dl>
      </>}
    </dialog>
  </div>;
}
