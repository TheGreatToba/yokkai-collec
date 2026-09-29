"use client";

import { Boosters } from "@/components/boosters";

export function BoostersPreview() {
  return <Boosters
    status={{ available: 3, maximum: 5, nextPackAt: 4_102_444_800_000 }}
    countdown="42 min"
    decisionStatus={{ available: true, pending: [], nextPackAt: 4_102_444_800_000 }}
    decisionCountdown="6 j"
    busy={false}
    draw={[]}
    drawKind="regular"
    collection={[]}
    revealed={0}
    onOpen={async () => {}}
    onKeepDecision={async () => 0}
    onDiscard={async () => {}}
    onReveal={() => {}}
  />;
}
