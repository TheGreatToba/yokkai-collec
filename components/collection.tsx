"use client";
/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  CollectedCard,
  Folder,
  PaniniAlbumCardPage,
  PaniniAlbumPage,
  Rarity
} from "@/lib/data/cards";
import {
  Button,
  Chip,
  Feedback,
  Karas,
  Modal,
  Pagination,
  SelectionBar,
  SelectionModeButton
} from "@/components/ui";
import { YokaiCard } from "@/components/yokai-card";
import { CardShell } from "@/components/card-shell";
import { CardShareButton, MyCardShares } from "@/components/card-sharing";
import { CardReportButton } from "@/components/card-report-button";
import { CARD_PAGE_SIZES } from "@/lib/ui/pagination";
import {
  COLLECTION_SORTS,
  isCollectionSort,
  sortCollection
} from "@/lib/ui/collection-sort";
import { matchesCardSearch } from "@/lib/ui/card-search";
import { useCollectionSort } from "@/hooks/use-collection-sort";
import { getCardDiscovery } from "@/lib/data/wishlist";
import {
  collectionGroupKey,
  consumableCopies,
  consumptionPlan,
  groupCollection
} from "@/lib/ui/collection-groups";

// Optional display metadata, separate from the existing business types.
export type CollectionPresentation = {
  number?: string;
  isNew?: boolean;
  frozen?: { remaining: string };
  auctionId?: string;
  marketValue?: number | null;
  destructionValue?: number;
};
const rarityOrder: Rarity[] = ["LR", "SSR", "SR", "R", "C"];
const rarityText = {
  C: "text-rarity-c",
  R: "text-rarity-r",
  SR: "text-rarity-sr",
  SSR: "text-rarity-ssr",
  LR: "text-rarity-lr"
};
// Karas credited by a single destruction, as already announced in the confirmation modal.
const DESTRUCTION_KARAS: Record<Rarity, number> = {
  C: 1,
  R: 2,
  SR: 3,
  SSR: 4,
  LR: 5
};
const LOCKED_FOLDER = "__locked__";
const COLLECTION_CARD_IMAGE_SIZES =
  "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 190px";
const formatDate = (value: string, long = false) =>
  new Date(value).toLocaleDateString("fr-FR", {
    dateStyle: long ? "long" : "medium"
  });

function FilterSection({
  title,
  children,
  open = true
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="yk-filter-section" open={open}>
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

function FilterIcon({ colorClass }: { colorClass: string }) {
  return (
    <svg
      aria-hidden="true"
      className={colorClass}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="m12 2 2.45 6.1L21 10.5l-5.25 4.05L16 21l-4-3.55L8 21l.25-6.45L3 10.5l6.55-2.4L12 2Z" />
    </svg>
  );
}

function ProtectedIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g stroke="rgba(2,0,15,.95)" strokeWidth="5">
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v3" />
      </g>
      <g stroke="currentColor" strokeWidth="2">
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v3" />
      </g>
    </svg>
  );
}

function AuctionIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14 5 5 5M12 7l5 5M3 21l8-8M6 18l-3-3M14 3l7 7-4 4-7-7 4-4Z" />
      <path d="M12 21h9" />
    </svg>
  );
}

