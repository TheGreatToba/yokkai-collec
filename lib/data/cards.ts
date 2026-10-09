import { createClient } from "@/utils/supabase/client";
import { cardSearchTerms } from "@/lib/ui/card-search";
import { createPlayerSnapshotCache, PLAYER_SNAPSHOT_TTL, publishPlayerSnapshotInvalidation, subscribePlayerSnapshotInvalidation, type PlayerSnapshotScope } from "@/lib/data/player-state";

export type Rarity = "C" | "R" | "SR" | "SSR" | "LR";
export type Category = string;
export type Card = { id: string; name: string; category: Category; anime?: string; rarity: Rarity; image: string; wishlisted?: boolean };
export type CataloguePage = { cards: Card[]; total: number };
export type CollectedCard = Card & { instanceId: string; obtainedAt: string; shiny: boolean; isEvolved: boolean; isFirstOwner: boolean; locked?: boolean; folderId: string | null; catalogueImage: string; customImageUrl: string | null; destructionValue?: number };
export type Folder = { id: string; name: string };
export type ActiveAuctionCard = { instanceId: string; auctionId: string; endsAt: string };
export type PackStatus = { available: number; maximum: number; nextPackAt: number | null };
export type DecisionPackStatus = { available: boolean; nextPackAt: number; pending: (CollectedCard & { discarded?: boolean })[] };
export type DecisionPackChoice = CollectedCard & { karasReward: number };
type GameInfo = {
  user: { id: string; name: string }; categories: Category[]; rarities: Rarity[];
  dropRates: { rarity: Rarity; percent: number }[]; shinyRate: number; karasBalance: number;
};
type CardRow = { id: string; nom: string; categorie: string; franchise?: string | null; rarete_base: Rarity; image_url: string };
type OwnedRow = { id: string; date_obtention: string; is_shiny: boolean; is_evolved: boolean; is_first_owner: boolean; is_locked: boolean; folder_id: string | null; custom_image_url: string | null; cards: CardRow };
const cardFields = "id,nom,categorie,franchise,rarete_base,image_url";
const rank: Record<Rarity, number> = { C: 0, R: 1, SR: 2, SSR: 3, LR: 4 };
const PAGE_SIZE = 500;
const FRANCHISE_BATCH = 200;

function failure(error: { message?: string; code?: string }) {
  const messages: Record<string, string> = {
    AUTH_REQUIRED: "Connectez-vous pour retrouver votre collection et vos packs.",
    PROFILE_MISSING: "Votre profil est introuvable. Impossible de charger la partie.",
    PACK_NOT_READY: "Aucun pack disponible pour le moment.",
    CATALOGUE_INCOMPLETE: "Le catalogue n’est pas encore prêt. Réessayez plus tard.",
    SSR_CARD_NOT_OWNED: "Cet exemplaire SSR n’est plus dans votre collection.",
    NOT_ENOUGH_SSR_COPIES: "Il faut trois exemplaires SSR identiques pour effectuer cette évolution.",
    DECISION_PACK_NOT_READY: "Le Decision Pack quotidien n’est pas encore disponible.",
    DECISION_CHOICE_UNAVAILABLE: "Cette carte du Decision Pack n’est plus disponible.",
    DECISION_LAST_CHOICE: "La dernière carte doit être conservée.",
    CARD_NOT_OWNED: "Cette carte n’est plus dans votre collection.",
    CARD_FROZEN: "Cette carte est placée aux enchères, elle ne peut pas être détruite.",
    CARD_LOCKED: "Cette carte est verrouillée. Déverrouillez-la avant cette action.",
    FOLDER_NAME_TAKEN: "Un dossier porte déjà ce nom.",
    FOLDER_NOT_FOUND: "Ce dossier n’existe plus.",
  };
  if (error.message === "INVALID_IMGUR_URL") return new Error("Saisissez un lien Imgur valide commençant par https://i.imgur.com/ ou https://imgur.com/.");
  if (error.message && messages[error.message]) return new Error(messages[error.message]);
  if (error.code === "PGRST301") return new Error(messages.AUTH_REQUIRED);
  if (error.code === "42501") return new Error("Vos données sont temporairement inaccessibles. Actualisez la page ou reconnectez-vous.");
  return new Error("Impossible de joindre les données du jeu. Réessayez dans un instant.");
}

