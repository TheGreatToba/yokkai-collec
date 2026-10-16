import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseConfig } from "@/utils/supabase/config";
import type { Card, Rarity } from "@/lib/data/cards";

// Read catalog metadata only, and never connect this demo to a remote database.
export async function getLocalBoosterCatalogue(): Promise<Card[]> {
  if (process.env.NODE_ENV !== "development") return [];
  const { url } = getSupabaseConfig();
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) return [];
  const client = createClient(await cookies());
  const groups = await Promise.all((["SSR", "LR"] as const).map(async rarity => {
    const { data, error } = await client.from("cards")
      .select("id,nom,categorie,franchise,rarete_base,image_url")
      .eq("rarete_base", rarity)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("favoris_count", { ascending: false })
      .limit(250);
    if (error) throw new Error("The local card catalog could not be loaded.");
    return (data ?? []).map(row => ({
      id: row.id as string,
      name: row.nom as string,
      category: row.categorie as string,
      anime: (row.franchise as string | null) || undefined,
      rarity: row.rarete_base as Rarity,
      image: row.image_url as string
    }));
  }));
  return groups.flat();
}
