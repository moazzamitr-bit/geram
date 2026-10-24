/**
 * Where server-side Supabase clients send HTTP.
 *
 * The browser keeps NEXT_PUBLIC_SUPABASE_URL (https://DOMAIN/sb through Caddy).
 * SUPABASE_INTERNAL_URL is optional and server-only. When it is unset or blank,
 * every caller falls back to the public URL, so an existing .env.production
 * keeps working without that line.
 *
 * The internal value is the gateway root, with no /sb prefix. Caddy strips /sb
 * before proxying to port 8000. On the current self-hosted stack that host is
 * the supabase-envoy container (network aliases: kong, envoy, api-gw).
 */

export function publicSupabaseUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return url || undefined;
}

export function serverSupabaseUrl(): string | undefined {
  const internal = process.env.SUPABASE_INTERNAL_URL?.trim();
  if (internal) return internal;
  return publicSupabaseUrl();
}

/**
 * Cookie name @supabase/supabase-js derives from the public project URL
 * (`sb-<first-dns-label>-auth-token`). Server clients that call a different
 * host must keep this name, or middleware will not see the browser session.
 */
export function publicAuthCookieName(publicUrl: string): string {
  const ref = new URL(publicUrl).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

export function serverAuthCookieOptions(): { name: string } | undefined {
  const internal = process.env.SUPABASE_INTERNAL_URL?.trim();
  const pub = publicSupabaseUrl();
  if (!internal || !pub) return undefined;
  try {
    if (new URL(internal).host === new URL(pub).host) return undefined;
    return { name: publicAuthCookieName(pub) };
  } catch {
    return undefined;
  }
}
