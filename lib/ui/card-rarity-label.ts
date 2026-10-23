// SSR fusion results retain the legacy shiny flag in the API and database.
// Translate that flag into the player-facing variant name at display time.
export function cardRarityLabel(rarity: string, shiny = false): string {
  if (shiny && rarity === "SSR") return "SSR EVOLVED";
  if (shiny && rarity === "LR") return "LR Shiny";
  return rarity;
}