function cardFromRow(row: CardRow): Card {
  return { id: row.id, name: row.nom, category: row.categorie, anime: row.franchise || undefined, rarity: row.rarete_base, image: row.image_url };
}

export async function withLiveCardFranchises<T extends Card>(cards: T[]): Promise<T[]> {
  if (!cards.length) return cards;
  const ids = [...new Set(cards.map(card => card.id))];
  // Batched: the gateway rejects GET URLs above ~25 KB (≈700 uuids) with a bare 400.
  const batches = Array.from({ length: Math.ceil(ids.length / FRANCHISE_BATCH) }, (_, i) => ids.slice(i * FRANCHISE_BATCH, (i + 1) * FRANCHISE_BATCH));
  const results = await Promise.all(batches.map(batch => db().from("cards").select("id,franchise").in("id", batch)));
  const failed = results.find(result => result.error);
  if (failed?.error) throw failure(failed.error);
  const rows = results.flatMap(result => result.data as {id:string;franchise:string|null}[]);
  const franchises = new Map(rows.map(row => [row.id, row.franchise?.trim() || undefined]));
  return cards.map(card => ({ ...card, anime: franchises.get(card.id) }));
}

async function withPackDestructionValues<T extends Card & {instanceId:string}>(cards:T[]):Promise<(T & {destructionValue:number})[]> {
  if(!cards.length)return [];
  const {data,error}=await db().rpc("get_pack_destruction_values",{p_instance_ids:cards.map(card=>card.instanceId)});
  if(error)throw failure(error);
  const values=data as Record<string,number>;
  return cards.map(card=>{
    const destructionValue=values[card.instanceId];
    if(!Number.isInteger(destructionValue))throw failure({message:"DESTRUCTION_VALUE_MISSING"});
    return {...card,destructionValue};
  });
}

// Memory-only caches avoid reloading the collection at every one-second UI tick.
const cache = createPlayerSnapshotCache();
let client: ReturnType<typeof createClient> | undefined;
function db() {
  if (!client) {
    client = createClient();
    let userId: string | undefined;
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        userId = session?.user.id;
        cache.clear();
      }
    });
  }
  return client;
}

// Local session read: getClaims calls /auth/v1/user on every poll when Auth signs
// with a symmetric secret (self-hosted). RLS still enforces ownership server-side.
async function playerId() {
  const { data, error } = await db().auth.getSession();
  const id = data?.session?.user.id;
  if (error || !id) throw failure({ message: "AUTH_REQUIRED" });
  return id;
}

async function assertPlayer(id: string) {
  if (await playerId() !== id) throw failure({ message: "AUTH_REQUIRED" });
}

function clearPlayerSnapshotCaches(scopes: readonly PlayerSnapshotScope[]) {
  for (const scope of scopes) cache.deleteScope(scope);
}

export function invalidatePlayerSnapshots(scopes: readonly PlayerSnapshotScope[]) {
  clearPlayerSnapshotCaches(scopes);
  publishPlayerSnapshotInvalidation(scopes);
}

subscribePlayerSnapshotInvalidation(clearPlayerSnapshotCaches);

export async function getAllCards(): Promise<Card[]> {
  const cards: Card[] = [];
  let cursor: string | undefined;
  while (true) {
    let query = db().from("cards").select(cardFields).order("id").limit(PAGE_SIZE);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw failure(error);
    if (!data?.length) break;
    const rows = data as CardRow[];
    cards.push(...rows.map(cardFromRow));
    cursor = rows[rows.length - 1].id;
  }
  return cards;
}

export async function searchCards(query: string, limit = 30): Promise<Card[]> {
  const id = await playerId();
  const { data, error } = await db().rpc("search_cards", { p_query: query.trim(), p_limit: limit });
  if (error) throw failure(error);
  await assertPlayer(id);
  return (data as Card[]).map(card => ({ ...card }));
}

export async function getCataloguePage({ query = "", category = "", rarity = "", page = 1, pageSize = 24 }: {
  query?: string; category?: string; rarity?: Rarity | ""; page?: number; pageSize?: number;
} = {}): Promise<CataloguePage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(60, Math.max(1, Math.trunc(pageSize)));
  const from = (safePage - 1) * safePageSize;
  let request = db().from("cards").select(cardFields, { count: "exact" });
  for (const term of cardSearchTerms(query)) request = request.or(`nom.ilike.%${term}%,franchise.ilike.%${term}%`);
  if (category) request = request.eq("categorie", category);
  if (rarity) request = request.eq("rarete_base", rarity);
  const { data, error, count } = await request.order("nom").order("id").range(from, from + safePageSize - 1);
  if (error) throw failure(error);
  return { cards: ((data ?? []) as CardRow[]).map(cardFromRow), total: count ?? 0 };
}

