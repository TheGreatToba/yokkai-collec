"use client";

import type { Card } from "@/lib/data/cards";
import { LrCardReveal } from "@/components/lr-card-reveal";

// Both rarities use the same native player and the site's shared card face.
export function CardCinematic({
  card,
  onContinue,
  autoAdvance = false
}: {
  card: Pick<Card, "name" | "category" | "anime" | "image" | "rarity">;
  onContinue?: () => void;
  autoAdvance?: boolean;
}) {
  return (
    <LrCardReveal
      key={`${card.rarity}:${card.name}:${card.image}`}
      card={card}
      onContinue={onContinue}
      autoAdvance={autoAdvance}
    />
  );
}
