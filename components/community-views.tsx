"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { animation } from "@/lib/ui/animations";
import {
  getCataloguePage,
  getGameInfo,
  getUserCollection,
  invalidatePlayerSnapshots,
  type Card,
  type CollectedCard,
  type Rarity
} from "@/lib/data/cards";
import { notificationItem, Topbar } from "@/components/topbar";
import {
  Avatar,
  Button,
  Karas,
  Modal,
  Pagination,
  StatusPill
} from "@/components/ui";
import { YokaiCard } from "@/components/yokai-card";
import { CardShell } from "@/components/card-shell";
import { CardReportButton } from "@/components/card-report-button";
import { GifPicker, type GifChoice } from "@/components/gif-picker";
import { CARD_PAGE_SIZES } from "@/lib/ui/pagination";
import {
  auctionReconciliationScopes,
  cancelAuction,
  getAuction,
  getAuctionChat,
  getAuctions,
  placeBid,
  sendAuctionChatMessage,
  toggleWatch,
  type AuctionData,
  type AuctionDetail
} from "@/lib/data/market";
import { subscribePlayerSnapshotInvalidation } from "@/lib/data/player-state";
import { TradesPanel } from "@/components/trades";
import { type ModerationAdapter } from "@/lib/data/moderation";
import { PlayerModeration } from "@/components/player-moderation";
import { FriendsPanel } from "@/components/friends";
import { ProfileExperience } from "@/components/profile";
import {
  getCardDiscovery,
  getWishlist,
  toggleWishlist,
  type CardDiscovery,
  type CardOwner,
  type WishlistCard
} from "@/lib/data/wishlist";
import { markNotificationRead } from "@/lib/data/notifications";
import { useNotificationFeed } from "@/hooks/use-notification-feed";
import { matchesCardSearch } from "@/lib/ui/card-search";

export type CommunityScreen =
  | "profile"
  | "friends"
  | "market"
  | "auction"
  | "trades"
  | "search"
  | "wishlist";
const headings = {
  profile: ["Collectionneur", "Mon profil"],
  friends: ["Entre collectionneurs", "Mes amis"],
  market: ["La salle des ventes", "Marché"],
  auction: ["Marché · Enchère", "Détail de l’enchère"],
  trades: ["Entre collectionneurs", "Proposer un échange"],
  search: ["Toutes les cartes du jeu", "Catalogue"],
  wishlist: ["Les cartes convoitées", "Ma wishlist"]
};
function Unavailable({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="yk-empty-state">
      <span
        aria-hidden="true"
        className="font-display text-3xl text-accent-gold"
      >
        ✦
      </span>
      <p className="mt-4 max-w-md text-sm leading-6 text-ink-2">{children}</p>
    </div>
  );
}

const catalogueRarities: Rarity[] = ["LR", "SSR", "SR", "R", "C"];
const catalogueRarityText: Record<Rarity, string> = {
  C: "text-rarity-c",
  R: "text-rarity-r",
  SR: "text-rarity-sr",
  SSR: "text-rarity-ssr",
  LR: "text-rarity-lr"
};
function CatalogueFilterSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="yk-filter-section" open>
      <summary>
        {title}
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
      </summary>
      <div className="yk-filter-section-content">{children}</div>
    </details>
  );
}

