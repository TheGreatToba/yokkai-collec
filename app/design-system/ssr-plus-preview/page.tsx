import type { Metadata } from "next";
import { YokaiCard } from "@/components/yokai-card";
import { CollectionPreviewClient } from "@/components/collection-preview";
import type { CollectedCard } from "@/lib/data/cards";

export const metadata: Metadata = {
  title: "SSR+ preview · Yokkai Collec'",
  robots: { index: false, follow: false }
};

const card: CollectedCard = {
  id: "ssr-plus-preview",
  instanceId: "ssr-plus-preview-0",
  name: "Yokkai Spirit",
  category: "ANIME/MANGA",
  anime: "Yokkai Collec'",
  rarity: "SSR",
  image: "/assets/card-back.png",
  catalogueImage: "/assets/card-back.png",
  customImageUrl: null,
  obtainedAt: "2026-10-15T12:00:00Z",
  shiny: false,
  isEvolved: false,
  isFirstOwner: false,
  folderId: null
};
const cards = Array.from({ length: 6 }, (_, index) => ({
  ...card,
  instanceId: `ssr-plus-preview-${index}`
}));

export default function SsrPlusPreview() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-12">
      <p className="eyebrow">Local preview · simulated data</p>
      <h1 className="yk-title mt-2">SSR+ evolution</h1>
      <p className="mt-4 text-ink-2">
        Five identical SSR cards. One pink SSR+. No UR rarity.
      </p>
      <div className="my-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
        {(
          [
            ["SSR", "SSR", false],
            ["SSR+", "SSR", true],
            ["LR Shiny · unchanged", "LR", true]
          ] as const
        ).map(([label, rarity, shiny]) => (
          <section key={label} className="mx-auto w-full max-w-64">
            <h2 className="mb-4 text-center font-semibold">{label}</h2>
            <YokaiCard {...card} rarity={rarity} shiny={shiny} />
          </section>
        ))}
      </div>
      <h2 className="mb-6 font-display text-2xl">Try the fusion</h2>
      <CollectionPreviewClient cards={cards} />
    </main>
  );
}