export async function getGameInfo(): Promise<GameInfo> {
  const id = await playerId();
  const info = await cache.memo<GameInfo>(`info:${id}`, PLAYER_SNAPSHOT_TTL.balance, async () => {
    const { data, error } = await db().rpc("get_game_info");
    if (error) throw failure(error);
    return data as GameInfo;
  });
  await assertPlayer(id);
  return { ...info, user: { ...info.user }, categories: [...info.categories],
    rarities: [...info.rarities], dropRates: info.dropRates.map((rate) => ({ ...rate })) };
}

export async function getUserCollection(): Promise<CollectedCard[]> {
  const id = await playerId();
  const collection = await cache.memo<CollectedCard[]>(`collection:${id}`, PLAYER_SNAPSHOT_TTL.collection, async () => {
    const cards: CollectedCard[] = [];
    let cursor: string | undefined;
    while (true) {
      let query = db().from("user_cards").select(`id,date_obtention,is_shiny,is_evolved,is_first_owner,is_locked,folder_id,custom_image_url,cards!inner(${cardFields})`)
        .eq("user_id", id).order("id").limit(PAGE_SIZE);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw failure(error);
      if (!data?.length) break;
      const rows = data as unknown as OwnedRow[];
      cards.push(...rows.map((row) => ({ ...cardFromRow(row.cards), image: row.custom_image_url || row.cards.image_url,
        catalogueImage: row.cards.image_url, customImageUrl: row.custom_image_url, instanceId: row.id,
        obtainedAt: row.date_obtention, shiny: row.is_shiny, isEvolved: row.is_evolved,
        isFirstOwner: row.is_first_owner, locked: row.is_locked, folderId: row.folder_id })));
      cursor = rows[rows.length - 1].id;
    }
    return cards.sort((a, b) => rank[b.rarity] - rank[a.rarity] ||
      Date.parse(b.obtainedAt) - Date.parse(a.obtainedAt) || a.instanceId.localeCompare(b.instanceId));
  });
  await assertPlayer(id);
  return collection.map((card) => ({ ...card }));
}

export async function getActiveAuctionCards(): Promise<ActiveAuctionCard[]> {
  const id = await playerId();
  const { data, error } = await db().rpc("get_my_active_auction_cards");
  if (error) throw failure(error);
  await assertPlayer(id);
  return (data as ActiveAuctionCard[]).map(auction => ({ ...auction }));
}

export async function getPackStatus(): Promise<PackStatus> {
  const id = await playerId();
  const { data, error } = await db().rpc("get_regular_pack_status");
  if (error) throw failure(error);
  await assertPlayer(id);
  const status = data as PackStatus & { serverNow: number };
  // Display clock only: availability and consumption always use database time.
  return { available: status.available, maximum: status.maximum,
    nextPackAt: status.nextPackAt === null ? null : Date.now() + status.nextPackAt - status.serverNow };
}

export async function getDecisionPackStatus(): Promise<DecisionPackStatus> {
  const id = await playerId();
  const { data, error } = await db().rpc("get_decision_pack_status");
  if (error) throw failure(error);
  await assertPlayer(id);
  const status = data as DecisionPackStatus & { serverNow: number };
  return { available: status.available,
    nextPackAt: Date.now() + status.nextPackAt - status.serverNow,
    pending: await withPackDestructionValues(await withLiveCardFranchises(status.pending)) };
}

export async function openBooster(): Promise<CollectedCard[]> {
  const id = await playerId();
  try {
    // One transaction; no direct writes or automatic retry on timeout.
    const { data, error } = await db().rpc("open_regular_pack");
    if (error) throw failure(error);
    await assertPlayer(id);
    const cards = data as CollectedCard[];
    const [franchised, valued] = await Promise.all([withLiveCardFranchises(cards), withPackDestructionValues(cards)]);
    return valued.map((card, index) => ({ ...card, anime: franchised[index].anime })).sort((a, b) => rank[a.rarity] - rank[b.rarity]);
  } finally {
    // The server may have committed even if the response was lost.
    cache.delete(`collection:${id}`);
  }
}

