"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ProfileExperience, type ProfileAdapter } from "@/components/profile";
import { Topbar } from "@/components/topbar";
import {
  getGameInfo,
  getPaniniAlbumsPage,
  type CollectedCard
} from "@/lib/data/cards";
import type { ProfileDetails, ProfileInterests } from "@/lib/data/profile";
import type { ProfileEngagement } from "@/lib/data/profile";

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
const licenses: Record<string, string[]> = {
  "ANIME/MANGA": [
    ...initial.anime,
    "Bleach",
    "Naruto",
    "Demon Slayer",
    "Attack on Titan",
    "Fullmetal Alchemist",
    "Hunter x Hunter",
    "Death Note",
    "Dragon Ball",
    "Chainsaw Man"
  ],
  "VIDEO GAMES": [
    ...initial.games,
    "Persona 5",
    "The Last of Us",
    "Elden Ring"
  ],
  KPOP: [...initial.kpop, "BLACKPINK", "EXO", "SEVENTEEN"],
  FILM: [
    "Le Seigneur des Anneaux",
    "Harry Potter",
    "Star Wars",
    "Studio Ghibli"
  ],
  KDRAMA: ["Goblin", "Crash Landing on You", "Squid Game"],
  COMICS: ["Marvel", "DC"],
  ARTIST: ["Daft Punk", "Taylor Swift", "The Weeknd"],
  BRAINROT: ["BRAINROT"],
  MEME: ["MEME"],
  VOCALOID: ["VOCALOID"],
  "DISNEY CHANNEL": ["DISNEY CHANNEL"],
  SPORT: ["NBA", "Football"],
  SERIE: ["Breaking Bad", "Stranger Things"],
  MANWHA: ["Solo Leveling", "Omniscient Reader"],
  ESPORT: ["League of Legends", "Valorant"],
  "INTERNET PERSONALITY": ["MrBeast", "Logan Paul"]
};

export function ProfilePreview() {
  const params = useSearchParams();
  const visitor = params.get("visitor") === "1";
  const privateProfile = params.get("private") === "1";
  const demoCatalogue = params.get("catalogue") === "demo";
  const reportError = params.get("reportError") === "1";
  const previewUrls = useRef<string[]>([]);
  const social = useRef<ProfileEngagement>({
    views: 1284,
    likes: 42,
    likedByMe: false
  });
  const countedVisits = useRef(new Set<string>());
  useEffect(
    () => () => {
      previewUrls.current.forEach(url => URL.revokeObjectURL(url));
    },
    []
  );
  const adapter = useMemo<ProfileAdapter>(() => {
    const friends = [
      { id: "friend-1", pseudo: "Kitsune" },
      { id: "friend-2", pseudo: "Sakura" },
      { id: "friend-3", pseudo: "Rin" }
    ];
    const profile = () => ({
      id: "preview",
      pseudo: "Toba",
      avatarUrl: "/assets/landing/gojou.webp",
      bio: "Les histoires qui restent, les cartes qu’on collectionne.\nAnime, RPG et découvertes en boucle ✧",
      bannerCard: collection[0],
      friendshipStatus: visitor ? ("accepted" as const) : ("self" as const),
      isPublic: !privateProfile,
      canViewCollection: !privateProfile,
      featuredCards: privateProfile ? [] : collection,
      friendsVisible: !privateProfile,
      friends: privateProfile ? [] : friends,
      cardCount: privateProfile ? null : 2578,
      distinctCardCount: privateProfile ? null : 1342
    });
    const upload = async (file: File) => {
      if (
        file.size > 2 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          file.type
        )
      )
        throw new Error("JPG, PNG, WebP ou GIF, 2 Mo maximum.");
      const url = URL.createObjectURL(file);
      previewUrls.current.push(url);
      return url;
    };
    return {
      profile: async () => profile(),
      wishlist: async () =>
        collection.map(card => ({
          ...card,
          createdAt: "2026-10-13T10:00:00Z"
        })),
      blocked: async () => [],
      moderation: {
        list: async () => [],
        block: async () => {},
        unblock: async () => {},
        report: async () => {
          if (reportError)
            throw new Error("Impossible de transmettre ce signalement.");
        }
      },
      engagement: async () => ({ ...social.current }),
      recordView: async (_id, visitId) => {
        if (!countedVisits.current.has(visitId)) {
          countedVisits.current.add(visitId);
          social.current = {
            ...social.current,
            views: social.current.views + 1
          };
        }
        return { ...social.current };
      },
      like: async (_id, liked) => {
        social.current = {
          ...social.current,
          likes:
            social.current.likes +
            Number(liked) -
            Number(social.current.likedByMe),
          likedByMe: liked
        };
        return { ...social.current };
      },
      saveWidgets: async value => value,
      widgetLicenses: async ({ category, query = "", page = 1 }) => {
        if (!demoCatalogue) {
          const data = await getPaniniAlbumsPage({
            category,
            query,
            page,
            pageSize: 72
          });
          return {
            items: data.items.map(album => album.license),
            total: data.total
          };
        }
        const items = (licenses[category] ?? [])
          .filter(license =>
            license.toLowerCase().includes(query.trim().toLowerCase())
          )
          .toSorted((a, b) => a.localeCompare(b, "fr"));
        return {
          items: items.slice((page - 1) * 72, page * 72),
          total: items.length
        };
      },
      uploadAvatar: upload,
      uploadBanner: upload,
      search: async query =>
        collection.filter(card =>
          `${card.name} ${card.anime}`
            .toLowerCase()
            .includes(query.toLowerCase())
        ),
      saveAppearance: async (bio, avatarUrl, ids, bannerCardId, bannerUrl) => ({
        ...profile(),
        bio,
        avatarUrl,
        bannerUrl,
        bannerCard: collection.find(card => card.id === bannerCardId) ?? null,
        featuredCards: collection.filter(card => ids.includes(card.instanceId))
      }),
      details: async () =>
        ({
          joinedAt: "2025-11-21T10:00:00Z",
          interests: initial,
          widgets: [
            { category: "ANIME/MANGA", entries: initial.anime },
            { category: "VIDEO GAMES", entries: initial.games },
            { category: "KPOP", entries: initial.kpop },
            {
              category: "FILM",
              entries: ["Studio Ghibli", "Le Seigneur des Anneaux"]
            }
          ],
          widgetCategories: demoCatalogue
            ? Object.keys(licenses)
            : [
                ...new Set(
                  (await getGameInfo()).categories.map(category =>
                    category.trim().toUpperCase()
                  )
                )
              ].sort(),
          bannerUrl: null,
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
  }, [visitor, privateProfile, demoCatalogue, reportError]);
  return (
    <>
      <Topbar view="profile" name="Toba" karas={2578} notifications={[]} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <p className="eyebrow">Aperçu local · données de démonstration</p>
        {!demoCatalogue && (
          <p className="yk-profile-muted mt-3">
            Les catégories et licences viennent du catalogue réel, en lecture
            seule. Connecte-toi en local pour les consulter. Les modifications
            du profil restent temporaires.
          </p>
        )}
        {!demoCatalogue && (
          <a
            className="yk-profile-muted underline"
            href="/design-system/profile-preview?catalogue=demo"
          >
            Essayer avec les données de démonstration sans connexion
          </a>
        )}
        <h1 className="yk-title mt-3">Profil du collectionneur</h1>
        <div className="mt-8">
          <ProfileExperience
            key={`${visitor}:${privateProfile}:${demoCatalogue}`}
            adapter={adapter}
            collection={collection}
          />
        </div>
      </main>
    </>
  );
}
