import { createClient as createBrowserOrServer } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/db/types";

/** Synthetic email — must use a real domain Supabase accepts (not .local / example.com). */
function phoneEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `p${digits}@geram.vercel.app`;
}

function phoneE164(digits: string) {
  const normalized = digits.replace(/^98/, "0");
  if (!/^09\d{9}$/.test(normalized)) {
    throw new Error("invalid_phone");
  }
  return `+98${normalized.slice(1)}`;
}

function phonePassword(phone: string) {
  const pepper =
    process.env.PHONE_AUTH_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 24) ||
    "gram-dev-pepper";
  return `gram-${pepper}-${phone.replace(/\D/g, "")}`;
}

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserOrServer(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInWithPhoneOrEmail(
  supabase: ReturnType<typeof anonClient>,
  creds: { email: string; password: string; e164: string }
) {
  const byEmail = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (byEmail.data.user) return byEmail;

  return supabase.auth.signInWithPassword({
    phone: creds.e164,
    password: creds.password,
  });
}

async function ensureWithServiceRole(
  digits: string,
  email: string,
  password: string,
  e164: string
) {
  const admin = createServiceClient();
  const supabase = anonClient();

  const existing = await signInWithPhoneOrEmail(supabase, {
    email,
    password,
    e164,
  });
  if (existing.data.user) {
    return { email, password, phone: digits };
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone: e164,
    phone_confirm: true,
    user_metadata: { phone: digits },
  });

  if (createError && !/already|exists|registered/i.test(createError.message)) {
    throw createError;
  }

  const after = await signInWithPhoneOrEmail(supabase, {
    email,
    password,
    e164,
  });
  if (after.error || !after.data.user) {
    throw after.error ?? new Error("phone_sign_in_failed");
  }

  await admin
    .from("profiles")
    .update({ phone: digits })
    .eq("id", after.data.user.id);

  return { email, password, phone: digits };
}

async function ensureWithAnon(
  digits: string,
  email: string,
  password: string,
  e164: string
) {
  const supabase = anonClient();

  const signIn = await signInWithPhoneOrEmail(supabase, {
    email,
    password,
    e164,
  });
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

  const again = await signInWithPhoneOrEmail(supabase, {
    email,
    password,
    e164,
  });
  if (again.error || !again.data.user) {
    throw again.error ?? new Error("phone_sign_in_failed");
  }

  await supabase
    .from("profiles")
    .update({ phone: digits })
    .eq("id", again.data.user.id);

  return { email, password, phone: digits };
}

/** Ensure a phone-backed auth user exists (server-only). */
export async function ensurePhoneUser(phone: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  const digits = phone.replace(/\D/g, "").replace(/^98/, "0");
  const email = phoneEmail(digits);
  const password = phonePassword(digits);
  const e164 = phoneE164(digits);

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return ensureWithServiceRole(digits, email, password, e164);
  }

  return ensureWithAnon(digits, email, password, e164);
}
