import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/utils/supabase/config";
import type { Rarity } from "@/lib/data/cards";

export type SharedCard = {
  cardName: string;
  franchise: string;
  rarity: Rarity;
  shiny: boolean;
  catalogueImageUrl: string;
  pseudo?: string;
};

const rarities = new Set<Rarity>(["C", "R", "SR", "SSR", "LR"]);
let client: ReturnType<typeof createClient> | undefined;

export const isShareId = (value: string) => /^[0-9a-f]{32}$/.test(value);

function db() {
  if (!client) {
    const { url, key } = getSupabaseConfig();
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export async function getSharedCard(id: string): Promise<SharedCard | null> {
  if (!isShareId(id)) return null;
  const database = db() as unknown as {
    rpc: (
      name: string,
      args: Record<string, string>,
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await database.rpc("get_shared_card", {
    p_share_id: id,
  });
  if (error || !data || typeof data!=="object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (typeof value.cardName!=="string" || typeof value.franchise!=="string" ||
      typeof value.rarity!=="string" || !rarities.has(value.rarity as Rarity) ||
      typeof value.shiny!=="boolean" || typeof value.catalogueImageUrl!=="string") return null;
  return {
    cardName: value.cardName,
    franchise: value.franchise,
    rarity: value.rarity as Rarity,
    shiny: value.shiny,
    catalogueImageUrl: value.catalogueImageUrl,
    ...(typeof value.pseudo === "string" ? { pseudo: value.pseudo } : {}),
  };
}
