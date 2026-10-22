"use client";

import type { Card } from "@/lib/data/cards";
import { LrCardReveal } from "@/components/lr-card-reveal";
import { LocalCardCinematic } from "@/components/local-card-cinematic";

// Use the same isolated player as the preview, but never its development route.
export function CardCinematic({
  card,
  onContinue
}: {
  card: Pick<Card, "name" | "category" | "anime" | "image" | "rarity">;
  onContinue?: () => void;
}) {
  if (card.rarity === "LR")
    return (
      <LrCardReveal
        key={`${card.name}:${card.image}`}
        card={card}
        onContinue={onContinue}
      />
    );
  return (
    <LocalCardCinematic
      card={card}
      onContinue={onContinue}
      controls={false}
      productionEnabled
    />
  );
}
