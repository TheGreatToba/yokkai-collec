"use client";

import { useEffect } from "react";
import { CollectionView } from "@/components/collection";
import type { CollectedCard } from "@/lib/data/cards";

export function CollectionPreviewClient({ cards }: { cards: CollectedCard[] }) {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("detail")) return;
    const frame = window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".yk-collection-card")?.click());
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
