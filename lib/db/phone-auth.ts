import { createClient as createBrowserOrServer } from "@supabase/supabase-js";
import { phoneEmail } from "@/lib/auth/phone";
import { createServiceClient } from "@/lib/supabase/admin";
import { fetchWithTimeout } from "@/lib/supabase/fetch";
import { serverSupabaseUrl } from "@/lib/supabase/url";

export type PhoneSession = {
  session: { access_token: string; refresh_token: string };
  profile: {
    id: string;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    kyc_status: string | null;
    onboarding_done: boolean | null;
  };
};

function anonClient() {
  const url = serverSupabaseUrl();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("phone_auth_misconfigured");
  return createBrowserOrServer(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout(12_000) },
  });
}

/**
 * Open a Supabase session after the SMS code has already been checked.
 *
 * GoTrue admin `generateLink({ type: "magiclink" })` only writes a one-time
 * recovery token for an existing user. It does not read or write
 * `encrypted_password`, so a password chosen at registration still works.
 * A brand-new address is created by GoTrue itself (it may assign an internal
 * password the user never sees). `verifyOtp` uses type `email` because that
 * lookup matches both the recovery token (existing user) and the confirmation
 * token (user just created). The hashed token is never logged or returned.
 */
export async function createOtpSession(phone: string): Promise<PhoneSession> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("phone_auth_misconfigured");
  }

  const digits = phone.replace(/\D/g, "").replace(/^98/, "0");
  const email = phoneEmail(digits);
  const admin = createServiceClient();
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: { phone: digits } },
  });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    console.error("otp_session_link", link.error?.message ?? "missing_token");
    throw new Error("otp_session_failed");
  }

  const supabase = anonClient();
  const verified = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (verified.error || !verified.data.session || !verified.data.user) {
    console.error("otp_session_verify", verified.error?.message ?? "missing_session");
    throw new Error("otp_session_failed");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone, first_name, last_name, kyc_status, onboarding_done")
    .eq("id", verified.data.user.id)
    .maybeSingle();

  return {
    session: {
      access_token: verified.data.session.access_token,
      refresh_token: verified.data.session.refresh_token,
    },
    profile: profile ?? {
      id: verified.data.user.id,
      phone: digits,
      first_name: "",
      last_name: "",
      kyc_status: "UNVERIFIED",
      onboarding_done: false,
    },
  };
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: "already_registered" | "service_unavailable" | "register_failed" };

/**
 * Password sign-up without phone verification (pre-launch). Requires the
 * service role so the account is created already confirmed. An existing
 * number is never overwritten — that would let anyone take over an account.
 */
export async function registerPhoneUser(input: {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<RegisterResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "service_unavailable" };
  const admin = createServiceClient();
  const { error } = await admin.auth.admin.createUser({
    email: phoneEmail(input.phone),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      phone: input.phone,
      first_name: input.firstName,
      last_name: input.lastName,
    },
  });
  if (error) {
    if (/already|exists|registered/i.test(error.message)) {
      return { ok: false, error: "already_registered" };
    }
    console.error("register_phone_user", error.message);
    return { ok: false, error: "register_failed" };
  }
  return { ok: true };
}
