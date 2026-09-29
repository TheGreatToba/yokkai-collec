"use client";

import { useEffect } from "react";
import { CollectionView } from "@/components/collection";
import type { CollectedCard } from "@/lib/data/cards";

export function CollectionPreviewClient({ cards }: { cards: CollectedCard[] }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("filters")) {
      const frame = window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".yk-mobile-filter-trigger")?.click());
      return () => window.cancelAnimationFrame(frame);
    }
    if (params.has("detail")) {
      const frame = window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".yk-collection-card")?.click());
      return () => window.cancelAnimationFrame(frame);
    }
    const selection = params.get("select");
    if (!selection) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(".yk-collection-summary .yk-button")?.click();
      window.requestAnimationFrame(() => {
        const cardButtons = [...document.querySelectorAll<HTMLButtonElement>(".yk-collection-card")];
        const count = selection === "all" ? cardButtons.length : selection === "many" ? 5 : 1;
        cardButtons.slice(0, count).forEach(button => button.click());
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <CollectionView
    cards={cards}
    categories={["Anime", "Manga"]}
    totals={{ C: 100, R: 100, SR: 100, SSR: 100, LR: 100 }}
    folders={[{ id: "favorites", name: "Favoris" }]}
    onMoveCard={async () => {}}
    onCreateAuction={async () => {}}
    onEvolve={async () => cards[0]}
    onSetCustomImage={async () => {}}
    onDiscard={async () => {}}
    onDiscardMany={async () => {}}
  />;
}
