import { createClient as createBrowserOrServer } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/db/types";

function phoneEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.geram.local`;
}

function phonePassword(phone: string) {
  const pepper =
    process.env.PHONE_AUTH_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 24) ||
    "gram-dev-pepper";
  return `gram-${pepper}-${phone.replace(/\D/g, "")}`;
}

/** Ensure a phone-backed auth user exists (works with anon key via signUp/signIn). */
export async function ensurePhoneUser(phone: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  const digits = phone.replace(/\D/g, "").replace(/^98/, "0");
  const email = phoneEmail(digits);
  const password = phonePassword(digits);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createBrowserOrServer(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.data.user) {
    return { email, password, phone: digits };
  }

  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: { data: { phone: digits } },
  });
  if (signUp.error && !/already/i.test(signUp.error.message)) {
    throw signUp.error;
  }

  const again = await supabase.auth.signInWithPassword({ email, password });
  if (again.error || !again.data.user) {
    throw again.error ?? new Error("phone_sign_in_failed");
  }

  await supabase
    .from("profiles")
    .update({ phone: digits })
    .eq("id", again.data.user.id);

  return { email, password, phone: digits };
}
