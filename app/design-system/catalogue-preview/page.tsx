import type { Metadata } from "next";
import { CardShell } from "@/components/card-shell";
import { Topbar } from "@/components/topbar";
import { YokaiCard } from "@/components/yokai-card";
import type { Card, Rarity } from "@/lib/data/cards";

export const metadata: Metadata = {
  title: "Catalogue preview · Yokkai Collec’",
  robots: { index: false, follow: false }
};
const rarities: Rarity[] = ["LR", "SSR", "SR", "R", "C"];
const rarityText: Record<Rarity, string> = {
  C: "text-rarity-c",
  R: "text-rarity-r",
  SR: "text-rarity-sr",
  SSR: "text-rarity-ssr",
  UR: "text-rarity-ur",
  LR: "text-rarity-lr"
};
const cards: Card[] = Array.from({ length: 24 }, (_, index) => ({
  id: `catalogue-preview-${index}`,
  name: ["Kitsune céleste", "Oni écarlate", "Tengu des brumes", "Kappa ancien"][
    index % 4
  ],
  category: index % 2 ? "Manga" : "Anime",
  anime: "Spirit Realm",
  rarity: rarities[index % rarities.length],
  image: "/assets/booster-pack.png"
}));
const icon = (rarity: Rarity) => (
  <svg
    aria-hidden="true"
    className={rarityText[rarity]}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="m12 2 2.45 6.1L21 10.5l-5.25 4.05L16 21l-4-3.55L8 21l.25-6.45L3 10.5l6.55-2.4L12 2Z" />
  </svg>
);

export default function CataloguePreview() {
  return (
    <>
      <Topbar view="search" name="Kitsune" karas={4920} notifications={[]} />
      <main className="mx-auto w-full max-w-[var(--layout-collection-max)] px-6 py-10">
        <p className="eyebrow">Toutes les cartes du jeu</p>
        <h1 className="yk-title mt-3">Catalogue</h1>
        <section className="yk-catalogue mt-8">
          <div className="yk-catalogue-heading">
            <div>
              <p className="font-display text-xl">103 379 cartes</p>
              <p className="mt-1 text-xs text-ink-3">
                Toutes les cartes du jeu
              </p>
            </div>
            <button type="button" className="yk-mobile-filter-trigger">
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
            </button>
          </div>
          <div className="yk-collection-layout">
            <aside className="yk-collection-sidebar">
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
                <span>Rechercher…</span>
              </div>
              <details className="yk-filter-section" open>
                <summary>Rareté</summary>
                <div className="yk-filter-section-content">
                  <div className="yk-filter-option" aria-pressed="true">
                    <span className="yk-filter-check" />
                    <span>Toutes</span>
                  </div>
                  {rarities.map(rarity => (
                    <div className="yk-filter-option" key={rarity}>
                      <span className="yk-filter-check" />
                      {icon(rarity)}
                      <span className={rarityText[rarity]}>{rarity}</span>
                    </div>
                  ))}
                </div>
              </details>
              <details className="yk-filter-section" open>
                <summary>Catégorie</summary>
                <div className="yk-filter-section-content">
                  {[
                    "Toutes les catégories",
                    "Anime",
                    "Manga",
                    "Kpop",
                    "Film"
                  ].map((category, index) => (
                    <div
                      className="yk-filter-option"
                      aria-pressed={index === 0}
                      key={category}
                    >
                      <span className="yk-filter-check" />
                      <span>{category}</span>
                    </div>
                  ))}
                </div>
              </details>
              <button className="yk-filter-reset" disabled>
                Réinitialiser les filtres
              </button>
            </aside>
            <div className="yk-collection-main">
              <ul className="yk-card-grid yk-catalogue-grid">
                {cards.map(card => (
                  <li key={card.id}>
                    <button type="button" className="yk-catalogue-card">
                      <CardShell>
                        <YokaiCard {...card} animated={false} />
                      </CardShell>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="yk-collection-pagination">
                <span className="text-sm text-ink-2">
                  ‹　1　2　3　…　4308　›
                </span>
                <label>
                  Cartes par page
                  <select defaultValue={24}>
                    <option>24</option>
                    <option>36</option>
                    <option>48</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
