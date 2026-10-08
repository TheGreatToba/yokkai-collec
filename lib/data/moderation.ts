import { createClient } from "@/utils/supabase/client";
import { invalidatePlayerSnapshots } from "@/lib/data/cards";

export type BlockedUser = { id: string; pseudo: string; avatarUrl?: string | null; createdAt?: string };
export type ReportReason = "harassment" | "inappropriate" | "spam" | "cheating" | "other";
export type ReportInput = { userId: string; reason: ReportReason; contextType: "profile" | "auction_chat"; contextId?: string; details: string; blockAlso: boolean };
export type ModerationAdapter = {
  list: () => Promise<BlockedUser[]>;
  block: (id: string) => Promise<unknown>;
  unblock: (id: string) => Promise<unknown>;
  report: (input: ReportInput) => Promise<unknown>;
};
const db = createClient;
const errors: Record<string, string> = {
  REPORT_DUPLICATE: "Tu as déjà signalé ce joueur dans ce contexte.",
  REPORT_LIMIT: "Tu as atteint la limite de 10 signalements pour aujourd’hui.",
  REPORT_INVALID: "Impossible de transmettre ce signalement.",
};
async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await db().rpc(name, args);
    if (error) throw new Error(errors[error.message] ?? "Impossible d’effectuer cette action.");
    return data as T;
  } catch (error) {
    if (error instanceof Error && Object.values(errors).includes(error.message)) throw error;
    throw new Error("Impossible d’effectuer cette action.");
  }
}
function changed(id: string, blocked: boolean) {
  invalidatePlayerSnapshots(["profile"]);
  window.dispatchEvent(new CustomEvent("player-block-changed", { detail: { id, blocked } }));
}
export const listBlockedUsers = () => call<BlockedUser[]>("list_blocked_users");
export async function blockUser(id: string) { await call("block_user", { p_user_id: id }); changed(id, true); }
export async function unblockUser(id: string) { await call("unblock_user", { p_user_id: id }); changed(id, false); }
export async function reportUser(input: ReportInput) {
  await call("report_user", { p_user_id: input.userId, p_reason: input.reason, p_context_type: input.contextType, p_context_id: input.contextId ?? null, p_details: input.details, p_block_also: input.blockAlso });
  if (input.blockAlso) changed(input.userId, true);
}
export const liveModeration: ModerationAdapter = { list: listBlockedUsers, block: blockUser, unblock: unblockUser, report: reportUser };
