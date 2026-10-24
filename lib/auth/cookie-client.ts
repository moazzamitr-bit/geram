import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchWithTimeout } from "@/lib/supabase/fetch";
import { serverAuthCookieOptions, serverSupabaseUrl } from "@/lib/supabase/url";

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * Route-handler Supabase client. Session cookies are collected and written
 * onto the NextResponse we actually return, so middleware and the browser
 * see the same `sb-<host>-auth-token` cookies.
 */
export async function createCookieAuthClient() {
  const url = serverSupabaseUrl();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }

  const cookieStore = await cookies();
  const pending: PendingCookie[] = [];
  const cookieOptions = serverAuthCookieOptions();
  const supabase = createServerClient(url, key, {
    ...(cookieOptions ? { cookieOptions } : {}),
    global: { fetch: fetchWithTimeout(12_000) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options });
        });
      },
    },
  });

  return {
    supabase,
    seal<T extends NextResponse>(response: T) {
      for (const cookie of pending) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
      return response;
    },
  };
}
