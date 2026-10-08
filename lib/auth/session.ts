import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export async function getCurrentPseudo(userId: string) {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.from("user_profiles")
    .select("pseudo").eq("user_id", userId).maybeSingle();
  return !error && typeof data?.pseudo === "string" ? data.pseudo : null;
}

export async function getCurrentKarasBalance(
  existingClient?: ReturnType<typeof createClient>,
) {
  const supabase = existingClient ?? createClient(await cookies());
  const { data, error } = await supabase.rpc("get_game_info");
  if (error || !data || typeof data !== "object") return undefined;
  const balance = (data as { karasBalance?: unknown }).karasBalance;
  return typeof balance === "number" ? balance : undefined;
}
