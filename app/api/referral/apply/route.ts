import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadCommerceSettings } from "@/lib/commerce/settings-server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(4).max(16),
});

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s/g, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });
  }

  const code = normalizeCode(parsed.data.code);
  const settings = await loadCommerceSettings();

  const { data: me } = await supabase
    .from("profiles")
    .select("id, referred_by, referral_code")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.referred_by) {
    return NextResponse.json({ ok: false, error: "already_referred" }, { status: 409 });
  }

  const { data: inviter } = await supabase
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", code)
    .maybeSingle();

  if (!inviter || inviter.id === user.id) {
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ referred_by: inviter.id })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  const { error: eventErr } = await supabase.from("referral_events").insert({
    inviter_id: inviter.id,
    invitee_id: user.id,
    inviter_bonus_toman: settings.referral.inviterBonusToman,
    invitee_bonus_toman: settings.referral.inviteeBonusToman,
    status: "PENDING",
  });

  if (eventErr) {
    return NextResponse.json({ ok: false, error: eventErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inviteeBonusToman: settings.referral.inviteeBonusToman,
    message: "کد دعوت ثبت شد. پاداش پس از تکمیل احراز هویت واریز می‌شود.",
  });
}
