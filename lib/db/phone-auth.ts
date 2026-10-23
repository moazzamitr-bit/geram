import { randomBytes } from "crypto";
import { createClient as createBrowserOrServer } from "@supabase/supabase-js";
import { phoneE164, phoneEmail } from "@/lib/auth/phone";
import { getExecutionMode } from "@/lib/core/mode";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/db/types";

/**
 * Anon-only fallback (no service role). The password is derivable from the
 * pepper, so the pepper must be a real secret: there is deliberately no default.
 */
function pepperedPassword(phone: string) {
  let pepper = process.env.PHONE_AUTH_PEPPER;
  if (!pepper || pepper.length < 32) {
    // SANDBOX already accepts a fixed public OTP, so a known pepper grants
    // nothing extra there; keep the demo working until a secret is set.
    // Any other mode refuses to derive guessable passwords.
    let mode = "UNKNOWN";
    try {
      mode = getExecutionMode();
    } catch {
      /* unknown → strict */
    }
    if (mode !== "SANDBOX") throw new Error("phone_auth_misconfigured");
    pepper = process.env.PHONE_AUTH_PEPPER || "gram-dev-pepper";
  }
  return `gram-${pepper}-${phone.replace(/\D/g, "")}`;
}

/** One-time password for this sign-in; never stored or derivable. */
function randomPassword() {
  return randomBytes(32).toString("base64url");
}

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserOrServer(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createServiceClient>,
  email: string
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (profile?.id) return profile.id as string;

  // Profiles can lag auth.users (trigger failures); page through instead of
  // only checking the first page.
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/**
 * Service-role path: rotate the auth password to a fresh random value on every
 * verified login, so knowing the phone number (or any server secret) is never
 * enough to sign in directly against Supabase.
 */
async function ensureWithServiceRole(digits: string, email: string, e164: string) {
  const admin = createServiceClient();
  const password = randomPassword();

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone: e164,
    phone_confirm: true,
    user_metadata: { phone: digits },
  });

  if (createError) {
    if (!/already|exists|registered/i.test(createError.message)) {
      throw createError;
    }
    const userId = await findUserIdByEmail(admin, email);
    if (!userId) throw new Error("phone_user_lookup_failed");
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) throw updateError;
  }

  return { email, password, phone: digits };
}

async function ensureWithAnon(digits: string, email: string) {
  const supabase = anonClient();
  const password = pepperedPassword(digits);

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

  return { email, password, phone: digits };
}

/** Ensure a phone-backed auth user exists (server-only). Call only after OTP verification. */
export async function ensurePhoneUser(phone: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  const digits = phone.replace(/\D/g, "").replace(/^98/, "0");
  const email = phoneEmail(digits);
  const e164 = phoneE164(digits);

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return ensureWithServiceRole(digits, email, e164);
  }

  return ensureWithAnon(digits, email);
}
