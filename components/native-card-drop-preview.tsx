"use client";

import { useState } from "react";
import { BoosterReveal, type RevealCard } from "@/components/boosters";

const rarities = ["SR", "SSR", "LR", "C"] as const;
export function NativeCardDropPreview() {
  const [rarity, setRarity] = useState<RevealCard["rarity"]>("SSR");
  const [revealed, setRevealed] = useState(0);
  const [key, setKey] = useState(0);
  const card: RevealCard = {
    id: `native-${rarity}`,
    instanceId: `native-${rarity}-${key}`,
    name: "Satoru Gojo",
    category: "ANIME/MANGA",
    anime: "Jujutsu Kaisen",
    rarity,
    image: "/assets/landing/gojou.webp"
  };
  return (
    <>
      <div className="my-8 flex flex-wrap gap-3">
        {rarities.map(value => (
          <button
            type="button"
            className="yk-button yk-button-secondary"
            key={value}
            aria-pressed={rarity === value}
            onClick={() => {
              setRarity(value);
              setRevealed(0);
              setKey(current => current + 1);
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <BoosterReveal
        key={key}
        cards={[card]}
        revealed={revealed}
        onReveal={() => setRevealed(1)}
        onReturn={() => {
          setRevealed(0);
          setKey(current => current + 1);
        }}
      />
    </>
  );
}
