import { createClient } from "@/utils/supabase/client";
import { invalidatePlayerSnapshots } from "@/lib/data/cards";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  conditionType: string;
  conditionValue: number;
  conditionCategory: string | null;
  karasReward: number;
  progressCurrent: number;
  progressTarget: number;
  progressLabel: string | null;
  completedAt: string | null;
  claimedAt: string | null;
};

export type ClaimResult = { balance: number; claimedAt: string; reward: number };

function failure(error: { message?: string; code?: string }) {
  const messages: Record<string, string> = {
    AUTH_REQUIRED: "Connectez-vous pour consulter vos succès.",
    PROFILE_MISSING: "Votre profil est introuvable.",
    ACHIEVEMENT_LOCKED: "Ce succès n’est pas encore complété.",
    ACHIEVEMENT_ALREADY_CLAIMED: "Cette récompense a déjà été réclamée.",
  };
  if (error.message && messages[error.message]) return new Error(messages[error.message]);
  if (error.code === "PGRST301") return new Error(messages.AUTH_REQUIRED);
  return new Error("Impossible de joindre les données des succès. Réessayez dans un instant.");
}

export async function getAchievements(): Promise<Achievement[]> {
  const { data, error } = await createClient().rpc("get_achievements");
  if (error) throw failure(error);
  return (data as Achievement[]).map(item => ({ ...item }));
}

export async function claimAchievement(id: string): Promise<ClaimResult> {
  const { data, error } = await createClient().rpc("claim_achievement", { p_achievement_id: id });
  if (error) throw failure(error);
  const result = data as ClaimResult;
  invalidatePlayerSnapshots(["balance"]);
  return result;
}
