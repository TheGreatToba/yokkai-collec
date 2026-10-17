import { savePremiumStyle } from "@/lib/premium/server";
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
    const body = await premiumInput(request, ["style"]);
    await savePremiumStyle(user.id, body.style);
    return premiumReply({ saved: true });
  } catch (error) {
    return premiumFailure(error);
  }
}
