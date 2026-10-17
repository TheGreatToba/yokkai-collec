import { configuredBillingService } from "@/lib/billing/server";
import { billingUser, billingReply, billingFailure } from "@/lib/billing/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await billingUser(request);
    return billingReply(await configuredBillingService().status(user.id));
  } catch (error) {
    return billingFailure(error);
  }
}
