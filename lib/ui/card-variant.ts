import type { Rarity } from "@/lib/data/cards";

/** SSR+ reuses the evolved SSR finish; it is not a new catalogue rarity. */
export function cardVariantLabel(rarity: Rarity, shiny = false): string {
  if (rarity === "SSR" && shiny) return "SSR+";
  return `${rarity}${rarity === "LR" && shiny ? " ✦ Shiny" : ""}`;
}
