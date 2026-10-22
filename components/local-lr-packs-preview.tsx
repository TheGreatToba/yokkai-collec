"use client";

import { useState } from "react";
import { Boosters, type RevealCard } from "@/components/boosters";
import { createLocalLrPack } from "@/lib/ui/local-lr-packs";
import { useSfx } from "@/hooks/use-sfx";

export function LocalLrPacksPreview() {
  const [draw, setDraw] = useState<RevealCard[]>([]);
  const [kind, setKind] = useState<"regular" | "decision">("regular");
  const [revealed, setRevealed] = useState(0);
  const [sequence, setSequence] = useState(0);
  const sound = useSfx();

  if (process.env.NODE_ENV !== "development") return null;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-veil bg-veil px-4 py-3 text-sm">
        <p role="status">
          Unlimited demo packs · LR guaranteed in slot 5 · No real rewards
        </p>
        <button
          type="button"
          className="yk-button yk-button-secondary"
          aria-pressed={sound.enabled}
          onClick={sound.toggle}
        >
          {sound.enabled ? "Mute sounds" : "Enable sounds"}
        </button>
      </div>
      <Boosters
        previewOnly
        releasedOpening
        clickToOpen
        status={{ available: 10, reserve: 10, maximum: 10, nextPackAt: null }}
        countdown="00:00"
        decisionStatus={{
          available: true,
          pending: [],
          remaining: 2,
          maximum: 2,
          nextPackAt: 4_102_444_800_000
        }}
        decisionCountdown="00:00"
        busy={false}
        draw={draw}
        drawKind={kind}
        collection={[]}
        revealed={revealed}
        onOpen={async nextKind => {
          const cards = createLocalLrPack(nextKind, sequence);
          setSequence(current => current + 1);
          setKind(nextKind);
          setRevealed(0);
          setDraw(cards);
          return cards;
        }}
        onKeepDecision={async () => 0}
        onDiscard={async () => {}}
        onReveal={index =>
          setRevealed(current => (current === index ? current + 1 : current))
        }
        onSound={sound.play}
      />
    </>
  );
}
