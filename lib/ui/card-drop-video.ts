import type { Rarity } from "@/lib/data/cards";

export const CARD_DROP_VIDEOS = {
  SR: "/assets/drops/sr-v1.mp4",
  SSR: "/assets/drops/ssr-v1.mp4",
  LR: "/assets/drops/lr-v1.mp4"
} as const;

export function cardDropVideo(rarity: Rarity): string | null {
  return rarity === "SR" || rarity === "SSR" || rarity === "LR"
    ? CARD_DROP_VIDEOS[rarity]
    : null;
}

export const CARD_DROP_FACE_AT = { SR: 3.2, SSR: 3.2, LR: 5.8 } as const;
export const CARD_DROP_STALL_MS = 6000;
export const CARD_DROP_MAX_MS = 18000;
