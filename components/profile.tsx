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
import dynamic from "next/dynamic";
import { PlayerModeration } from "@/components/player-moderation";
import { ProfileLicensePicker } from "@/components/profile-license-picker";
import { ProfileWall } from "@/components/profile-wall";
import { BannerCrop } from "@/components/banner-crop";
import { BannerImage } from "@/components/banner-image";
import { ProfileStyleFields } from "@/components/profile-style-fields";
import { StyledPlayerName } from "@/components/styled-player-name";
import {
  DEFAULT_PROFILE_STYLE,
  normalizeProfileStyle,
  type ProfileStyle
} from "@/lib/ui/profile-style";
import { useProAccess, ProFeatureNotice } from "@/components/pro-access";
import type { BannerFrame } from "@/lib/ui/banner-frame";
import type { CatalogueCardAdapter } from "@/components/community-views";
import type { WallAdapter } from "@/lib/data/profile-wall";
import type { ProfileMarketAdapter } from "@/lib/data/profile-market";
import { listBlockedUsers, type BlockedUser } from "@/lib/data/moderation";
import { type ModerationAdapter } from "@/lib/data/moderation";
import { FriendAction, type FriendActionAdapter } from "@/components/friends";
import { type Card, type CollectedCard, type Rarity } from "@/lib/data/cards";
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
  uploadAvatar,
  uploadBanner,
  PROFILE_IMAGE_MAX_BYTES,
  type ProfileDetails,
  type ProfileEngagement,
  type ProfileWidget,
  type Profile
} from "@/lib/data/profile";
import { getWishlist, type WishlistCard } from "@/lib/data/wishlist";
import { matchesCardSearch } from "@/lib/ui/card-search";
import { compareBannerCards } from "@/lib/ui/banner-card-sort";

const CollectionView = dynamic(
  () => import("@/components/collection").then(module => module.CollectionView),
  { loading: () => <p role="status">Loading collection…</p> }
);

const ProfileSales = dynamic(() =>
  import("@/components/profile-sales").then(module => module.ProfileSales)
);

const CatalogueCardModal = dynamic(() =>
  import("@/components/community-views").then(
    module => module.CatalogueCardModal
  )
);

const FEATURED_CARD_LIMIT = 5;
const PROFILE_CARD_IMAGE_SIZES =
  "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 190px";

function widgetLabel(category: string) {
  const labels: Record<string, string> = {
    "ANIME/MANGA": "Favorite anime & manga",
    "VIDEO GAMES": "Favorite games",
    KPOP: "K-pop groups",
    FILM: "Favorite movies",
    SERIE: "Favorite series",
    KDRAMA: "Favorite K-dramas",
    COMICS: "Favorite comics",
    ARTIST: "Favorite artists",
    VOCALOID: "Favorite Vocaloids",
    MANWHA: "Favorite manhwa",
    SPORT: "Favorite sports",
    "DISNEY CHANNEL": "Disney Channel",
    MEME: "Favorite memes",
    BRAINROT: "Favorite brainrot"
  };
  return labels[category] ?? category;
}

