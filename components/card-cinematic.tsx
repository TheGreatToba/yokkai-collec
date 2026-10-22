"use client";

import type { Card } from "@/lib/data/cards";
import { LocalCardCinematic } from "@/components/local-card-cinematic";

// Use the same isolated player as the preview, but never its development route.
export function CardCinematic({
  card,
  onContinue
}: {
  card: Pick<Card, "name" | "category" | "anime" | "image" | "rarity">;
  onContinue: () => void;
}) {
  return (
    <LocalCardCinematic
      card={card}
      onContinue={onContinue}
      controls={false}
      productionEnabled
    />
  );
}
