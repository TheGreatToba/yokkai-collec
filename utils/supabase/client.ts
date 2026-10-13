import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/utils/supabase/config";

export function createClient() {
  const { url, key, cookieName } = getSupabaseConfig();
  return createBrowserClient(url, key, { cookieOptions: { name: cookieName } });
}
