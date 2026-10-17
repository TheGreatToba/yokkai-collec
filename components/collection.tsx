"use client";
/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  Card,
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
import { CatalogueCardModal } from "@/components/catalogue-card-modal";
import { BINDER_CARD_PAGE_SIZES, CARD_PAGE_SIZES } from "@/lib/ui/pagination";
import {
  COLLECTION_SORTS,
  isCollectionSort,
  sortCollection
} from "@/lib/ui/collection-sort";
import { matchesCardSearch } from "@/lib/ui/card-search";
import { useCollectionSort } from "@/hooks/use-collection-sort";
import { getCardDiscovery } from "@/lib/data/wishlist";
import { useLocalAuctionQuota } from "@/components/local-auction-quota";
import { auctionLimitMessage } from "@/lib/ui/local-auction-quota";
import {
  useCardCustomizationAccess,
  PRO_CARD_CUSTOMIZATION_MESSAGE
} from "@/components/card-customization-access";
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
  new Date(value).toLocaleDateString("en-US", {
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
  onSetPaniniAlbumFavorite,
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
    favoritesOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) => Promise<PaniniAlbumPage>;
  loadPaniniAlbumCards?: (options: {
    license: string;
    query?: string;
    category?: string;
    rarity?: Rarity | "";
    ownedOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) => Promise<PaniniAlbumCardPage>;
  onSetPaniniAlbumFavorite?: (
    license: string,
    favorite: boolean
  ) => Promise<void>;
  loadCardDiscovery?: (
    cardId: string
  ) => Promise<{ marketValue: number | null }>;
}) {
  const pathname = usePathname();
  const canCustomizeImages = useCardCustomizationAccess();
  const auctionQuota = useLocalAuctionQuota();
  const auctionQuotaFull =
    !!auctionQuota && auctionQuota.active >= auctionQuota.limit;
  const profileIdentifier = pathname?.startsWith("/profile/")
    ? decodeURIComponent(pathname.slice("/profile/".length))
    : undefined;
  const resolvedTradeHref =
    tradeHref ??
    (readOnly && profileIdentifier
      ? (card: CollectedCard) =>
          `/trades?ami=${encodeURIComponent(profileIdentifier)}&carte=${encodeURIComponent(card.instanceId)}`
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
  const [albumSearchBeforeOpen, setAlbumSearchBeforeOpen] = useState("");
  const [paniniAlbumPage, setPaniniAlbumPage] = useState(1);
  const [paniniPage, setPaniniPage] = useState(1);
  const [paniniPageSize, setPaniniPageSize] = useState<number>(
    BINDER_CARD_PAGE_SIZES[0]
  );
  const [hideMissingCards, setHideMissingCards] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedMissingCard, setSelectedMissingCard] = useState<Card | null>(
    null
  );
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
  const [favoriteError, setFavoriteError] = useState("");
  const [paniniAlbumRefresh, setPaniniAlbumRefresh] = useState(0);
  const [favoriteLicenseBusy, setFavoriteLicenseBusy] = useState<string | null>(
    null
  );
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
          "BRAINROT",
          "DISNEY CHANNEL",
          "FILM",
          "INTERNET PERSONALITY",
          "KDRAMA",
          "KPOP",
          "MEME",
          "VOCALOID",
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
        favoritesOnly,
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
                  : "Couldn't load binders."
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
    favoritesOnly,
    loadPaniniAlbums,
    paniniAlbumRefresh,
    query,
    selectedLicense,
    viewMode
  ]);

  const togglePaniniAlbumFavorite = async (
    license: string,
    favorite: boolean
  ) => {
    if (!onSetPaniniAlbumFavorite || favoriteLicenseBusy) return;
    setFavoriteLicenseBusy(license);
    setFavoriteError("");
    setPaniniAlbums(current => ({
      ...current,
      items: current.items.map(item =>
        item.license === license ? { ...item, favorite } : item
      )
    }));
    try {
      await onSetPaniniAlbumFavorite(license, favorite);
      setPaniniAlbumPage(1);
      setPaniniAlbumRefresh(current => current + 1);
    } catch (error) {
      setPaniniAlbums(current => ({
        ...current,
        items: current.items.map(item =>
          item.license === license ? { ...item, favorite: !favorite } : item
        )
      }));
      setFavoriteError(
        error instanceof Error
          ? error.message
          : "Couldn't update this favorite."
      );
    } finally {
      setFavoriteLicenseBusy(null);
    }
  };

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
        rarity,
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
                  : "Couldn't load this binder's cards."
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
    rarity,
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
        error instanceof Error ? error.message : "Couldn't evolve this card."
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
        error instanceof Error ? error.message : "Couldn't create this folder."
      );
    } finally {
      setFolderBusy(false);
    }
  }
  async function auctionSelected() {
    if (!selected || !onCreateAuction || auctionBusy || selectedGroupFrozen)
      return;
    if (auctionQuotaFull) return;
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
        error instanceof Error ? error.message : "Couldn't create this auction."
      );
    } finally {
      setAuctionBusy(false);
    }
  }
  async function openAuction() {
    if (!selected || selectedGroupFrozen || auctionQuotaFull) return;
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
    if (imageUrl !== null && !canCustomizeImages) return;
    setImageBusy(true);
    setImageError("");
    try {
      await onSetCustomImage(selected.instanceId, imageUrl);
      setCustomImageUrl("");
    } catch (error) {
      setImageError(
        error instanceof Error
          ? error.message
          : "Couldn't customize this image."
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
          : "Couldn't change this card's lock."
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
        error instanceof Error ? error.message : "Couldn't destroy this card."
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
          : "Couldn't destroy the selected cards."
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
          : "Couldn't move the selected cards."
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
    setPaniniPage(1);
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
          Search collection
        </label>
        <input
          id="collection-query"
          type="search"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search…"
        />
      </div>
      <FilterSection title="Rarity">
        <button
          type="button"
          className="yk-filter-option"
          aria-pressed={!rarity}
          onClick={() => {
            setRarity("");
            setPage(1);
            setPaniniPage(1);
          }}
        >
          <span className="yk-filter-check" />
          <span>All</span>
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
              setPaniniPage(1);
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
      <FilterSection title="Category">
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
          <span>All categories</span>
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
        <FilterSection title="Status">
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
            <span>In auctions</span>
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
        <FilterSection title="Folder">
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
            <span>All folders</span>
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
            <span>Locked cards</span>
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
            <span>No folder</span>
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
              + New folder
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
                placeholder="New folder"
                aria-label="New folder name"
              />
              <Button
                variant="secondary"
                disabled={folderBusy || !folderName.trim()}
                onClick={() => void addFolder()}
              >
                {folderBusy ? "Creating…" : "Create"}
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
                Delete this folder
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
        Reset filters
      </button>
    </>
  );
  return (
    <section
      aria-label={detailOnly ? "Card details" : "Card collection"}
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
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            />
          )}
          <div className="yk-collection-layout">
            <aside
              id="collection-filters"
              className={`yk-collection-sidebar ${filtersOpen ? "yk-sidebar-open" : ""}`}
              aria-label="Collection filters"
            >
              <div className="yk-sidebar-mobile-head">
                <strong>Filters</strong>
                <button
                  type="button"
                  aria-label="Close filters"
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
                  Filters
                  {query || rarity || category || folder || auctionOnly ? (
                    <span>•</span>
                  ) : null}
                </button>
                <div className="yk-collection-toolbar-actions">
                  {!readOnly && <MyCardShares />}
                  <label className="yk-sort-control">
                    <span>Sort by:</span>
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
                      aria-label="Sort collection"
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
                    <span>Binder</span>
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
                  <span>Shiny only</span>
                  <i />
                </button>
                <div className="yk-view-toggle" aria-label="Display mode">
                  <button
                    type="button"
                    aria-label="Grid view"
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
                    aria-label="List view"
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
                <section className="yk-panini" aria-label="License binders">
                  {selectedLicense ? (
                    <>
                      <div className="yk-panini-album-head">
                        <button
                          type="button"
                          className="yk-panini-back"
                          onClick={() => {
                            setSelectedLicense(null);
                            setQuery(albumSearchBeforeOpen);
                            setPaniniPage(1);
                          }}
                        >
                          ← All binders
                        </button>
                        <div>
                          <p className="yk-section-title">Binder</p>
                          <h2>{selectedLicense}</h2>
                        </div>
                        <p>
                          {selectedAlbum?.owned ?? selectedLicenseOwned} /{" "}
                          {(
                            selectedAlbum?.total ?? paniniCards.total
                          ).toLocaleString("en-US")}{" "}
                          {(selectedAlbum?.total ?? paniniCards.total) === 1
                            ? "card"
                            : "cards"}
                        </p>
                      </div>
                      <div className="yk-panini-controls">
                        <label className="yk-panini-search">
                          <span className="sr-only">
                            Search cards in this license
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
                            placeholder="Search cards…"
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
                            ? "Show missing cards"
                            : "Hide missing cards"}
                        </button>
                      </div>
                      {paniniError && (
                        <div className="yk-panini-empty" role="alert">
                          <strong>Couldn&apos;t load</strong>
                          <p>{paniniError}</p>
                        </div>
                      )}
                      {paniniBusy && (
                        <div className="yk-panini-empty" role="status">
                          <strong>Loading binder…</strong>
                        </div>
                      )}
                      {!paniniBusy &&
                        !paniniError &&
                        paniniCards.total === 0 && (
                          <div className="yk-panini-empty">
                            <strong>No cards found</strong>
                            <p>Try another character name.</p>
                          </div>
                        )}
                      <ul
                        className="yk-panini-slots"
                        aria-label={`Cards from ${selectedLicense}`}
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
                                  aria-label={`View ${owned.name}`}
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
                                <button
                                  type="button"
                                  className="yk-panini-missing"
                                  onClick={() => setSelectedMissingCard(card)}
                                  aria-label={`${card.name}, card not owned`}
                                  aria-haspopup="dialog"
                                >
                                  <CardShell interactive={false}>
                                    <YokaiCard
                                      {...card}
                                      animated={false}
                                      className="yk-panini-missing-card"
                                      imageSizes={COLLECTION_CARD_IMAGE_SIZES}
                                    />
                                  </CardShell>
                                </button>
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
                            label={`Binder pages ${selectedLicense}`}
                          />
                          <label>
                            Cards per page
                            <select
                              value={paniniPageSize}
                              onChange={event => {
                                setPaniniPageSize(Number(event.target.value));
                                setPaniniPage(1);
                              }}
                            >
                              {BINDER_CARD_PAGE_SIZES.map(size => (
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
                          <p className="yk-section-title">Binder</p>
                          <h2>My license binders</h2>
                        </div>
                        <p>
                          {paniniAlbums.total.toLocaleString("en-US")}{" "}
                          {paniniAlbums.total === 1 ? "license" : "licenses"}{" "}
                          shown
                        </p>
                      </div>
                      <div className="yk-panini-album-filters">
                        <label className="yk-panini-search">
                          <span className="sr-only">Search licenses</span>
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
                            placeholder="Search licenses…"
                          />
                        </label>
                        {onSetPaniniAlbumFavorite && (
                          <button
                            type="button"
                            className="yk-panini-owned-toggle"
                            aria-pressed={favoritesOnly}
                            onClick={() => {
                              setFavoritesOnly(current => !current);
                              setPaniniAlbumPage(1);
                            }}
                          >
                            <span aria-hidden="true">
                              {favoritesOnly ? "✓" : "○"}
                            </span>
                            ★ Favorites only
                          </button>
                        )}
                      </div>
                      {paniniError && (
                        <div className="yk-panini-empty" role="alert">
                          <strong>Couldn&apos;t load</strong>
                          <p>{paniniError}</p>
                        </div>
                      )}
                      {paniniBusy && (
                        <div className="yk-panini-empty" role="status">
                          <strong>Loading binders…</strong>
                        </div>
                      )}
                      {favoriteError && (
                        <div className="yk-panini-favorite-error" role="alert">
                          {favoriteError}
                        </div>
                      )}
                      {!paniniBusy &&
                      !paniniError &&
                      paniniAlbums.total === 0 ? (
                        <div className="yk-panini-empty">
                          <strong>No licenses found</strong>
                          <p>Try another name in the search bar.</p>
                        </div>
                      ) : !paniniBusy && !paniniError ? (
                        <ul className="yk-panini-grid">
                          {paniniAlbums.items.map(item => (
                            <li
                              key={item.license}
                              className={
                                item.favorite
                                  ? "yk-panini-album-item is-favorite"
                                  : "yk-panini-album-item"
                              }
                            >
                              <button
                                type="button"
                                className="yk-panini-album-open"
                                onClick={() => {
                                  setAlbumSearchBeforeOpen(query);
                                  setSelectedLicense(item.license);
                                  setQuery("");
                                  setPaniniPage(1);
                                }}
                                aria-label={`View ${item.license}, ${item.owned.toLocaleString("en-US")} of ${item.total.toLocaleString("en-US")} ${item.total === 1 ? "card" : "cards"}`}
                              >
                                <span className="yk-panini-details">
                                  <strong>{item.license}</strong>
                                  <span className="yk-panini-count">
                                    <b>{item.owned.toLocaleString("en-US")}</b>{" "}
                                    / {item.total.toLocaleString("en-US")}{" "}
                                    {item.total === 1 ? "card" : "cards"}
                                  </span>
                                  <span className="yk-panini-progress">
                                    <i style={{ width: `${item.percent}%` }} />
                                  </span>
                                  <small>{item.percent}% complete</small>
                                </span>
                              </button>
                              {onSetPaniniAlbumFavorite && (
                                <button
                                  type="button"
                                  className="yk-panini-favorite"
                                  aria-label={`${item.favorite ? "Remove" : "Add"} ${item.license} ${item.favorite ? "from" : "to"} favorites`}
                                  aria-pressed={item.favorite}
                                  disabled={favoriteLicenseBusy !== null}
                                  onPointerDown={event =>
                                    event.stopPropagation()
                                  }
                                  onClick={event => {
                                    event.stopPropagation();
                                    void togglePaniniAlbumFavorite(
                                      item.license,
                                      !item.favorite
                                    );
                                  }}
                                >
                                  <svg
                                    aria-hidden="true"
                                    width="19"
                                    height="19"
                                    viewBox="0 0 24 24"
                                    fill={
                                      item.favorite ? "currentColor" : "none"
                                    }
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <path d="m12 2.8 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 16.83l-5.5 2.89 1.05-6.12L3.1 9.27l6.15-.9L12 2.8Z" />
                                  </svg>
                                </button>
                              )}
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
                            label="Binder pages"
                          />
                          <span className="yk-panini-page-limit">
                            72 binders per page
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
                      ? "Your collection is empty — open your first pack."
                      : "No cards match these filters."}
                  </p>
                  {cards.length === 0 ? (
                    <Link
                      href="/boosters"
                      className="yk-button yk-button-primary mt-6"
                    >
                      Open my first pack
                    </Link>
                  ) : (
                    <p className="mt-3 text-sm text-ink-2">
                      Try another rarity or category.
                    </p>
                  )}
                </div>
              ) : null}
              {viewMode !== "panini" && (
                <ul
                  className={`yk-card-grid yk-collection-grid ${viewMode === "list" ? "yk-collection-grid-list" : ""}`}
                  aria-label="Owned card groups"
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
                          aria-label={`${selecting ? "Select" : "View"} ${card.name}, ${card.rarity}, ${group.cards.length.toLocaleString("en-US")} ${group.cards.length === 1 ? "copy" : "copies"}`}
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
                              aria-label="Protected card"
                              title="Protected card"
                            >
                              <ProtectedIcon size={16} />
                            </span>
                          )}
                          {lockedCount === 0 && frozenCount > 0 && (
                            <span className="yk-group-frozen">
                              {frozenCount} in auction
                            </span>
                          )}
                        </button>
                        <div className="yk-collection-card-meta">
                          {historyGroup.isFirstOwner ? (
                            <p className="text-[11px] font-semibold text-rarity-lr">
                              First owner, obtained on{" "}
                              {formatDate(historyGroup.firstObtainedAt)}
                            </p>
                          ) : (
                            <p className="text-[11px] tracking-wider text-ink-3 uppercase">
                              Obtained on{" "}
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
                    label="Collection pages"
                  />
                  <label>
                    Cards per page
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
                          Destination folder
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
                          <option value="">Choose a folder…</option>
                          <option value="unfiled">No folder</option>
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
                          {bulkFolderBusy ? "Moving…" : "Move"}
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
        title="Card details"
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
                    Folder
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
                    <option value="">No folder</option>
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
                      EVOLVED
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
                      aria-label={selected.locked ? "Unlock card" : "Lock card"}
                      aria-pressed={!!selected.locked}
                      title={
                        selected.locked
                          ? "Locked: can't be destroyed or traded"
                          : "Lock this card"
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
                  <span className="yk-section-title">Displayed copy</span>
                  <div>
                    {selectedGroup?.cards.map((card, index) => (
                      <button
                        type="button"
                        key={card.instanceId}
                        aria-label={`Copy ${index + 1}${card.locked ? ", protected" : ""}`}
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
                  <dt>Category</dt>
                  <dd>{selected.category}</dd>
                </div>
                <div>
                  <dt>Obtained on</dt>
                  <dd>{formatDate(selected.obtainedAt, true)}</dd>
                </div>
                <div>
                  <dt>Copies</dt>
                  <dd>{selectedGroup?.cards.length ?? 1}</dd>
                </div>
                {selectedMeta?.marketValue != null && (
                  <div>
                    <dt>Market value</dt>
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
                  <Feedback tone="error" title="Card frozen while in auction">
                    This card can&apos;t be listed again or destroyed until the
                    auction ends or the card is withdrawn.
                  </Feedback>
                ))}
              {resolvedTradeHref && !selected.locked && (
                <Link
                  className="yk-button yk-button-primary mt-6 flex w-full justify-center"
                  href={resolvedTradeHref(selected)}
                >
                  Offer a trade
                </Link>
              )}
              {!readOnly &&
                (onCreateAuction ||
                  (selected.rarity === "SSR" && !selected.shiny)) && (
                  <div className="yk-detail-actions">
                    {onCreateAuction && (
                      <Button
                        className="w-full"
                        disabled={
                          selected.locked ||
                          selectedGroupFrozen ||
                          auctionQuotaFull
                        }
                        aria-describedby={
                          auctionQuotaFull ? "auction-quota-notice" : undefined
                        }
                        onClick={() => void openAuction()}
                      >
                        {selected.locked
                          ? "Card locked"
                          : selectedGroupFrozen
                            ? "Card frozen while in auction"
                            : "List for auction"}
                      </Button>
                    )}
                    {onCreateAuction && auctionQuota && (
                      <p id="auction-quota-notice" className="yk-detail-hint">
                        Active auctions: {auctionQuota.active} /{" "}
                        {auctionQuota.limit}.
                        {auctionQuotaFull && (
                          <>
                            {" "}
                            {auctionLimitMessage(auctionQuota.limit)}{" "}
                            {auctionQuota.limit === 3 && (
                              <Link href="/premium" className="yk-detail-link">
                                Discover Yokkai Pro
                              </Link>
                            )}
                          </>
                        )}
                      </p>
                    )}
                    {selected.rarity === "SSR" && !selected.shiny && (
                      <div className="yk-detail-evolve">
                        <div className="yk-detail-progress-copy">
                          <strong>Shiny progress</strong>
                          <span>{evolvableCopies}/5 copies</span>
                        </div>
                        <div
                          className="yk-detail-progress"
                          role="progressbar"
                          aria-label="Progress toward Shiny evolution"
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
                          Evolve to Shiny
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
                    Customize image
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
                        aria-label="Custom Imgur link"
                        aria-describedby={
                          !canCustomizeImages
                            ? "detail-custom-image-pro-notice"
                            : undefined
                        }
                        className="auth-input"
                      />
                      <Button
                        variant="secondary"
                        disabled={
                          !canCustomizeImages ||
                          imageBusy ||
                          !customImageUrl.trim()
                        }
                        onClick={() =>
                          void saveCustomImage(customImageUrl.trim())
                        }
                      >
                        {imageBusy ? "Saving…" : "Apply"}
                      </Button>
                    </div>
                    {!canCustomizeImages && (
                      <p
                        id="detail-custom-image-pro-notice"
                        className="yk-detail-hint"
                      >
                        {PRO_CARD_CUSTOMIZATION_MESSAGE}{" "}
                        <Link href="/premium" className="yk-detail-link">
                          Discover Yokkai Pro
                        </Link>
                      </p>
                    )}
                    <p className="yk-detail-hint">
                      Link: https://i.imgur.com/… or https://imgur.com/…
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
                            Restore original image
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
                      : "Destroy copies"}
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
        title="Confirm Shiny evolution"
      >
        {selected && (
          <>
            <p className="text-sm leading-6 text-ink-2">
              Choose exactly five copies to consume ({evolutionCards.length}/5).
              The suggested selection preserves custom images where possible.
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
                        {checked ? "✓ Selected" : "Select"}
                      </strong>
                      <span className="mt-1 block text-ink-2">
                        Obtained on {formatDate(card.obtainedAt, true)}
                      </span>
                      <span className="mt-1 block text-ink-3">
                        Folder:{" "}
                        {folders.find(folder => folder.id === card.folderId)
                          ?.name ?? "No folder"}{" "}
                        · Image:{" "}
                        {card.customImageUrl
                          ? "custom (will be lost)"
                          : "original"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs leading-5 text-ink-3">
              The result is a new Shiny SSR card, with no folder and its
              original image.
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
                Cancel
              </Button>
              <Button
                disabled={evolving || evolutionCards.length !== 5}
                onClick={() => void evolveSelected()}
              >
                {evolving ? "Evolving…" : "Confirm evolution"}
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
          title="Destroy selected cards?"
        >
          <p className="text-sm leading-6 text-ink-2">
            Destroy{" "}
            <strong className="text-ink">
              {selectedCards.length.toLocaleString("en-US")}{" "}
              {selectedCards.length === 1 ? "copy" : "copies"}
            </strong>{" "}
            for{" "}
            <strong className="text-karas">{selectedValue ?? "…"} Karas</strong>{" "}
            ? This can&apos;t be undone.
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
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={bulkDiscardBusy || selectedValue == null}
              onClick={() => void discardSelection()}
            >
              {bulkDiscardBusy ? "Destroying…" : "Confirm destruction"}
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
        title={adminRemoval ? "Retirer cette carte ?" : "Destroy copies?"}
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
                  Choose how many copies of{" "}
                  <strong className="text-ink">{selected.name}</strong> to
                  destroy. Copies with no custom image are used first, followed
                  by the oldest copies.
                </p>
                <div className="yk-quantity-picker">
                  <button
                    type="button"
                    aria-label="Destroy one fewer copy"
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
                    aria-label="Destroy one more copy"
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
                    Destroy all
                  </button>
                </div>
                <p className="mt-4 text-sm text-ink-2">
                  You&apos;ll destroy{" "}
                  <strong className="text-ink">
                    {discardCards.length.toLocaleString("en-US")}{" "}
                    {discardCards.length === 1 ? "copy" : "copies"}
                  </strong>{" "}
                  and receive{" "}
                  <strong className="text-karas">
                    {discardValue?.toLocaleString("en-US")} Karas
                  </strong>
                  .
                </p>
              </>
            )}
            {destructibleCards.length < (selectedGroup?.cards.length ?? 0) && (
              <p className="mt-2 text-xs text-ink-3">
                Excluded copies in auctions:{" "}
                {(selectedGroup?.cards.length ?? 0) - destructibleCards.length}.
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
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={discardBusy || discardCards.length === 0}
                onClick={() => void discardSelected()}
              >
                {discardBusy
                  ? adminRemoval
                    ? "Retrait…"
                    : "Destroying…"
                  : adminRemoval
                    ? "Retirer la carte"
                    : `Destroy ${discardCards.length}`}
              </Button>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={auctionOpen && !!selected}
        onClose={closeAuction}
        title={auctionDone ? "Card listed for auction" : "List for auction"}
        className="yk-auction-modal"
      >
        {selected &&
          (auctionDone ? (
            <>
              <Feedback
                tone="success"
                title="Card listed for auction — locked until the auction ends"
              >
                It&apos;s now listed on the market.
              </Feedback>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={closeAuction}>
                  Close
                </Button>
                <Link href="/market" className="yk-button yk-button-primary">
                  View market
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
                    Starting bid
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
                    Minimum: 10 Karas.
                  </p>
                  {auctionSuggestionBusy ? (
                    <p className="mt-3 text-xs text-ink-3">
                      Looking up market value…
                    </p>
                  ) : auctionSuggestion != null ? (
                    <div className="yk-auction-suggestion">
                      <span>
                        Suggested: <Karas amount={auctionSuggestion} />
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAuctionPrice(String(auctionSuggestion))
                        }
                      >
                        Use this value
                      </button>
                    </div>
                  ) : null}
                  <fieldset className="mt-5">
                    <legend className="mb-2 text-xs font-semibold tracking-wider text-ink-3 uppercase">
                      Duration
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
                  This card will be locked until the auction ends. You
                  won&apos;t be able to trade or destroy it.
                </li>
                {selected.customImageUrl && (
                  <li>This card&apos;s custom image will be reset.</li>
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    auctionQuotaFull || auctionBusy || Number(auctionPrice) < 10
                  }
                  aria-busy={auctionBusy || undefined}
                >
                  {auctionBusy ? "Listing…" : "List for auction"}
                </Button>
              </div>
            </form>
          ))}
      </Modal>
      <CatalogueCardModal
        selected={selectedMissingCard}
        onClose={() => setSelectedMissingCard(null)}
      />
    </section>
  );
}
