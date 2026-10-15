"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent
} from "react";
import { Avatar, Button, Modal, Toast } from "@/components/ui";
import { YokaiCard } from "@/components/yokai-card";
import { CardShell } from "@/components/card-shell";
import { CollectionView } from "@/components/collection";
import { PlayerModeration } from "@/components/player-moderation";
import { ProfileLicensePicker } from "@/components/profile-license-picker";
import { ProfileWall } from "@/components/profile-wall";
import { ProfileSales } from "@/components/profile-sales";
import { ProfileBanner } from "@/components/profile-banner";
import {
  CatalogueCardModal,
  type CatalogueCardAdapter
} from "@/components/community-views";
import type { WallAdapter } from "@/lib/data/profile-wall";
import type { ProfileMarketAdapter } from "@/lib/data/profile-market";
import { listBlockedUsers, type BlockedUser } from "@/lib/data/moderation";
import { type ModerationAdapter } from "@/lib/data/moderation";
import { FriendAction, type FriendActionAdapter } from "@/components/friends";
import {
  searchCards,
  type Card,
  type CollectedCard,
  type Rarity
} from "@/lib/data/cards";
import {
  getFriendCollection,
  getFriendPaniniAlbumCardsPage,
  getFriendPaniniAlbumsPage,
  getProfile,
  getProfileDetails,
  getProfileEngagement,
  setProfileLike,
  getProfileWidgetLicenses,
  saveProfileAppearance,
  saveProfileWidgets,
  uploadBanner,
  uploadAvatar,
  type ProfileDetails,
  type ProfileEngagement,
  type ProfileWidget,
  type Profile
} from "@/lib/data/profile";
import { getWishlist, type WishlistCard } from "@/lib/data/wishlist";
import { matchesCardSearch } from "@/lib/ui/card-search";

const FEATURED_CARD_LIMIT = 5;
const PROFILE_CARD_IMAGE_SIZES =
  "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 190px";

function widgetLabel(category: string) {
  const labels: Record<string, string> = {
    "ANIME/MANGA": "Animes & mangas favoris",
    "VIDEO GAMES": "Jeux préférés",
    KPOP: "Groupes de K-pop",
    FILM: "Films préférés",
    SERIE: "Séries préférées",
    KDRAMA: "K-dramas favoris",
    COMICS: "Comics favoris",
    ARTIST: "Artistes préférés",
    VOCALOID: "Vocaloid favoris",
    MANWHA: "Manhwas favoris",
    SPORT: "Sports préférés",
    "DISNEY CHANNEL": "Disney Channel",
    MEME: "Mèmes favoris",
    BRAINROT: "Brainrot favoris"
  };
  return labels[category] ?? category;
}

function ProfilePrivate() {
  return (
    <p className="yk-profile-empty">
      Cette collection est privée. Son activité et ses classeurs sont réservés
      aux personnes autorisées.
    </p>
  );
}

