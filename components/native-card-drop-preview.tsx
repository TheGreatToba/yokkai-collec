"use client";

import { useState } from "react";
import { BoosterReveal, type RevealCard } from "@/components/boosters";

const rarities = ["SR", "SSR", "LR", "C"] as const;
export const NATIVE_DROP_DEMO_CARDS: RevealCard[] = [
  {
    id: "demo-sr",
    instanceId: "demo-sr",
    rarity: "SR",
    name: "Satoru Gojo",
    category: "ANIME/MANGA",
    anime: "Jujutsu Kaisen",
    image: "/assets/landing/gojou.webp"
  },
  {
    id: "demo-ssr",
    instanceId: "demo-ssr",
    rarity: "SSR",
    name: "Levi Ackerman",
    category: "ANIME/MANGA",
    anime: "Attack on Titan",
    image: "/assets/landing/levi.webp"
  },
  {
    id: "demo-lr",
    instanceId: "demo-lr",
    rarity: "LR",
    name: "Monkey D. Luffy",
    category: "ANIME/MANGA",
    anime: "One Piece",
    image: "/assets/landing/luffy.webp"
  }
];
export function NativeCardDropPreview() {
  const [rarity, setRarity] = useState<RevealCard["rarity"] | "pack">("pack");
  const [opened, setOpened] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [key, setKey] = useState(0);
  const card: RevealCard = {
    id: `native-${rarity}`,
    instanceId: `native-${rarity}-${key}`,
    name: "Satoru Gojo",
    category: "ANIME/MANGA",
    anime: "Jujutsu Kaisen",
    rarity: rarity === "pack" ? "SR" : rarity,
    image: "/assets/landing/gojou.webp"
  };
  const cards =
    rarity === "pack"
      ? NATIVE_DROP_DEMO_CARDS.map(card => ({
          ...card,
          instanceId: `${card.id}-${key}`
        }))
      : [card];
  function replay() {
    setRevealed(0);
    setKey(current => current + 1);
    setOpened(true);
  }
  return (
    <>
      <div className="my-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="yk-button yk-button-primary"
          aria-pressed={rarity === "pack"}
          onClick={() => {
            setRarity("pack");
            setOpened(false);
            setRevealed(0);
            setKey(current => current + 1);
          }}
        >
          Pack SR + SSR + LR
        </button>
        {rarities.map(value => (
          <button
            type="button"
            className="yk-button yk-button-secondary"
            key={value}
            aria-pressed={rarity === value}
            onClick={() => {
              setRarity(value);
              setOpened(true);
              setRevealed(0);
              setKey(current => current + 1);
            }}
          >
            {value}
          </button>
        ))}
      </div>
      {!opened ? (
        <section className="rounded-panel border border-veil bg-surface px-6 py-8 text-center">
          <div
            role="img"
            aria-label="Demo booster pack"
            className="mx-auto h-64 w-44 bg-[url('/assets/booster-pack.png')] bg-contain bg-center bg-no-repeat"
          />
          <h2 className="mt-6 font-display text-2xl">
            SR + SSR + LR demo pack
          </h2>
          <p className="my-4 text-sm text-ink-2">
            Three simulated cards. No booster or Karas spent.
          </p>
          <button
            type="button"
            className="yk-button yk-button-primary"
            onClick={replay}
          >
            Open demo pack
          </button>
        </section>
      ) : (
        <BoosterReveal
          key={key}
          cards={cards}
          revealed={revealed}
          onReveal={index =>
            setRevealed(current => (current === index ? current + 1 : current))
          }
          onNext={replay}
          nextLabel="Replay demo pack"
          onReturn={() => {
            setRevealed(0);
            setOpened(false);
            setKey(current => current + 1);
          }}
        />
      )}
    </>
  );
}
