"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseConfig } from "@/utils/supabase/config";
import { hasRecentAuthentication } from "@/lib/auth/recent-auth";
import { deleteAccount } from "@/lib/server/account-deletion";

type DeletionState = { error?: string; reconnect?: boolean };

export async function reconnectForDeletion(
  _state: DeletionState,
  _form: FormData
): Promise<DeletionState> {
  try {
    const client = createClient(await cookies());
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return { error: "La déconnexion a échoué. Réessaie." };
  } catch {
    return { error: "La déconnexion a échoué. Réessaie." };
  }
  redirect("/connexion");
}

export async function deleteAccountAction(
  _state: DeletionState,
  form: FormData
): Promise<DeletionState> {
  const reconnect = {
    error:
      "Reconnecte-toi puis reviens dans les paramètres : une connexion de moins de cinq minutes est nécessaire.",
    reconnect: true
  };
  const cookieStore = await cookies();
  const client = createClient(cookieStore);
  let userId: string;
  try {
    // getClaims validates the signature (or asks Auth for legacy HS256 JWTs).
    // getUser additionally rejects a session whose identity has been removed.
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims || !hasRecentAuthentication(data.claims))
      return reconnect;
    const verified = await client.auth.getUser();
    if (
      verified.error ||
      !verified.data.user ||
      data.claims.sub !== verified.data.user.id ||
      data.claims.role !== "authenticated" ||
      data.claims.is_anonymous === true
    )
      return reconnect;
    userId = verified.data.user.id;
  } catch {
    return reconnect;
  }
  const pseudo = form.get("pseudo");
  if (typeof pseudo !== "string" || !pseudo || [...pseudo].length > 30)
    return { error: "Retape exactement ton pseudo pour confirmer." };
  try {
    const profile = await client.rpc("get_game_info");
    if (profile.error || typeof profile.data?.user?.name !== "string")
      return {
        error: "Impossible de vérifier ton pseudo. Réessaie plus tard."
      };
    if (pseudo !== profile.data.user.name)
      return {
        error: "Le pseudo ne correspond pas. Retape exactement ton pseudo."
      };
    await deleteAccount(userId);
  } catch {
    // A partial deletion remains fenced. Never retry destructive calls silently.
    return {
      error:
        "La suppression n’a pas pu être terminée. Ne répète pas la demande ; contacte l’équipe pour vérifier son état." +
        (process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim()
          ? ` Contact : ${process.env.NEXT_PUBLIC_CONTACT_EMAIL.trim()}.`
          : "")
    };
  }
  // Auth Admin already revoked all sessions. Still clear local session cookies.
  // An Auth 401/404 is expected after deletion and tolerated by supabase-js.
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // The identity is gone; never send the player back to the destructive form.
  }
  const project = new URL(getSupabaseConfig().url).hostname.split(".")[0];
  const tokenCookie = `sb-${project}-auth-token`;
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name === tokenCookie ||
      cookie.name.startsWith(`${tokenCookie}.`) ||
      cookie.name === `${tokenCookie}-code-verifier`
    )
      cookieStore.delete(cookie.name);
  }
  revalidatePath("/", "layout");
  redirect("/compte-supprime");
}
