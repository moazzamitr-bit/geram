import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchWithTimeout } from "@/lib/supabase/fetch";
import { serverAuthCookieOptions, serverSupabaseUrl } from "@/lib/supabase/url";

export async function createClient() {
  const url = serverSupabaseUrl();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }

  const cookieStore = await cookies();
  const cookieOptions = serverAuthCookieOptions();

  return createServerClient(url, key, {
    ...(cookieOptions ? { cookieOptions } : {}),
    global: { fetch: fetchWithTimeout(12_000) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* called from a Server Component — ignore */
        }
      },
    },
  });
}
