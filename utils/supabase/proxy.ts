import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/utils/supabase/config";

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const responseHeaders = new Headers();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach(cookie => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        // A response containing refreshed session cookies must not be cached.
        if (!responseHeaders.has("Cache-Control")) {
          responseHeaders.set("Cache-Control", "private, no-store");
        }
        Object.entries(headers).forEach(([name, value]) =>
          responseHeaders.set(name, value)
        );
        responseHeaders.forEach((value, name) =>
          response.headers.set(name, value)
        );
      }
    }
  });

  // Creating the client alone does not refresh the session.
  await supabase.auth.getClaims();

  return response;
}
