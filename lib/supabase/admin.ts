import { createClient } from "@supabase/supabase-js";
import { serverSupabaseUrl } from "@/lib/supabase/url";

/** Service-role client — server only. Never import in client components. */
export function createServiceClient() {
  const url = serverSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service env missing");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