export function CollectionView({
  cards,
  categories,
  presentation = {},
  readOnly = false,
  adminRemoval = false,
  tradeHref,
  folders = [],
  detailOnly = false,
  initialSelectedId = null,
  onDetailClose,
  onCreateFolder,
  onDeleteFolder,
  onMoveCard,
  onMoveCards,
  onSetLocked,
  onCreateAuction,
  onEvolve,
  onSetCustomImage,
  onDiscard,
  onDiscardMany,
  loadPaniniAlbums,
  loadPaniniAlbumCards,
  loadCardDiscovery = getCardDiscovery
}: {
  cards: CollectedCard[];
  categories: string[];
  presentation?: Record<string, CollectionPresentation>;
  totals?: Partial<Record<Rarity, number>>;
  readOnly?: boolean;
  adminRemoval?: boolean;
  tradeHref?: (card: CollectedCard) => string;
  folders?: Folder[];
  detailOnly?: boolean;
  initialSelectedId?: string | null;
  onDetailClose?: () => void;
  onCreateFolder?: (name: string) => Promise<void>;
  onDeleteFolder?: (folderId: string) => Promise<void>;
  onMoveCard?: (instanceId: string, folderId: string | null) => Promise<void>;
  onMoveCards?: (
    instanceIds: string[],
    folderId: string | null
  ) => Promise<void>;
  onSetLocked?: (instanceId: string, locked: boolean) => Promise<void>;
  onCreateAuction?: (
    instanceId: string,
    startingPrice: number,
    durationMinutes: number
  ) => Promise<void>;
  onEvolve?: (instanceIds: string[]) => Promise<CollectedCard>;
  onSetCustomImage?: (
    instanceId: string,
    imageUrl: string | null
  ) => Promise<void>;
  onDiscard?: (instanceId: string) => Promise<void>;
  onDiscardMany?: (instanceIds: string[]) => Promise<void>;
  loadPaniniAlbums?: (options: {
    query?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }) => Promise<PaniniAlbumPage>;
  loadPaniniAlbumCards?: (options: {
    license: string;
    query?: string;
    category?: string;
    ownedOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) => Promise<PaniniAlbumCardPage>;
  loadCardDiscovery?: (
    cardId: string
  ) => Promise<{ marketValue: number | null }>;
}) {
  const pathname = usePathname();
  const profileIdentifier = pathname?.startsWith("/profil/")
    ? decodeURIComponent(pathname.slice("/profil/".length))
    : undefined;
  const resolvedTradeHref =
    tradeHref ??
    (readOnly && profileIdentifier
      ? (card: CollectedCard) =>
          `/echanges?ami=${encodeURIComponent(profileIdentifier)}&carte=${encodeURIComponent(card.instanceId)}`
      : undefined);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [shinyOnly, setShinyOnly] = useState(false);
  const [folder, setFolder] = useState<
    string | "unfiled" | typeof LOCKED_FOLDER | ""
  >("");
  const [auctionOnly, setAuctionOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useCollectionSort();
  const [pageSize, setPageSize] = useState<number>(CARD_PAGE_SIZES[0]);
  const [folderName, setFolderName] = useState("");
  const [showFolderCreator, setShowFolderCreator] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [auctionPrice, setAuctionPrice] = useState("10");
  const [auctionDuration, setAuctionDuration] = useState("60");
  const [auctionBusy, setAuctionBusy] = useState(false);
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [auctionDone, setAuctionDone] = useState(false);
  const [auctionError, setAuctionError] = useState("");
  const [auctionSuggestion, setAuctionSuggestion] = useState<number | null>(
    null
  );
  const [auctionSuggestionBusy, setAuctionSuggestionBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId
  );
  const [evolving, setEvolving] = useState(false);
  const [evolveConfirm, setEvolveConfirm] = useState(false);
  const [evolutionSelection, setEvolutionSelection] = useState<Set<string>>(
    new Set()
  );
  const [evolutionError, setEvolutionError] = useState("");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState("");
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [discardQuantity, setDiscardQuantity] = useState(1);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardError, setDiscardError] = useState("");
  const [bulkDiscardBusy, setBulkDiscardBusy] = useState(false);
  const [bulkDiscardConfirm, setBulkDiscardConfirm] = useState(false);
  const [bulkDiscardError, setBulkDiscardError] = useState("");
  const [bulkFolderTarget, setBulkFolderTarget] = useState("");
  const [bulkFolderBusy, setBulkFolderBusy] = useState(false);
  const [bulkFolderError, setBulkFolderError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "panini">("grid");
  const [selectedLicense, setSelectedLicense] = useState<string | null>(null);
  const [paniniAlbumPage, setPaniniAlbumPage] = useState(1);
  const [paniniPage, setPaniniPage] = useState(1);
  const [paniniPageSize, setPaniniPageSize] = useState<number>(
    CARD_PAGE_SIZES[0]
  );
  const [hideMissingCards, setHideMissingCards] = useState(false);
  const [paniniAlbums, setPaniniAlbums] = useState<PaniniAlbumPage>({
    items: [],
    total: 0
  });
  const [paniniCards, setPaniniCards] = useState<PaniniAlbumCardPage>({
    items: [],
    total: 0
  });
  const [paniniBusy, setPaniniBusy] = useState(false);
  const [paniniError, setPaniniError] = useState("");
  const selected = cards.find(c => c.instanceId === selectedId);
  const selectedMeta = selected ? presentation[selected.instanceId] : undefined;
  const filtered = useMemo(
    () =>
      sortCollection(
        cards.filter(
          c =>
            matchesCardSearch(query, [c.name, c.category, c.anime]) &&
            (!category || c.category === category) &&
            (!rarity || c.rarity === rarity) &&
            (!shinyOnly || c.shiny) &&
            (!folder ||
              (folder === LOCKED_FOLDER
                ? !!c.locked
                : folder === "unfiled"
                  ? !c.folderId
                  : c.folderId === folder)) &&
            (!auctionOnly || !!presentation[c.instanceId]?.frozen)
        ),
        sort
      ),
    [
      auctionOnly,
      cards,
      category,
      folder,
      presentation,
      query,
      rarity,
      shinyOnly,
      sort
    ]
  );
  const groups = groupCollection(filtered);
  const allGroupsByKey = useMemo(
    () => new Map(groupCollection(cards).map(group => [group.key, group])),
    [cards]
  );
  const paniniAlbumPageCount = Math.max(1, Math.ceil(paniniAlbums.total / 72));
  const activePaniniAlbumPage = Math.min(paniniAlbumPage, paniniAlbumPageCount);
  const ownedByCardId = useMemo(() => {
    const owned = new Map<string, CollectedCard>();
    for (const card of cards) {
      if (!owned.has(card.id)) owned.set(card.id, card);
    }
    return owned;
  }, [cards]);
  const selectedLicenseOwned = selectedLicense
    ? cards.filter(card => {
        const specialCategory = [
          "ARTIST",
          "DISNEY CHANNEL",
          "FILM",
          "INTERNET PERSONALITY",
          "KPOP",
          "WWE"
        ].includes(card.category.trim().toUpperCase());
        return specialCategory
          ? card.category.trim().toUpperCase() === selectedLicense.toUpperCase()
          : card.anime?.trim() === selectedLicense;
      }).length
    : 0;
  const selectedAlbum = paniniAlbums.items.find(
    album => album.license === selectedLicense
  );
  const paniniPageCount = Math.max(
    1,
    Math.ceil(paniniCards.total / paniniPageSize)
  );
  const activePaniniPage = Math.min(paniniPage, paniniPageCount);

  useEffect(() => {
    if (viewMode !== "panini" || selectedLicense || !loadPaniniAlbums) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setPaniniBusy(true);
      setPaniniError("");
      void loadPaniniAlbums({
        query,
        category,
        page: activePaniniAlbumPage,
        pageSize: 72
      })
        .then(
          result => {
            if (active) setPaniniAlbums(result);
          },
          error => {
            if (active)
              setPaniniError(
                error instanceof Error
                  ? error.message
                  : "Impossible de charger les classeurs."
              );
          }
        )
        .finally(() => {
          if (active) setPaniniBusy(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    activePaniniAlbumPage,
    category,
    loadPaniniAlbums,
    query,
    selectedLicense,
    viewMode
  ]);

  useEffect(() => {
    if (viewMode !== "panini" || !selectedLicense || !loadPaniniAlbumCards)
      return;
    let active = true;
    const timer = window.setTimeout(() => {
      setPaniniBusy(true);
      setPaniniError("");
      void loadPaniniAlbumCards({
        license: selectedLicense,
        query,
        category,
        ownedOnly: hideMissingCards,
        page: activePaniniPage,
        pageSize: paniniPageSize
      })
        .then(
          result => {
            if (active) setPaniniCards(result);
          },
          error => {
            if (active)
              setPaniniError(
                error instanceof Error
                  ? error.message
                  : "Impossible de charger les cartes de ce classeur."
              );
          }
        )
        .finally(() => {
          if (active) setPaniniBusy(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    activePaniniPage,
    category,
    hideMissingCards,
    loadPaniniAlbumCards,
    paniniPageSize,
    query,
    selectedLicense,
    viewMode
  ]);
  const pageCount = Math.max(1, Math.ceil(groups.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const visibleGroups = groups.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );
  const selectedCards = cards.filter(
    c =>
      selection.has(c.instanceId) &&
      !c.locked &&
      !presentation[c.instanceId]?.frozen
  );
  const selectedGroup = selected
    ? groupCollection(
        cards.filter(
          card => collectionGroupKey(card) === collectionGroupKey(selected)
        )
      )[0]
    : undefined;
  const selectedGroupFrozen =
    selectedGroup?.cards.some(
      card => !!presentation[card.instanceId]?.frozen
    ) ?? false;
  const isFrozen = (instanceId: string) =>
    adminRemoval
      ? false
      : !!presentation[instanceId]?.frozen ||
        !!cards.find(card => card.instanceId === instanceId)?.locked;
  const destructibleCards = consumableCopies(
    selectedGroup?.cards ?? [],
    isFrozen
  ).slice(0, onDiscardMany ? undefined : 1);
  const discardCards = consumptionPlan(
    selectedGroup?.cards ?? [],
    Math.min(discardQuantity, destructibleCards.length),
    isFrozen
  ).slice(0, onDiscardMany ? undefined : 1);
  const discardValue = discardCards.reduce(
    (sum, card) =>
      sum +
      (presentation[card.instanceId]?.destructionValue ??
        DESTRUCTION_KARAS[card.rarity]),
    0
  );
  const evolvableCards = selected
    ? consumableCopies(
        cards.filter(
          c => c.id === selected.id && c.rarity === "SSR" && !c.shiny
        ),
        isFrozen
      )
    : [];
  const evolutionCards = evolvableCards.filter(card =>
    evolutionSelection.has(card.instanceId)
  );
  const evolvableCopies = evolvableCards.length;
  const selectedValue =
    selectedCards.length > 0
      ? selectedCards.reduce(
          (sum, card) =>
            sum +
            (presentation[card.instanceId]?.destructionValue ??
              DESTRUCTION_KARAS[card.rarity]),
          0
        )
      : undefined;
  function closeDetail() {
    setSelectedId(null);
    onDetailClose?.();
  }
  function toggleGroup(groupCards: CollectedCard[]) {
    setSelection(current => {
      const next = new Set(current);
      const eligible = groupCards.filter(
        card => !card.locked && !presentation[card.instanceId]?.frozen
      );
      const all =
        eligible.length > 0 &&
        eligible.every(card => next.has(card.instanceId));
      for (const card of eligible) {
        if (all) next.delete(card.instanceId);
        else next.add(card.instanceId);
      }
      return next;
    });
  }
  function toggleEvolutionCard(instanceId: string) {
    setEvolutionSelection(current => {
      const next = new Set(current);
      if (next.has(instanceId)) next.delete(instanceId);
      else if (next.size < 5) next.add(instanceId);
      return next;
    });
  }
  async function evolveSelected() {
    if (!selected || !onEvolve || evolving || evolutionCards.length !== 5)
      return;
    setEvolving(true);
    setEvolutionError("");
    try {
      const evolved = await onEvolve(
        evolutionCards.map(card => card.instanceId)
      );
      setEvolveConfirm(false);
      setSelectedId(evolved.instanceId);
    } catch (error) {
      setEvolutionError(
        error instanceof Error
          ? error.message
          : "Impossible d’effectuer l’évolution."
      );
    } finally {
      setEvolving(false);
    }
  }
  async function addFolder() {
    if (!onCreateFolder || !folderName.trim() || folderBusy) return;
    setFolderBusy(true);
    setFolderError("");
    try {
      await onCreateFolder(folderName.trim());
      setFolderName("");
      setShowFolderCreator(false);
    } catch (error) {
      setFolderError(
        error instanceof Error
          ? error.message
          : "Impossible de créer le dossier."
      );
    } finally {
      setFolderBusy(false);
    }
  }
  async function auctionSelected() {
    if (!selected || !onCreateAuction || auctionBusy || selectedGroupFrozen)
      return;
    setAuctionBusy(true);
    setAuctionError("");
    try {
      await onCreateAuction(
        selected.instanceId,
        Number(auctionPrice),
        Number(auctionDuration)
      );
      setAuctionDone(true);
    } catch (error) {
      setAuctionError(
        error instanceof Error
          ? error.message
          : "Impossible de créer l’enchère."
      );
    } finally {
      setAuctionBusy(false);
    }
  }
  async function openAuction() {
    if (!selected || selectedGroupFrozen) return;
    setAuctionPrice("10");
    setAuctionError("");
    setAuctionDone(false);
    setAuctionSuggestion(null);
    setAuctionSuggestionBusy(true);
    setAuctionOpen(true);
    try {
      const discovery = await loadCardDiscovery(selected.id);
      const value = discovery.marketValue;
      setAuctionSuggestion(
        value != null && Number.isFinite(value) && value > 0
          ? Math.round(value)
          : null
      );
    } catch {
      setAuctionSuggestion(null);
    } finally {
      setAuctionSuggestionBusy(false);
    }
  }
  function closeAuction() {
    if (auctionBusy) return;
    setAuctionOpen(false);
    setAuctionError("");
    setAuctionSuggestion(null);
    setAuctionSuggestionBusy(false);
    if (auctionDone) {
      setAuctionDone(false);
      closeDetail();
    }
  }
  async function saveCustomImage(imageUrl: string | null) {
    if (!selected || !onSetCustomImage || imageBusy) return;
    setImageBusy(true);
    setImageError("");
    try {
      await onSetCustomImage(selected.instanceId, imageUrl);
      setCustomImageUrl("");
    } catch (error) {
      setImageError(
        error instanceof Error
          ? error.message
          : "Impossible de personnaliser l'image."
      );
    } finally {
      setImageBusy(false);
    }
  }
  async function toggleSelectedLock() {
    if (!selected || !onSetLocked || lockBusy || selectedMeta?.frozen) return;
    setLockBusy(true);
    setLockError("");
    try {
      await onSetLocked(selected.instanceId, !selected.locked);
    } catch (error) {
      setLockError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier le verrouillage de cette carte."
      );
    } finally {
      setLockBusy(false);
    }
  }
  async function discardSelected() {
    if (
      !selected ||
      !discardCards.length ||
      discardBusy ||
      (!onDiscardMany && !onDiscard)
    )
      return;
    setDiscardBusy(true);
    setDiscardError("");
    try {
      if (onDiscardMany)
        await onDiscardMany(discardCards.map(card => card.instanceId));
      else if (discardCards.length === 1 && onDiscard)
        await onDiscard(discardCards[0].instanceId);
      setDiscardConfirm(false);
      closeDetail();
    } catch (error) {
      setDiscardError(
        error instanceof Error
          ? error.message
          : "Impossible de détruire cette carte."
      );
    } finally {
      setDiscardBusy(false);
    }
  }
  async function discardSelection() {
    if (!onDiscardMany || !selectedCards.length || bulkDiscardBusy) return;
    setBulkDiscardBusy(true);
    setBulkDiscardError("");
    try {
      await onDiscardMany(selectedCards.map(card => card.instanceId));
      setBulkDiscardConfirm(false);
      setSelection(new Set());
      setSelecting(false);
    } catch (error) {
      setBulkDiscardError(
        error instanceof Error
          ? error.message
          : "Impossible de détruire la sélection."
      );
    } finally {
      setBulkDiscardBusy(false);
    }
  }
  async function moveSelection() {
    if (
      !onMoveCards ||
      !selectedCards.length ||
      !bulkFolderTarget ||
      bulkFolderBusy
    )
      return;
    setBulkFolderBusy(true);
    setBulkFolderError("");
    try {
      await onMoveCards(
        selectedCards.map(card => card.instanceId),
        bulkFolderTarget === "unfiled" ? null : bulkFolderTarget
      );
      setSelection(new Set());
      setSelecting(false);
      setBulkFolderTarget("");
    } catch (error) {
      setBulkFolderError(
        error instanceof Error
          ? error.message
          : "Impossible de ranger la sélection."
      );
    } finally {
      setBulkFolderBusy(false);
    }
  }
  const resetFilters = () => {
    setQuery("");
    setRarity("");
    setCategory("");
    setShinyOnly(false);
    setFolder("");
    setAuctionOnly(false);
    setPage(1);
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
        <label className="sr-only" htmlFor="collection-query">
          Rechercher dans la collection
        </label>
        <input
          id="collection-query"
          type="search"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Rechercher…"
        />
      </div>
      <FilterSection title="Rareté">
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={!rarity}
          onClick={() => {
            setRarity("");
            setPage(1);
          }}
        >
          <span className="yk-filter-check" />
          <span>Toutes</span>
          <strong>{groupCollection(cards).length}</strong>
        </button>
        {rarityOrder.map(r => (
          <button
            type="button"
            key={r}
            className="yk-filter-option"
            aria-pressed={rarity === r}
            onClick={() => {
              setRarity(r);
              setPage(1);
            }}
          >
            <span className="yk-filter-check" />
            <FilterIcon colorClass={rarityText[r]} />
            <span className={rarityText[r]}>{r}</span>
            <strong>
              {groupCollection(cards.filter(c => c.rarity === r)).length}
            </strong>
          </button>
        ))}
      </FilterSection>
      <FilterSection title="Catégorie">
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={!category}
          onClick={() => {
            setCategory("");
            setPage(1);
            setPaniniAlbumPage(1);
            setPaniniPage(1);
          }}
        >
          <span className="yk-filter-check" />
          <span>Toutes les catégories</span>
          <strong>{groupCollection(cards).length}</strong>
        </button>
        {categories.map(item => (
          <button
            type="button"
            key={item}
            className="yk-filter-option"
            aria-pressed={category === item}
            onClick={() => {
              setCategory(item);
              setPage(1);
              setPaniniAlbumPage(1);
              setPaniniPage(1);
            }}
          >
            <span className="yk-filter-check" />
            <span>{item}</span>
            <strong>
              {
                groupCollection(cards.filter(card => card.category === item))
                  .length
              }
            </strong>
          </button>
        ))}
      </FilterSection>
      {!readOnly && (
        <FilterSection title="Statut">
          <button
            type="button"
            className="yk-filter-option yk-filter-option-icon"
            aria-pressed={auctionOnly}
            onClick={() => {
              setAuctionOnly(current => !current);
              setPage(1);
            }}
          >
            <span className="yk-filter-check" />
            <AuctionIcon />
            <span>En enchères</span>
            <strong>
              {
                groupCollection(
                  cards.filter(card => presentation[card.instanceId]?.frozen)
                ).length
              }
            </strong>
          </button>
        </FilterSection>
      )}
      {!readOnly && (
        <FilterSection title="Dossier">
          <button
            type="button"
            className="yk-filter-option"
            aria-pressed={!folder}
            onClick={() => {
              setFolder("");
              setPage(1);
            }}
          >
            <span className="yk-filter-check" />
            <span>Tous les dossiers</span>
            <strong>{groupCollection(cards).length}</strong>
          </button>
          <button
            type="button"
            className="yk-filter-option"
            aria-pressed={folder === LOCKED_FOLDER}
            onClick={() => {
              setFolder(LOCKED_FOLDER);
              setPage(1);
            }}
          >
            <span className="yk-filter-check" />
            <ProtectedIcon />
            <span>Cartes verrouillées</span>
            <strong>
              {groupCollection(cards.filter(card => card.locked)).length}
            </strong>
          </button>
          <button
            type="button"
            className="yk-filter-option"
            aria-pressed={folder === "unfiled"}
            onClick={() => {
              setFolder("unfiled");
              setPage(1);
            }}
          >
            <span className="yk-filter-check" />
            <span>Sans dossier</span>
            <strong>
              {groupCollection(cards.filter(card => !card.folderId)).length}
            </strong>
          </button>
          {folders.map(item => (
            <button
              type="button"
              key={item.id}
              className="yk-filter-option"
              aria-pressed={folder === item.id}
              onClick={() => {
                setFolder(item.id);
                setPage(1);
              }}
            >
              <span className="yk-filter-check" />
              <span>{item.name}</span>
              <strong>
                {
                  groupCollection(
                    cards.filter(card => card.folderId === item.id)
                  ).length
                }
              </strong>
            </button>
          ))}
          {onCreateFolder && (
            <button
              type="button"
              className="yk-folder-create-toggle"
              aria-expanded={showFolderCreator}
              onClick={() => {
                setShowFolderCreator(current => !current);
                setFolderError("");
              }}
            >
              + Créer un dossier
            </button>
          )}
          {onCreateFolder && showFolderCreator && (
            <div className="yk-folder-create">
              <input
                autoFocus
                value={folderName}
                maxLength={40}
                onChange={event => setFolderName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addFolder();
                  }
                  if (event.key === "Escape") {
                    setShowFolderCreator(false);
                    setFolderName("");
                  }
                }}
                placeholder="Nouveau dossier"
                aria-label="Nom du nouveau dossier"
              />
              <Button
                variant="secondary"
                disabled={folderBusy || !folderName.trim()}
                onClick={() => void addFolder()}
              >
                {folderBusy ? "Création…" : "Créer"}
              </Button>
            </div>
          )}
          {onDeleteFolder &&
            folder &&
            folder !== "unfiled" &&
            folder !== LOCKED_FOLDER && (
              <button
                type="button"
                className="yk-folder-delete"
                onClick={() => void onDeleteFolder(folder)}
              >
                Supprimer ce dossier
              </button>
            )}
          {folderError && (
            <p role="alert" className="text-xs text-danger">
              {folderError}
            </p>
          )}
        </FilterSection>
      )}
      <button
        type="button"
        className="yk-filter-reset"
        disabled={
          !(query || rarity || category || shinyOnly || folder || auctionOnly)
        }
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
    <section
      aria-label={detailOnly ? "Détail d’une carte" : "Collection de cartes"}
      className={
        detailOnly ? undefined : `yk-collection ${selecting ? "pb-28" : ""}`
      }
    >
      {!detailOnly && (
        <>
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
              id="collection-filters"
              className={`yk-collection-sidebar ${filtersOpen ? "yk-sidebar-open" : ""}`}
              aria-label="Filtres de la collection"
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
              <div className="yk-collection-toolbar">
                <button
                  type="button"
                  className="yk-mobile-filter-trigger"
                  aria-expanded={filtersOpen}
                  aria-controls="collection-filters"
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
                  Filtres
                  {query || rarity || category || folder || auctionOnly ? (
                    <span>•</span>
                  ) : null}
                </button>
                <div className="yk-collection-toolbar-actions">
                  {!readOnly && <MyCardShares />}
                  <label className="yk-sort-control">
                    <span>Trier par :</span>
                    <strong aria-hidden="true">
                      {
                        COLLECTION_SORTS.find(option => option.value === sort)
                          ?.label
                      }
                    </strong>
                    <svg
                      aria-hidden="true"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="m7 10 5 5 5-5" />
                    </svg>
                    <select
                      aria-label="Trier la collection"
                      value={sort}
                      onChange={e => {
                        if (isCollectionSort(e.target.value)) {
                          setSort(e.target.value);
                          setPage(1);
                        }
                      }}
                    >
                      {COLLECTION_SORTS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!readOnly && (
                    <SelectionModeButton
                      active={selecting}
                      onClick={() => {
                        setSelecting(!selecting);
                        setSelection(new Set());
                      }}
                    />
                  )}
                  <Button
                    variant="secondary"
                    className="yk-panini-mode"
                    aria-pressed={viewMode === "panini"}
                    onClick={() => {
                      setViewMode(current =>
                        current === "panini" ? "grid" : "panini"
                      );
                      setSelectedLicense(null);
                      setSelecting(false);
                      setSelection(new Set());
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" />
                      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" />
                    </svg>
                    <span>Classeur</span>
                  </Button>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shinyOnly}
                  className="yk-shiny-toggle"
                  onClick={() => {
                    setShinyOnly(current => !current);
                    setPage(1);
                  }}
                >
                  <span>Shiny uniquement</span>
                  <i />
                </button>
                <div className="yk-view-toggle" aria-label="Mode d’affichage">
                  <button
                    type="button"
                    aria-label="Vue grille"
                    aria-pressed={viewMode === "grid"}
                    onClick={() => setViewMode("grid")}
                  >
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect x="4" y="4" width="6" height="6" />
                      <rect x="14" y="4" width="6" height="6" />
                      <rect x="4" y="14" width="6" height="6" />
                      <rect x="14" y="14" width="6" height="6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Vue liste"
                    aria-pressed={viewMode === "list"}
                    onClick={() => setViewMode("list")}
                  >
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M8 6h12M8 12h12M8 18h12" />
                      <circle cx="4" cy="6" r="1" fill="currentColor" />
                      <circle cx="4" cy="12" r="1" fill="currentColor" />
                      <circle cx="4" cy="18" r="1" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>
              {viewMode === "panini" ? (
                <section
                  className="yk-panini"
                  aria-label="Classeurs par licence"
                >
                  {selectedLicense ? (
                    <>
                      <div className="yk-panini-album-head">
                        <button
                          type="button"
                          className="yk-panini-back"
                          onClick={() => {
                            setSelectedLicense(null);
                            setQuery("");
                            setPaniniPage(1);
                          }}
                        >
                          ← Tous les classeurs
                        </button>
                        <div>
                          <p className="yk-section-title">Classeur</p>
                          <h2>{selectedLicense}</h2>
                        </div>
                        <p>
                          {selectedAlbum?.owned ?? selectedLicenseOwned} /{" "}
                          {selectedAlbum?.total ?? paniniCards.total} cartes
                        </p>
                      </div>
                      <div className="yk-panini-controls">
                        <label className="yk-panini-search">
                          <span className="sr-only">
                            Rechercher une carte dans cette licence
                          </span>
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
                          <input
                            type="search"
                            value={query}
                            onChange={event => {
                              setQuery(event.target.value);
                              setPaniniPage(1);
                            }}
                            placeholder="Rechercher une carte…"
                          />
                        </label>
                        <button
                          type="button"
                          className="yk-panini-owned-toggle"
                          aria-pressed={hideMissingCards}
                          onClick={() => {
                            setHideMissingCards(current => !current);
                            setPaniniPage(1);
                          }}
                        >
                          <span aria-hidden="true">
                            {hideMissingCards ? "✓" : "○"}
                          </span>
                          {hideMissingCards
                            ? "Afficher les cartes manquantes"
                            : "Cacher les cartes non possédées"}
                        </button>
                      </div>
                      {paniniError && (
                        <div className="yk-panini-empty" role="alert">
                          <strong>Chargement impossible</strong>
                          <p>{paniniError}</p>
                        </div>
                      )}
                      {paniniBusy && (
                        <div className="yk-panini-empty" role="status">
                          <strong>Chargement du classeur…</strong>
                        </div>
                      )}
                      {!paniniBusy &&
                        !paniniError &&
                        paniniCards.total === 0 && (
                          <div className="yk-panini-empty">
                            <strong>Aucune carte trouvée</strong>
                            <p>Essaie un autre nom de personnage.</p>
                          </div>
                        )}
                      <ul
                        className="yk-panini-slots"
                        aria-label={`Cartes de la licence ${selectedLicense}`}
                      >
                        {paniniCards.items.map(card => {
                          const owned = ownedByCardId.get(card.id);
                          return (
                            <li key={card.id}>
                              {owned ? (
                                <button
                                  type="button"
                                  className="yk-panini-owned"
                                  onClick={() =>
                                    setSelectedId(owned.instanceId)
                                  }
                                  aria-label={`Voir ${owned.name}`}
                                >
                                  <CardShell>
                                    <YokaiCard
                                      {...owned}
                                      image={owned.image}
                                      {...presentation[owned.instanceId]}
                                      imageSizes={COLLECTION_CARD_IMAGE_SIZES}
                                    />
                                  </CardShell>
                                </button>
                              ) : (
                                <div
                                  className="yk-panini-missing"
                                  aria-label="Carte non obtenue"
                                >
                                  <span>?</span>
                                  <small>À découvrir</small>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {paniniCards.total > 0 && (
                        <div className="yk-collection-pagination yk-panini-pagination">
                          <Pagination
                            page={activePaniniPage}
                            pageCount={paniniPageCount}
                            onPageChange={setPaniniPage}
                            label={`Pagination du classeur ${selectedLicense}`}
                          />
                          <label>
                            Cartes par page
                            <select
                              value={paniniPageSize}
                              onChange={event => {
                                setPaniniPageSize(Number(event.target.value));
                                setPaniniPage(1);
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
                      )}
                    </>
                  ) : (
                    <>
                      <div className="yk-panini-heading">
                        <div>
                          <p className="yk-section-title">Classeur</p>
                          <h2>Mes classeurs par licence</h2>
                        </div>
                        <p>
                          {paniniAlbums.total} licence
                          {paniniAlbums.total > 1 ? "s" : ""} affichée
                          {paniniAlbums.total > 1 ? "s" : ""}
                        </p>
                      </div>
                      <label className="yk-panini-search">
                        <span className="sr-only">Rechercher une licence</span>
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
                        <input
                          type="search"
                          value={query}
                          onChange={event => {
                            setQuery(event.target.value);
                            setPaniniAlbumPage(1);
                          }}
                          placeholder="Rechercher une licence…"
                        />
                      </label>
                      {paniniError && (
                        <div className="yk-panini-empty" role="alert">
                          <strong>Chargement impossible</strong>
                          <p>{paniniError}</p>
                        </div>
                      )}
                      {paniniBusy && (
                        <div className="yk-panini-empty" role="status">
                          <strong>Chargement des classeurs…</strong>
                        </div>
                      )}
                      {!paniniBusy &&
                      !paniniError &&
                      paniniAlbums.total === 0 ? (
                        <div className="yk-panini-empty">
                          <strong>Aucune licence trouvée</strong>
                          <p>Essaie un autre nom dans la barre de recherche.</p>
                        </div>
                      ) : !paniniBusy && !paniniError ? (
                        <ul className="yk-panini-grid">
                          {paniniAlbums.items.map(item => (
                            <li key={item.license}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLicense(item.license);
                                  setQuery("");
                                  setPaniniPage(1);
                                }}
                                aria-label={`Voir ${item.license}, ${item.owned} cartes sur ${item.total}`}
                              >
                                <span className="yk-panini-details">
                                  <strong>{item.license}</strong>
                                  <span className="yk-panini-count">
                                    <b>{item.owned}</b> / {item.total} cartes
                                  </span>
                                  <span className="yk-panini-progress">
                                    <i style={{ width: `${item.percent}%` }} />
                                  </span>
                                  <small>{item.percent}% complété</small>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {paniniAlbums.total > 0 && (
                        <div className="yk-collection-pagination yk-panini-pagination">
                          <Pagination
                            page={activePaniniAlbumPage}
                            pageCount={paniniAlbumPageCount}
                            onPageChange={setPaniniAlbumPage}
                            label="Pagination des classeurs"
                          />
                          <span className="yk-panini-page-limit">
                            72 collections par page
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </section>
              ) : filtered.length === 0 ? (
                <div className="rounded-panel border border-dashed border-veil-strong px-6 py-16 text-center">
                  <p className="font-display text-xl">
                    {cards.length === 0
                      ? "Ta collection est vide pour l’instant — ouvre ton premier booster."
                      : "Aucune carte ne correspond à ces filtres."}
                  </p>
                  {cards.length === 0 ? (
                    <Link
                      href="/boosters"
                      className="yk-button yk-button-primary mt-6"
                    >
                      Ouvrir mon premier booster
                    </Link>
                  ) : (
                    <p className="mt-3 text-sm text-ink-2">
                      Essaie une autre rareté ou catégorie.
                    </p>
                  )}
                </div>
              ) : null}
              {viewMode !== "panini" && (
                <ul
                  className={`yk-card-grid yk-collection-grid ${viewMode === "list" ? "yk-collection-grid-list" : ""}`}
                  aria-label="Groupes de cartes obtenues"
                >
                  {visibleGroups.map(group => {
                    const card = group.representative;
                    const historyGroup = allGroupsByKey.get(group.key) ?? group;
                    const meta = presentation[card.instanceId];
                    const eligible = group.cards.filter(
                      copy =>
                        !copy.locked && !presentation[copy.instanceId]?.frozen
                    );
                    const checked =
                      eligible.length > 0 &&
                      eligible.every(copy => selection.has(copy.instanceId));
                    const partial =
                      !checked &&
                      eligible.some(copy => selection.has(copy.instanceId));
                    const frozenCount = group.cards.filter(
                      copy => presentation[copy.instanceId]?.frozen
                    ).length;
                    const lockedCount = group.cards.filter(
                      copy => copy.locked
                    ).length;
                    return (
                      <li key={group.key} className="min-w-0">
                        <button
                          type="button"
                          disabled={selecting && eligible.length === 0}
                          className={`yk-collection-card ${selecting && (checked || partial) ? "yk-selected-card" : ""}`}
                          aria-label={`${selecting ? "Sélectionner" : "Voir"} ${card.name}, ${card.rarity}, ${group.cards.length} exemplaires`}
                          aria-pressed={selecting ? checked : undefined}
                          aria-haspopup={selecting ? undefined : "dialog"}
                          onClick={() =>
                            selecting
                              ? toggleGroup(group.cards)
                              : setSelectedId(card.instanceId)
                          }
                        >
                          <CardShell>
                            <YokaiCard
                              {...card}
                              image={card.image}
                              {...meta}
                              animated={!readOnly}
                              imageSizes={COLLECTION_CARD_IMAGE_SIZES}
                            />
                          </CardShell>
                          {selecting && eligible.length > 0 && (
                            <span
                              className={`yk-selection-check ${checked || partial ? "yk-checked" : ""}`}
                            >
                              {checked ? "✓" : partial ? "−" : ""}
                            </span>
                          )}
                          {group.cards.some(
                            copy => presentation[copy.instanceId]?.isNew
                          ) && (
                            <span className="absolute top-3 left-3 rounded-badge bg-accent-gold px-2 py-1 text-[10px] font-bold text-void">
                              NEW
                            </span>
                          )}
                          {group.cards.length > 1 && (
                            <span className="absolute right-2 bottom-2 rounded-full border border-veil bg-void/90 px-2 py-1 text-xs text-ink-2">
                              ×{group.cards.length}
                            </span>
                          )}
                          {lockedCount > 0 && (
                            <span
                              className="yk-group-locked"
                              aria-label="Carte protégée"
                              title="Carte protégée"
                            >
                              <ProtectedIcon size={16} />
                            </span>
                          )}
                          {lockedCount === 0 && frozenCount > 0 && (
                            <span className="yk-group-frozen">
                              {frozenCount} en enchère
                            </span>
                          )}
                        </button>
                        <div className="yk-collection-card-meta">
                          {historyGroup.isFirstOwner ? (
                            <p className="text-[11px] font-semibold text-rarity-lr">
                              Premier propriétaire, obtenu le{" "}
                              {formatDate(historyGroup.firstObtainedAt)}
                            </p>
                          ) : (
                            <p className="text-[11px] tracking-wider text-ink-3 uppercase">
                              Obtenu le{" "}
                              <time dateTime={historyGroup.firstObtainedAt}>
                                {formatDate(historyGroup.firstObtainedAt)}
                              </time>
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {viewMode !== "panini" && filtered.length > 0 && (
                <div className="yk-collection-pagination">
                  <Pagination
                    page={activePage}
                    pageCount={pageCount}
                    onPageChange={setPage}
                    label="Pagination de la collection"
                  />
                  <label>
                    Cartes par page
                    <select
                      value={pageSize}
                      onChange={event => {
                        setPageSize(Number(event.target.value));
                        setPage(1);
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
              )}
              {selecting && (
                <SelectionBar
                  itemLabel="exemplaire"
                  count={selectedCards.length}
                  value={selectedValue}
                  busy={bulkDiscardBusy || bulkFolderBusy}
                  error={bulkFolderError || bulkDiscardError}
                  actions={
                    onMoveCards ? (
                      <div className="yk-selection-folder">
                        <label htmlFor="selection-folder" className="sr-only">
                          Dossier de destination
                        </label>
                        <select
                          id="selection-folder"
                          value={bulkFolderTarget}
                          disabled={bulkFolderBusy || bulkDiscardBusy}
                          onChange={event => {
                            setBulkFolderTarget(event.target.value);
                            setBulkFolderError("");
                          }}
                        >
                          <option value="">Choisir un dossier…</option>
                          <option value="unfiled">Sans dossier</option>
                          {folders.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="secondary"
                          disabled={
                            !selectedCards.length ||
                            !bulkFolderTarget ||
                            bulkFolderBusy ||
                            bulkDiscardBusy
                          }
                          onClick={() => void moveSelection()}
                        >
                          {bulkFolderBusy ? "Rangement…" : "Ranger"}
                        </Button>
                      </div>
                    ) : undefined
                  }
                  onAll={() =>
                    setSelection(
                      new Set(
                        groups
                          .flatMap(group => group.cards)
                          .filter(
                            c =>
                              !c.locked && !presentation[c.instanceId]?.frozen
                          )
                          .map(c => c.instanceId)
                      )
                    )
                  }
                  onNone={() => setSelection(new Set())}
                  onDestroy={() => {
                    setBulkDiscardError("");
                    setBulkFolderError("");
                    setBulkDiscardConfirm(true);
                  }}
                  onClose={() => {
                    setSelecting(false);
                    setSelection(new Set());
                    setBulkFolderTarget("");
                    setBulkFolderError("");
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}
      <Modal
        open={!!selected && !discardConfirm && !auctionOpen && !evolveConfirm}
        onClose={closeDetail}
        title="Détail de la carte"
        className="yk-card-detail-modal"
      >
        {selected && (
          <div className="yk-detail-grid">
            <div className="yk-detail-side">
              <div className="yk-detail-art">
                <YokaiCard
                  {...selected}
                  image={selected.image}
                  {...selectedMeta}
                  fallbackImage={selected.catalogueImage}
                />
              </div>
              {!readOnly && onMoveCard && (
                <div className="yk-detail-folder">
                  <label
                    htmlFor="detail-card-folder"
                    className="yk-section-title"
                  >
                    Dossier
                  </label>
                  <select
                    id="detail-card-folder"
                    value={selected.folderId ?? ""}
                    onChange={event =>
                      void onMoveCard(
                        selected.instanceId,
                        event.target.value || null
                      )
                    }
                  >
                    <option value="">Sans dossier</option>
                    {folders.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="yk-detail-info">
              <header>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-sm font-bold tracking-widest ${rarityText[selected.rarity]}`}
                  >
                    {selected.rarity}
                    {selected.shiny ? " ✦ Shiny" : ""}
                  </span>
                  {selected.isEvolved && (
                    <span className="text-[10px] font-semibold tracking-wider text-accent-gold">
                      ÉVOLUÉE
                    </span>
                  )}
                </div>
                <div className="yk-detail-title-row">
                  <h3 className="font-display text-[28px] leading-tight">
                    {selected.name}
                  </h3>
                  {!readOnly && onSetLocked && (
                    <button
                      type="button"
                      className="yk-detail-lock-toggle"
                      aria-label={
                        selected.locked
                          ? "Déverrouiller la carte"
                          : "Verrouiller la carte"
                      }
                      aria-pressed={!!selected.locked}
                      title={
                        selected.locked
                          ? "Verrouillée : incassable et non échangeable"
                          : "Verrouiller cette carte"
                      }
                      disabled={lockBusy || !!selectedMeta?.frozen}
                      onClick={() => void toggleSelectedLock()}
                    >
                      <ProtectedIcon size={17} />
                    </button>
                  )}
                </div>
                {lockError && (
                  <p role="alert" className="mt-2 text-xs text-danger">
                    {lockError}
                  </p>
                )}
              </header>
              {(selectedGroup?.cards.length ?? 0) > 1 && (
                <div className="yk-copy-picker">
                  <span className="yk-section-title">Exemplaire affiché</span>
                  <div>
                    {selectedGroup?.cards.map((card, index) => (
                      <button
                        type="button"
                        key={card.instanceId}
                        aria-label={`Exemplaire ${index + 1}${card.locked ? ", protégé" : ""}`}
                        aria-pressed={card.instanceId === selected.instanceId}
                        onClick={() => setSelectedId(card.instanceId)}
                      >
                        <span>
                          {index + 1}
                          {card.customImageUrl ? " ✦" : ""}
                        </span>
                        {card.locked ? (
                          <ProtectedIcon size={12} />
                        ) : presentation[card.instanceId]?.frozen ? (
                          " ⏳"
                        ) : (
                          ""
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <dl className="yk-detail-facts">
                <div>
                  <dt>Catégorie</dt>
                  <dd>{selected.category}</dd>
                </div>
                <div>
                  <dt>Obtenue le</dt>
                  <dd>{formatDate(selected.obtainedAt, true)}</dd>
                </div>
                <div>
                  <dt>Exemplaires</dt>
                  <dd>{selectedGroup?.cards.length ?? 1}</dd>
                </div>
                {selectedMeta?.marketValue != null && (
                  <div>
                    <dt>Valeur de marché</dt>
                    <dd>
                      <Karas amount={selectedMeta.marketValue} />
                    </dd>
                  </div>
                )}
              </dl>
              {!readOnly && (
                <CardShareButton
                  key={selected.instanceId}
                  instanceId={selected.instanceId}
                  name={selected.name}
                />
              )}
              <CardReportButton
                cardId={selected.id}
                cardName={selected.name}
                className="mt-4 w-full"
              />
              {selectedGroupFrozen &&
                (adminRemoval ? (
                  <Feedback
                    tone="error"
                    title="Carte actuellement aux enchères"
                  >
                    Le retrait administratif annulera aussi la vente et
                    remboursera automatiquement le meilleur enchérisseur.
                  </Feedback>
                ) : (
                  <Feedback tone="error" title="Carte gelée car en enchère">
                    Cette carte ne peut pas être remise aux enchères ni
                    supprimée jusqu’à ce que la vente soit terminée ou que la
                    carte soit retirée des enchères.
                  </Feedback>
                ))}
              {resolvedTradeHref && !selected.locked && (
                <Link
                  className="yk-button yk-button-primary mt-6 flex w-full justify-center"
                  href={resolvedTradeHref(selected)}
                >
                  Proposer un échange
                </Link>
              )}
              {!readOnly &&
                (onCreateAuction ||
                  (selected.rarity === "SSR" && !selected.shiny)) && (
                  <div className="yk-detail-actions">
                    {onCreateAuction && (
                      <Button
                        className="w-full"
                        disabled={selected.locked || selectedGroupFrozen}
                        onClick={() => void openAuction()}
                      >
                        {selected.locked
                          ? "Carte verrouillée"
                          : selectedGroupFrozen
                            ? "Carte gelée car en enchère"
                            : "Mettre aux enchères"}
                      </Button>
                    )}
                    {selected.rarity === "SSR" && !selected.shiny && (
                      <div className="yk-detail-evolve">
                        <div className="yk-detail-progress-copy">
                          <strong>Progression Shiny</strong>
                          <span>{evolvableCopies}/5 exemplaires</span>
                        </div>
                        <div
                          className="yk-detail-progress"
                          role="progressbar"
                          aria-label="Progression vers l’évolution Shiny"
                          aria-valuemin={0}
                          aria-valuemax={5}
                          aria-valuenow={Math.min(evolvableCopies, 5)}
                        >
                          <span
                            style={{
                              width: `${Math.min(evolvableCopies, 5) * 20}%`
                            }}
                          />
                        </div>
                        <Button
                          variant="secondary"
                          disabled={
                            evolvableCopies < 5 || evolving || !onEvolve
                          }
                          onClick={() => {
                            setEvolutionSelection(
                              new Set(
                                evolvableCards
                                  .slice(0, 5)
                                  .map(card => card.instanceId)
                              )
                            );
                            setEvolutionError("");
                            setEvolveConfirm(true);
                          }}
                        >
                          Évoluer en Shiny
                        </Button>
                      </div>
                    )}
                    {evolutionError && (
                      <p role="alert" className="text-xs text-danger">
                        {evolutionError}
                      </p>
                    )}
                  </div>
                )}
              {!readOnly && onSetCustomImage && (
                <details className="yk-detail-image">
                  <summary>
                    Personnaliser l'image
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
                  <div className="yk-detail-image-content">
                    <div className="yk-detail-image-row">
                      <input
                        id="detail-custom-image"
                        type="url"
                        value={customImageUrl}
                        onChange={event => {
                          setCustomImageUrl(event.target.value);
                          setImageError("");
                        }}
                        placeholder="https://i.imgur.com/image.jpg"
                        aria-label="Lien Imgur personnalisé"
                        className="auth-input"
                      />
                      <Button
                        variant="secondary"
                        disabled={imageBusy || !customImageUrl.trim()}
                        onClick={() =>
                          void saveCustomImage(customImageUrl.trim())
                        }
                      >
                        {imageBusy ? "Enregistrement…" : "Appliquer"}
                      </Button>
                    </div>
                    <p className="yk-detail-hint">
                      Lien https://i.imgur.com/… ou https://imgur.com/…
                      {selected.customImageUrl && (
                        <>
                          {" "}
                          ·{" "}
                          <button
                            type="button"
                            className="yk-detail-link"
                            disabled={imageBusy}
                            onClick={() => void saveCustomImage(null)}
                          >
                            Revenir à l’image d’origine
                          </button>
                        </>
                      )}
                    </p>
                    {imageError && (
                      <p role="alert" className="mt-2 text-xs text-danger">
                        {imageError}
                      </p>
                    )}
                  </div>
                </details>
              )}
              {(!readOnly || adminRemoval) && (onDiscardMany || onDiscard) && (
                <div className="yk-detail-danger">
                  <Button
                    variant="danger"
                    disabled={discardBusy || destructibleCards.length === 0}
                    onClick={() => {
                      setDiscardQuantity(1);
                      setDiscardError("");
                      setDiscardConfirm(true);
                    }}
                  >
                    {adminRemoval
                      ? "Retirer de la collection"
                      : "Détruire des exemplaires"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={evolveConfirm && !!selected}
        onClose={() => {
          if (!evolving) {
            setEvolveConfirm(false);
            setEvolutionError("");
          }
        }}
        title="Confirmer l’évolution Shiny"
      >
        {selected && (
          <>
            <p className="text-sm leading-6 text-ink-2">
              Choisis précisément cinq exemplaires à consommer (
              {evolutionCards.length}/5). La sélection proposée préserve les
              images personnalisées si possible.
            </p>
            <ul className="mt-4 grid gap-3">
              {evolvableCards.map(card => {
                const checked = evolutionSelection.has(card.instanceId);
                return (
                  <li key={card.instanceId}>
                    <button
                      type="button"
                      className="yk-evolution-copy"
                      aria-pressed={checked}
                      onClick={() => toggleEvolutionCard(card.instanceId)}
                    >
                      <strong className="text-ink">
                        {checked ? "✓ Sélectionné" : "Sélectionner"}
                      </strong>
                      <span className="mt-1 block text-ink-2">
                        Obtenu le {formatDate(card.obtainedAt, true)}
                      </span>
                      <span className="mt-1 block text-ink-3">
                        Dossier :{" "}
                        {folders.find(folder => folder.id === card.folderId)
                          ?.name ?? "Sans dossier"}{" "}
                        · Image :{" "}
                        {card.customImageUrl
                          ? "personnalisée (sera perdue)"
                          : "d’origine"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs leading-5 text-ink-3">
              L’évolution créée sera une nouvelle SSR Shiny, sans dossier et
              avec l’image d’origine.
            </p>
            {evolutionError && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {evolutionError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={evolving}
                onClick={() => setEvolveConfirm(false)}
              >
                Annuler
              </Button>
              <Button
                disabled={evolving || evolutionCards.length !== 5}
                onClick={() => void evolveSelected()}
              >
                {evolving ? "Évolution…" : "Confirmer l’évolution"}
              </Button>
            </div>
          </>
        )}
      </Modal>
      {!readOnly && (
        <Modal
          open={bulkDiscardConfirm}
          onClose={() => {
            if (!bulkDiscardBusy) setBulkDiscardConfirm(false);
          }}
          title="Détruire la sélection ?"
        >
          <p className="text-sm leading-6 text-ink-2">
            Détruire{" "}
            <strong className="text-ink">
              {selectedCards.length} exemplaire
              {selectedCards.length > 1 ? "s" : ""}
            </strong>{" "}
            pour{" "}
            <strong className="text-karas">{selectedValue ?? "…"} Karas</strong>{" "}
            ? Action irréversible.
          </p>
          {bulkDiscardError && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {bulkDiscardError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={bulkDiscardBusy}
              onClick={() => setBulkDiscardConfirm(false)}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={bulkDiscardBusy || selectedValue == null}
              onClick={() => void discardSelection()}
            >
              {bulkDiscardBusy ? "Destruction…" : "Confirmer la destruction"}
            </Button>
          </div>
        </Modal>
      )}
      <Modal
        open={discardConfirm && !!selected}
        onClose={() => {
          if (!discardBusy) {
            setDiscardConfirm(false);
            setDiscardError("");
          }
        }}
        title={
          adminRemoval ? "Retirer cette carte ?" : "Détruire des exemplaires ?"
        }
      >
        {selected && (
          <>
            {adminRemoval ? (
              <p className="text-sm leading-6 text-ink-2">
                Retirer définitivement cet exemplaire de{" "}
                <strong className="text-ink">{selected.name}</strong> de la
                collection du joueur ? Aucun Kara ne sera crédité. Cette action
                est irréversible.
              </p>
            ) : (
              <>
                <p className="text-sm leading-6 text-ink-2">
                  Choisis combien d’exemplaires de{" "}
                  <strong className="text-ink">{selected.name}</strong>{" "}
                  détruire. Les copies sans image personnalisée sont consommées
                  en premier, puis les plus anciennes.
                </p>
                <div className="yk-quantity-picker">
                  <button
                    type="button"
                    aria-label="Détruire un exemplaire de moins"
                    disabled={discardQuantity <= 1 || discardBusy}
                    onClick={() =>
                      setDiscardQuantity(value => Math.max(1, value - 1))
                    }
                  >
                    −
                  </button>
                  <output aria-live="polite">{discardQuantity}</output>
                  <button
                    type="button"
                    aria-label="Détruire un exemplaire de plus"
                    disabled={
                      discardQuantity >= destructibleCards.length || discardBusy
                    }
                    onClick={() =>
                      setDiscardQuantity(value =>
                        Math.min(destructibleCards.length, value + 1)
                      )
                    }
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={
                      discardBusy ||
                      discardQuantity === destructibleCards.length
                    }
                    onClick={() => setDiscardQuantity(destructibleCards.length)}
                  >
                    Tout détruire
                  </button>
                </div>
                <p className="mt-4 text-sm text-ink-2">
                  Tu détruiras{" "}
                  <strong className="text-ink">
                    {discardCards.length} exemplaire
                    {discardCards.length > 1 ? "s" : ""}
                  </strong>{" "}
                  et recevras{" "}
                  <strong className="text-karas">
                    {discardValue} Kara{discardValue > 1 ? "s" : ""}
                  </strong>
                  .
                </p>
              </>
            )}
            {destructibleCards.length < (selectedGroup?.cards.length ?? 0) && (
              <p className="mt-2 text-xs text-ink-3">
                {(selectedGroup?.cards.length ?? 0) - destructibleCards.length}{" "}
                exemplaire(s) en enchère sont exclus.
              </p>
            )}
            {discardError && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {discardError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={discardBusy}
                onClick={() => setDiscardConfirm(false)}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                disabled={discardBusy || discardCards.length === 0}
                onClick={() => void discardSelected()}
              >
                {discardBusy
                  ? adminRemoval
                    ? "Retrait…"
                    : "Destruction…"
                  : adminRemoval
                    ? "Retirer la carte"
                    : `Détruire ${discardCards.length}`}
              </Button>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={auctionOpen && !!selected}
        onClose={closeAuction}
        title={auctionDone ? "Carte mise aux enchères" : "Mettre aux enchères"}
        className="yk-auction-modal"
      >
        {selected &&
          (auctionDone ? (
            <>
              <Feedback
                tone="success"
                title="Carte mise aux enchères — verrouillée jusqu’à la fin de la vente"
              >
                Elle apparaît dès maintenant sur le marché.
              </Feedback>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={closeAuction}>
                  Fermer
                </Button>
                <Link href="/marche" className="yk-button yk-button-primary">
                  Voir le marché
                </Link>
              </div>
            </>
          ) : (
            <form
              onSubmit={event => {
                event.preventDefault();
                if (Number(auctionPrice) >= 10) void auctionSelected();
              }}
            >
              <div className="yk-auction-modal-grid">
                <div className="yk-auction-modal-art">
                  <YokaiCard
                    {...selected}
                    image={selected.image}
                    fallbackImage={selected.catalogueImage}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-bold tracking-widest ${rarityText[selected.rarity]}`}
                  >
                    {selected.rarity}
                    {selected.shiny ? " ✦" : ""}
                  </p>
                  <h3 className="mt-1 font-display text-2xl leading-tight">
                    {selected.name}
                  </h3>
                  <label
                    className="mt-5 block text-xs font-semibold tracking-wider text-ink-3 uppercase"
                    htmlFor="auction-price"
                  >
                    Prix de départ
                  </label>
                  <input
                    id="auction-price"
                    type="number"
                    inputMode="numeric"
                    min="10"
                    value={auctionPrice}
                    onChange={e => setAuctionPrice(e.target.value)}
                    aria-invalid={Number(auctionPrice) < 10 || undefined}
                    className="auth-input mt-2"
                  />
                  <p
                    className={`mt-2 text-xs ${Number(auctionPrice) < 10 ? "text-danger-ink" : "text-ink-3"}`}
                  >
                    Minimum 10 Karas.
                  </p>
                  {auctionSuggestionBusy ? (
                    <p className="mt-3 text-xs text-ink-3">
                      Recherche de la valeur de marché…
                    </p>
                  ) : auctionSuggestion != null ? (
                    <div className="yk-auction-suggestion">
                      <span>
                        Suggestion : <Karas amount={auctionSuggestion} />
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAuctionPrice(String(auctionSuggestion))
                        }
                      >
                        Utiliser cette valeur
                      </button>
                    </div>
                  ) : null}
                  <fieldset className="mt-5">
                    <legend className="mb-2 text-xs font-semibold tracking-wider text-ink-3 uppercase">
                      Durée
                    </legend>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["15", "15 min"],
                        ["30", "30 min"],
                        ["60", "1 h"],
                        ["240", "4 h"],
                        ["720", "12 h"],
                        ["1440", "24 h"]
                      ].map(([value, label]) => (
                        <Chip
                          key={value}
                          active={auctionDuration === value}
                          className="justify-center"
                          onClick={() => setAuctionDuration(value)}
                        >
                          {label}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
              <ul className="yk-auction-modal-notes">
                <li>
                  La carte sera verrouillée jusqu’à la fin de la vente :
                  impossible de l’échanger ou de la détruire.
                </li>
                {selected.customImageUrl && (
                  <li>
                    L’image personnalisée de cette carte sera réinitialisée.
                  </li>
                )}
              </ul>
              {auctionError && (
                <p role="alert" className="mt-4 text-sm text-danger">
                  {auctionError}
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                  variant="secondary"
                  disabled={auctionBusy}
                  onClick={closeAuction}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={auctionBusy || Number(auctionPrice) < 10}
                  aria-busy={auctionBusy || undefined}
                >
                  {auctionBusy ? "Publication…" : "Mettre en vente"}
                </Button>
              </div>
            </form>
          ))}
      </Modal>
    </section>
  );
}
