"use client";

import { Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CollectionView } from "@/components/collection";
import { ProfileExperience, type ProfileAdapter } from "@/components/profile";
import type {
  CollectedCard,
  PaniniAlbumCard,
  PaniniAlbumProgress,
  Rarity
} from "@/lib/data/cards";

// Disposable presentation data only. Production blocks every /design-system route.
const sources = [
  ["Sonic Adventure", "Sonic the Hedgehog", "VIDEO GAMES", 9],
  ["Sonic Adventure 2", "Sonic the Hedgehog", "VIDEO GAMES", 10],
  ["Sonic Heroes", "Sonic the Hedgehog", "VIDEO GAMES", 7],
  ["THE IDOLM@STER CINDERELLA GIRLS", "THE IDOLM@STER", "ANIME/MANGA", 6],
  ["THE IDOLM@STER MILLION LIVE!", "THE IDOLM@STER", "ANIME/MANGA", 4],
  ["IDOLM@STER: XENOGLOSSIA", "THE IDOLM@STER", "ANIME/MANGA", 2],
  [
    "Show Me Your Panties While You Give Me That Disgusted Look! 2",
    "Show Me Your Panties While You Give Me That Disgusted Look!",
    "ANIME/MANGA",
    6
  ],
  ["POKEMON BLUE/RED", "Pokémon", "VIDEO GAMES", 18]
] as const;
const categoryList = ["ANIME/MANGA", "VIDEO GAMES"];
const rarityList: Rarity[] = ["C", "R", "SR", "SSR", "LR"];
const catalogue: (PaniniAlbumCard & { binder: string })[] = sources.flatMap(
  ([source, binder, category, count], group) =>
    Array.from({ length: count }, (_, index) => ({
      id: `fixture-${group}-${index}`,
      name: `Fixture card ${group + 1}-${index + 1}`,
      category,
      anime: source,
      binder,
      rarity: rarityList[index % rarityList.length],
      image: "/assets/landing/gojou.webp",
      owned: index % 3 === 0
    }))
);
const owned: CollectedCard[] = catalogue
  .filter(card => card.owned)
  .map(card => ({
    ...card,
    instanceId: `instance-${card.id}`,
    obtainedAt: "2026-10-24T12:00:00Z",
    shiny: false,
    isEvolved: false,
    isFirstOwner: true,
    folderId: null,
    catalogueImage: card.image,
    customImageUrl: null
  }));
// An additional copy must not increase the number of distinct owned cards.
owned.push({ ...owned[0], instanceId: "fixture-extra-copy", shiny: true });