export async function evolveSsrCard(instanceIds: string[]): Promise<CollectedCard> {
  const id = await playerId();
  try {
    const { data, error } = await db().rpc("evolve_ssr_card", { p_card_instance_ids: instanceIds });
    if (error) throw failure(error);
    await assertPlayer(id);
    return (await withLiveCardFranchises([data as CollectedCard]))[0];
  } finally {
    cache.delete(`collection:${id}`);
  }
}

export async function openDecisionPack(): Promise<DecisionPackStatus["pending"]> {
  const id = await playerId();
  const { data, error } = await db().rpc("open_decision_pack");
  if (error) throw failure(error);
  await assertPlayer(id);
  const cards = data as DecisionPackStatus["pending"];
  const [franchised, valued] = await Promise.all([withLiveCardFranchises(cards), withPackDestructionValues(cards)]);
  return valued.map((card, index) => ({ ...card, anime: franchised[index].anime }));
}

export async function keepDecisionPackCard(choiceId: string): Promise<DecisionPackChoice> {
  const id = await playerId();
  try {
    const { data, error } = await db().rpc("keep_decision_pack_card", { p_choice_id: choiceId });
    if (error) throw failure(error);
    await assertPlayer(id);
    return (await withLiveCardFranchises([data as DecisionPackChoice]))[0];
  } finally {
    // The automatically discarded Decision cards credit Karas too.
    cache.delete(`collection:${id}`);
    cache.delete(`info:${id}`);
  }
}

export async function discardPackCard(instanceId: string, kind: "regular" | "decision"): Promise<number | null> {
  const id = await playerId();
  try {
    const rpc = kind === "regular" ? "discard_collection_card" : "discard_decision_pack_card";
    const args = kind === "regular" ? { p_card_instance_id: instanceId } : { p_choice_id: instanceId };
    const { data, error } = await db().rpc(rpc, args);
    if (error) throw failure(error);
    await assertPlayer(id);
    return kind === "regular" ? data as number : null;
  } finally {
    // Destruction and its Karas credit are committed together server-side.
    // Refresh both snapshots even if the RPC response itself was lost.
    cache.delete(`collection:${id}`);
    cache.delete(`info:${id}`);
  }
}

export async function getFolders(): Promise<Folder[]> {
  const id = await playerId();
  const { data, error } = await db().from("folders").select("id,nom").eq("user_id", id).order("nom");
  if (error) throw failure(error);
  await assertPlayer(id);
  return (data as { id: string; nom: string }[]).map(folder => ({ id: folder.id, name: folder.nom }));
}

export async function createFolder(name: string): Promise<Folder> {
  const id = await playerId();
  const { data, error } = await db().rpc("create_folder", { p_name: name });
  if (error) throw failure(error);
  await assertPlayer(id);
  return data as Folder;
}

export async function deleteFolder(folderId: string): Promise<void> {
  const id = await playerId();
  const { error } = await db().rpc("delete_folder", { p_folder_id: folderId });
  if (error) throw failure(error);
  await assertPlayer(id); cache.delete(`collection:${id}`);
}

export async function moveCardToFolder(instanceId: string, folderId: string | null): Promise<void> {
  const id = await playerId();
  const { error } = await db().rpc("move_card_to_folder", { p_card_instance_id: instanceId, p_folder_id: folderId });
  if (error) throw failure(error);
  await assertPlayer(id); cache.delete(`collection:${id}`);
}

export async function setCollectionCardLocked(instanceId: string, locked: boolean): Promise<void> {
  const { error } = await db().rpc("set_collection_card_locked", { p_card_instance_id: instanceId, p_locked: locked });
  if (error) throw failure(error);
  invalidatePlayerSnapshots(["collection"]);
}

export async function setCardCustomImage(instanceId: string, imageUrl: string | null): Promise<CollectedCard> {
  const id = await playerId();
  try {
    const { data, error } = await db().rpc("set_card_custom_image", { p_card_instance_id: instanceId, p_image_url: imageUrl });
    if (error) throw failure(error);
    await assertPlayer(id);
    return (await withLiveCardFranchises([data as CollectedCard]))[0];
  } finally { cache.delete(`collection:${id}`); }
}
