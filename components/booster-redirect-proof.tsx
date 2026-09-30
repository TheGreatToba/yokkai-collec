"use client";

import { BoosterReveal, type RevealCard } from "@/components/boosters";

declare global {
  interface Window { __boosterRedirectProof?: string[] }
}

const cards: RevealCard[] = [
  { id: "proof-card", instanceId: "proof-copy", name: "Kitsune céleste", category: "Anime", anime: "Spirit Realm", rarity: "SR", image: "/assets/booster-pack.png", isNew: true },
];

const record = (event: string) => (window.__boosterRedirectProof ??= []).push(event);

export function BoosterRedirectProof({ decision = false, disabled = false }: { decision?: boolean; disabled?: boolean }) {
  return <BoosterReveal
    cards={cards}
    revealed={cards.length}
    onReveal={() => {}}
    onReturn={() => record("return")}
    onNext={decision ? undefined : () => record("next")}
    decision={decision ? { keptId: cards[0].instanceId, karasReward: 20, onKeep: async () => 20 } : undefined}
    navigateToCollection={disabled ? () => {} : () => record("collection")}
  />;
}
