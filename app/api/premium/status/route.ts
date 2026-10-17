import { getPremiumState } from "@/lib/premium/server";
import { premiumUser, premiumReply, premiumFailure } from "@/lib/premium/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await premiumUser();
    return premiumReply(await getPremiumState(user.id));
  } catch (error) {
    return premiumFailure(error);
  }
}
