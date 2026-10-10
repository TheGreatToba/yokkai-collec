import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

function publicOrigin(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) {
    try {
      const site = new URL(configuredUrl);
      if (["http:", "https:"].includes(site.protocol) && !site.username && !site.password) {
        return site.origin;
      }
    } catch {
      // Fall back to the request origin when the optional setting is invalid.
    }
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const recoveryRequested = params.get("next") === "/reinitialiser-mot-de-passe" || type === "recovery";
  let confirmed = false;
  try {
    if (!params.has("error") && (code || (tokenHash && ["email", "signup", "recovery"].includes(type ?? "")))) {
      const supabase = createClient(await cookies());
      // Support the default PKCE email and the token-hash email template.
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as "email" | "signup" | "recovery" });
      confirmed = !error;
    }
  } catch {
    // Invalid/expired links get a useful page, never raw provider errors.
  }
  const response = NextResponse.redirect(new URL(
    confirmed
      ? recoveryRequested ? "/reinitialiser-mot-de-passe" : "/"
      : recoveryRequested ? "/mot-de-passe-oublie?lien=erreur" : "/connexion?confirmation=erreur",
    publicOrigin(request),
  ));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