function ProfilePrivate() {
  return (
    <p className="yk-profile-empty">
      This collection is private. Only authorized players can view its activity
      and binders.
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
          setError("Choose up to 12 licenses per category.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          onSaved(await save(next));
        } catch (reason) {
          setError(
            reason instanceof Error ? reason.message : "Couldn't save changes."
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="yk-profile-muted">
        Choose a category, then pick up to 12 catalog licenses to feature.
        Custom entries aren&apos;t available.
      </p>
      <div
        className="yk-profile-widget-picker"
        aria-label="Available categories"
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
        <p className="yk-profile-empty">No categories available yet.</p>
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
                  aria-label={`${direction < 0 ? "Move up" : "Move down"} widget ${widget.category}`}
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
                aria-label={`Remove widget ${widget.category}`}
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
            aria-label={`Selected licenses · ${widget.category}`}
          >
            {widget.entries.map(license => (
              <button
                key={license}
                type="button"
                disabled={busy}
                aria-label={`Remove ${license} from favorites ${widget.category}`}
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
              <p className="yk-profile-muted">No licenses selected.</p>
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
              ? "Hide licenses"
              : "Choose licenses"}
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
        {busy ? "Saving…" : "Save my board"}
      </Button>
    </form>
  );
}

function Featured({
  cards,
  emptyLabel,
  slots = FEATURED_CARD_LIMIT
}: {
  cards: CollectedCard[];
  emptyLabel?: string;
  slots?: number;
}) {
  const pathname = usePathname();
  const publicPseudo = pathname.startsWith("/profile/")
    ? decodeURIComponent(pathname.slice("/profile/".length))
    : undefined;
  const label =
    emptyLabel ??
    (publicPseudo
      ? `${publicPseudo} hasn't featured any cards yet`
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
      {Array.from({ length: Math.max(0, slots - cards.length) }, (_, i) => (
        <div key={`empty-${i}`} className="yk-featured-empty">
          <span aria-hidden="true">✦</span>
          <small>Empty slot</small>
        </div>
      ))}
    </div>
  );
}

function Editor({
  mode,
  profile,
  collection,
  initialBannerUrl,
  initialBannerFrame,
  framingAvailable,
  adapter,
  onSaved,
  onClose
}: {
  mode: "profile" | "showcase";
  profile: Profile;
  collection: CollectedCard[];
  initialBannerUrl: string | null;
  initialBannerFrame: BannerFrame | null;
  framingAvailable: boolean;
  adapter: ProfileAdapter;
  onSaved: (
    p: Profile & { bannerUrl: string | null; bannerFrame?: BannerFrame | null }
  ) => void;
  onClose: () => void;
}) {
  const [bio, setBio] = useState(profile.bio);
  const pro = useProAccess();
  const FEATURED_CARD_LIMIT = pro ? 10 : 5;
  const [avatar, setAvatar] = useState(profile.avatarUrl);
  const ownedBannerCards = useMemo(() => {
    const cards = new Map<string, Card>();
    for (const card of collection) {
      if (card.catalogueImage?.trim() && !cards.has(card.id))
        cards.set(card.id, { ...card, image: card.catalogueImage });
    }
    return [...cards.values()];
  }, [collection]);
  const eligibleBanner =
    ownedBannerCards.find(card => card.id === profile.bannerCard?.id) ?? null;
  const [bannerCard, setBannerCard] = useState<Card | null>(
    initialBannerUrl ? null : eligibleBanner
  );
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!bannerPreview) return;
    return () => URL.revokeObjectURL(bannerPreview);
  }, [bannerPreview]);
  const bannerSource =
    (bannerFile ? bannerPreview : bannerUrl) || bannerCard?.image;
  const [bannerFrame, setBannerFrame] = useState(
    initialBannerUrl || eligibleBanner ? initialBannerFrame : null
  );
  const [crop, setCrop] = useState<{
    src: string;
    frame: BannerFrame | null;
    card: Card | null;
    file?: File;
  } | null>(null);
  useEffect(() => {
    if (!crop?.file) return;
    const url = crop.src;
    return () => URL.revokeObjectURL(url);
  }, [crop]);
  const [selected, setSelected] = useState(
    () => new Set(profile.featuredCards.map(c => c.instanceId))
  );
  const [featuredQuery, setFeaturedQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bannerQuery, setBannerQuery] = useState("");
  const ownedBannerChoices = useMemo(
    () =>
      ownedBannerCards
        .filter(card =>
          matchesCardSearch(bannerQuery, [card.name, card.category, card.anime])
        )
        .toSorted(compareBannerCards),
    [ownedBannerCards, bannerQuery]
  );
  const unique = useMemo(() => {
    if (mode !== "showcase") return [];
    const byCard = new Map<string, CollectedCard>();
    for (const card of collection) {
      if (!byCard.has(card.id) || selected.has(card.instanceId))
        byCard.set(card.id, card);
    }
    return [...byCard.values()];
  }, [collection, selected, mode]);
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
      setError(e instanceof Error ? e.message : "Couldn't upload this image.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (bannerFrame && !framingAvailable) {
        throw new Error(
          "Banner framing is not available yet. Please try again after the update."
        );
      }
      if (
        bannerCard &&
        !ownedBannerCards.some(card => card.id === bannerCard.id)
      )
        throw new Error("Choose a card you own for your banner.");
      const uploadedBannerUrl = bannerFile
        ? await (adapter.uploadBanner ?? uploadBanner)(bannerFile, profile.id)
        : bannerUrl;
      const updated = await (adapter.saveAppearance ?? saveProfileAppearance)(
        bio,
        avatar,
        [...selected],
        bannerCard?.id ?? null,
        uploadedBannerUrl,
        bannerFrame ?? undefined
      );
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save changes.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6 yk-profile-edit-grid" data-profile-editor={mode}>
      <div className="space-y-6">
        {mode === "profile" && (
          <>
            <div className="flex items-center gap-4">
              <Avatar
                name={profile.pseudo}
                image={avatar ?? undefined}
                size={80}
              />
              <label className="yk-button yk-button-secondary cursor-pointer">
                Choose photo
                <input
                  className="sr-only"
                  type="file"
                  disabled={busy}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={e => void photo(e.target.files?.[0])}
                />
              </label>
            </div>
            <p className="text-xs text-ink-3">
              JPG, PNG, WebP or GIF · Up to 4 MB.
            </p>
            {!pro && <ProFeatureNotice feature="Animated profile pictures" />}
            <label className="block text-sm text-ink-2">
              Bio
              <textarea
                className="auth-input mt-2 min-h-28 resize-none overflow-y-auto py-3"
                maxLength={300}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell us about your collection…"
              />
              <span className="mt-1 block text-right text-xs text-ink-3">
                {bio.length}/300
              </span>
            </label>
            <section
              className="yk-profile-banner-editor"
              data-owned-banner-picker
            >
              <h3 className="font-display text-lg">Profile banner</h3>
              <p className="yk-profile-muted">
                Choose a card from your collection or upload an image. Adjust
                its position, zoom and rotation before saving.
              </p>
              {profile.bannerCard && !eligibleBanner && !initialBannerUrl && (
                <p className="mt-2 text-xs text-ink-3" role="status">
                  Your previous banner is no longer eligible. Saving will
                  replace it with your selected card, or remove it if no card is
                  selected.
                </p>
              )}
              {bannerSource && (
                <div className="yk-banner-framed-preview">
                  <BannerImage
                    src={bannerSource}
                    frame={
                      bannerFrame ?? { x: 50, y: 50, zoom: 1, rotation: 0 }
                    }
                  />
                </div>
              )}
              <div className="yk-profile-widget-tools">
                <label
                  className="yk-button yk-button-secondary cursor-pointer"
                  data-banner-upload
                  aria-disabled={!pro}
                >
                  Upload banner
                  <input
                    className="sr-only"
                    type="file"
                    disabled={busy || !pro}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file || !pro) return;
                      if (file.size > PROFILE_IMAGE_MAX_BYTES) {
                        setError("Your banner must be 4 MB or smaller.");
                        return;
                      }
                      if (
                        ![
                          "image/jpeg",
                          "image/png",
                          "image/webp",
                          "image/gif"
                        ].includes(file.type)
                      ) {
                        setError("Use a JPG, PNG, WebP or GIF image.");
                        return;
                      }
                      setError("");
                      const src = URL.createObjectURL(file);
                      setCrop({ src, frame: null, card: null, file });
                    }}
                  />
                </label>
                {bannerSource && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setBannerCard(null);
                      setBannerFrame(null);
                      setBannerUrl(null);
                      setBannerFile(null);
                      setBannerPreview(null);
                    }}
                  >
                    Remove banner
                  </Button>
                )}
                {bannerSource && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      setCrop({
                        src: bannerSource,
                        frame: bannerFrame,
                        card: bannerCard
                      })
                    }
                  >
                    Adjust banner
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-3">
                JPG, PNG, WebP or GIF · Up to 4 MB.
              </p>
              {!pro && (
                <ProFeatureNotice feature="Custom and animated banners" />
              )}
              {bannerCard && (
                <div className="yk-banner-choice mt-4">
                  <div>
                    <img src={bannerCard.image} alt="" decoding="async" />
                    <strong>{bannerCard.name}</strong>
                    <small>{bannerCard.anime ?? bannerCard.category}</small>
                  </div>
                </div>
              )}
              <div className="relative mt-4">
                <input
                  className="auth-input"
                  type="search"
                  aria-label="Search your collection for a banner"
                  aria-describedby="banner-search-help"
                  disabled={busy}
                  value={bannerQuery}
                  onChange={e => {
                    const value = e.target.value;
                    setBannerQuery(value);
                    setError("");
                  }}
                  placeholder="Search by character and franchise…"
                />
                <p id="banner-search-help" className="mt-2 text-xs text-ink-3">
                  Combine a character’s name with its franchise, e.g. Loki One
                  Piece.
                </p>
                {ownedBannerChoices.length > 0 ? (
                  <ul className="yk-banner-results">
                    {ownedBannerChoices.slice(0, 36).map(card => (
                      <li key={card.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setCrop({
                              src: card.image,
                              frame: null,
                              card
                            });
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
                ) : (
                  <p className="mt-3 text-sm text-ink-3" role="status">
                    {ownedBannerCards.length
                      ? "No matching cards in your collection."
                      : "Collect a card to use it as a profile banner, or upload an image."}
                  </p>
                )}
                {ownedBannerChoices.length > 36 && (
                  <p className="mt-2 text-xs text-ink-3">
                    Showing 36 of{" "}
                    {ownedBannerChoices.length.toLocaleString("en-US")} cards.
                    Search to find a specific card.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
        {mode === "showcase" && (
          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg">Featured cards</h3>
              <span className="text-xs text-ink-3">
                {selected.size}/{FEATURED_CARD_LIMIT}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-3">
              Choose up to {FEATURED_CARD_LIMIT} different cards from your
              collection.
            </p>
            <label className="sr-only" htmlFor="featured-query">
              Search for a card to feature
            </label>
            <input
              id="featured-query"
              className="auth-input mt-4"
              type="search"
              value={featuredQuery}
              onChange={e => setFeaturedQuery(e.target.value)}
              placeholder="Search cards…"
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
                    <span>{featured ? "Selected" : "Choose"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 yk-profile-edit-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {crop && (
        <BannerCrop
          key={crop.src}
          src={crop.src}
          initial={crop.frame}
          onCancel={() => {
            if (crop.file) URL.revokeObjectURL(crop.src);
            setCrop(null);
          }}
          onApply={frame => {
            setBannerCard(crop.card);
            if (crop.file) {
              setBannerFile(crop.file);
              setBannerPreview(URL.createObjectURL(crop.file));
              setBannerUrl(null);
              URL.revokeObjectURL(crop.src);
            } else if (crop.card) {
              setBannerFile(null);
              setBannerUrl(null);
              setBannerPreview(null);
            }
            setBannerFrame(frame);
            setCrop(null);
          }}
        />
      )}
    </div>
  );
}

function ProfileStyleEditor({
  profile,
  onSaved,
  onClose
}: {
  profile: Profile;
  onSaved: (style: ProfileStyle) => void;
  onClose: () => void;
}) {
  const pro = useProAccess();
  const initialStyle = normalizeProfileStyle({
    ...DEFAULT_PROFILE_STYLE,
    ...profile.profileStyle?.style
  });
  const [style, setStyle] = useState(initialStyle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!pro || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/pro/profile-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style })
      });
      if (!response.ok)
        throw new Error("Your profile style couldn't be saved. Try again.");
      onSaved(style);
      window.dispatchEvent(new Event("yokkai:profile-style-updated"));
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your profile style couldn't be saved. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6" data-profile-editor="style">
      <ProfileStyleFields
        name={profile.pseudo}
        value={style}
        onChange={setStyle}
        busy={busy}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="yk-profile-style-actions">
        {!pro && (
          <p>
            Preview is free. Saving and publishing a profile style requires
            Yokkai Pro.
          </p>
        )}
        <div>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !pro}
            aria-describedby={!pro ? "profile-style-save-help" : undefined}
            onClick={() => void submit()}
          >
            {busy ? "Saving…" : pro ? "Save & apply" : "Pro required"}
          </Button>
        </div>
        {!pro && (
          <span id="profile-style-save-help" className="sr-only">
            Upgrade to Yokkai Pro to save and publish this style.
          </span>
        )}
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
                href={`/catalog?carte=${card.id}`}
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
              {details.favoriteAlbums.filter(
                album => album.owned === album.total
              ).length === 1
                ? "favorite binder completed"
                : "favorite binders completed"}{" "}
              <small>
                of {details.favoriteAlbums.length}{" "}
                {details.favoriteAlbums.length === 1 ? "favorite" : "favorites"}
              </small>
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
                  aria-label={`Completion for ${album.license}`}
                />
                <small>{album.percent}% complete</small>
              </li>
            ))}
          </ul>
        </section>
      ) : !details ? (
        <p className="yk-profile-empty">
          {detailsError
            ? "Binder progress is temporarily unavailable."
            : "Loading progress…"}
        </p>
      ) : (
        <div className="yk-profile-surface yk-profile-completion-empty">
          <span aria-hidden="true">☆</span>
          <h3>No favorite binders yet</h3>
          <p>Starred binders will appear here with their progress.</p>
          {isMe && (
            <Link className="yk-button yk-button-secondary" href="/collection">
              Choose my favorite binders
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
  const [editingMode, setEditingMode] = useState<
    "profile" | "style" | "showcase"
  >("profile");
  const [toast, setToast] = useState("");
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishlistCard, setWishlistCard] = useState<WishlistCard | null>(null);
  const [friendCards, setFriendCards] = useState<CollectedCard[]>();
  const [collectionError, setCollectionError] = useState("");
  const [tab, setTab] = useState(
    searchParams.get("tab") === "wall" ? "wall" : "tableau"
  );
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
  const [savedBannerFrame, setSavedBannerFrame] = useState<
    BannerFrame | null | undefined
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
        if (active) setEngagementError("Likes are temporarily unavailable.");
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
            setDetailsError("Stats and board are temporarily unavailable.");
        }
      );
    return () => {
      active = false;
    };
  }, [identifier, adapter]);
  const loadFriendPaniniAlbums = useCallback(
    (options: Parameters<typeof getFriendPaniniAlbumsPage>[1]) => {
      if (!profile) return Promise.reject(new Error("Profile unavailable."));
      if (adapter.friendAlbums)
        return adapter.friendAlbums(profile.id, options);
      return getFriendPaniniAlbumsPage(profile.id, options);
    },
    [profile, adapter]
  );
  const loadFriendPaniniAlbumCards = useCallback(
    (options: Parameters<typeof getFriendPaniniAlbumCardsPage>[1]) => {
      if (!profile) return Promise.reject(new Error("Profile unavailable."));
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
          setError(e instanceof Error ? e.message : "Profile unavailable.");
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
        <p>Loading profile…</p>
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
        reason instanceof Error ? reason.message : "Like unavailable."
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
      .then(setProfile, () => setError("Profile unavailable."));
  }
  function afterUnblock() {
    if (!profile) return;
    setBlocked(current => current.filter(player => player.id !== profile.id));
    void adapter
      .profile(identifier)
      .then(setProfile, () => setError("Profile unavailable."));
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
        reason instanceof Error ? reason.message : "Collection unavailable."
      );
    }
  }
  const categories = friendCards
    ? [...new Set(friendCards.map(card => card.category))].sort((a, b) =>
        a.localeCompare(b, "fr")
      )
    : [];
  const bannerImage =
    (savedBannerUrl === undefined ? details?.bannerUrl : savedBannerUrl) ||
    profile.bannerCard?.image;
  const bannerFrame =
    savedBannerFrame === undefined ? details?.bannerFrame : savedBannerFrame;
  return (
    <>
      <div
        className="yk-profile-hub"
        data-profile-tab={tab}
        data-profile-theme="default"
        data-avatar-frame={
          profile.profileStyle?.active
            ? profile.profileStyle.style.avatarFrame
            : "none"
        }
        data-showcase-effect={
          profile.profileStyle?.active
            ? profile.profileStyle.style.showcaseEffect
            : "none"
        }
      >
        <section className="yk-profile-main">
          <nav className="yk-profile-tabs" aria-label="Profile sections">
            {[
              ["tableau", "Board"],
              ["wall", "Wall"],
              ["activity", "Activity"],
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
                <h3 className="yk-section-title">Featured cards</h3>
                {isMe ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingMode("showcase");
                      setEditing(true);
                    }}
                  >
                    Edit showcase
                  </Button>
                ) : (
                  <span className="yk-profile-muted">Their showcase</span>
                )}
              </div>
              <Featured
                cards={profile.featuredCards}
                slots={profile.profileStyle?.active ? 10 : 5}
              />
            </section>
            {adapter.previewWidgets ? (
              <section className="yk-profile-universe">
                <div className="yk-profile-section-heading">
                  <div>
                    <p className="eyebrow">Their world</p>
                    <h2>Board for {profile.pseudo}</h2>
                  </div>
                  {isMe && (
                    <Button
                      variant="secondary"
                      disabled={!details}
                      onClick={() => setPreferencesOpen(true)}
                    >
                      Customize my board
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
                            ? "Add your favorites to share what you love."
                            : "Their favorites will appear here."}
                        </p>
                      )}
                    </section>
                  ))}
                </div>
                {details && !details.widgets.length && (
                  <p className="yk-profile-surface yk-profile-empty">
                    {isMe
                      ? "Make your board your own with widgets for your favorite categories."
                      : "Their favorite widgets will appear here."}
                  </p>
                )}
              </section>
            ) : (
              <section className="yk-profile-completion">
                <div className="yk-profile-section-heading">
                  <h2>Completion</h2>
                  <span className="yk-profile-muted">Favorite binders</span>
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
                <p className="eyebrow">The collector&apos;s feed</p>
                <h2>Recent activity</h2>
              </div>
              <span className="yk-profile-muted">Last 20 activities</span>
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
                      href={`/catalog?carte=${event.card.id}`}
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
                          ? "Card sold"
                          : event.kind === "bought"
                            ? "Card bought"
                            : "Card obtained"}
                      </p>
                      <Link href={`/catalog?carte=${event.card.id}`}>
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
                          {event.price.toLocaleString("en-US")} Karas
                        </p>
                      )}
                    </div>
                    <time dateTime={event.at}>
                      {new Date(event.at).toLocaleDateString("en-US", {
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
                  ? "No activity to show yet."
                  : detailsError
                    ? "Activity is temporarily unavailable."
                    : "Loading activity…"}
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
                          href={`/profile/${encodeURIComponent(friend.pseudo)}`}
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
          <div
            className={`yk-profile-banner ${bannerImage ? "has-image" : ""} ${bannerFrame ? "has-frame" : ""}`}
          >
            {bannerImage && (
              <>
                {bannerFrame ? (
                  <BannerImage src={bannerImage} frame={bannerFrame} />
                ) : (
                  <img
                    src={bannerImage}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                  />
                )}
                <span className="yk-profile-banner-shade" />
              </>
            )}
          </div>
          <div className="yk-profile-identity-content">
            <div className="yk-profile-avatar">
              <Avatar
                name={profile.pseudo}
                image={profile.avatarUrl ?? undefined}
                size={96}
              />
            </div>
            <span className="yk-profile-identity-label">COLLECTOR</span>
            <div className="yk-profile-name-row">
              <h2>
                <StyledPlayerName
                  name={profile.pseudo}
                  cosmetics={profile.profileStyle}
                />
              </h2>
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
            <p className="yk-profile-bio">{profile.bio || "No bio yet."}</p>
            <div className="yk-profile-actions">
              {isMe ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingMode("profile");
                      setEditing(true);
                    }}
                  >
                    Edit profile
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingMode("style");
                      setEditing(true);
                    }}
                  >
                    Profile style
                  </Button>
                </>
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
                  ? "Saving…"
                  : engagement?.likedByMe
                    ? "♥ Profile liked"
                    : "♡ Like this profile"}
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
                  aria-label={`View ${profile.cardCount?.toLocaleString("en-US") ?? "—"} ${profile.cardCount === 1 ? "card" : "cards"} from ${profile.pseudo}`}
                >
                  <p>Cards</p>
                  <strong>{profile.cardCount}</strong>
                  <span>View collection →</span>
                </button>
              ) : (
                <Link href="/collection">
                  <p>Cards</p>
                  <strong>
                    {profile.canViewCollection ? profile.cardCount : "Private"}
                  </strong>
                </Link>
              )}
              <div>
                <p>Unique</p>
                <strong>
                  {profile.canViewCollection
                    ? profile.distinctCardCount
                    : "Private"}
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
                  {engagement?.likes.toLocaleString("en-US") ?? "—"}
                </strong>
              </div>
            </div>
            <div className="yk-profile-side-stats">
              <div>
                <p>Packs opened</p>
                <strong>
                  {profile.canViewCollection
                    ? (details?.boostersOpened?.toLocaleString("en-US") ?? "—")
                    : "Private"}
                </strong>
              </div>
              <div className="is-lr">
                <p>✦ LR</p>
                <strong>
                  {profile.canViewCollection
                    ? (details?.lrCount?.toLocaleString("en-US") ?? "—")
                    : "Private"}
                </strong>
              </div>
              <div className="is-ssr">
                <p>✦ SSR</p>
                <strong>
                  {profile.canViewCollection
                    ? (details?.ssrCount?.toLocaleString("en-US") ?? "—")
                    : "Private"}
                </strong>
              </div>
            </div>
            <div className="yk-profile-member">
              <p>Member since</p>
              <strong>
                {details?.joinedAt || (isMe && joined)
                  ? new Date(details?.joinedAt || joined!).toLocaleDateString(
                      "en-US",
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
        title="Customize my board"
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
              setToast("Board updated");
            }}
          />
        )}
      </Modal>
      <Modal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        title={`Collection for ${profile.pseudo}`}
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
              Try again
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
            <p>Loading collection…</p>
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
        title={
          editingMode === "showcase"
            ? "Edit showcase"
            : editingMode === "style"
              ? "Profile style"
              : "Edit my profile"
        }
        className={
          editingMode === "profile"
            ? "yk-profile-edit-modal"
            : editingMode === "style"
              ? "yk-profile-style-modal"
              : "max-w-4xl"
        }
      >
        {isMe && editingMode === "style" ? (
          <ProfileStyleEditor
            key={editingMode}
            profile={profile}
            onClose={() => setEditing(false)}
            onSaved={style => {
              setProfile({
                ...profile,
                profileStyle: { active: true, style }
              });
              setToast("Profile style updated");
            }}
          />
        ) : isMe && collection && details ? (
          <Editor
            key={editingMode}
            mode={editingMode === "showcase" ? "showcase" : "profile"}
            profile={profile}
            collection={collection}
            initialBannerUrl={
              (savedBannerUrl === undefined
                ? details?.bannerUrl
                : savedBannerUrl) ?? null
            }
            initialBannerFrame={bannerFrame ?? null}
            framingAvailable={
              !!adapter.saveAppearance || details.bannerFrame !== undefined
            }
            adapter={adapter}
            onClose={() => setEditing(false)}
            onSaved={p => {
              setProfile(p);
              setSavedBannerUrl(p.bannerUrl);
              setSavedBannerFrame(p.bannerFrame ?? null);
              setToast(
                editingMode === "showcase"
                  ? "Showcase updated"
                  : "Profile updated"
              );
            }}
          />
        ) : (
          <p className="yk-profile-empty">
            {detailsError || "Loading profile editor…"}
          </p>
        )}
      </Modal>
      <Toast message={toast} onDismiss={() => setToast("")} />
    </>
  );
}
