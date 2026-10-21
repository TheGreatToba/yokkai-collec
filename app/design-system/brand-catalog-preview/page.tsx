"use client";
import { SearchView } from "@/components/community-views";
import { Topbar } from "@/components/topbar";
import type { Card, Rarity, getCataloguePage } from "@/lib/data/cards";

const categories = ["ANIME/MANGA", "FILM", "KPOP"];
const cards: Card[] = Array.from({ length: 26 }, (_, index) => ({
  id: `counter-${index}`,
  name: `Preview card ${index + 1}`,
  category: categories[index % 2],
  rarity: (["LR", "SSR", "SR", "R", "C"] as Rarity[])[index % 5],
  image: "/assets/booster-pack.png"
}));
const loadPage: typeof getCataloguePage = async ({
  category = "",
  rarity = "",
  query = "",
  page = 1,
  pageSize = 24
} = {}) => {
  const matching = cards.filter(
    card =>
      (!category || card.category === category) &&
      (!rarity || card.rarity === rarity) &&
      card.name.toLowerCase().includes(query.toLowerCase())
  );
  return {
    cards: matching.slice((page - 1) * pageSize, page * pageSize),
    total: matching.length
  };
};
const loadCounts = async () => ({
  total: 26,
  rarities: { LR: 6, SSR: 5, SR: 5, R: 5, C: 5 },
  categories: { "ANIME/MANGA": 13, FILM: 13 }
});

export default function BrandCatalogPreview() {
  return (
    <>
      <Topbar view="search" name="Preview" karas={0} notifications={[]} />
      <main className="mx-auto w-full max-w-[var(--layout-collection-max)] px-6 py-10">
        <SearchView
          loadPage={loadPage}
          loadCounts={loadCounts}
          previewCategories={categories}
          pageHeading={
            <>
              <p className="eyebrow">Every card in the game</p>
              <h1 className="yk-title mt-3">Catalog</h1>
            </>
          }
        />
      </main>
    </>
  );
}
