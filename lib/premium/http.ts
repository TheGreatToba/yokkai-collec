import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { PremiumError, requireLocalPremium } from "./server";

const messages: Record<string, string> = {
  LOCAL_ONLY: "Not found.",
  AUTH_REQUIRED: "Sign in to your local account to continue.",
  REQUEST_DENIED: "Request denied.",
  INVALID_REQUEST: "Invalid request.",
  STRIPE_TEST_SETUP_REQUIRED:
    "Checkout is not configured for this local preview yet.",
  PRICE_MUST_BE_EUR_499_MONTHLY:
    "Configure an active EUR 4.99 monthly Stripe test price.",
  USE_MANAGE_SUBSCRIPTION:
    "You already have a subscription or a pending payment. Use Manage subscription.",
  NO_SUBSCRIPTION:
    "No Stripe subscription is linked to this local account yet.",
  PREMIUM_REQUIRED:
    "An active test subscription is required to save this style.",
  INVALID_STYLE: "Choose one of the available styles.",
  INVALID_SIGNATURE: "Invalid webhook signature."
};
export function premiumReply(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
export function premiumFailure(error: unknown) {
  if (error instanceof PremiumError)
    return premiumReply(
      {
        error:
          messages[error.code] ??
          "Billing is temporarily unavailable. Please try again.",
        code: error.code
      },
      error.status
    );
  // Do not leak Stripe payloads, secrets or customer identifiers.
  console.error("LOCAL_PREMIUM_REQUEST_FAILED");
  return premiumReply(
    {
      error:
        "Billing is temporarily unavailable. Check the local Stripe setup and try again."
    },
    503
  );
}
export async function premiumUser(request?: Request) {
  requireLocalPremium();
  if (
    request &&
    request.headers.get("origin") !==
      new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin
  )
    throw new PremiumError("REQUEST_DENIED", 403);
  const user = await getCurrentUser();
  if (!user) throw new PremiumError("AUTH_REQUIRED", 401);
  return user;
}
export async function limitedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new PremiumError("INVALID_REQUEST", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function premiumInput(request: Request, keys: string[] = []) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new PremiumError("INVALID_REQUEST");
  let body;
  try {
    body = JSON.parse(await limitedBody(request, 1024));
  } catch {
    throw new PremiumError("INVALID_REQUEST");
  }
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object" ||
    Object.keys(body).some(key => !keys.includes(key))
  )
    throw new PremiumError("INVALID_REQUEST");
  return body as Record<string, unknown>;
}
