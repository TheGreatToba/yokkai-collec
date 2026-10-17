import {
  PremiumError,
  receivePremiumWebhook,
  requireLocalPremium
} from "@/lib/premium/server";
import { limitedBody, premiumReply, premiumFailure } from "@/lib/premium/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireLocalPremium();
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new PremiumError("INVALID_SIGNATURE");
    await receivePremiumWebhook(await limitedBody(request, 262144), signature);
    return premiumReply({ received: true });
  } catch (error) {
    return premiumFailure(error);
  }
}