function Review() {
  const params = useSearchParams();
  const favorites = useRef(new Set(["Sonic the Hedgehog"]));
  const privateProfile = params.get("private") === "1";
  const adapter = useMemo(() => {
    const resolve = (license: string) =>
      sources.find(row => row[0] === license)?.[1] ?? license;
    const progress = (): PaniniAlbumProgress[] =>
      [...new Set(catalogue.map(card => card.binder))].map(license => {
        const cards = catalogue.filter(card => card.binder === license);
        const count = cards.filter(card => card.owned).length;
        return {
          license,
          total: cards.length,
          owned: count,
          percent: Math.round((count * 100) / cards.length),
          favorite: favorites.current.has(license)
        };
      });
    const albums = async ({
      query = "",
      category = "",
      favoritesOnly = false,
      page = 1,
      pageSize = 72
    } = {}) => {
      if (privateProfile)
        throw new Error(
          "This profile is private. Only friends can view its collection."
        );
      const items = progress().filter(
        album =>
          (!favoritesOnly || album.favorite) &&
          catalogue.some(
            card =>
              card.binder === album.license &&
              (!category || card.category === category) &&
              [card.binder, card.anime].some(name =>
                (name ?? "").toLowerCase().includes(query.toLowerCase())
              )
          )
      );
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length
      };
    };
    const cards = async ({
      license,
      query = "",
      category = "",
      rarity = "",
      ownedOnly = false,
      page = 1,
      pageSize = 28
    }: {
      license: string;
      query?: string;
      category?: string;
      rarity?: Rarity | "";
      ownedOnly?: boolean;
      page?: number;
      pageSize?: number;
    }) => {
      if (privateProfile)
        throw new Error(
          "This profile is private. Only friends can view its collection."
        );
      const items = catalogue.filter(
        card =>
          card.binder === resolve(license) &&
          (!category || card.category === category) &&
          (!rarity || card.rarity === rarity) &&
          (!ownedOnly || card.owned) &&
          [card.name, card.anime].some(name =>
            (name ?? "").toLowerCase().includes(query.toLowerCase())
          )
      );
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length
      };
    };
    const profile: ProfileAdapter = {
      profile: async () => ({
        id: "fixture-owner",
        pseudo: "BinderFixture",
        avatarUrl: null,
        bio: "Synthetic global binder review",
        bannerCard: null,
        friendshipStatus: privateProfile ? "none" : "accepted",
        isPublic: !privateProfile,
        canViewCollection: !privateProfile,
        featuredCards: privateProfile ? [] : owned.slice(0, 5),
        friends: [],
        friendsVisible: !privateProfile,
        cardCount: privateProfile ? null : owned.length,
        distinctCardCount: privateProfile ? null : owned.length - 1
      }),
      wishlist: async () => [],
      blocked: async () => [],
      friendCollection: async () => {
        if (privateProfile)
          throw new Error(
            "This profile is private. Only friends can view its collection."
          );
        return owned;
      },
      friendAlbums: async (_id, options) => albums(options),
      friendAlbumCards: async (_id, options) => cards(options),
      details: async () => ({
        joinedAt: "2026-10-24T12:00:00Z",
        interests: { anime: [], games: [], kpop: [], other: [] },
        widgets: privateProfile
          ? []
          : [
              {
                category: "VIDEO GAMES",
                entries: ["Sonic the Hedgehog", "Pokémon"]
              }
            ],
        widgetCategories: categoryList,
        bannerUrl: null,
        boostersOpened: privateProfile ? null : 12,
        lrCount: privateProfile ? null : 1,
        ssrCount: privateProfile ? null : 2,
        mutualFriends: [],
        favoriteAlbums: privateProfile
          ? []
          : progress().filter(album => album.favorite),
        activity: []
      })
    };
    return { albums, cards, profile };
  }, [privateProfile]);
  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1440,
        margin: "0 auto",
        padding: "clamp(8px, 2vw, 24px)"
      }}
    >
      <h1>Global binder review</h1>
      <p>
        Synthetic UI fixture. SQL and full-catalogue counts are verified
        separately. Favorites reset on reload.
      </p>
      <p>
        <Link href="?surface=collection">My binders</Link>
        {" · "}
        <Link href="?surface=profile">Friend profile</Link>
        {" · "}
        <Link href="?surface=profile&private=1">Private profile</Link>
      </p>
      <p>
        Expected: Sonic 10 / 26, THE IDOLM@STER 5 / 12, Pokémon 6 / 18. One
        extra owned copy does not increase progress.
      </p>
      {params.get("surface") === "profile" ? (
        <ProfileExperience
          identifier="fixture-owner"
          adapter={adapter.profile}
        />
      ) : (
        <CollectionView
          previewOnly
          cards={owned}
          categories={categoryList}
          loadPaniniAlbums={adapter.albums}
          loadPaniniAlbumCards={adapter.cards}
          onSetPaniniAlbumFavorite={async (license, favorite) => {
            if (favorite) favorites.current.add(license);
            else favorites.current.delete(license);
          }}
          loadCardDiscovery={async () => ({ marketValue: null })}
        />
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading review…</p>}>
      <Review />
    </Suspense>
  );
}
