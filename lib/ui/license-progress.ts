import type { Card, CollectedCard } from "@/lib/data/cards";

const CATEGORY_ALBUMS = new Set([
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
]);

export function paniniAlbumForCard(
  card: Pick<Card, "anime" | "category">
): string {
  const category = card.category?.trim().toUpperCase();
  if (category === "ARTIST") return card.anime?.trim() || category;
  if (CATEGORY_ALBUMS.has(category)) return category;
  return card.anime?.trim() ?? "";
}

export function buildLicenseCatalogueTotals(
  cards: readonly Pick<Card, "id" | "anime" | "category">[]
): LicenseCatalogueTotal[] {
  const cardsByAlbum = new Map<string, Set<string>>();

  for (const card of cards) {
    const album = paniniAlbumForCard(card);
    if (!album) continue;
    const albumCards = cardsByAlbum.get(album) ?? new Set<string>();
    albumCards.add(card.id);
    cardsByAlbum.set(album, albumCards);
  }

  return [...cardsByAlbum].map(([license, albumCards]) => ({
    license,
    total: albumCards.size
  }));
}

export type LicenseCatalogueTotal = {
  license: string;
  total: number;
};

export type LicenseProgress = LicenseCatalogueTotal & {
  owned: number;
  percent: number;
};

export function buildLicenseProgress(
  cards: readonly CollectedCard[],
  catalogue: readonly LicenseCatalogueTotal[]
): LicenseProgress[] {
  const ownedByLicense = new Map<string, Set<string>>();

  for (const card of cards) {
    const license = paniniAlbumForCard(card);
    if (!license) continue;
    const owned = ownedByLicense.get(license) ?? new Set<string>();
    owned.add(card.id);
    ownedByLicense.set(license, owned);
  }

  return catalogue
    .filter(item => item.license.trim() && item.total > 0)
    .map(item => {
      const owned = ownedByLicense.get(item.license)?.size ?? 0;
      return {
        ...item,
        owned,
        percent: Math.min(100, Math.round((owned / item.total) * 100))
      };
    })
    .sort(
      (a, b) =>
        b.percent - a.percent ||
        b.owned - a.owned ||
        a.license.localeCompare(b.license, "fr")
    );
}
