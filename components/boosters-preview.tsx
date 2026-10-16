"use client";

import { useState } from "react";
import { Boosters, type RevealCard } from "@/components/boosters";
import { Button } from "@/components/ui";
import type { Rarity } from "@/lib/data/cards";

// Local-only simulation: no RPC, so the complete opening flow (including SSR/LR
// reveals) can be exercised in a browser without consuming a real pack.
const draws: Record<"regular" | "decision", [string, Rarity][]> = {
  regular: [
    ["Kappa ancien", "SSR"],
    ["Tanuki solaire", "LR"],
    ["Tengu des brumes", "SSR"],
    ["Oni écarlate", "SSR"],
    ["Kitsune céleste", "LR"]
  ],
  decision: [
    ["Kappa ancien", "SSR"],
    ["Tengu des brumes", "LR"],
    ["Yuki-Onna", "SSR"],
    ["Oni écarlate", "SSR"],
    ["Tanuki solaire", "LR"]
  ]
};
const franchises = [
  "Spirit Realm",
  "Mononoke Chronicles",
  "Hyakki Yagyō",
  "Spirit Realm",
  "Moonlit Shrine"
];

export function BoostersPreview() {
  const [draw, setDraw] = useState<RevealCard[]>([]);
  const [drawKind, setDrawKind] = useState<"regular" | "decision">("regular");
  const [revealed, setRevealed] = useState(0);
  const [session, setSession] = useState(0);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p role="note" className="text-sm text-ink-2">
          Local demo · Unlimited packs · Guaranteed SSR and LR · No rewards
          saved.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setDraw([]);
            setRevealed(0);
            setSession(current => current + 1);
          }}
        >
          Reset demo
        </Button>
      </div>
      <Boosters
        key={session}
        status={{ available: 5, maximum: 5, nextPackAt: null }}
        countdown="00:00"
        decisionStatus={{
          available: true,
          pending: [],
          nextPackAt: 0
        }}
        decisionCountdown="00:00:00"
        busy={false}
        draw={draw}
        drawKind={drawKind}
        collection={[]}
        revealed={revealed}
        onOpen={async kind => {
          setDrawKind(kind);
          setRevealed(0);
          const cards = draws[kind].map(([name, rarity], index) => ({
            id: `preview-${kind}-${index}`,
            instanceId: `preview-${kind}-${index}-${Date.now()}`,
            name,
            category: "Anime",
            anime: franchises[index],
            rarity,
            image: "/assets/booster-pack.png",
            shiny: false
          }));
          setDraw(cards);
          return cards;
        }}
        onKeepDecision={async () => 180}
        onDiscard={async () => {}}
        onReveal={index =>
          setRevealed(current => (current === index ? current + 1 : current))
        }
      />
    </>
  );
}
