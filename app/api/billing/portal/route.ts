import { configuredBillingService } from "@/lib/billing/server";
import {
  billingUser,
  emptyBillingInput,
  billingReply,
  billingFailure
} from "@/lib/billing/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await billingUser(request, true);
    await emptyBillingInput(request);
    return billingReply({
      url: await configuredBillingService().portal(user.id)
    });
  } catch (error) {
    return billingFailure(error);
  }
}
