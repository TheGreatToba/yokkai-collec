"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Boosters, type RevealCard } from "@/components/boosters";
import { NATIVE_DROP_DEMO_CARDS } from "@/components/native-card-drop-preview";
import { useSfx } from "@/hooks/use-sfx";

export function LocalBoosterComparison() {
  const [variant, setVariant] = useState<"before" | "after">("after");
  const [draw, setDraw] = useState<RevealCard[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [key, setKey] = useState(0);
  const sound = useSfx();

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-drop-animation");
    root.setAttribute("data-drop-animation", variant);
    return () => {
      if (previous === null) root.removeAttribute("data-drop-animation");
      else root.setAttribute("data-drop-animation", previous);
    };
  }, [variant]);

  function choose(value: "before" | "after") {
    setVariant(value);
    setDraw([]);
    setRevealed(0);
    setKey(current => current + 1);
  }

  return (
    <>
      <header className="border-b border-line px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/boosters" aria-label="Booster comparison">
          <Image
            src="/assets/header-logo-gold.png"
            alt="Yokkai Collec’"
            width={120}
            height={48}
          />
        </Link>
        <span className="text-sm text-accent-gold">Local animation demo</span>
        <Link href="/boosters?live=1" className="text-sm text-ink-2">
          Back to live boosters
        </Link>
      </header>
      <main
        id="main-content"
        className="yk-game-main mx-auto w-full max-w-6xl px-6 py-10"
      >
        <div className="yk-pack-page-heading">
          <p className="eyebrow">Local simulation · real account unchanged</p>
          <h1 className="yk-title mt-3">Compare SSR / LR drops</h1>
          <p className="my-4 text-sm text-ink-2">
            Every demo booster contains the same SSR Levi and LR Luffy. Choose
            Before or After, then open the Regular Pack. No real booster, card
            or Karas is consumed or created.
          </p>
          <div
            className="mb-6 flex flex-wrap items-center gap-3"
            aria-label="Animation version"
          >
            <button
              type="button"
              className={`yk-button ${variant === "before" ? "yk-button-primary" : "yk-button-secondary"}`}
              aria-pressed={variant === "before"}
              onClick={() => choose("before")}
            >
              Before · production effects
            </button>
            <button
              type="button"
              className={`yk-button ${variant === "after" ? "yk-button-primary" : "yk-button-secondary"}`}
              aria-pressed={variant === "after"}
              onClick={() => choose("after")}
            >
              After · new effects
            </button>
            <Link className="text-sm text-accent-gold" href="/boosters?live=1">
              Back to live boosters
            </Link>
          </div>
        </div>
        <p className="mb-4 text-sm text-accent-gold" role="status">
          Demo · {variant === "before" ? "Before" : "After"} · Guaranteed SSR +
          LR
        </p>
        <Boosters
          key={key}
          status={{ available: 5, maximum: 5, nextPackAt: 4_102_444_800_000 }}
          countdown="00:00"
          decisionStatus={{
            available: false,
            pending: [],
            nextPackAt: 4_102_444_800_000
          }}
          decisionCountdown="Demo disabled"
          busy={false}
          draw={draw}
          drawKind="regular"
          collection={[]}
          revealed={revealed}
          onOpen={async () => {
            const cards = NATIVE_DROP_DEMO_CARDS.filter(
              card => card.rarity === "SSR" || card.rarity === "LR"
            ).map(card => ({
              ...card,
              instanceId: `comparison-${variant}-${card.id}-${Date.now()}`
            }));
            setDraw(cards);
            setRevealed(0);
            return cards;
          }}
          onKeepDecision={async () => 0}
          onDiscard={async () => {}}
          onReveal={index =>
            setRevealed(current => (current === index ? current + 1 : current))
          }
          onSound={sound.play}
        />
      </main>
    </>
  );
}
