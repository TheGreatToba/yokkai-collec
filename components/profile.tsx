"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Modal, Toast } from "@/components/ui";
import { YokaiCard } from "@/components/yokai-card";
import { CardShell } from "@/components/card-shell";
import { CollectionView } from "@/components/collection";
import { PlayerModeration } from "@/components/player-moderation";
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
  getProfile,
  saveProfile,
  uploadAvatar,
  type Profile
} from "@/lib/data/profile";
import { getWishlist, type WishlistCard } from "@/lib/data/wishlist";
import { matchesCardSearch } from "@/lib/ui/card-search";

const FEATURED_CARD_LIMIT = 5;
const PROFILE_CARD_IMAGE_SIZES =
  "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 190px";

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
  onSaved,
  onClose
}: {
  profile: Profile;
  collection: CollectedCard[];
  onSaved: (p: Profile) => void;
  onClose: () => void;
}) {
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatarUrl);
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
        void searchCards(bannerQuery, 8).then(
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
  }, [bannerQuery, bannerCard]);
  function toggle(id: string) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < FEATURED_CARD_LIMIT) next.add(id);
      return next;
    });
  }
  async function photo(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setAvatar(await uploadAvatar(file, profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const updated = await saveProfile(
        bio,
        avatar,
        [...selected],
        bannerCard?.id ?? null
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={e => void photo(e.target.files?.[0])}
          />
        </label>
      </div>
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
      <section>
        <h3 className="font-display text-lg">Personnage de bannière</h3>
        <p className="mt-2 text-xs text-ink-3">
          Recherchez un personnage dans tout le catalogue.
        </p>
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
  onNavigate
}: {
  cards: WishlistCard[];
  onNavigate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [category, setCategory] = useState("");
  const categories = useMemo(
    () =>
      [...new Set(cards.map(card => card.category))].sort((a, b) =>
        a.localeCompare(b, "fr")
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
        aria-label="Filtres de la wishlist"
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
            Rechercher dans la wishlist
          </label>
          <input
            id="friend-wishlist-query"
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Rechercher…"
          />
        </div>
        <WishlistFilterSection title="Rareté">
          <button
            type="button"
            className="yk-filter-option"
            aria-pressed={!rarity}
            onClick={() => setRarity("")}
          >
            <span className="yk-filter-check" />
            <span>Toutes</span>
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
        <WishlistFilterSection title="Catégorie">
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
          Réinitialiser les filtres
        </button>
      </aside>
      <section
        className="yk-friend-wishlist-results"
        aria-label="Cartes de la wishlist"
      >
        <p role="status" className="yk-friend-wishlist-count">
          {shown.length.toLocaleString("fr-FR")} carte
          {shown.length > 1 ? "s" : ""}
          {filtered ? " trouvée(s)" : ""}
        </p>
        {shown.length ? (
          <div className="yk-card-grid yk-wishlist-grid">
            {shown.map(card => (
              <Link
                href={`/recherche?carte=${card.id}`}
                key={card.id}
                onClick={onNavigate}
                aria-label={`Voir ${card.name} dans le catalogue`}
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
            <p>Aucune carte ne correspond à cette recherche.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export type ProfileAdapter = {
  profile: typeof getProfile;
  wishlist: typeof getWishlist;
  blocked: typeof listBlockedUsers;
  moderation?: ModerationAdapter;
  friendAction?: FriendActionAdapter;
};
const liveProfile: ProfileAdapter = {
  profile: getProfile,
  wishlist: getWishlist,
  blocked: listBlockedUsers
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
  const [friendCards, setFriendCards] = useState<CollectedCard[]>();
  const [collectionError, setCollectionError] = useState("");
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
      setFriendCards(await getFriendCollection(friendId));
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
  return (
    <>
      <div
        className={`yk-profile-banner ${profile.bannerCard ? "has-image" : ""}`}
      >
        {profile.bannerCard && (
          <>
            <img
              src={profile.bannerCard.image}
              alt=""
              aria-hidden="true"
              decoding="async"
            />
            <span className="yk-profile-banner-shade" />
            <span className="yk-profile-banner-label">
              <strong>{profile.bannerCard.name}</strong>
              <small>
                {profile.bannerCard.anime ?? profile.bannerCard.category}
              </small>
            </span>
          </>
        )}
      </div>
      <div className="relative -mt-14 flex flex-wrap items-end justify-between gap-5 px-6">
        <div>
          <Avatar
            name={profile.pseudo}
            image={profile.avatarUrl ?? undefined}
            size={112}
          />
          <h2 className="mt-5 font-display text-[30px]">{profile.pseudo}</h2>
          {profile.bio ? (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-ink-2">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-3 text-sm italic text-ink-3">
              Aucune bio pour le moment.
            </p>
          )}
          {isMe && joined && (
            <p className="mt-2 text-xs text-ink-3">
              Membre depuis le{" "}
              {new Date(joined).toLocaleDateString("fr-FR", {
                dateStyle: "long"
              })}
            </p>
          )}
        </div>
        {isMe ? (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Modifier le profil
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <FriendAction
              key={`${profile.id}:${profile.friendshipStatus}:${blockedByMe}`}
              userId={profile.id}
              status={profile.friendshipStatus}
              blockedByMe={blockedByMe}
              adapter={adapter.friendAction}
              onUnblocked={afterUnblock}
            />
            <PlayerModeration
              userId={profile.id}
              pseudo={profile.pseudo}
              blockedByMe={blockedByMe}
              adapter={adapter.moderation}
              onBlocked={afterBlock}
            />
          </div>
        )}
      </div>
      <div
        className={`my-8 grid grid-cols-2 gap-3 ${profile.friendsVisible ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        {!isMe && profile.canViewCollection ? (
          <button
            type="button"
            className="rounded-panel border border-veil bg-surface p-5 text-left transition hover:border-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
            onClick={() => void openFriendCollection()}
            aria-label={`Voir les ${profile.cardCount} cartes de ${profile.pseudo}`}
          >
            <p className="text-xs text-ink-3">Cartes</p>
            <p className="mt-3 font-display text-2xl">{profile.cardCount}</p>
            <span className="mt-2 block text-xs text-accent-gold">
              Voir la collection →
            </span>
          </button>
        ) : (
          <div className="rounded-panel border border-veil bg-surface p-5">
            <p className="text-xs text-ink-3">Cartes</p>
            <p className="mt-3 font-display text-2xl">
              {profile.canViewCollection ? profile.cardCount : "Privée"}
            </p>
          </div>
        )}
        <div className="rounded-panel border border-veil bg-surface p-5">
          <p className="text-xs text-ink-3">Différentes</p>
          <p className="mt-3 font-display text-2xl">
            {profile.canViewCollection ? profile.distinctCardCount : "Privée"}
          </p>
        </div>
        {profile.friendsVisible && (
          <div className="rounded-panel border border-veil bg-surface p-5">
            <p className="text-xs text-ink-3">Amis</p>
            <p className="mt-3 font-display text-2xl">{friends.length}</p>
          </div>
        )}
        {profile.friendshipStatus === "accepted" ? (
          <button
            type="button"
            className="rounded-panel border border-veil bg-surface p-5 text-left transition hover:border-accent-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
            onClick={() => setWishlistOpen(true)}
            aria-label={`Voir les ${wishlist.length} cartes de la wishlist de ${profile.pseudo}`}
          >
            <p className="text-xs text-ink-3">Wishlist</p>
            <p className="mt-3 font-display text-2xl">{wishlist.length}</p>
            <span className="mt-2 block text-xs text-accent-gold">
              Voir la wishlist →
            </span>
          </button>
        ) : (
          <div className="rounded-panel border border-veil bg-surface p-5">
            <p className="text-xs text-ink-3">Wishlist</p>
            <p className="mt-3 font-display text-2xl">{wishlist.length}</p>
          </div>
        )}
      </div>
      <div className={profile.friendsVisible ? "yk-profile-columns" : ""}>
        <section>
          <h3 className="yk-section-title">Cartes mises en avant</h3>
          <Featured cards={profile.featuredCards} />
          <h3 className="yk-section-title mt-10">Wishlist</h3>
          {wishlist.length ? (
            <div className="yk-card-grid yk-profile-wishlist-preview mt-5">
              {wishlist.slice(0, 6).map(card => (
                <Link
                  href={`/recherche?carte=${card.id}`}
                  key={card.id}
                  className="rounded-panel border border-veil bg-surface p-3 hover:border-accent-gold"
                >
                  <YokaiCard
                    {...card}
                    animated={false}
                    imageSizes={PROFILE_CARD_IMAGE_SIZES}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-3">
              Aucune carte souhaitée pour le moment.
            </p>
          )}
          {isMe && collection ? (
            <>
              <h3 className="yk-section-title mt-10">Ma collection</h3>
              <p className="mt-3 text-sm text-ink-3">
                Retrouvez la gestion complète dans l’onglet Collection.
              </p>
              <Link
                className="yk-button yk-button-secondary mt-5 inline-flex"
                href="/collection"
              >
                Ouvrir ma collection
              </Link>
            </>
          ) : null}
        </section>
        {profile.friendsVisible && (
          <aside className="h-fit rounded-panel border border-veil bg-surface p-5">
            <h3 className="yk-section-title">Amis</h3>
            {friends.length ? (
              <ul className="mt-5 space-y-3">
                {friends.map(friend => (
                  <li key={friend.id}>
                    <Link
                      href={`/profil/${encodeURIComponent(friend.pseudo)}`}
                      className="flex items-center gap-3 rounded-input p-2 hover:bg-veil"
                    >
                      <Avatar
                        name={friend.pseudo}
                        image={friend.avatarUrl ?? undefined}
                      />
                      <span className="min-w-0 truncate font-display">
                        {friend.pseudo}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-ink-3">Aucun ami à afficher.</p>
            )}
          </aside>
        )}
      </div>
      <Modal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        title={`Collection de ${profile.pseudo}`}
        className="yk-friend-collection-modal"
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
            readOnly
          />
        ) : (
          <div className="yk-empty-state">
            <p>Chargement de la collection…</p>
          </div>
        )}
      </Modal>
      <Modal
        open={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        title={`Wishlist de ${profile.pseudo}`}
        className="yk-friend-collection-modal"
      >
        {wishlist.length ? (
          <FriendWishlist
            cards={wishlist}
            onNavigate={() => setWishlistOpen(false)}
          />
        ) : (
          <div className="yk-empty-state">
            <p>Aucune carte souhaitée pour le moment.</p>
          </div>
        )}
      </Modal>
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Modifier mon profil"
        className="max-w-4xl"
      >
        {collection && (
          <Editor
            profile={profile}
            collection={collection}
            onClose={() => setEditing(false)}
            onSaved={p => {
              setProfile(p);
              setToast("Profil mis à jour");
            }}
          />
        )}
      </Modal>
      <Toast message={toast} onDismiss={() => setToast("")} />
    </>
  );
}
