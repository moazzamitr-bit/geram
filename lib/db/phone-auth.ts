import { createServiceClient } from "@/lib/supabase/admin";
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

export async function ensurePhoneUser(phone: string) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service not configured");
  }

  const digits = phone.replace(/\D/g, "").replace(/^98/, "0");
  const email = phoneEmail(digits);
  const password = phonePassword(digits);
  const admin = createServiceClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", digits)
    .maybeSingle();

  if (!existingProfile) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone: digits },
    });
    if (error) throw error;
    if (data.user) {
      await admin
        .from("profiles")
        .update({ phone: digits })
        .eq("id", data.user.id);
    }
  } else {
    await admin.auth.admin.updateUserById(existingProfile.id, {
      password,
      email,
      user_metadata: { phone: digits },
    });
  }

  return { email, password, phone: digits };
}
