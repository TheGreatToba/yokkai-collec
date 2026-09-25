import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  let confirmed = false;
  try {
    if (!params.has("error") && (code || (tokenHash && (type === "email" || type === "signup")))) {
      const supabase = createClient(await cookies());
      // Support the default PKCE email and the token-hash email template.
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as "email" | "signup" });
      confirmed = !error;
    }
  } catch {
    // Invalid/expired links get a useful page, never raw provider errors.
  }
  const response = NextResponse.redirect(new URL(
    confirmed ? "/" : "/connexion?confirmation=erreur", request.url,
  ));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