function CardOwnerList({
  title,
  owners
}: {
  title: string;
  owners: CardOwner[];
}) {
  return (
    <div className="yk-catalogue-owner-group">
      <h4>{title}</h4>
      {owners.length ? (
        <ul>
          {owners.map(owner => (
            <li key={owner.id}>
              <Link href={`/profil/${owner.id}`} title={owner.pseudo}>
                <span className="yk-catalogue-owner-name">{owner.pseudo}</span>
                <span className="yk-catalogue-owner-copies">
                  {owner.copies} ex.
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>Aucun</p>
      )}
    </div>
  );
}
function CatalogueCardModal({
  selected,
  onClose,
  onWishlistChange
}: {
  selected: Card | null;
  onClose: () => void;
  onWishlistChange?: (cardId: string, wishlisted: boolean) => void;
}) {
  const [discovery, setDiscovery] = useState<{
    cardId: string;
    detail?: CardDiscovery;
    error?: string;
  }>();
  const [busy, setBusy] = useState(false);
  const detail =
    selected && discovery?.cardId === selected.id
      ? discovery.detail
      : undefined;
  const error =
    selected && discovery?.cardId === selected.id ? discovery.error : undefined;
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const cardId = selected.id;
    void getCardDiscovery(cardId).then(
      value => {
        if (active) setDiscovery({ cardId, detail: value });
      },
      e => {
        if (active)
          setDiscovery({
            cardId,
            error: e instanceof Error ? e.message : "Détail indisponible."
          });
      }
    );
    return () => {
      active = false;
    };
  }, [selected]);
  async function toggle() {
    if (!selected || busy) return;
    setBusy(true);
    setDiscovery(current =>
      current?.cardId === selected.id
        ? { ...current, error: undefined }
        : current
    );
    try {
      const wishlisted = await toggleWishlist(selected.id);
      setDiscovery(current =>
        current?.cardId === selected.id && current.detail
          ? { ...current, detail: { ...current.detail, wishlisted } }
          : current
      );
      onWishlistChange?.(selected.id, wishlisted);
    } catch (e) {
      setDiscovery({
        cardId: selected.id,
        detail,
        error: e instanceof Error ? e.message : "Action impossible."
      });
    } finally {
      setBusy(false);
    }
  }
  async function moreOwners() {
    if (!selected || !detail) return;
    try {
      const next = await getCardDiscovery(
        selected.id,
        detail.owners.length,
        12
      );
      setDiscovery({
        cardId: selected.id,
        detail: { ...next, owners: [...detail.owners, ...next.owners] }
      });
    } catch (e) {
      setDiscovery({
        cardId: selected.id,
        detail,
        error: e instanceof Error ? e.message : "Possesseurs indisponibles."
      });
    }
  }
  const friendOwners = detail?.owners.filter(owner => owner.isFriend) ?? [];
  const otherOwners = detail?.owners.filter(owner => !owner.isFriend) ?? [];
  return (
    <Modal
      open={!!selected}
      onClose={onClose}
      title={selected?.name ?? "Détail de la carte"}
      className="yk-catalogue-detail-modal"
    >
      {selected && (
        <div className="yk-detail-grid">
          <div className="yk-detail-art">
            <YokaiCard {...selected} />
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="text-sm text-ink-2">
              {selected.category} · {selected.rarity}
            </p>
            <p className="mt-2 text-sm text-ink-3">
              {selected.anime ?? "Franchise non renseignée"}
            </p>
            <p className="mt-7 text-xs text-ink-3">Valeur de marché</p>
            {detail?.marketValue != null ? (
              <Karas
                amount={Math.round(detail.marketValue)}
                className="mt-2 text-xl"
              />
            ) : (
              <p className="mt-2 text-sm text-ink-3">
                Aucune vente enregistrée
              </p>
            )}
            {detail?.activeAuctionId ? (
              <Link
                className="yk-button mt-5 flex w-full justify-center"
                href={`/marche/${detail.activeAuctionId}`}
              >
                Voir l’enchère
              </Link>
            ) : null}
            <Button
              variant="secondary"
              disabled={!detail || busy}
              className="mt-3 w-full"
              onClick={() => void toggle()}
            >
              {detail?.wishlisted
                ? "♥ Retirer de ma wishlist"
                : "♡ Ajouter à ma wishlist"}
            </Button>
            <CardReportButton
              cardId={selected.id}
              cardName={selected.name}
              className="mt-3 w-full"
            />
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            <section className="yk-catalogue-owners">
              <h3 className="font-display text-sm">
                Possesseurs actuels {detail ? `(${detail.ownerCount})` : ""}
              </h3>
              {detail?.owners.length ? (
                <div className="yk-catalogue-owner-columns">
                  <CardOwnerList title="Amis" owners={friendOwners} />
                  <CardOwnerList
                    title="Autres utilisateurs"
                    owners={otherOwners}
                  />
                </div>
              ) : detail ? (
                <p>Aucun possesseur actuellement.</p>
              ) : (
                <p>Chargement…</p>
              )}
              {detail && detail.owners.length < detail.ownerCount ? (
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => void moreOwners()}
                >
                  Afficher plus
                </Button>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </Modal>
  );
}
function CatalogueFilterIcon({ rarity }: { rarity: Rarity }) {
  return (
    <svg
      aria-hidden="true"
      className={catalogueRarityText[rarity]}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="m12 2 2.45 6.1L21 10.5l-5.25 4.05L16 21l-4-3.55L8 21l.25-6.45L3 10.5l6.55-2.4L12 2Z" />
    </svg>
  );
}

// View models receive display values from their eventual API adapters. No prices,
// minimum bids, durations, balances or auction rules are computed in these views.
export type AuctionPresentation = {
  id: string;
  card: Card;
  amount: number;
  remaining: string;
  remainingSeconds: number;
  seller: string;
  sellerId?: string | null;
  sellerAvatarUrl?: string | null;
  bids: number;
  popularity?: number;
  status?: "leading" | "outbid" | "mine" | "won" | "lost" | "sold" | "unsold";
  wishlist?: boolean;
  finished?: boolean;
  winner?: string;
  marketValue?: number;
  balance?: number;
  nextBid?: number;
  minimumBid?: number;
  progress?: number;
  antiSnipeMessage?: string;
  extended?: boolean;
  history?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    time: string;
    amount: number;
    mine?: boolean;
  }[];
};
const labels = {
  leading: "En tête",
  outbid: "Surenchéri",
  mine: "Ma vente",
  won: "Remportée",
  lost: "Perdue",
  sold: "Vendue",
  unsold: "Non vendue"
};
function AuctionStatus({
  status
}: {
  status: NonNullable<AuctionPresentation["status"]>;
}) {
  return (
    <StatusPill
      tone={
        status === "outbid" || status === "lost"
          ? "danger"
          : status === "leading" || status === "won"
            ? "success"
            : "gold"
      }
    >
      {labels[status]}
    </StatusPill>
  );
}
const urgencyClass = (seconds: number) =>
  seconds < 300
    ? "yk-urgency-critical"
    : seconds < 3600
      ? "yk-urgency-soon"
      : "";
const formatKaras = (amount: number) =>
  `${amount.toLocaleString("fr-FR")} Karas`;
function HourglassIcon() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
    </svg>
  );
}
function WatchButton({
  watched,
  onToggle,
  className = ""
}: {
  watched?: boolean;
  onToggle?: () => Promise<void>;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={!!watched}
      disabled={!onToggle || busy}
      aria-label={
        watched ? "Ne plus suivre cette enchère" : "Suivre cette enchère"
      }
      className={`yk-watch-button ${watched ? "yk-watching" : ""} ${className}`}
      onClick={async () => {
        if (!onToggle || busy) return;
        setBusy(true);
        try {
          await onToggle();
        } finally {
          setBusy(false);
        }
      }}
    >
      <svg
        aria-hidden="true"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill={watched ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z" />
      </svg>
      <span className="yk-watch-label">{watched ? "Suivi" : "Suivre"}</span>
    </button>
  );
}
function AuctionTile({
  auction: a,
  onToggleWatch
}: {
  auction: AuctionPresentation;
  onToggleWatch?: (id: string) => Promise<void>;
}) {
  return (
    <li className="yk-market-tile">
      <Link
        href={`/marche/${a.id}`}
        className="yk-market-tile-link"
        aria-label={`Voir l’enchère ${a.card.name}, ${formatKaras(a.amount)}, ${a.finished ? "terminée" : `fin dans ${a.remaining}`}`}
      >
        <CardShell>
          <YokaiCard {...a.card} imageSizes="100vw" />
        </CardShell>
        <div className="yk-market-tile-meta">
          <span className="yk-market-seller">
            <Avatar
              name={a.seller}
              image={a.sellerAvatarUrl ?? undefined}
              size={26}
            />
            <span className="truncate">{a.seller}</span>
          </span>
          <div className="yk-market-tile-line">
            <span
              className={`yk-market-timer ${a.finished ? "" : urgencyClass(a.remainingSeconds)}`}
            >
              <HourglassIcon />
              {a.finished ? "Terminée" : a.remaining}
            </span>
            <span className="yk-market-tile-state">
              {a.status && <AuctionStatus status={a.status} />}
            </span>
            <Karas amount={a.amount} className="yk-market-price" />
          </div>
        </div>
      </Link>
      <WatchButton
        watched={a.wishlist}
        onToggle={onToggleWatch ? () => onToggleWatch(a.id) : undefined}
        className="yk-market-tile-watch"
      />
    </li>
  );
}

const marketEmptyStates = {
  mine: {
    title: "Aucune enchère en cours pour le moment",
    text: "Tu n’as aucune vente active ni aucune enchère en tête.",
    action: "Parcourir le marché"
  },
  won: {
    title: "Tu n’as pas encore remporté d’enchère",
    text: "Les cartes que tu remportes apparaîtront ici.",
    action: "Voir les fins imminentes"
  },
  sold: {
    title: "Aucune vente terminée pour l’instant",
    text: "Tes ventes terminées, vendues ou non, apparaîtront ici.",
    action: "Mettre une carte en vente"
  }
} as const;
export type MarketSort = "end" | "asc" | "desc" | "popular";
export function compareMarketAuctions(
  a: AuctionPresentation,
  b: AuctionPresentation,
  sort: MarketSort
) {
  return sort === "asc"
    ? a.amount - b.amount
    : sort === "desc"
      ? b.amount - a.amount
      : sort === "popular"
        ? (b.popularity ?? 0) - (a.popularity ?? 0) ||
          a.remainingSeconds - b.remainingSeconds ||
          a.id.localeCompare(b.id)
        : a.remainingSeconds - b.remainingSeconds;
}
export function MarketView({
  lists,
  activeSales,
  onToggleWatch
}: {
  lists?: Record<"active" | "mine" | "won" | "sold", AuctionPresentation[]>;
  activeSales?: string;
  onToggleWatch?: (id: string) => Promise<void>;
}) {
  const [section, setSection] = useState<"browse" | "mine">("browse");
  const [mineTab, setMineTab] = useState<"mine" | "won" | "sold">("mine");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [sort, setSort] = useState<MarketSort>("end");
  const [category, setCategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const matches = (a: AuctionPresentation) =>
    matchesCardSearch(query, [a.card.name, a.card.anime]) &&
    (!rarity || a.card.rarity === rarity) &&
    (!category || a.card.category === category);
  const categories = [
    ...new Set(
      (section === "browse" ? lists?.active : lists?.[mineTab])?.map(
        a => a.card.category
      )
    )
  ].sort();
  const filtered = !!(query || rarity || category);
  const browse = lists?.active
    .filter(matches)
    .sort((a, b) => compareMarketAuctions(a, b, sort));
  const mine = lists?.[mineTab].filter(matches);
  const mineCount = lists
    ? lists.mine.length + lists.won.length + lists.sold.length
    : undefined;
  const empty = marketEmptyStates[mineTab];
  const shown = section === "browse" ? browse : mine;
  const plural = (shown?.length ?? 0) > 1 ? "s" : "";
  const heading = !shown
    ? "Chargement des enchères…"
    : section === "browse"
      ? `${shown.length.toLocaleString("fr-FR")} carte${plural} aux enchères`
      : `${shown.length.toLocaleString("fr-FR")} enchère${plural} ${mineTab === "mine" ? "en cours" : mineTab === "won" ? `gagnée${plural}` : `terminée${plural}`}`;
  const filters = (
    <>
      <div className="yk-filter-search">
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <label className="sr-only" htmlFor="market-query">
          Rechercher dans le marché
        </label>
        <input
          id="market-query"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher…"
        />
      </div>
      <div className="yk-market-filter-scroll">
        {section === "mine" && (
          <CatalogueFilterSection title="Statut">
            {(
              [
                ["mine", "En cours"],
                ["won", "Gagnées"],
                ["sold", "Terminées"]
              ] as const
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                className="yk-filter-option"
                aria-pressed={mineTab === key}
                onClick={() => setMineTab(key)}
              >
                <span className="yk-filter-check" />
                <span>{label}</span>
                {lists && <strong>{lists[key].length}</strong>}
              </button>
            ))}
          </CatalogueFilterSection>
        )}
        <CatalogueFilterSection title="Rareté">
          <button
            type="button"
            className="yk-filter-option"
            aria-pressed={!rarity}
            onClick={() => setRarity("")}
          >
            <span className="yk-filter-check" />
            <span>Toutes</span>
          </button>
          {catalogueRarities.map(r => (
            <button
              type="button"
              key={r}
              className="yk-filter-option"
              aria-pressed={rarity === r}
              onClick={() => setRarity(r)}
            >
              <span className="yk-filter-check" />
              <CatalogueFilterIcon rarity={r} />
              <span className={catalogueRarityText[r]}>{r}</span>
            </button>
          ))}
        </CatalogueFilterSection>
        <CatalogueFilterSection title="Catégorie">
          <button
            type="button"
            className="yk-filter-option"
            aria-pressed={!category}
            onClick={() => setCategory("")}
          >
            <span className="yk-filter-check" />
            <span>Toutes les catégories</span>
          </button>
          {categories.map(item => (
            <button
              type="button"
              key={item}
              className="yk-filter-option"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              <span className="yk-filter-check" />
              <span>{item}</span>
            </button>
          ))}
        </CatalogueFilterSection>
        {section === "browse" && (
          <CatalogueFilterSection title="Trier par">
            {(
              [
                ["end", "Fin imminente"],
                ["asc", "Prix croissant"],
                ["desc", "Prix décroissant"],
                ["popular", "Les + populaires"]
              ] as const
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                className="yk-filter-option"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
              >
                <span className="yk-filter-check" />
                <span>{label}</span>
              </button>
            ))}
          </CatalogueFilterSection>
        )}
      </div>
      <button
        type="button"
        className="yk-filter-reset"
        disabled={!(filtered || (section === "browse" && sort !== "end"))}
        onClick={() => {
          setQuery("");
          setRarity("");
          setCategory("");
          setSort("end");
        }}
      >
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Réinitialiser les filtres
      </button>
    </>
  );
  return (
    <section aria-label="Marché aux enchères" className="yk-market">
      <div className="yk-catalogue-heading">
        <div>
          <p role="status" className="font-display text-xl">
            {heading}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            {filtered
              ? "Résultats correspondant à vos filtres"
              : section === "browse"
                ? "Toutes les enchères en cours"
                : "Tes ventes et tes mises"}
          </p>
        </div>
      </div>
      {filtersOpen && (
        <button
          type="button"
          className="yk-filter-backdrop"
          aria-label="Fermer les filtres"
          onClick={() => setFiltersOpen(false)}
        />
      )}
      <div className="yk-collection-layout">
        <aside
          id="market-filters"
          className={`yk-collection-sidebar yk-market-sidebar ${filtersOpen ? "yk-sidebar-open" : ""}`}
          aria-label="Filtres du marché"
        >
          <div className="yk-sidebar-mobile-head">
            <strong>Filtres</strong>
            <button
              type="button"
              aria-label="Fermer les filtres"
              onClick={() => setFiltersOpen(false)}
            >
              ×
            </button>
          </div>
          {filters}
        </aside>
        <div className="yk-collection-main">
          <div className="yk-collection-toolbar yk-market-toolbar-band">
            <button
              type="button"
              className="yk-mobile-filter-trigger"
              aria-expanded={filtersOpen}
              aria-controls="market-filters"
              onClick={() => setFiltersOpen(true)}
            >
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filtres{filtered ? <span>•</span> : null}
            </button>
            <div
              className="yk-market-sections"
              role="tablist"
              aria-label="Sections du marché"
            >
              {(
                [
                  ["browse", "Enchères", lists?.active.length],
                  ["mine", "Mes enchères", mineCount]
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={section === key}
                  className="yk-market-section"
                  onClick={() => {
                    setSection(key);
                    setCategory("");
                  }}
                >
                  {label}
                  {count != null && <span>{count}</span>}
                </button>
              ))}
            </div>
            <div className="yk-market-band-actions">
              <StatusPill>Mes ventes actives · {activeSales ?? "—"}</StatusPill>
              <Link
                href="/collection"
                className="yk-button yk-button-secondary"
              >
                + Vendre une carte
              </Link>
            </div>
          </div>
          {section === "browse" ? (
            !browse ? (
              <Unavailable>Chargement des enchères…</Unavailable>
            ) : !browse.length ? (
              <Unavailable>
                {filtered
                  ? "Aucune enchère ne correspond à votre recherche et vos filtres."
                  : "Aucune enchère en cours pour le moment."}
              </Unavailable>
            ) : (
              <ul
                className="yk-card-grid yk-market-list"
                aria-label="Enchères en cours"
              >
                {browse.map(a => (
                  <AuctionTile
                    key={a.id}
                    auction={a}
                    onToggleWatch={onToggleWatch}
                  />
                ))}
              </ul>
            )
          ) : !lists || !mine ? (
            <Unavailable>Chargement de tes enchères…</Unavailable>
          ) : !lists[mineTab].length ? (
            <div role="status" className="yk-empty-state">
              <span
                aria-hidden="true"
                className="font-display text-3xl text-accent-gold"
              >
                ✦
              </span>
              <p className="mt-4 font-display text-lg">{empty.title}</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-2">
                {empty.text}
              </p>
              {mineTab === "sold" ? (
                <Link
                  href="/collection"
                  className="yk-button yk-button-secondary mt-6"
                >
                  {empty.action}
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-6"
                  onClick={() => {
                    setSection("browse");
                    setSort("end");
                  }}
                >
                  {empty.action}
                </Button>
              )}
            </div>
          ) : !mine.length ? (
            <Unavailable>
              Aucune enchère ne correspond à votre recherche et vos filtres.
            </Unavailable>
          ) : (
            <ul
              className="yk-card-grid yk-market-list"
              aria-label={`Mes enchères · ${empty.action}`}
            >
              {mine.map(a => (
                <AuctionTile
                  key={a.id}
                  auction={a}
                  onToggleWatch={onToggleWatch}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
function AuctionOutcome({ auction }: { auction: AuctionPresentation }) {
  const won = auction.status === "won" || auction.status === "leading";
  const lost = auction.status === "lost" || auction.status === "outbid";
  if (won)
    return (
      <div role="status" className="yk-auction-outcome yk-outcome-won">
        <p className="yk-outcome-badge">Enchère remportée !</p>
        <p className="mt-2 text-sm text-ink-2">
          {auction.card.name} rejoint ta collection pour{" "}
          {formatKaras(auction.amount)}.
        </p>
        <Link href="/collection" className="yk-button yk-button-secondary mt-4">
          Voir ma collection
        </Link>
      </div>
    );
  if (lost)
    return (
      <div role="status" className="yk-auction-outcome yk-outcome-lost">
        <p className="yk-outcome-badge">Enchère perdue</p>
        <p className="mt-2 text-sm text-ink-2">
          {auction.winner
            ? `Remportée par ${auction.winner} pour ${formatKaras(auction.amount)}.`
            : "Une autre offre l’a emporté."}{" "}
          Tes Karas misés t’ont été rendus.
        </p>
        <Link href="/marche" className="yk-button yk-button-secondary mt-4">
          Retour au marché
        </Link>
      </div>
    );
  if (
    auction.status === "sold" ||
    (auction.status === "mine" && auction.winner)
  )
    return (
      <div role="status" className="yk-auction-outcome yk-outcome-won">
        <p className="yk-outcome-badge">Carte vendue</p>
        <p className="mt-2 text-sm text-ink-2">
          Vendue à {auction.winner ?? "un joueur"} pour{" "}
          {formatKaras(auction.amount)}.
        </p>
      </div>
    );
  if (auction.status === "unsold")
    return (
      <div role="status" className="yk-auction-outcome">
        <p className="yk-outcome-badge">Aucune offre</p>
        <p className="mt-2 text-sm text-ink-2">
          La carte est revenue dans ta collection.
        </p>
      </div>
    );
  return (
    <div role="status" className="yk-auction-outcome">
      <p className="yk-outcome-badge">Enchère terminée</p>
      <p className="mt-2 text-sm text-ink-2">
        {auction.winner
          ? `Remportée par ${auction.winner} pour ${formatKaras(auction.amount)}.`
          : "Aucune offre n’a été placée."}
      </p>
    </div>
  );
}
export type AuctionChatAdapter = {
  get: typeof getAuctionChat;
  send: typeof sendAuctionChatMessage;
  moderation?: ModerationAdapter;
};
const liveAuctionChat: AuctionChatAdapter = {
  get: getAuctionChat,
  send: sendAuctionChatMessage
};
export function AuctionChatPanel({
  auctionId,
  refreshKey,
  finished,
  adapter = liveAuctionChat
}: {
  auctionId: string;
  refreshKey: number;
  finished: boolean;
  adapter?: AuctionChatAdapter;
}) {
  const [reportMessage, setReportMessage] = useState("");
  const [chat, setChat] =
    useState<Awaited<ReturnType<typeof getAuctionChat>>>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const mentionIndexRef = useRef(0);
  const mentionMatch = draft.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1].toLocaleLowerCase("fr");
  const hasMention = !!mentionMatch;
  const mentionOptions = useMemo(
    () =>
      hasMention
        ? (chat?.participants
            .filter(
              participant =>
                !participant.mine &&
                participant.pseudo
                  .toLocaleLowerCase("fr")
                  .startsWith(mentionQuery ?? "")
            )
            .slice(0, 5) ?? [])
        : [],
    [chat?.participants, hasMention, mentionQuery]
  );
  const load = useCallback(async () => {
    try {
      setChat(await adapter.get(auctionId));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat indisponible.");
    }
  }, [auctionId, adapter]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void adapter.get(auctionId).then(
        value => {
          if (active) {
            setChat(value);
            setError("");
          }
        },
        reason => {
          if (active)
            setError(
              reason instanceof Error ? reason.message : "Chat indisponible."
            );
        }
      );
    };
    const frame = window.requestAnimationFrame(refresh);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 3000);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [auctionId, refreshKey, adapter]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chat?.messages.length]);
  useEffect(() => {
    const textarea = document.getElementById("auction-chat-message");
    if (
      !(textarea instanceof HTMLTextAreaElement) ||
      mentionOptions.length === 0
    )
      return;
    mentionIndexRef.current = 0;
    const markSelected = () =>
      document
        .querySelectorAll<HTMLButtonElement>("#auction-mention-options button")
        .forEach((button, index) =>
          button.setAttribute(
            "aria-selected",
            String(index === mentionIndexRef.current)
          )
        );
    markSelected();
    const navigate = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        mentionIndexRef.current =
          (mentionIndexRef.current +
            (event.key === "ArrowDown" ? 1 : -1) +
            mentionOptions.length) %
          mentionOptions.length;
        markSelected();
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        selectMention(mentionOptions[mentionIndexRef.current].pseudo);
      }
    };
    textarea.addEventListener("keydown", navigate);
    return () => textarea.removeEventListener("keydown", navigate);
  }, [mentionOptions]);
  async function send(gif?: GifChoice) {
    const message = draft.trim();
    if ((!message && !gif) || busy) return;
    setBusy(true);
    setError("");
    try {
      const sent = await adapter.send(auctionId, message, gif?.url);
      setChat(current =>
        current
          ? { ...current, messages: [...current.messages, sent] }
          : current
      );
      setDraft("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Message impossible à envoyer."
      );
      await load();
    } finally {
      setBusy(false);
    }
  }
  function selectMention(pseudo: string) {
    setDraft(current => current.replace(/@([^\s@]*)$/, `@${pseudo} `));
  }
  // The transient list is rebuilt from the current @query; no option persists as selected.
  // eslint-disable-next-line jsx-a11y/role-has-required-aria-props, @next/next/no-img-element -- preserve animated GIPHY media without optimization.
  return (
    <section
      id="chat-enchere"
      className="yk-auction-chat"
      aria-label="Chat de l’enchère"
    >
      <div className="yk-auction-chat-head">
        <div>
          <h2 className="yk-section-title">Chat de l’enchère</h2>
          <p>Le vendeur et les enchérisseurs peuvent écrire.</p>
        </div>
        <span>
          {chat?.messages.length ?? 0} message
          {chat?.messages.length === 1 ? "" : "s"}
        </span>
      </div>
      {!chat && !error ? (
        <p className="yk-auction-chat-empty">Chargement du chat…</p>
      ) : chat?.messages.length ? (
        <ol ref={listRef} className="yk-auction-chat-list" aria-live="polite">
          {chat.messages.map(item => (
            <li key={item.id} className={item.mine ? "is-mine" : undefined}>
              <Avatar
                name={item.pseudo}
                image={item.avatarUrl ?? undefined}
                size={30}
              />
              <div>
                <p>
                  <Link href={`/profil/${encodeURIComponent(item.pseudo)}`}>
                    {item.mine ? "Vous" : item.pseudo}
                  </Link>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </time>
                </p>
                {item.gifUrl ? (
                  <img
                    className="yk-auction-chat-gif"
                    src={item.gifUrl}
                    alt="GIF partagé"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span>{item.message}</span>
                )}
                {!item.mine && (
                  <PlayerModeration
                    userId={item.userId}
                    pseudo={item.pseudo}
                    contextId={item.id}
                    adapter={adapter.moderation}
                    onReported={() =>
                      setReportMessage("Merci, ton signalement a été transmis.")
                    }
                    onBlocked={() => void load()}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : chat ? (
        <p className="yk-auction-chat-empty">Aucun message pour le moment.</p>
      ) : null}
      {reportMessage && (
        <p role="status" className="text-sm text-ink-2">
          {reportMessage}
        </p>
      )}
      {error && (
        <p role="alert" className="yk-auction-alert">
          {error}
        </p>
      )}
      {chat?.canPost && !finished ? (
        <form
          className="yk-auction-chat-form"
          onSubmit={event => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="auction-chat-message">
            Votre message
          </label>
          <div className="yk-auction-chat-composer">
            <textarea
              id="auction-chat-message"
              maxLength={500}
              rows={2}
              value={draft}
              disabled={busy}
              aria-autocomplete="list"
              aria-controls="auction-mention-options"
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Écrire un message ou @mentionner…"
            />
            {mentionOptions.length > 0 && (
              <ul
                id="auction-mention-options"
                className="yk-auction-mention-options"
                role="listbox"
                aria-label="Participants à mentionner"
              >
                {mentionOptions.map(participant => (
                  <li key={participant.userId}>
                    <button
                      type="button"
                      role="option"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => selectMention(participant.pseudo)}
                    >
                      <Avatar
                        name={participant.pseudo}
                        image={participant.avatarUrl ?? undefined}
                        size={26}
                      />
                      <span>@{participant.pseudo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <GifPicker disabled={busy} onSelect={gif => void send(gif)} />
            <span>
              {draft.length}/500 · @ pour mentionner · Entrée pour envoyer
            </span>
            <Button type="submit" disabled={busy || !draft.trim()}>
              {busy ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="yk-auction-chat-locked">
          {finished
            ? "Le chat est fermé car l’enchère est terminée."
            : "Place une mise pour pouvoir participer au chat."}
        </p>
      )}
    </section>
  );
}
export function AuctionView({
  auction,
  onBid,
  onCancel,
  onToggleWatch
}: {
  auction?: AuctionPresentation;
  onBid?: (amount: number) => Promise<void>;
  onCancel?: () => Promise<void>;
  onToggleWatch?: () => Promise<void>;
}) {
  const [offer, setOffer] = useState("");
  const [pending, setPending] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [error, setError] = useState("");
  async function bid(amount: number) {
    if (!onBid || pending) return;
    setPending(true);
    setError("");
    try {
      await onBid(amount);
      setOffer("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Impossible d’envoyer cette offre."
      );
    } finally {
      setPending(false);
    }
  }
  async function cancel() {
    if (!onCancel || pending) return;
    setPending(true);
    setError("");
    try {
      await onCancel();
      setCancelConfirm(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible de retirer cette carte de la vente."
      );
      setCancelConfirm(false);
    } finally {
      setPending(false);
    }
  }
  if (!auction)
    return (
      <Unavailable>Cette enchère est indisponible pour le moment.</Unavailable>
    );
  // Display-only comparisons of values already provided by the adapter; the RPC stays the source of truth.
  const offerValue = offer.trim() === "" ? undefined : Number(offer);
  const offerTooLow =
    offerValue != null &&
    auction.minimumBid != null &&
    (!Number.isFinite(offerValue) || offerValue < auction.minimumBid);
  const quickShort =
    auction.balance != null &&
    auction.nextBid != null &&
    auction.balance < auction.nextBid;
  const offerShort =
    offerValue != null &&
    auction.balance != null &&
    offerValue > auction.balance;
  const biddable = !!onBid && !auction.finished && auction.nextBid != null;
  const franchise = auction.card.anime?.trim() || auction.card.category;
  return (
    <div className="yk-auction-page">
      <div className="yk-auction-art">
        <YokaiCard {...auction.card} />
      </div>
      <div className="yk-auction-main">
        <header className="yk-auction-header">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-sm font-bold tracking-widest ${catalogueRarityText[auction.card.rarity]}`}
              >
                {auction.card.rarity}
              </span>
              {auction.status && <AuctionStatus status={auction.status} />}
            </div>
            <h2 className="mt-2 font-display">{auction.card.name}</h2>
            <p className="yk-auction-seller mt-2 text-sm text-ink-2">
              {franchise} · vendue par{" "}
              <Avatar
                name={auction.seller}
                image={auction.sellerAvatarUrl ?? undefined}
                size={26}
              />
              {auction.sellerId === null ? (
                <span className="font-semibold">Joueur supprimé</span>
              ) : (
                <Link
                  href={`/profil/${encodeURIComponent(auction.seller)}`}
                  className="font-semibold hover:text-accent-gold"
                >
                  {auction.seller}
                </Link>
              )}
            </p>
          </div>
          {onToggleWatch && (
            <WatchButton
              watched={auction.wishlist}
              onToggle={onToggleWatch}
              className="yk-auction-watch"
            />
          )}
        </header>
        <section className="yk-auction-panel" aria-label="Enchérir">
          <div className="yk-auction-figures">
            <div>
              <p className="yk-auction-label">Prix actuel</p>
              <Karas amount={auction.amount} className="yk-auction-price" />
              <p className="mt-1 text-xs text-ink-3">
                {auction.bids} mise{auction.bids > 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <p className="yk-auction-label">
                {auction.finished ? "Enchère terminée" : "Temps restant"}
              </p>
              <p
                className={`yk-auction-countdown font-display ${auction.finished ? "" : urgencyClass(auction.remainingSeconds)} ${auction.extended ? "yk-countdown-extended" : ""}`}
                aria-live="off"
              >
                {auction.finished ? "00:00:00" : auction.remaining}
              </p>
            </div>
          </div>
          {auction.extended && !auction.finished && (
            <p role="status" className="yk-auction-extension">
              <HourglassIcon />
              Une minute a été ajoutée à l’enchère.
            </p>
          )}
          {!auction.extended &&
            auction.antiSnipeMessage &&
            !auction.finished && (
              <p className="yk-auction-hint">
                <HourglassIcon />
                {auction.antiSnipeMessage}
              </p>
            )}
          {auction.finished ? (
            <AuctionOutcome auction={auction} />
          ) : auction.nextBid == null ? (
            <>
              <p className="yk-auction-hint">
                C’est ta vente : tu ne peux pas enchérir dessus. Les offres des
                autres joueurs apparaissent dans l’historique.
              </p>
              {onCancel &&
                (auction.bids === 0 ? (
                  <Button
                    variant="danger"
                    disabled={pending}
                    onClick={() => setCancelConfirm(true)}
                  >
                    Retirer la carte de la vente
                  </Button>
                ) : (
                  <p className="yk-auction-alert">
                    Cette carte ne peut plus être retirée car une mise a déjà
                    été placée.
                  </p>
                ))}
            </>
          ) : (
            <>
              <Button
                className="yk-bid-quick"
                disabled={!biddable || pending || quickShort}
                aria-busy={pending || undefined}
                onClick={() => void bid(auction.nextBid!)}
              >
                +10 Karas<span>· {formatKaras(auction.nextBid)}</span>
              </Button>
              <form
                className="yk-auction-offer"
                onSubmit={event => {
                  event.preventDefault();
                  if (offerValue != null && !offerTooLow && !offerShort)
                    void bid(offerValue);
                }}
              >
                <label htmlFor="bid" className="yk-auction-label">
                  Ou saisis un montant
                </label>
                <div className="yk-auction-offer-row">
                  <input
                    id="bid"
                    type="number"
                    inputMode="numeric"
                    min={auction.minimumBid}
                    value={offer}
                    disabled={!biddable || pending}
                    onChange={e => setOffer(e.target.value)}
                    placeholder={
                      auction.minimumBid == null
                        ? "Ton offre"
                        : `Minimum ${auction.minimumBid.toLocaleString("fr-FR")}`
                    }
                    aria-invalid={offerTooLow || offerShort || undefined}
                    aria-describedby="bid-help"
                    className="auth-input min-w-0"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={
                      !biddable ||
                      pending ||
                      offerValue == null ||
                      offerTooLow ||
                      offerShort
                    }
                  >
                    Placer l’offre
                  </Button>
                </div>
                <p
                  id="bid-help"
                  className={`mt-2 text-xs ${offerTooLow ? "text-danger-ink" : "text-ink-3"}`}
                >
                  {offerTooLow && auction.minimumBid != null
                    ? `L’offre doit être d’au moins ${formatKaras(auction.minimumBid)}.`
                    : `Minimum ${auction.minimumBid != null ? formatKaras(auction.minimumBid) : "—"} · +10 Karas par rapport à l’offre actuelle.`}
                </p>
              </form>
              <div className="yk-auction-balance">
                <span>Ton solde</span>
                <Karas amount={auction.balance} />
              </div>
              {(quickShort || offerShort) && (
                <p role="alert" className="yk-auction-alert">
                  Solde de Karas insuffisant (ton solde :{" "}
                  {auction.balance != null ? formatKaras(auction.balance) : "—"}
                  ).
                </p>
              )}
              <p className="text-xs text-ink-3">
                Karas prélevés immédiatement, rendus si tu es surenchéri.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="yk-auction-alert">
              {error}
            </p>
          )}
        </section>
        <AuctionChatPanel
          auctionId={auction.id}
          refreshKey={auction.bids}
          finished={!!auction.finished}
        />
      </div>
      <Modal
        open={cancelConfirm}
        onClose={() => {
          if (!pending) setCancelConfirm(false);
        }}
        title="Retirer la carte de la vente"
      >
        <p className="text-sm leading-6 text-ink-2">
          La vente sera annulée et la carte retournera immédiatement dans ta
          collection.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => setCancelConfirm(false)}
          >
            Garder la vente
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => void cancel()}
          >
            {pending ? "Retrait…" : "Confirmer le retrait"}
          </Button>
        </div>
      </Modal>
      <section className="yk-auction-history" aria-label="Historique des mises">
        <h2 className="yk-section-title">
          Historique des mises
          {auction.history?.length ? ` (${auction.history.length})` : ""}
        </h2>
        {auction.history?.length ? (
          <ol className="mt-4">
            {auction.history.map((h, i) => (
              <li
                key={h.id}
                className={i === 0 ? "yk-history-leading" : undefined}
              >
                <Avatar
                  name={h.name}
                  image={h.avatarUrl ?? undefined}
                  size={28}
                />
                <p className="min-w-0 flex-1 text-sm">
                  {h.mine ? (
                    <strong>Vous</strong>
                  ) : !h.name || h.name === "Joueur supprimé" ? (
                    <strong>Joueur supprimé</strong>
                  ) : (
                    <Link
                      href={`/profil/${encodeURIComponent(h.name)}`}
                      className="font-semibold hover:text-accent-gold"
                    >
                      {h.name}
                    </Link>
                  )}
                  <span className="text-ink-3"> · </span>
                  <span className="text-karas tabular-nums">
                    {formatKaras(h.amount)}
                  </span>
                  <span className="text-ink-3"> · </span>
                  <time className="text-ink-3 tabular-nums">{h.time}</time>
                </p>
                {i === 0 && (
                  <StatusPill tone="success">
                    {auction.finished ? "Gagnant" : "En tête"}
                  </StatusPill>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-ink-3">
            Aucune mise pour le moment · prix de départ{" "}
            {formatKaras(auction.amount)}.
          </p>
        )}
      </section>
    </div>
  );
}
export function ProfileView({
  joined,
  cards,
  isMe = true,
  identifier
}: {
  name?: string;
  joined?: string;
  cards?: CollectedCard[];
  isMe?: boolean;
  identifier?: string;
}) {
  return (
    <ProfileExperience
      identifier={isMe ? undefined : identifier}
      collection={cards}
      joined={joined}
    />
  );
}

export function SearchView({
  loadPage = getCataloguePage,
  previewCategories
}: { loadPage?: typeof getCataloguePage; previewCategories?: string[] } = {}) {
  const [pageSize, setPageSize] = useState<number>(CARD_PAGE_SIZES[0]);
  const [categories, setCategories] = useState<string[]>(
    previewCategories ?? []
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Card | null>(null);
  const [results, setResults] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (previewCategories) return;
    let active = true;
    void getGameInfo().then(
      info => {
        if (active) setCategories(info.categories);
      },
      () => {}
    );
    return () => {
      active = false;
    };
  }, [previewCategories]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(
      () =>
        void loadPage({ query, category, rarity, page, pageSize })
          .then(
            value => {
              if (active) {
                setResults(value.cards);
                setTotal(value.total);
              }
            },
            () => {
              if (active)
                setSearchError("Le catalogue est momentanément indisponible.");
            }
          )
          .finally(() => {
            if (active) setSearching(false);
          }),
      250
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, category, rarity, page, pageSize, loadPage]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const resetPage = () => {
    setPage(1);
    setSearching(true);
    setSearchError("");
  };
  const resetFilters = () => {
    setQuery("");
    setCategory("");
    setRarity("");
    resetPage();
  };
  const filters = (
    <>
      <div className="yk-filter-search">
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <label className="sr-only" htmlFor="catalogue-query">
          Rechercher dans le catalogue
        </label>
        <input
          id="catalogue-query"
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            resetPage();
          }}
          placeholder="Rechercher…"
        />
      </div>
      <CatalogueFilterSection title="Rareté">
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={!rarity}
          onClick={() => {
            setRarity("");
            resetPage();
          }}
        >
          <span className="yk-filter-check" />
          <span>Toutes</span>
        </button>
        {catalogueRarities.map(item => (
          <button
            type="button"
            key={item}
            className="yk-filter-option"
            aria-pressed={rarity === item}
            onClick={() => {
              setRarity(item);
              resetPage();
            }}
          >
            <span className="yk-filter-check" />
            <CatalogueFilterIcon rarity={item} />
            <span className={catalogueRarityText[item]}>{item}</span>
          </button>
        ))}
      </CatalogueFilterSection>
      <CatalogueFilterSection title="Catégorie">
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={!category}
          onClick={() => {
            setCategory("");
            resetPage();
          }}
        >
          <span className="yk-filter-check" />
          <span>Toutes les catégories</span>
        </button>
        {categories.map(item => (
          <button
            type="button"
            key={item}
            className="yk-filter-option"
            aria-pressed={category === item}
            onClick={() => {
              setCategory(item);
              resetPage();
            }}
          >
            <span className="yk-filter-check" />
            <span>{item}</span>
          </button>
        ))}
      </CatalogueFilterSection>
      <button
        type="button"
        className="yk-filter-reset"
        disabled={!(query || category || rarity)}
        onClick={resetFilters}
      >
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Réinitialiser les filtres
      </button>
    </>
  );
  return (
    <section className="yk-catalogue">
      <div className="yk-catalogue-heading">
        <div>
          <p role="status" className="font-display text-xl">
            {searching
              ? "Chargement du catalogue…"
              : `${total.toLocaleString("fr-FR")} carte${total > 1 ? "s" : ""}`}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            {query || category || rarity
              ? "Résultats correspondant à vos filtres"
              : "Toutes les cartes du jeu"}
          </p>
        </div>
        <button
          type="button"
          className="yk-mobile-filter-trigger"
          aria-expanded={filtersOpen}
          aria-controls="catalogue-filters"
          onClick={() => setFiltersOpen(true)}
        >
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtres{query || category || rarity ? <span>•</span> : null}
        </button>
      </div>
      {filtersOpen && (
        <button
          type="button"
          className="yk-filter-backdrop"
          aria-label="Fermer les filtres"
          onClick={() => setFiltersOpen(false)}
        />
      )}
      <div className="yk-collection-layout">
        <aside
          id="catalogue-filters"
          className={`yk-collection-sidebar ${filtersOpen ? "yk-sidebar-open" : ""}`}
          aria-label="Filtres du catalogue"
        >
          <div className="yk-sidebar-mobile-head">
            <strong>Filtres</strong>
            <button
              type="button"
              aria-label="Fermer les filtres"
              onClick={() => setFiltersOpen(false)}
            >
              ×
            </button>
          </div>
          {filters}
        </aside>
        <div className="yk-collection-main">
          {searchError && (
            <p role="alert" className="mb-5 text-sm text-danger">
              {searchError}
            </p>
          )}
          {!searching && results.length === 0 && (
            <Unavailable>Aucune carte ne correspond à ces filtres.</Unavailable>
          )}
          <ul
            className="yk-card-grid yk-catalogue-grid"
            aria-label="Cartes du catalogue"
          >
            {results.map(card => (
              <li key={card.id}>
                <button
                  type="button"
                  className="yk-catalogue-card"
                  onClick={() => setSelected(card)}
                  aria-label={`Voir ${card.name}, ${card.rarity}`}
                  aria-haspopup="dialog"
                >
                  <CardShell>
                    <YokaiCard {...card} animated={false} imageSizes="100vw" />
                  </CardShell>
                </button>
              </li>
            ))}
          </ul>
          <div className="yk-collection-pagination">
            <Pagination
              page={page}
              pageCount={pageCount}
              label="Pagination du catalogue"
              onPageChange={number => {
                setPage(number);
                setSearching(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
            <label>
              Cartes par page
              <select
                value={pageSize}
                onChange={event => {
                  setPageSize(Number(event.target.value));
                  resetPage();
                }}
              >
                {CARD_PAGE_SIZES.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
      <CatalogueCardModal
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

export function TradesView() {
  const searchParams = useSearchParams();
  return (
    <>
      <div className="my-8 rounded-panel border border-accent-neon/25 bg-accent-neon/10 p-5">
        <p className="text-sm text-accent-neon">
          Échange tes cartes et tes Karas uniquement avec tes amis.
        </p>
      </div>
      <TradesPanel
        initialOfferId={searchParams.get("offre") ?? undefined}
        initialFriendId={searchParams.get("ami") ?? undefined}
        initialRequestedCardId={searchParams.get("carte") ?? undefined}
      />
    </>
  );
}
type WishlistSort = "recent" | "name" | "rarity";
const wishlistRarityRank: Record<Rarity, number> = {
  LR: 0,
  SSR: 1,
  SR: 2,
  R: 3,
  C: 4
};
export function WishlistView({
  previewCards,
  onRemove
}: {
  previewCards?: WishlistCard[];
  onRemove?: (id: string) => Promise<unknown>;
} = {}) {
  const [cards, setCards] = useState<WishlistCard[] | undefined>(previewCards);
  const [selected, setSelected] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<WishlistSort>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (previewCards) return;
    let active = true;
    void getWishlist().then(
      value => {
        if (active) setCards(value);
      },
      e => {
        if (active)
          setError(e instanceof Error ? e.message : "Wishlist indisponible.");
      }
    );
    return () => {
      active = false;
    };
  }, [previewCards]);
  const categories = useMemo(
    () =>
      Array.from(new Set((cards ?? []).map(card => card.category))).sort(
        (a, b) => a.localeCompare(b, "fr")
      ),
    [cards]
  );
  const filteredCards = useMemo(
    () =>
      [...(cards ?? [])]
        .filter(
          card =>
            matchesCardSearch(query, [card.name, card.anime, card.category]) &&
            (!rarity || card.rarity === rarity) &&
            (!category || card.category === category)
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name, "fr")
            : sort === "rarity"
              ? wishlistRarityRank[a.rarity] - wishlistRarityRank[b.rarity] ||
                a.name.localeCompare(b.name, "fr")
              : Date.parse(b.createdAt) - Date.parse(a.createdAt)
        ),
    [cards, query, rarity, category, sort]
  );
  const filtered = !!(query || rarity || category || sort !== "recent");
  async function remove(id: string) {
    try {
      await (onRemove ? onRemove(id) : toggleWishlist(id));
      setCards(current => current?.filter(card => card.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
    }
  }
  const filters = (
    <>
      <div className="yk-filter-search">
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <label className="sr-only" htmlFor="wishlist-query">
          Rechercher dans la wishlist
        </label>
        <input
          id="wishlist-query"
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Rechercher…"
        />
      </div>
      <CatalogueFilterSection title="Tri">
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={sort === "recent"}
          onClick={() => setSort("recent")}
        >
          <span className="yk-filter-check" />
          <span>Ajout récent</span>
        </button>
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={sort === "name"}
          onClick={() => setSort("name")}
        >
          <span className="yk-filter-check" />
          <span>Nom A–Z</span>
        </button>
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={sort === "rarity"}
          onClick={() => setSort("rarity")}
        >
          <span className="yk-filter-check" />
          <span>Rareté</span>
        </button>
      </CatalogueFilterSection>
      <CatalogueFilterSection title="Rareté">
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={!rarity}
          onClick={() => setRarity("")}
        >
          <span className="yk-filter-check" />
          <span>Toutes</span>
        </button>
        {catalogueRarities.map(item => (
          <button
            type="button"
            key={item}
            className="yk-filter-option"
            aria-pressed={rarity === item}
            onClick={() => setRarity(item)}
          >
            <span className="yk-filter-check" />
            <CatalogueFilterIcon rarity={item} />
            <span className={catalogueRarityText[item]}>{item}</span>
          </button>
        ))}
      </CatalogueFilterSection>
      <CatalogueFilterSection title="Catégorie">
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={!category}
          onClick={() => setCategory("")}
        >
          <span className="yk-filter-check" />
          <span>Toutes les catégories</span>
        </button>
        {categories.map(item => (
          <button
            type="button"
            key={item}
            className="yk-filter-option"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            <span className="yk-filter-check" />
            <span>{item}</span>
          </button>
        ))}
      </CatalogueFilterSection>
      <button
        type="button"
        className="yk-filter-reset"
        disabled={!filtered}
        onClick={() => {
          setQuery("");
          setRarity("");
          setCategory("");
          setSort("recent");
        }}
      >
        Réinitialiser les filtres
      </button>
    </>
  );
  return (
    <>
      {cards && cards.length > 0 && (
        <div className="yk-wishlist-head">
          <div>
            <p className="font-display text-xl">
              {cards.length} carte{cards.length > 1 ? "s" : ""} suivie
              {cards.length > 1 ? "s" : ""}
            </p>
            <p className="mt-2 text-sm text-ink-2">
              Recevez une alerte dès qu’une de ces cartes est mise aux enchères.
            </p>
          </div>
          <Link href="/recherche" className="yk-button yk-button-secondary">
            Découvrir des cartes
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="yk-social-alert mb-5">
          {error}
        </p>
      )}
      {cards === undefined ? (
        <Unavailable>Chargement de votre wishlist…</Unavailable>
      ) : cards.length === 0 ? (
        <div className="yk-wishlist-empty">
          <span aria-hidden="true">☆</span>
          <h2>Ta wishlist est vide</h2>
          <p>
            Ajoute des cartes depuis la recherche ou ta collection pour les
            retrouver ici.
          </p>
          <Link href="/recherche" className="yk-button yk-button-secondary">
            Explorer le catalogue
          </Link>
        </div>
      ) : (
        <section className="yk-catalogue">
          <div className="yk-catalogue-heading">
            <div>
              <p role="status" className="font-display text-xl">
                {filteredCards.length.toLocaleString("fr-FR")} carte
                {filteredCards.length > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {filtered
                  ? "Résultats correspondant à vos filtres"
                  : "Toutes les cartes de votre wishlist"}
              </p>
            </div>
            <button
              type="button"
              className="yk-mobile-filter-trigger"
              aria-expanded={filtersOpen}
              aria-controls="wishlist-filters"
              onClick={() => setFiltersOpen(true)}
            >
              <svg
                aria-hidden="true"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Trier et filtrer{filtered ? <span>•</span> : null}
            </button>
          </div>
          {filtersOpen && (
            <button
              type="button"
              className="yk-filter-backdrop"
              aria-label="Fermer les filtres"
              onClick={() => setFiltersOpen(false)}
            />
          )}
          <div className="yk-collection-layout">
            <aside
              id="wishlist-filters"
              className={`yk-collection-sidebar ${filtersOpen ? "yk-sidebar-open" : ""}`}
              aria-label="Tri et filtres de la wishlist"
            >
              <div className="yk-sidebar-mobile-head">
                <strong>Trier et filtrer</strong>
                <button
                  type="button"
                  aria-label="Fermer les filtres"
                  onClick={() => setFiltersOpen(false)}
                >
                  ×
                </button>
              </div>
              {filters}
            </aside>
            <div className="yk-collection-main">
              {filteredCards.length ? (
                <div className="yk-card-grid yk-wishlist-grid">
                  {filteredCards.map(card => (
                    <article key={card.id} className="yk-wishlist-item">
                      <button
                        type="button"
                        className="yk-catalogue-card"
                        onClick={() => setSelected(card)}
                        aria-label={`Voir ${card.name}, ${card.rarity}`}
                        aria-haspopup="dialog"
                      >
                        <CardShell>
                          <YokaiCard
                            {...card}
                            animated={false}
                            imageSizes="100vw"
                          />
                        </CardShell>
                      </button>
                      <Button
                        variant="danger"
                        onClick={() => void remove(card.id)}
                        aria-label={`Retirer ${card.name} de la wishlist`}
                      >
                        ♡ Retirer
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <Unavailable>
                  Aucune carte ne correspond à ces filtres.
                </Unavailable>
              )}
            </div>
          </div>
        </section>
      )}
      <CatalogueCardModal
        selected={selected}
        onClose={() => setSelected(null)}
        onWishlistChange={(id, wishlisted) => {
          if (!wishlisted) {
            setCards(current => current?.filter(card => card.id !== id));
            setSelected(null);
          }
        }}
      />
    </>
  );
}

const remaining = (endsAt: string) => {
  const seconds = Math.max(
    0,
    Math.ceil((Date.parse(endsAt) - Date.now()) / 1000)
  );
  return {
    seconds,
    text: `${Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0")}:${Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
  };
};
export function presentAuction(
  raw: AuctionData | AuctionDetail,
  viewer?: string
): AuctionPresentation {
  const left = remaining(raw.endsAt);
  const finished = raw.status !== "active" || left.seconds === 0;
  const detail = raw as AuctionDetail;
  const bidder = !!raw.hasBid || !!detail.history?.some(b => b.mine);
  const status =
    raw.status === "sold"
      ? raw.buyerId === viewer
        ? "won"
        : raw.sellerId === viewer
          ? "sold"
          : bidder
            ? "lost"
            : undefined
      : raw.status === "expired"
        ? raw.sellerId === viewer
          ? "unsold"
          : bidder
            ? "lost"
            : undefined
        : raw.sellerId === viewer
          ? "mine"
          : raw.buyerId === viewer
            ? "leading"
            : bidder
              ? "outbid"
              : undefined;
  return {
    id: raw.id,
    card: { ...raw.card, image: raw.card.catalogueImage ?? raw.card.image },
    amount: raw.amount,
    remaining: left.text,
    remainingSeconds: left.seconds,
    seller: raw.seller || "Joueur supprimé",
    sellerId: raw.sellerId,
    sellerAvatarUrl: raw.sellerAvatarUrl,
    bids: raw.bids ?? detail.history?.length ?? 0,
    popularity: raw.popularity,
    status,
    finished,
    winner: detail.winner ?? undefined,
    balance: detail.balance,
    nextBid: !finished && raw.sellerId !== viewer ? raw.amount + 10 : undefined,
    minimumBid: raw.amount + 10,
    wishlist: raw.watched,
    antiSnipeMessage:
      left.seconds < 300 && !finished
        ? "Toute mise ajoute une minute à la fin."
        : undefined,
    history: detail.history?.map(b => ({
      id: b.id,
      name: b.name,
      avatarUrl: b.avatarUrl,
      amount: b.amount,
      time: new Date(b.createdAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      mine: b.mine
    }))
  };
}

export function buildAuctionLists(market: AuctionData[], viewer: string) {
  return {
    active: market
      .filter(a => a.status === "active")
      .map(a => presentAuction(a, viewer)),
    mine: market
      .filter(a => a.status === "active" && (a.sellerId === viewer || a.hasBid))
      .map(a => presentAuction(a, viewer)),
    won: market
      .filter(a => a.status === "sold" && a.buyerId === viewer)
      .map(a => presentAuction(a, viewer)),
    sold: market
      .filter(a => a.status !== "active" && a.sellerId === viewer)
      .map(a => presentAuction(a, viewer))
  };
}

export function CommunityView({
  screen,
  account,
  name,
  joined,
  isMe = true,
  playerId,
  auctionId
}: {
  screen: CommunityScreen;
  account: ReactNode;
  name?: string;
  joined?: string;
  isMe?: boolean;
  playerId?: string;
  auctionId?: string;
}) {
  const router = useRouter();
  const [collection, setCollection] = useState<CollectedCard[]>();
  const [error, setError] = useState("");
  const [karas, setKaras] = useState<number>();
  const [viewer, setViewer] = useState<string>();
  const [market, setMarket] = useState<AuctionData[]>();
  const [auction, setAuction] = useState<AuctionDetail>();
  const [, setClock] = useState(0);
  const [extended, setExtended] = useState(false);
  const lastEndsAt = useRef<{ id: string; endsAt: string } | undefined>(
    undefined
  );
  const extensionTimer = useRef<number | undefined>(undefined);
  const viewerRef = useRef<string | undefined>(undefined);
  const marketRef = useRef<AuctionData[] | undefined>(undefined);
  const auctionRef = useRef<AuctionDetail | undefined>(undefined);
  // Presentation only: flags the notice when the server-provided endsAt moves later (anti-snipe already applied by place_bid).
  const receiveAuction = useCallback((next: AuctionDetail) => {
    const previous = lastEndsAt.current;
    const scopes = auctionReconciliationScopes(
      auctionRef.current ? [auctionRef.current] : [],
      [next],
      viewerRef.current
    );
    auctionRef.current = next;
    if (scopes.length) invalidatePlayerSnapshots(scopes);
    lastEndsAt.current = { id: next.id, endsAt: next.endsAt };
    setAuction(next);
    setKaras(next.balance);
    if (
      previous?.id === next.id &&
      next.status === "active" &&
      Date.parse(next.endsAt) > Date.parse(previous.endsAt)
    ) {
      setExtended(true);
      window.clearTimeout(extensionTimer.current);
      extensionTimer.current = window.setTimeout(
        () => setExtended(false),
        animation.market.extensionNotice
      );
    }
  }, []);
  useEffect(() => () => window.clearTimeout(extensionTimer.current), []);
  useEffect(() => {
    if (screen !== "market" && screen !== "auction") return;
    const timer = window.setInterval(() => setClock(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);
  useEffect(() => {
    let active = true;
    void getGameInfo().then(
      info => {
        if (active) {
          viewerRef.current = info.user.id;
          setKaras(info.karasBalance);
          setViewer(info.user.id);
        }
      },
      () => {
        if (active)
          setError("Impossible de charger votre solde. Réessayez plus tard.");
      }
    );
    if (screen === "profile" && isMe)
      void getUserCollection().then(
        data => {
          if (active) setCollection(data);
        },
        () => {
          if (active)
            setError(
              "Impossible de charger votre collection. Réessayez plus tard."
            );
        }
      );
    if (screen === "market")
      void getAuctions().then(
        data => {
          if (active) {
            marketRef.current = data;
            setMarket(data);
          }
        },
        e => {
          if (active)
            setError(
              e instanceof Error
                ? e.message
                : "Impossible de charger le marché."
            );
        }
      );
    if (screen === "auction" && auctionId)
      void getAuction(auctionId).then(
        data => {
          if (active) receiveAuction(data);
        },
        e => {
          if (active)
            setError(
              e instanceof Error
                ? e.message
                : "Impossible de charger l’enchère."
            );
        }
      );
    return () => {
      active = false;
    };
  }, [screen, isMe, playerId, auctionId, receiveAuction]);
  useEffect(() => {
    if (screen !== "market" && screen !== "auction") return;
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        if (screen === "market") {
          const next = await getAuctions();
          if (active) {
            const scopes = auctionReconciliationScopes(
              marketRef.current ?? [],
              next,
              viewerRef.current
            );
            marketRef.current = next;
            if (scopes.length) invalidatePlayerSnapshots(scopes);
            setMarket(next);
          }
        } else if (auctionId) {
          const next = await getAuction(auctionId);
          if (active) receiveAuction(next);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production")
          console.error("[market] automatic refresh failed", error);
      } finally {
        loading = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [screen, auctionId, receiveAuction]);
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribePlayerSnapshotInvalidation(scopes => {
      if (scopes.includes("balance"))
        void getGameInfo().then(
          info => {
            if (active) setKaras(info.karasBalance);
          },
          () => undefined
        );
      if (scopes.includes("collection") && screen === "profile" && isMe)
        void getUserCollection().then(
          cards => {
            if (active) setCollection(cards);
          },
          () => undefined
        );
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [screen, isMe]);
  const feed = useNotificationFeed();
  const lists =
    market && viewer ? buildAuctionLists(market, viewer) : undefined;
  const activeSales =
    market && viewer
      ? String(
          market.filter(a => a.status === "active" && a.sellerId === viewer)
            .length
        )
      : undefined;
  async function refreshAuction() {
    if (!auctionId) return;
    receiveAuction(await getAuction(auctionId));
  }
  async function watchFromMarket(id: string) {
    try {
      await toggleWatch(id);
      setMarket(await getAuctions());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Impossible de suivre cette enchère."
      );
    }
  }
  async function watchAuction() {
    if (!auction) return;
    try {
      await toggleWatch(auction.id);
      await refreshAuction();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Impossible de suivre cette enchère."
      );
    }
  }
  const [overline, title] = headings[screen];
  const notificationItems = (feed.notifications ?? []).map(notificationItem);
  return (
    <>
      <Topbar
        view={screen}
        account={account}
        name={isMe ? name : undefined}
        karas={karas}
        notifications={notificationItems}
        notificationError={feed.error || undefined}
        onRetryNotifications={feed.retry}
        onRefreshNotifications={() => void feed.refresh()}
        onReadAll={async () => {
          await markNotificationRead();
          feed.setNotifications(current =>
            current?.map(n => ({
              ...n,
              readAt: n.readAt ?? new Date().toISOString()
            }))
          );
        }}
        onOpenNotification={async (id, href) => {
          await markNotificationRead(id);
          window.location.assign(href);
        }}
      />
      <main
        id="main-content"
        className={`mx-auto w-full ${screen === "search" || screen === "market" || screen === "auction" || screen === "wishlist" ? "max-w-[var(--layout-collection-max)]" : "max-w-6xl"} px-6 py-10`}
      >
        <div>
          {screen === "auction" && (
            <Link href="/marche" className="yk-back-link">
              ← Retour au marché
            </Link>
          )}
          <p className="eyebrow">{overline}</p>
          <h1 className="yk-title mt-3">
            {screen === "profile" && !isMe ? "Profil du joueur" : title}
          </h1>
        </div>
        {error && (
          <p
            role="alert"
            className="my-6 rounded-panel border border-danger/40 bg-danger/10 p-5 text-sm text-danger-ink"
          >
            {error}
          </p>
        )}
        <div className="mt-8">
          {screen === "profile" && (
            <ProfileView
              name={name}
              joined={joined}
              cards={collection}
              isMe={isMe}
              identifier={playerId}
            />
          )}
          {screen === "friends" && <FriendsPanel />}
          {screen === "market" && (
            <MarketView
              lists={lists}
              activeSales={activeSales}
              onToggleWatch={watchFromMarket}
            />
          )}{" "}
          {screen === "auction" && (
            <AuctionView
              auction={
                auction && { ...presentAuction(auction, viewer), extended }
              }
              onBid={
                auctionId
                  ? async amount => {
                      await placeBid(auctionId, amount);
                      await refreshAuction();
                    }
                  : undefined
              }
              onCancel={
                auction &&
                auction.status === "active" &&
                auction.sellerId === viewer
                  ? async () => {
                      await cancelAuction(auction.id);
                      router.push("/collection");
                    }
                  : undefined
              }
              onToggleWatch={auction ? watchAuction : undefined}
            />
          )}{" "}
          {screen === "search" && <SearchView />}
          {screen === "trades" && <TradesView />}
          {screen === "wishlist" && <WishlistView />}
        </div>
      </main>
    </>
  );
}
