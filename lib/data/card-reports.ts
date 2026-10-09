"use client";

import { createClient } from "@/utils/supabase/client";

export type CardReportReason = "image_issue" | "wrong_license" | "duplicate_card";

const messages: Record<string, string> = {
  REPORT_DUPLICATE: "Tu as déjà signalé ce problème pour cette carte.",
  REPORT_LIMIT: "Tu as atteint la limite de signalements pour aujourd’hui.",
  REPORT_INVALID: "Ce signalement n’est pas valide.",
  AUTH_REQUIRED: "Connecte-toi pour signaler cette carte.",
};

export async function reportCard(cardId: string, reason: CardReportReason) {
  const { error } = await createClient().rpc("report_card", { p_card_id: cardId, p_reason: reason });
  if (!error) return;
  const known = Object.entries(messages).find(([code]) => error.message.includes(code));
  throw new Error(known?.[1] ?? "Le signalement n’a pas pu être envoyé.");
}
