import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { createCookieAuthClient } from "@/lib/auth/cookie-client";
import { phoneE164, phoneEmail } from "@/lib/auth/phone";
import { createServiceClient } from "@/lib/supabase/admin";

export type AuthProfile = {
  id: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  kyc_status: string | null;
  onboarding_done: boolean | null;
};

type Seal = <T extends NextResponse>(response: T) => T;

export type AuthSuccess = {
  ok: true;
  session: { access_token: string; refresh_token: string };
  profile: AuthProfile;
  seal: Seal;
};

export type AuthFailure = {
  ok: false;
  error: string;
  status: number;
  seal: Seal;
};

const passthrough: Seal = (response) => response;

const PROFILE_COLUMNS = "id, phone, first_name, last_name, kyc_status, onboarding_done";

async function loadProfile(
  supabase: SupabaseClient,
  id: string,
  phone: string
): Promise<AuthProfile> {
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (data) return data as AuthProfile;
  return {
    id,
    phone,
    first_name: "",
    last_name: "",
    kyc_status: "UNVERIFIED",
    onboarding_done: false,
  };
}

export async function loginPhonePassword(
  phone: string,
  password: string
): Promise<AuthSuccess | AuthFailure> {
  const client = await createCookieAuthClient();
  const { data, error } = await client.supabase.auth.signInWithPassword({
    email: phoneEmail(phone),
    password,
  });
  if (error || !data.session || !data.user) {
    return { ok: false, error: "invalid_credentials", status: 401, seal: client.seal };
  }
  const profile = await loadProfile(client.supabase, data.user.id, phone);
  return {
    ok: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    profile,
    seal: client.seal,
  };
}

export async function registerPhonePassword(input: {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthSuccess | AuthFailure> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "service_unavailable", status: 503, seal: passthrough };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const admin = createServiceClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email: phoneEmail(input.phone),
    password: input.password,
    email_confirm: true,
    phone: phoneE164(input.phone),
    phone_confirm: true,
    user_metadata: {
      phone: input.phone,
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (createError) {
    if (/already|exists|registered/i.test(createError.message)) {
      return { ok: false, error: "already_registered", status: 409, seal: passthrough };
    }
    console.error("register_create", createError.message);
    return { ok: false, error: "service_unavailable", status: 503, seal: passthrough };
  }

  const client = await createCookieAuthClient();
  const { data, error } = await client.supabase.auth.signInWithPassword({
    email: phoneEmail(input.phone),
    password: input.password,
  });
  if (error || !data.session || !data.user) {
    return { ok: false, error: "sign_in_failed", status: 500, seal: client.seal };
  }

  await client.supabase
    .from("profiles")
    .update({ phone: input.phone, first_name: firstName, last_name: lastName })
    .eq("id", data.user.id);

  const profile = await loadProfile(client.supabase, data.user.id, input.phone);
  return {
    ok: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    profile: {
      ...profile,
      phone: profile.phone || input.phone,
      first_name: profile.first_name || firstName,
      last_name: profile.last_name || lastName,
      onboarding_done: false,
    },
    seal: client.seal,
  };
}

export async function loginAdmin(email: string, password: string): Promise<AuthSuccess | AuthFailure> {
  const client = await createCookieAuthClient();
  const { data, error } = await client.supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.session || !data.user) {
    return { ok: false, error: "invalid_credentials", status: 401, seal: client.seal };
  }

  const { data: profile, error: profileError } = await client.supabase
    .from("profiles")
    .select("role, id, phone, first_name, last_name, kyc_status, onboarding_done")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    await client.supabase.auth.signOut();
    return { ok: false, error: "not_admin", status: 403, seal: client.seal };
  }

  return {
    ok: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    profile: {
      id: profile.id,
      phone: profile.phone,
      first_name: profile.first_name,
      last_name: profile.last_name,
      kyc_status: profile.kyc_status,
      onboarding_done: profile.onboarding_done,
    },
    seal: client.seal,
  };
}
