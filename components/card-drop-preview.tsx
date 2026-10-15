"use client";

import { useState } from "react";
import { BoosterReveal, type RevealCard } from "@/components/boosters";

const cards: RevealCard[] = ["SR", "SSR", "LR", "C"].map((rarity, index) => ({
  id: `drop-preview-${index}`,
  instanceId: `drop-preview-copy-${index}`,
  name: `${rarity} · Actual drawn card`,
  category: "ANIME/MANGA",
  anime: "Yokkai Collec'",
  rarity: rarity as RevealCard["rarity"],
  image: "/assets/booster-pack.png"
}));

export function CardDropPreview() {
  const [selected, setSelected] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [key, setKey] = useState(0);
  return (
    <>
      <div className="my-8 flex flex-wrap gap-3">
        {cards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            className="yk-button yk-button-secondary"
            aria-pressed={selected === index}
            onClick={() => {
              setSelected(index);
              setRevealed(0);
              setKey(value => value + 1);
            }}
          >
            {card.rarity}
          </button>
        ))}
      </div>
      <BoosterReveal
        key={key}
        cards={[cards[selected]]}
        revealed={revealed}
        onReveal={() => setRevealed(1)}
        onReturn={() => {
          setRevealed(0);
          setKey(value => value + 1);
        }}
      />
    </>
  );
}
