import { createPremiumCheckout } from "@/lib/premium/server";
import {
  premiumUser,
  premiumInput,
  premiumReply,
  premiumFailure
} from "@/lib/premium/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await premiumUser(request);
    await premiumInput(request);
    return premiumReply({ url: await createPremiumCheckout(user.id) });
  } catch (error) {
    return premiumFailure(error);
  }
}