function PreferencesEditor({
  widgets,
  categories,
  loadLicenses,
  save,
  onSaved
}: {
  widgets: ProfileWidget[];
  categories: string[];
  loadLicenses: typeof getProfileWidgetLicenses;
  save: typeof saveProfileWidgets;
  onSaved: (value: ProfileWidget[]) => void;
}) {
  const [values, setValues] = useState<ProfileWidget[]>(() =>
    widgets.map(widget => ({ ...widget, entries: [...widget.entries] }))
  );
  const [activeCategory, setActiveCategory] = useState(
    widgets[0]?.category ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="yk-profile-preferences-form"
      onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        const next = values;
        if (next.some(widget => widget.entries.length > 12)) {
          setError("Maximum 12 licences par catégorie.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          onSaved(await save(next));
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Enregistrement impossible."
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="yk-profile-muted">
        Choisis une catégorie, puis jusqu’à 12 licences du catalogue à mettre en
        avant. Aucune saisie libre.
      </p>
      <div
        className="yk-profile-widget-picker"
        aria-label="Catégories disponibles"
      >
        {categories.map(category => {
          const selected = values.some(widget => widget.category === category);
          return (
            <button
              key={category}
              type="button"
              aria-pressed={selected}
              disabled={busy || (!selected && values.length >= 12)}
              onClick={() => {
                if (!selected)
                  setValues(current => [...current, { category, entries: [] }]);
                setActiveCategory(category);
              }}
            >
              <span aria-hidden="true">{selected ? "✓" : "+"}</span> {category}
            </button>
          );
        })}
      </div>
      {!categories.length && (
        <p className="yk-profile-empty">
          Aucune catégorie disponible pour le moment.
        </p>
      )}
      {values.map((widget, index) => (
        <section
          className="yk-profile-widget-editor"
          data-editor-category={widget.category}
          key={widget.category}
        >
          <div className="yk-profile-section-heading">
            <h3>{widgetLabel(widget.category)}</h3>
            <div className="yk-profile-widget-tools">
              {([-1, 1] as const).map(direction => (
                <button
                  key={direction}
                  type="button"
                  disabled={
                    busy ||
                    index + direction < 0 ||
                    index + direction >= values.length
                  }
                  aria-label={`${direction < 0 ? "Monter" : "Descendre"} le widget ${widget.category}`}
                  onClick={() =>
                    setValues(current => {
                      const next = [...current];
                      [next[index], next[index + direction]] = [
                        next[index + direction],
                        next[index]
                      ];
                      return next;
                    })
                  }
                >
                  {direction < 0 ? "↑" : "↓"}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                aria-label={`Retirer le widget ${widget.category}`}
                onClick={() =>
                  setValues(current =>
                    current.filter(value => value.category !== widget.category)
                  )
                }
              >
                ×
              </button>
            </div>
          </div>
          <div
            className="yk-profile-selected-licenses"
            aria-label={`Licences choisies · ${widget.category}`}
          >
            {widget.entries.map(license => (
              <button
                key={license}
                type="button"
                disabled={busy}
                aria-label={`Retirer ${license} des favoris ${widget.category}`}
                onClick={() =>
                  setValues(current =>
                    current.map(value =>
                      value.category === widget.category
                        ? {
                            ...value,
                            entries: value.entries.filter(
                              name => name !== license
                            )
                          }
                        : value
                    )
                  )
                }
              >
                {license} <span aria-hidden="true">×</span>
              </button>
            ))}
            {!widget.entries.length && (
              <p className="yk-profile-muted">Aucune licence sélectionnée.</p>
            )}
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            aria-expanded={activeCategory === widget.category}
            onClick={() =>
              setActiveCategory(
                activeCategory === widget.category ? "" : widget.category
              )
            }
          >
            {activeCategory === widget.category
              ? "Masquer les licences"
              : "Choisir les licences"}
          </Button>
          {activeCategory === widget.category && (
            <ProfileLicensePicker
              key={widget.category}
              category={widget.category}
              selected={widget.entries}
              disabled={busy}
              load={loadLicenses}
              onToggle={license =>
                setValues(current =>
                  current.map(value =>
                    value.category === widget.category
                      ? {
                          ...value,
                          entries: value.entries.includes(license)
                            ? value.entries.filter(name => name !== license)
                            : value.entries.length < 12
                              ? [...value.entries, license]
                              : value.entries
                        }
                      : value
                  )
                )
              }
            />
          )}
        </section>
      ))}
      {error && (
        <p role="alert" className="text-danger-ink">
          {error}
        </p>
      )}
      <Button disabled={busy} type="submit">
        {busy ? "Enregistrement…" : "Enregistrer mon tableau"}
      </Button>
    </form>
  );
}

function Featured({
  cards,
  emptyLabel
}: {
  cards: CollectedCard[];
  emptyLabel?: string;
}) {
  const pathname = usePathname();
  const publicPseudo = pathname.startsWith("/profil/")
    ? decodeURIComponent(pathname.slice("/profil/".length))
    : undefined;
  const label =
    emptyLabel ??
    (publicPseudo
      ? `${publicPseudo} n’a pas encore choisi de cartes à mettre en avant`
      : undefined);
  if (!cards.length && label)
    return (
      <div className="yk-featured-empty-state">
        <span aria-hidden="true">✦</span>
        <p>{label}</p>
      </div>
    );
  return (
    <div className="yk-card-grid yk-featured-stage">
      {cards.map(card => (
        <div key={card.instanceId}>
          <YokaiCard {...card} imageSizes={PROFILE_CARD_IMAGE_SIZES} />
        </div>
      ))}
      {Array.from(
        { length: Math.max(0, FEATURED_CARD_LIMIT - cards.length) },
        (_, i) => (
          <div key={`empty-${i}`} className="yk-featured-empty">
            <span aria-hidden="true">✦</span>
            <small>Emplacement libre</small>
          </div>
        )
      )}
    </div>
  );
}

function Editor({
  profile,
  collection,
  initialBannerUrl,
  adapter,
  onSaved,
  onClose
}: {
  profile: Profile;
  collection: CollectedCard[];
  initialBannerUrl: string | null;
  adapter: ProfileAdapter;
  onSaved: (p: Profile & { bannerUrl: string | null }) => void;
  onClose: () => void;
}) {
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);
  const [selected, setSelected] = useState(
    () => new Set(profile.featuredCards.map(c => c.instanceId))
  );
  const [featuredQuery, setFeaturedQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bannerResults, setBannerResults] = useState<Card[]>([]);
  const [bannerQuery, setBannerQuery] = useState(
    profile.bannerCard?.name ?? ""
  );
  const [bannerCard, setBannerCard] = useState<Card | null>(profile.bannerCard);
  const unique = useMemo(() => {
    const byCard = new Map<string, CollectedCard>();
    for (const card of collection) {
      if (!byCard.has(card.id) || selected.has(card.instanceId))
        byCard.set(card.id, card);
    }
    return [...byCard.values()];
  }, [collection, selected]);
  const featuredChoices = useMemo(
    () =>
      unique
        .filter(card =>
          matchesCardSearch(featuredQuery, [
            card.name,
            card.category,
            card.anime
          ])
        )
        .toSorted(
          (a, b) =>
            Number(selected.has(b.instanceId)) -
            Number(selected.has(a.instanceId))
        ),
    [unique, featuredQuery, selected]
  );
  useEffect(() => {
    if (bannerQuery.trim().length < 2 || bannerCard) return;
    let active = true;
    const timer = window.setTimeout(
      () =>
        void (adapter.search ?? searchCards)(bannerQuery, 8).then(
          cards => {
            if (active) setBannerResults(cards);
          },
          () => {
            if (active) setError("Impossible de rechercher dans le catalogue.");
          }
        ),
      250
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [bannerQuery, bannerCard, adapter]);
  function toggle(id: string) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < FEATURED_CARD_LIMIT) next.add(id);
      return next;
    });
  }
  async function photo(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      setAvatar(await (adapter.uploadAvatar ?? uploadAvatar)(file, profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function banner(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      setBannerUrl(
        await (adapter.uploadBanner ?? uploadBanner)(file, profile.id)
      );
      setBannerCard(null);
      setBannerQuery("");
      setBannerResults([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await (adapter.saveAppearance ?? saveProfileAppearance)(
        bio,
        avatar,
        [...selected],
        bannerCard?.id ?? null,
        bannerUrl
      );
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={profile.pseudo} image={avatar ?? undefined} size={80} />
        <label className="yk-button yk-button-secondary cursor-pointer">
          Choisir une photo
          <input
            className="sr-only"
            type="file"
            disabled={busy}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={e => void photo(e.target.files?.[0])}
          />
        </label>
      </div>
      <p className="text-xs text-ink-3">JPG, PNG, WebP or GIF · Up to 4 MB.</p>
      <label className="block text-sm text-ink-2">
        Bio
        <textarea
          className="auth-input mt-2 min-h-28 resize-y py-3"
          maxLength={300}
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Présentez votre collection…"
        />
        <span className="mt-1 block text-right text-xs text-ink-3">
          {bio.length}/300
        </span>
      </label>
      <section className="yk-profile-banner-editor">
        <h3 className="font-display text-lg">Bannière personnalisée</h3>
        <p className="yk-profile-muted">
          Upload an image from your computer or phone. JPG, PNG, WebP or GIF,
          <strong>up to 4 MB</strong>. The image is centered and cropped to fit
          your banner.
        </p>
        {bannerUrl && (
          <img
            className="yk-profile-banner-preview"
            src={bannerUrl}
            alt="Aperçu de la bannière"
          />
        )}
        <div className="yk-profile-widget-tools">
          <label className="yk-button yk-button-secondary cursor-pointer">
            Importer une bannière
            <input
              className="sr-only"
              aria-label="Importer une bannière"
              type="file"
              disabled={busy}
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={event => {
                void banner(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {bannerUrl && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setBannerUrl(null)}
            >
              Retirer la bannière
            </Button>
          )}
        </div>
      </section>
      <section>
        <h3 className="font-display text-lg">Personnage de bannière</h3>
        <p className="mt-2 text-xs text-ink-3">
          Ou choisis un personnage du catalogue à la place de l’image importée.
        </p>
        {!bannerUrl && bannerCard && (
          <div className="yk-profile-banner-editor-preview mt-4">
            <ProfileBanner characterImage={bannerCard.image} />
          </div>
        )}
        {bannerCard && (
          <div className="yk-banner-choice mt-4">
            <div>
              <img src={bannerCard.image} alt="" decoding="async" />
              <strong>{bannerCard.name}</strong>
              <small>{bannerCard.anime ?? bannerCard.category}</small>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setBannerCard(null);
                setBannerQuery("");
                setBannerResults([]);
              }}
            >
              Retirer
            </Button>
          </div>
        )}
        <div className="relative mt-4">
          <input
            className="auth-input"
            type="search"
            value={bannerQuery}
            onChange={e => {
              const value = e.target.value;
              setBannerQuery(value);
              setBannerResults([]);
              setError("");
              if (value !== bannerCard?.name) setBannerCard(null);
            }}
            placeholder="Nom du personnage ou de la série…"
          />
          {bannerResults.length > 0 && !bannerCard && (
            <ul className="yk-banner-results">
              {bannerResults.map(card => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setBannerCard(card);
                      setBannerUrl(null);
                      setBannerQuery(card.name);
                      setBannerResults([]);
                    }}
                  >
                    <img
                      src={card.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <span>
                      <strong>{card.name}</strong>
                      <small>{card.anime ?? card.category}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg">Cartes mises en avant</h3>
          <span className="text-xs text-ink-3">
            {selected.size}/{FEATURED_CARD_LIMIT}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Choisissez jusqu’à cinq cartes différentes de votre collection.
        </p>
        <label className="sr-only" htmlFor="featured-query">
          Rechercher une carte à mettre en avant
        </label>
        <input
          id="featured-query"
          className="auth-input mt-4"
          type="search"
          value={featuredQuery}
          onChange={e => setFeaturedQuery(e.target.value)}
          placeholder="Rechercher une carte…"
        />
        <div className="yk-featured-picker mt-4">
          {featuredChoices.map(card => {
            const featured = selected.has(card.instanceId);
            return (
              <button
                type="button"
                key={card.instanceId}
                aria-pressed={featured}
                className={featured ? "is-selected" : ""}
                onClick={() => toggle(card.instanceId)}
              >
                <YokaiCard
                  {...card}
                  image={featured ? card.image : card.catalogueImage}
                  animated={false}
                  imageSizes={PROFILE_CARD_IMAGE_SIZES}
                />
                <span>{featured ? "Sélectionnée" : "Choisir"}</span>
              </button>
            );
          })}
        </div>
      </section>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

const wishlistRarities: Rarity[] = ["LR", "SSR", "SR", "R", "C"];
const wishlistRarityText: Record<Rarity, string> = {
  C: "text-rarity-c",
  R: "text-rarity-r",
  SR: "text-rarity-sr",
  SSR: "text-rarity-ssr",
  LR: "text-rarity-lr"
};
function WishlistFilterSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
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
function WishlistRarityIcon({ rarity }: { rarity: Rarity }) {
  return (
    <svg
      aria-hidden="true"
      className={wishlistRarityText[rarity]}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="m12 2 2.45 6.1L21 10.5l-5.25 4.05L16 21l-4-3.55L8 21l.25-6.45L3 10.5l6.55-2.4L12 2Z" />
    </svg>
  );
}
function FriendWishlist({
  cards,
  onNavigate,
  onSelect
}: {
  cards: WishlistCard[];
  onNavigate: () => void;
  onSelect: (card: WishlistCard) => void;
}) {
  const openCard =
    (card: WishlistCard) => (event: MouseEvent<HTMLAnchorElement>) => {
      // Preserve href for new tabs and the navigation fallback.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        onNavigate();
        return;
      }
      event.preventDefault();
      onSelect(card);
    };
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [category, setCategory] = useState("");
  const categories = useMemo(
    () =>
      [...new Set(cards.map(card => card.category))].sort((a, b) =>
        a.localeCompare(b, "en-US")
      ),
    [cards]
  );
  const shown = useMemo(
    () =>
      cards.filter(
        card =>
          matchesCardSearch(query, [card.name, card.category, card.anime]) &&
          (!rarity || card.rarity === rarity) &&
          (!category || card.category === category)
      ),
    [cards, query, rarity, category]
  );
  const filtered = !!(query || rarity || category);
  return (
    <div className="yk-friend-wishlist-layout">
      <aside
        className="yk-collection-sidebar yk-friend-wishlist-filters"
        aria-label="Wishlist filters"
      >
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
          <label className="sr-only" htmlFor="friend-wishlist-query">
            Search wishlist
          </label>
          <input
            id="friend-wishlist-query"
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search…"
          />
        </div>
        <WishlistFilterSection title="Rarity">
          <button
            type="button"
            className="yk-filter-option"
            aria-pressed={!rarity}
            onClick={() => setRarity("")}
          >
            <span className="yk-filter-check" />
            <span>All</span>
          </button>
          {wishlistRarities.map(item => (
            <button
              type="button"
              key={item}
              className="yk-filter-option"
              aria-pressed={rarity === item}
              onClick={() => setRarity(item)}
            >
              <span className="yk-filter-check" />
              <WishlistRarityIcon rarity={item} />
              <span className={wishlistRarityText[item]}>{item}</span>
            </button>
          ))}
        </WishlistFilterSection>
        <WishlistFilterSection title="Category">
          <button
            type="button"
            className="yk-filter-option"
            aria-pressed={!category}
            onClick={() => setCategory("")}
          >
            <span className="yk-filter-check" />
            <span>All categories</span>
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
        </WishlistFilterSection>
        <button
          type="button"
          className="yk-filter-reset"
          disabled={!filtered}
          onClick={() => {
            setQuery("");
            setRarity("");
            setCategory("");
          }}
        >
          Reset filters
        </button>
      </aside>
      <section
        className="yk-friend-wishlist-results"
        aria-label="Wishlist cards"
      >
        <p role="status" className="yk-friend-wishlist-count">
          {shown.length.toLocaleString("en-US")}{" "}
          {shown.length === 1 ? "card" : "cards"}
          {filtered ? " found" : ""}
        </p>
        {shown.length ? (
          <div className="yk-card-grid yk-wishlist-grid">
            {shown.map(card => (
              <Link
                href={`/recherche?carte=${card.id}`}
                key={card.id}
                onClick={openCard(card)}
                aria-haspopup="dialog"
                aria-label={`View ${card.name} in the catalog`}
              >
                <CardShell>
                  <YokaiCard
                    {...card}
                    animated={false}
                    imageSizes={PROFILE_CARD_IMAGE_SIZES}
                  />
                </CardShell>
              </Link>
            ))}
          </div>
        ) : (
          <div className="yk-empty-state">
            <p>No cards match this search.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileCompletion({
  profile,
  details,
  detailsError,
  isMe
}: {
  profile: Profile;
  details?: ProfileDetails;
  detailsError: string;
  isMe: boolean;
}) {
  return (
    <>
      {!profile.canViewCollection ? (
        <ProfilePrivate />
      ) : details?.favoriteAlbums.length ? (
        <section className="yk-profile-surface">
          <div className="yk-profile-completion-summary">
            <strong>
              {
                details.favoriteAlbums.filter(
                  album => album.owned === album.total
                ).length
              }
            </strong>
            <span>
              classeurs favoris complétés{" "}
              <small>sur {details.favoriteAlbums.length} favoris</small>
            </span>
          </div>
          <ul className="yk-profile-album-progress">
            {details.favoriteAlbums.map(album => (
              <li key={album.license}>
                <div>
                  <strong>
                    <span aria-hidden="true">★</span> {album.license}
                  </strong>
                  <span>
                    {album.owned} / {album.total}
                  </span>
                </div>
                <progress
                  max={album.total}
                  value={album.owned}
                  aria-label={`Complétion de ${album.license}`}
                />
                <small>{album.percent}% complété</small>
              </li>
            ))}
          </ul>
        </section>
      ) : !details ? (
        <p className="yk-profile-empty">
          {detailsError
            ? "La progression des classeurs est temporairement indisponible."
            : "Chargement de la progression…"}
        </p>
      ) : (
        <div className="yk-profile-surface yk-profile-completion-empty">
          <span aria-hidden="true">☆</span>
          <h3>Aucun classeur favori pour le moment</h3>
          <p>
            Les classeurs marqués d’une étoile apparaîtront ici avec leur
            progression.
          </p>
          {isMe && (
            <Link className="yk-button yk-button-secondary" href="/collection">
              Choisir mes classeurs favoris
            </Link>
          )}
        </div>
      )}
    </>
  );
}

export type ProfileAdapter = {
  discovery?: CatalogueCardAdapter;
  friendCollection?: typeof getFriendCollection;
  friendAlbums?: typeof getFriendPaniniAlbumsPage;
  friendAlbumCards?: typeof getFriendPaniniAlbumCardsPage;
  wall?: WallAdapter;
  market?: ProfileMarketAdapter;
  // Compatibility harness for the retired widget UI; never enabled by liveProfile.
  previewWidgets?: boolean;
  profile: typeof getProfile;
  wishlist: typeof getWishlist;
  blocked: typeof listBlockedUsers;
  moderation?: ModerationAdapter;
  friendAction?: FriendActionAdapter;
  details?: typeof getProfileDetails;
  engagement?: typeof getProfileEngagement;
  like?: typeof setProfileLike;
  saveWidgets?: typeof saveProfileWidgets;
  widgetLicenses?: typeof getProfileWidgetLicenses;
  saveAppearance?: typeof saveProfileAppearance;
  uploadAvatar?: typeof uploadAvatar;
  uploadBanner?: typeof uploadBanner;
  search?: typeof searchCards;
};
const liveProfile: ProfileAdapter = {
  profile: getProfile,
  wishlist: getWishlist,
  blocked: listBlockedUsers,
  details: getProfileDetails,
  engagement: getProfileEngagement,
  like: setProfileLike,
  saveWidgets: saveProfileWidgets
};
export function ProfileExperience({
  identifier,
  collection,
  joined,
  adapter = liveProfile
}: {
  identifier?: string;
  collection?: CollectedCard[];
  joined?: string;
  adapter?: ProfileAdapter;
}) {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile>();
  const [wishlist, setWishlist] = useState<WishlistCard[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(searchParams.get("edition") === "1");
  const [toast, setToast] = useState("");
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishlistCard, setWishlistCard] = useState<WishlistCard | null>(null);
  const [friendCards, setFriendCards] = useState<CollectedCard[]>();
  const [collectionError, setCollectionError] = useState("");
  const [tab, setTab] = useState("tableau");
  const [details, setDetails] = useState<ProfileDetails>();
  const [detailsError, setDetailsError] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [mutualOnly, setMutualOnly] = useState(false);
  const [engagement, setEngagement] = useState<ProfileEngagement>();
  const [engagementError, setEngagementError] = useState("");
  const [likeBusy, setLikeBusy] = useState(false);
  const likePending = useRef(false);
  const [savedBannerUrl, setSavedBannerUrl] = useState<
    string | null | undefined
  >();
  const profileId = profile?.id;
  const profileBlocked = blocked.some(player => player.id === profileId);
  useEffect(() => {
    if (!profileId || !adapter.engagement) return;
    let active = true;
    void adapter.engagement(profileId).then(
      value => {
        if (active) {
          setEngagement(value);
          setEngagementError("");
        }
      },
      () => {
        if (active)
          setEngagementError("Les likes sont temporairement indisponibles.");
      }
    );
    return () => {
      active = false;
    };
  }, [profileId, adapter]);
  useEffect(() => {
    let active = true;
    if (adapter.details)
      void adapter.details(identifier).then(
        data => {
          if (active) setDetails(data);
        },
        () => {
          if (active)
            setDetailsError(
              "Les statistiques et le tableau sont temporairement indisponibles."
            );
        }
      );
    return () => {
      active = false;
    };
  }, [identifier, adapter]);
  const loadFriendPaniniAlbums = useCallback(
    (options: Parameters<typeof getFriendPaniniAlbumsPage>[1]) => {
      if (!profile) return Promise.reject(new Error("Profil indisponible."));
      if (adapter.friendAlbums)
        return adapter.friendAlbums(profile.id, options);
      return getFriendPaniniAlbumsPage(profile.id, options);
    },
    [profile, adapter]
  );
  const loadFriendPaniniAlbumCards = useCallback(
    (options: Parameters<typeof getFriendPaniniAlbumCardsPage>[1]) => {
      if (!profile) return Promise.reject(new Error("Profil indisponible."));
      if (adapter.friendAlbumCards)
        return adapter.friendAlbumCards(profile.id, options);
      return getFriendPaniniAlbumCardsPage(profile.id, options);
    },
    [profile, adapter]
  );
  useEffect(() => {
    let active = true;
    void Promise.all([
      adapter.profile(identifier),
      adapter.wishlist(identifier),
      adapter.blocked()
    ]).then(
      ([p, w, blocks]) => {
        if (active) {
          setProfile(p);
          setWishlist(w);
          setBlocked(blocks);
        }
      },
      e => {
        if (active)
          setError(e instanceof Error ? e.message : "Profil indisponible.");
      }
    );
    return () => {
      active = false;
    };
  }, [identifier, adapter]);
  if (error)
    return (
      <div className="yk-empty-state">
        <p>{error}</p>
      </div>
    );
  if (!profile)
    return (
      <div className="yk-empty-state">
        <p>Chargement du profil…</p>
      </div>
    );
  const isMe = profile.friendshipStatus === "self";
  async function likeProfile() {
    if (
      !profile ||
      !engagement ||
      isMe ||
      profileBlocked ||
      likePending.current ||
      !adapter.like
    )
      return;
    likePending.current = true;
    setLikeBusy(true);
    setEngagementError("");
    try {
      setEngagement(await adapter.like(profile.id, !engagement.likedByMe));
    } catch (reason) {
      setEngagementError(
        reason instanceof Error ? reason.message : "Like indisponible."
      );
    } finally {
      likePending.current = false;
      setLikeBusy(false);
    }
  }
  const friends = profile.friends ?? [];
  const blockedByMe = blocked.some(player => player.id === profile.id);
  function afterBlock() {
    if (!profile) return;
    setBlocked(current =>
      current.some(player => player.id === profile.id)
        ? current
        : [...current, { id: profile.id, pseudo: profile.pseudo }]
    );
    void adapter
      .profile(identifier)
      .then(setProfile, () => setError("Profil indisponible."));
  }
  function afterUnblock() {
    if (!profile) return;
    setBlocked(current => current.filter(player => player.id !== profile.id));
    void adapter
      .profile(identifier)
      .then(setProfile, () => setError("Profil indisponible."));
  }
  async function openFriendCollection() {
    if (!profile || !profile.canViewCollection) return;
    const friendId = profile.id;
    setCollectionOpen(true);
    if (friendCards) return;
    setCollectionError("");
    try {
      setFriendCards(
        adapter.friendCollection
          ? await adapter.friendCollection(friendId)
          : await getFriendCollection(friendId)
      );
    } catch (reason) {
      setCollectionError(
        reason instanceof Error ? reason.message : "Collection indisponible."
      );
    }
  }
  const categories = friendCards
    ? [...new Set(friendCards.map(card => card.category))].sort((a, b) =>
        a.localeCompare(b, "fr")
      )
    : [];
  const uploadedBannerUrl =
    savedBannerUrl === undefined ? details?.bannerUrl : savedBannerUrl;
  return (
    <>
      <div className="yk-profile-hub" data-profile-tab={tab}>
        <section className="yk-profile-main">
          <nav className="yk-profile-tabs" aria-label="Sections du profil">
            {[
              ["tableau", "Tableau"],
              ["wall", "Wall"],
              ["activity", "Activité"],
              ...(profile.friendsVisible ? [["friends", "Friends"]] : [])
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className={tab === key ? "is-active" : ""}
              >
                {key === "friends" ? (
                  <p className="yk-profile-tab-label">Friends</p>
                ) : (
                  label
                )}
                {key === "friends" && (
                  <p className="yk-profile-tab-count">{friends.length}</p>
                )}
              </button>
            ))}
          </nav>
          {detailsError && (
            <p role="status" className="yk-profile-notice">
              {detailsError}
            </p>
          )}
          <div hidden={tab !== "tableau"} className="yk-profile-panel">
            <section className="yk-profile-surface yk-profile-showcase">
              <div className="yk-profile-section-heading">
                <h3 className="yk-section-title">Cartes mises en avant</h3>
                <span className="yk-profile-muted">Sa vitrine</span>
              </div>
              <Featured cards={profile.featuredCards} />
            </section>
            {adapter.previewWidgets ? (
              <section className="yk-profile-universe">
                <div className="yk-profile-section-heading">
                  <div>
                    <p className="eyebrow">Son univers</p>
                    <h2>Le tableau de {profile.pseudo}</h2>
                  </div>
                  {isMe && (
                    <Button
                      variant="secondary"
                      disabled={!details}
                      onClick={() => setPreferencesOpen(true)}
                    >
                      Personnaliser mon tableau
                    </Button>
                  )}
                </div>
                <div className="yk-profile-interests">
                  {(details?.widgets ?? []).map(widget => (
                    <section
                      key={widget.category}
                      className="yk-profile-surface"
                      data-widget-category={widget.category}
                    >
                      <div className="yk-profile-section-heading">
                        <h3>
                          <span aria-hidden="true">✧</span>{" "}
                          {widgetLabel(widget.category)}
                        </h3>
                        <span className="yk-profile-muted">
                          {widget.entries.length}
                        </span>
                      </div>
                      {widget.entries.length ? (
                        <ol className="yk-profile-taste-list">
                          {widget.entries.map((name, index) => (
                            <li key={index}>
                              <span className="yk-profile-taste-number">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <strong>{name}</strong>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="yk-profile-empty">
                          {isMe
                            ? "Ajoute tes favoris pour partager ce que tu aimes."
                            : "Ses favoris apparaîtront ici."}
                        </p>
                      )}
                    </section>
                  ))}
                </div>
                {details && !details.widgets.length && (
                  <p className="yk-profile-surface yk-profile-empty">
                    {isMe
                      ? "Personnalise ton tableau en ajoutant les widgets de tes catégories préférées."
                      : "Ses widgets favoris apparaîtront ici."}
                  </p>
                )}
              </section>
            ) : (
              <section className="yk-profile-completion">
                <div className="yk-profile-section-heading">
                  <h2>Complétion</h2>
                  <span className="yk-profile-muted">Classeurs favoris</span>
                </div>
                <ProfileCompletion
                  profile={profile}
                  details={details}
                  detailsError={detailsError}
                  isMe={isMe}
                />
              </section>
            )}
          </div>
          <div hidden={tab !== "activity"} className="yk-profile-panel">
            {tab === "activity" && profile.canViewCollection && (
              <ProfileSales
                key={profile.id}
                ownerId={profile.id}
                adapter={adapter.market}
              />
            )}
            <div className="yk-profile-section-heading">
              <div>
                <p className="eyebrow">Le fil du collectionneur</p>
                <h2>Activité récente</h2>
              </div>
              <span className="yk-profile-muted">20 dernières activités</span>
            </div>
            {!profile.canViewCollection ? (
              <ProfilePrivate />
            ) : details?.activity.length ? (
              <ol className="yk-profile-activity">
                {details.activity.map(event => (
                  <li
                    key={event.kind + event.id}
                    className="yk-profile-surface"
                  >
                    <Link
                      href={`/recherche?carte=${event.card.id}`}
                      className="yk-profile-activity-image"
                    >
                      <img
                        src={event.card.image}
                        alt={event.card.name}
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                    <div>
                      <p className={`yk-profile-event-label is-${event.kind}`}>
                        {event.kind === "sold"
                          ? "Carte vendue"
                          : event.kind === "bought"
                            ? "Carte achetée"
                            : "Carte obtenue"}
                      </p>
                      <Link href={`/recherche?carte=${event.card.id}`}>
                        <h3>{event.card.name}</h3>
                      </Link>
                      <p className="yk-profile-muted">
                        {event.card.anime || event.card.category}{" "}
                        <span
                          className={`text-rarity-${event.card.rarity.toLowerCase()}`}
                        >
                          · {event.card.rarity}
                        </span>
                      </p>
                      {event.price !== undefined && (
                        <p className="yk-profile-event-price">
                          {event.price.toLocaleString("fr-FR")} Karas
                        </p>
                      )}
                    </div>
                    <time dateTime={event.at}>
                      {new Date(event.at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short"
                      })}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="yk-profile-empty">
                {details
                  ? "Aucune activité à afficher pour le moment."
                  : detailsError
                    ? "L’activité est temporairement indisponible."
                    : "Chargement de l’activité…"}
              </p>
            )}
          </div>
          {profile.friendsVisible && (
            <div hidden={tab !== "friends"} className="yk-profile-panel">
              <div className="yk-profile-section-heading">
                <div>
                  <p className="eyebrow">Their community</p>
                  <h3>Friends</h3>
                </div>
                {!isMe && (
                  <button
                    type="button"
                    className="yk-profile-filter"
                    aria-pressed={mutualOnly}
                    onClick={() => setMutualOnly(!mutualOnly)}
                  >
                    Mutual friends · {details?.mutualFriends.length ?? 0}
                  </button>
                )}
              </div>
              {(mutualOnly ? (details?.mutualFriends ?? []) : friends)
                .length ? (
                <ul className="yk-profile-friend-list">
                  {(mutualOnly ? (details?.mutualFriends ?? []) : friends).map(
                    friend => (
                      <li key={friend.id}>
                        <Link
                          href={`/profil/${encodeURIComponent(friend.pseudo)}`}
                        >
                          <Avatar
                            name={friend.pseudo}
                            image={friend.avatarUrl ?? undefined}
                            size={48}
                          />
                          <span>
                            <strong>{friend.pseudo}</strong>
                            {details?.mutualFriends.some(
                              common => common.id === friend.id
                            ) && <small>Mutual friend</small>}
                          </span>
                          <span
                            className="yk-profile-friend-arrow"
                            aria-hidden="true"
                          >
                            ↗
                          </span>
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <p className="yk-profile-empty">
                  {mutualOnly
                    ? "You don't have any mutual friends."
                    : "No friends to show."}
                </p>
              )}
            </div>
          )}
          <div hidden={tab !== "wall"} className="yk-profile-panel">
            <ProfileWall
              key={profile.id}
              ownerId={profile.id}
              pseudo={profile.pseudo}
              avatarUrl={profile.avatarUrl}
              isMe={isMe}
              isPublic={profile.isPublic}
              canRead={profile.canViewCollection}
              active={tab === "wall"}
              adapter={adapter.wall}
            />
          </div>
        </section>
        <aside className="yk-profile-identity">
          <ProfileBanner
            uploadedUrl={uploadedBannerUrl}
            characterImage={profile.bannerCard?.image}
          />
          <div className="yk-profile-identity-content">
            <div className="yk-profile-avatar">
              <Avatar
                name={profile.pseudo}
                image={profile.avatarUrl ?? undefined}
                size={96}
              />
            </div>
            <span className="yk-profile-identity-label">COLLECTIONNEUR</span>
            <div className="yk-profile-name-row">
              <h2>{profile.pseudo}</h2>
              {!isMe && (
                <PlayerModeration
                  userId={profile.id}
                  pseudo={profile.pseudo}
                  blockedByMe={blockedByMe}
                  adapter={adapter.moderation}
                  onBlocked={afterBlock}
                />
              )}
            </div>
            <p className="yk-profile-bio">
              {profile.bio || "Aucune bio pour le moment."}
            </p>
            <div className="yk-profile-actions">
              {isMe ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Modifier le profil
                </Button>
              ) : (
                <>
                  <FriendAction
                    key={`${profile.id}:${profile.friendshipStatus}:${blockedByMe}`}
                    userId={profile.id}
                    status={profile.friendshipStatus}
                    blockedByMe={blockedByMe}
                    adapter={adapter.friendAction}
                    onUnblocked={afterUnblock}
                  />
                </>
              )}
            </div>
            {!isMe && (
              <Button
                variant="secondary"
                disabled={
                  !engagement || likeBusy || profileBlocked || !adapter.like
                }
                aria-pressed={engagement?.likedByMe ?? false}
                onClick={() => void likeProfile()}
              >
                {likeBusy
                  ? "Enregistrement…"
                  : engagement?.likedByMe
                    ? "♥ Profil aimé"
                    : "♡ Aimer ce profil"}
              </Button>
            )}
            {engagementError && (
              <p className="yk-profile-muted" role="status">
                {engagementError}
              </p>
            )}
            <div className="yk-profile-side-counts">
              {!isMe && profile.canViewCollection ? (
                <button
                  type="button"
                  onClick={() => void openFriendCollection()}
                  aria-label={`Voir les ${profile.cardCount} cartes de ${profile.pseudo}`}
                >
                  <p>Cartes</p>
                  <strong>{profile.cardCount}</strong>
                  <span>Voir la collection →</span>
                </button>
              ) : (
                <Link href="/collection">
                  <p>Cartes</p>
                  <strong>
                    {profile.canViewCollection ? profile.cardCount : "Privée"}
                  </strong>
                </Link>
              )}
              <div>
                <p>Différentes</p>
                <strong>
                  {profile.canViewCollection
                    ? profile.distinctCardCount
                    : "Privée"}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setWishlistOpen(true)}
                disabled={!profile.canViewCollection}
                data-profile-wishlist
                aria-haspopup="dialog"
                aria-label={`View ${profile.pseudo}’s wishlist (${wishlist.length.toLocaleString("en-US")} ${wishlist.length === 1 ? "card" : "cards"})`}
              >
                <p>Wishlist</p>
                <strong>
                  {profile.canViewCollection
                    ? wishlist.length.toLocaleString("en-US")
                    : "Private"}
                </strong>
                {profile.canViewCollection && <span>View wishlist →</span>}
              </button>
              <div>
                <p>Likes</p>
                <strong data-profile-likes>
                  {engagement?.likes.toLocaleString("fr-FR") ?? "—"}
                </strong>
              </div>
            </div>
            <div className="yk-profile-side-stats">
              <div>
                <p>Boosters ouverts</p>
                <strong>
                  {profile.canViewCollection
                    ? (details?.boostersOpened?.toLocaleString("fr-FR") ?? "—")
                    : "Privé"}
                </strong>
              </div>
              <div className="is-lr">
                <p>✦ LR</p>
                <strong>
                  {profile.canViewCollection
                    ? (details?.lrCount?.toLocaleString("fr-FR") ?? "—")
                    : "Privé"}
                </strong>
              </div>
              <div className="is-ssr">
                <p>✦ SSR</p>
                <strong>
                  {profile.canViewCollection
                    ? (details?.ssrCount?.toLocaleString("fr-FR") ?? "—")
                    : "Privé"}
                </strong>
              </div>
            </div>
            <div className="yk-profile-member">
              <p>Membre depuis</p>
              <strong>
                {details?.joinedAt || (isMe && joined)
                  ? new Date(details?.joinedAt || joined!).toLocaleDateString(
                      "fr-FR",
                      { dateStyle: "long" }
                    )
                  : "—"}
              </strong>
            </div>
          </div>
        </aside>
      </div>
      <Modal
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        title="Personnaliser mon tableau"
      >
        {details && (
          <PreferencesEditor
            widgets={details.widgets}
            categories={details.widgetCategories}
            loadLicenses={adapter.widgetLicenses ?? getProfileWidgetLicenses}
            save={adapter.saveWidgets ?? saveProfileWidgets}
            onSaved={widgets => {
              setDetails({ ...details, widgets });
              setPreferencesOpen(false);
              setToast("Tableau mis à jour");
            }}
          />
        )}
      </Modal>
      <Modal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        title={`Collection de ${profile.pseudo}`}
        className="yk-friend-collection-modal yk-friend-card-grid-modal"
      >
        {collectionError ? (
          <div className="yk-empty-state">
            <p>{collectionError}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setFriendCards(undefined);
                void openFriendCollection();
              }}
            >
              Réessayer
            </Button>
          </div>
        ) : friendCards ? (
          <CollectionView
            cards={friendCards}
            categories={categories}
            loadPaniniAlbums={loadFriendPaniniAlbums}
            loadPaniniAlbumCards={loadFriendPaniniAlbumCards}
            readOnly
          />
        ) : (
          <div className="yk-empty-state">
            <p>Chargement de la collection…</p>
          </div>
        )}
      </Modal>
      <Modal
        open={wishlistOpen && profile.canViewCollection}
        onClose={() => {
          setWishlistCard(null);
          setWishlistOpen(false);
        }}
        title={`${profile.pseudo}’s wishlist`}
        className="yk-friend-collection-modal"
      >
        {wishlist.length ? (
          <FriendWishlist
            cards={wishlist}
            onNavigate={() => {
              setWishlistCard(null);
              setWishlistOpen(false);
            }}
            onSelect={setWishlistCard}
          />
        ) : (
          <div className="yk-empty-state">
            <p>No cards on this wishlist yet.</p>
          </div>
        )}
      </Modal>
      {wishlistCard && wishlistOpen && profile.canViewCollection && (
        <CatalogueCardModal
          key={wishlistCard.id}
          selected={wishlistCard}
          onClose={() => setWishlistCard(null)}
          adapter={adapter.discovery}
        />
      )}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Modifier mon profil"
        className="max-w-4xl"
      >
        {isMe && collection && details ? (
          <Editor
            profile={profile}
            collection={collection}
            initialBannerUrl={
              (savedBannerUrl === undefined
                ? details?.bannerUrl
                : savedBannerUrl) ?? null
            }
            adapter={adapter}
            onClose={() => setEditing(false)}
            onSaved={p => {
              setProfile(p);
              setSavedBannerUrl(p.bannerUrl);
              setToast("Profil mis à jour");
            }}
          />
        ) : (
          <p className="yk-profile-empty">
            {detailsError || "Chargement de l’éditeur du profil…"}
          </p>
        )}
      </Modal>
      <Toast message={toast} onDismiss={() => setToast("")} />
    </>
  );
}
