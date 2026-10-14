"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ProfileExperience, type ProfileAdapter } from "@/components/profile";
import { Topbar } from "@/components/topbar";
import type { CollectedCard } from "@/lib/data/cards";
import type { ProfileDetails, ProfileInterests } from "@/lib/data/profile";

const collection: CollectedCard[] = [
  ["SATORU GOJO", "Jujutsu Kaisen", "gojou.webp", "LR"],
  ["LEVI ACKERMAN", "Attack on Titan", "levi.webp", "SSR"],
  ["MONKEY D. LUFFY", "One Piece", "luffy.webp", "SSR"]
].map(([name, anime, image, rarity], index) => ({
  id: `preview-${index}`,
  instanceId: `preview-instance-${index}`,
  name,
  anime,
  category: "ANIME/MANGA",
  rarity: rarity as CollectedCard["rarity"],
  image: `/assets/landing/${image}`,
  catalogueImage: `/assets/landing/${image}`,
  customImageUrl: null,
  folderId: null,
  obtainedAt: "2026-10-14T10:00:00Z",
  shiny: false,
  isEvolved: false,
  isFirstOwner: true
}));
const initial: ProfileInterests = {
  anime: ["One Piece", "Noragami", "Black Butler", "Jujutsu Kaisen"],
  games: ["Final Fantasy VII", "Silent Hill 2", "Hollow Knight"],
  kpop: ["BTS", "TWICE", "Stray Kids"],
  other: ["Studio Ghibli", "Le Seigneur des Anneaux", "Daft Punk"]
};

export function ProfilePreview() {
  const params = useSearchParams();
  const visitor = params.get("visitor") === "1";
  const privateProfile = params.get("private") === "1";
  const adapter = useMemo<ProfileAdapter>(() => {
    const friends = [
      { id: "friend-1", pseudo: "Kitsune" },
      { id: "friend-2", pseudo: "Sakura" },
      { id: "friend-3", pseudo: "Rin" }
    ];
    return {
      profile: async () => ({
        id: "preview",
        pseudo: "Toba",
        avatarUrl: "/assets/landing/gojou.webp",
        bio: "Les histoires qui restent, les cartes qu’on collectionne.\nAnime, RPG et découvertes en boucle ✧",
        bannerCard: collection[0],
        friendshipStatus: visitor ? "accepted" : "self",
        isPublic: !privateProfile,
        canViewCollection: !privateProfile,
        featuredCards: privateProfile ? [] : collection,
        friendsVisible: !privateProfile,
        friends: privateProfile ? [] : friends,
        cardCount: privateProfile ? null : 2578,
        distinctCardCount: privateProfile ? null : 1342
      }),
      wishlist: async () =>
        collection.map(card => ({
          ...card,
          createdAt: "2026-10-13T10:00:00Z"
        })),
      blocked: async () => [],
      saveInterests: async value => value,
      details: async () =>
        ({
          joinedAt: "2025-11-21T10:00:00Z",
          interests: initial,
          boostersOpened: privateProfile ? null : 824,
          lrCount: privateProfile ? null : 12,
          ssrCount: privateProfile ? null : 86,
          mutualFriends: privateProfile ? [] : friends.slice(0, 2),
          favoriteAlbums: privateProfile
            ? []
            : [
                { license: "One Piece", owned: 156, total: 195, percent: 80 },
                { license: "Naruto", owned: 95, total: 119, percent: 80 },
                {
                  license: "Black Butler",
                  owned: 107,
                  total: 107,
                  percent: 100
                },
                { license: "KPOP", owned: 47, total: 56, percent: 84 },
                { license: "Noragami", owned: 45, total: 62, percent: 73 },
                { license: "Final Fantasy", owned: 48, total: 63, percent: 76 }
              ],
          activity: privateProfile
            ? []
            : collection.map((card, index) => ({
                id: card.id,
                kind: (["obtained", "bought", "sold"] as const)[index],
                at: `2026-10-${14 - index}T10:00:00Z`,
                card,
                ...(index ? { price: index === 1 ? 240 : 180 } : {})
              }))
        }) satisfies ProfileDetails
    };
  }, [visitor, privateProfile]);
  return (
    <>
      <Topbar view="profile" name="Toba" karas={2578} notifications={[]} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <p className="eyebrow">Aperçu local · données de démonstration</p>
        <h1 className="yk-title mt-3">Profil du collectionneur</h1>
        <div className="mt-8">
          <ProfileExperience
            key={`${visitor}:${privateProfile}`}
            adapter={adapter}
          />
        </div>
      </main>
    </>
  );
}
