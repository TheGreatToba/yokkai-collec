"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin";
import { createClient } from "@/utils/supabase/server";

export type ReportActionState = { ok: boolean; message: string };

export async function setReportStatusAction(
  _previous: ReportActionState,
  form: FormData
): Promise<ReportActionState> {
  try {
    await requireAdminAction();
    const reportId = String(form.get("report_id") ?? "");
    const status = String(form.get("status") ?? "");
    if (
      !/^[0-9a-f-]{36}$/i.test(reportId) ||
      !["pending", "reviewed", "dismissed"].includes(status)
    ) {
      throw new Error("Invalid moderation action.");
    }
    const client = createClient(await cookies());
    const { error } = await client.rpc("admin_set_report_status", {
      p_report_id: reportId,
      p_status: status
    });
    if (error) throw error;
    revalidatePath("/admin/reports");
    return {
      ok: true,
      message:
        status === "reviewed"
          ? "Report marked as reviewed."
          : status === "dismissed"
            ? "Report dismissed."
            : "Report moved back to pending."
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to complete this action."
    };
  }
}

export async function setCardReportStatusAction(
  _previous: ReportActionState,
  form: FormData
): Promise<ReportActionState> {
  try {
    await requireAdminAction();
    const reportId = String(form.get("report_id") ?? "");
    const status = String(form.get("status") ?? "");
    if (
      !/^[0-9a-f-]{36}$/i.test(reportId) ||
      !["pending", "reviewed", "dismissed"].includes(status)
    )
      throw new Error("Invalid moderation action.");
    const client = createClient(await cookies());
    const { error } = await client.rpc("admin_set_card_report_status", {
      p_report_id: reportId,
      p_status: status
    });
    if (error) throw error;
    revalidatePath("/admin/reports");
    return {
      ok: true,
      message:
        status === "reviewed"
          ? "Report marked as reviewed."
          : status === "dismissed"
            ? "Report dismissed."
            : "Report moved back to pending."
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to complete this action."
    };
  }
}
