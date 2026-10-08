"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin";
import { createClient } from "@/utils/supabase/server";

export type PlayerAdminActionState = { ok: boolean; message: string };

export async function setPlayerBanAction(
  _previous: PlayerAdminActionState,
  form: FormData,
): Promise<PlayerAdminActionState> {
  try {
    await requireAdminAction();
    const userId = String(form.get("user_id") ?? "");
    const banned = String(form.get("banned") ?? "") === "true";
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Identifiant joueur invalide.");
    const client = createClient(await cookies());
    const { error } = await client.rpc("admin_set_user_ban", {
      p_user_id: userId,
      p_banned: banned,
    });
    if (error) {
      if (error.message.includes("CANNOT_BAN_SELF")) throw new Error("Tu ne peux pas bannir ton propre compte.");
      if (error.message.includes("CANNOT_BAN_ADMIN")) throw new Error("Un compte administrateur ne peut pas être banni ici.");
      throw error;
    }
    revalidatePath("/admin/players");
    return { ok: true, message: banned ? "Le joueur a été banni et ses sessions ont été fermées." : "Le joueur a été débanni." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Action impossible." };
  }
}
