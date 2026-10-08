"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin";
import { createClient } from "@/utils/supabase/server";

export type PlayerAdminActionState = { ok: boolean; message: string };

export async function removePlayerCardAction(instanceId: string): Promise<PlayerAdminActionState> {
  try {
    await requireAdminAction();
    if (!/^[0-9a-f-]{36}$/i.test(instanceId)) throw new Error("Identifiant de carte invalide.");
    const client = createClient(await cookies());
    const { error } = await client.rpc("admin_remove_player_card", { p_card_instance_id: instanceId });
    if (error) {
      if (error.message.includes("CARD_FROZEN")) throw new Error("Cette carte est actuellement aux enchères.");
      if (error.message.includes("CARD_IN_TRADE")) throw new Error("Cette carte est engagée dans un échange en cours.");
      if (error.message.includes("CARD_NOT_FOUND")) throw new Error("Cette carte n’est plus dans la collection.");
      throw error;
    }
    revalidatePath("/admin/players");
    return { ok: true, message: "Carte retirée de la collection." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Retrait impossible." };
  }
}

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
