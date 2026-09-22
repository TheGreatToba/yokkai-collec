export type Rarity = "C" | "R" | "SR" | "SSR";
export type Category = "Anime/Manga" | "Sport" | "Cinéma";
export type Card = { id: string; name: string; category: Category; rarity: Rarity; image: string };
export type CollectedCard = Card & { instanceId: string; obtainedAt: string };
type Entry = { cardId: string; instanceId: string; obtainedAt: string };
type State = { version: 1; collection: Entry[]; packs: number; nextPackAt: number | null };
export type PackStatus = { available: number; maximum: number; nextPackAt: number | null };

const KEY = "yokkai-collec-v1";
const INTERVAL = 30 * 60 * 1000;
const MAX = 3;
const rarities: Rarity[] = ["C", "R", "SR", "SSR"];
const rates = [60, 25, 10, 5];
const categories: Category[] = ["Anime/Manga", "Sport", "Cinéma"];
const names = [
  ["Apprenti ninja", "Gardienne des fleurs", "Voyageur céleste", "Petit alchimiste", "Samouraï des brumes", "Épéiste lunaire", "Mage des étoiles", "Dragon écarlate", "Reine des esprits", "Empereur du soleil"],
  ["Jeune attaquant", "Sprinteuse", "Gardien de but", "Cycliste", "Basketteuse", "As du tennis", "Capitaine du stade", "Championne olympique", "Légende du ring", "Étoile du football"],
  ["Figurant", "Exploratrice", "Détective", "Pilote spatial", "Cowboy solitaire", "Agent secret", "Héroïne masquée", "Maître du suspense", "Icône du cinéma", "Légende du grand écran"],
];
const cardRarities: Rarity[] = ["C", "C", "C", "C", "C", "R", "R", "SR", "SR", "SSR"];
const palette = ["#7761ba", "#398a78", "#bc7743"];
// Self-contained placeholder images: no external image service required.
const catalog: Card[] = categories.flatMap((category, group) => names[group].map((name, index) => ({
  id: `${group + 1}-${index + 1}`, name, category, rarity: cardRarities[index],
  image: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360" viewBox="0 0 300 360"><rect width="300" height="360" fill="${palette[group]}"/><circle cx="150" cy="155" r="90" fill="none" stroke="white" stroke-opacity=".2" stroke-width="2"/><path d="M150 55 220 155 150 255 80 155Z" fill="white" fill-opacity=".15"/><text x="150" y="177" text-anchor="middle" font-family="sans-serif" font-size="64" fill="white">${String(index + 1).padStart(2, "0")}</text><text x="150" y="315" text-anchor="middle" font-family="sans-serif" font-size="12" fill="white">YOKKAI · PLACEHOLDER</text></svg>`)}`,
})));

export async function getAllCards(): Promise<Card[]> { return catalog.map(card => ({ ...card })); }
export async function getGameInfo() {
  return { user: { id: "local-player", name: "Collectionneur" }, categories: [...categories],
    rarities: [...rarities], dropRates: rarities.map((rarity, i) => ({ rarity, percent: rates[i] })) };
}

function save(state: State) {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { throw new Error("La sauvegarde locale est indisponible. Autorisez le stockage du navigateur pour jouer."); }
}
function validState(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const s = value as State;
  return s.version === 1 && Number.isInteger(s.packs) && s.packs >= 0 && s.packs <= MAX &&
    (s.packs === MAX ? s.nextPackAt === null : typeof s.nextPackAt === "number" && Number.isFinite(s.nextPackAt) && s.nextPackAt > 0) &&
    Array.isArray(s.collection) && s.collection.every(e => e && typeof e.instanceId === "string" &&
      catalog.some(c => c.id === e.cardId) && typeof e.obtainedAt === "string" && Number.isFinite(Date.parse(e.obtainedAt))) &&
    new Set(s.collection.map(e => e.instanceId)).size === s.collection.length;
}
function read(): State {
  if (typeof window === "undefined") throw new Error("Les données du joueur sont disponibles dans le navigateur.");
  let raw: string | null;
  try { raw = window.localStorage.getItem(KEY); }
  catch { throw new Error("Le stockage local est indisponible dans ce navigateur."); }
  let state: State;
  if (raw === null) {
    state = { version: 1, collection: [], packs: 1, nextPackAt: Date.now() + INTERVAL };
    save(state);
  } else {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error("La sauvegarde locale est illisible. Elle a été conservée."); }
    if (!validState(parsed)) throw new Error("La sauvegarde locale est invalide. Elle a été conservée.");
    state = parsed;
  }
  const now = Date.now();
  if (state.nextPackAt !== null && now >= state.nextPackAt) {
    const gained = Math.floor((now - state.nextPackAt) / INTERVAL) + 1;
    state.packs = Math.min(MAX, state.packs + gained);
    state.nextPackAt = state.packs === MAX ? null : state.nextPackAt + gained * INTERVAL;
    save(state);
  }
  return state;
}
function expand(entry: Entry): CollectedCard {
  return { ...catalog.find(c => c.id === entry.cardId)!, instanceId: entry.instanceId, obtainedAt: entry.obtainedAt };
}
async function withPlayerState<T>(operation: () => T): Promise<T> {
  // Reads also write when initializing or regenerating packs: all player-state
  // operations must use the same lock to avoid overwriting another tab's draw.
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(KEY, operation);
  }
  return operation();
}
export async function getUserCollection(): Promise<CollectedCard[]> {
  return withPlayerState(() => read().collection.map(expand).sort((a, b) => rarities.indexOf(b.rarity) - rarities.indexOf(a.rarity) || b.obtainedAt.localeCompare(a.obtainedAt)));
}
export async function getPackStatus(): Promise<PackStatus> {
  return withPlayerState(() => {
    const state = read();
    return { available: state.packs, maximum: MAX, nextPackAt: state.nextPackAt };
  });
}
function draw(): Card {
  const roll = Math.random() * 100;
  let cumulative = 0;
  const rarity = rarities.find((_, i) => { cumulative += rates[i]; return roll < cumulative; })!;
  const pool = catalog.filter(c => c.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
export async function openBooster(): Promise<CollectedCard[]> {
  const open = () => {
    const state = read();
    if (state.packs === 0) throw new Error("Aucun pack disponible pour le moment.");
    const obtainedAt = new Date().toISOString();
    const entries = Array.from({ length: 10 }, () => ({ cardId: draw().id, instanceId: crypto.randomUUID(), obtainedAt }));
    if (state.packs === MAX) state.nextPackAt = Date.now() + INTERVAL;
    state.packs -= 1;
    state.collection.push(...entries);
    // Save the complete draw before returning it, including cards not yet revealed.
    save(state);
    return entries.map(expand).sort((a, b) => rarities.indexOf(a.rarity) - rarities.indexOf(b.rarity));
  };
  return withPlayerState(open);
}
