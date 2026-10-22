"use client";

import { useState } from "react";
import { LocalCardCinematic } from "@/components/local-card-cinematic";
import { createLocalLrPack } from "@/lib/ui/local-lr-packs";

export function CardCinematicsPreview() {
  const [rarity, setRarity] = useState<"SSR" | "LR">("LR");
  const cards = createLocalLrPack("regular", 0);
  const card = cards.find(card => card.rarity === rarity)!;
  return (
    <>
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Cinematic rarity"
      >
        {(["SSR", "LR"] as const).map(value => (
          <button
            key={value}
            type="button"
            className={`yk-button ${rarity === value ? "yk-button-primary" : "yk-button-secondary"}`}
            aria-pressed={rarity === value}
            onClick={() => setRarity(value)}
          >
            {value} cinematic
          </button>
        ))}
      </div>
      <div className="yk-card-cinematic-demo">
        <LocalCardCinematic key={rarity} card={card} />
      </div>
    </>
  );
}
