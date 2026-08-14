import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/db/admin-queries";
import {
  hasPermission,
  roleFromProfileRole,
  type AdminPermission,
  type AdminRole,
} from "./rbac";
import { writeAudit } from "./audit";
import { adminDb } from "./queries";

export type AdminAuth = {
  ok: true;
  user: { id: string };
  profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    role: string;
  };
  role: AdminRole;
};

export async function requireAdminAuth(
  permission?: AdminPermission
): Promise<
  | AdminAuth
  | { ok: false; reason: "not_configured" | "unauthenticated" | "forbidden"; status: number }
> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    const reason = auth.reason as "not_configured" | "unauthenticated" | "forbidden";
    return {
      ok: false,
      reason,
      status: reason === "unauthenticated" ? 401 : reason === "not_configured" ? 503 : 403,
    };
  }
  const role = await resolveAdminRole(auth.user.id, auth.profile.role);
  if (!role) {
    return { ok: false, reason: "forbidden", status: 403 };
  }
  if (permission && !hasPermission(role, permission)) {
    await writeAudit({
      actorId: auth.user.id,
      role,
      action: "permission.denied",
      entity: "permission",
      entityId: permission,
      result: "denied",
    });
    return { ok: false, reason: "forbidden", status: 403 };
  }
  return {
    ok: true,
    user: { id: auth.user.id },
    profile: auth.profile,
    role,
  };
}

export async function resolveAdminRole(
  userId: string,
  profileRole: string | null | undefined
): Promise<AdminRole | null> {
  const fallback = roleFromProfileRole(profileRole);
  if (!fallback) return null;
  const sb = await adminDb();
  if (!sb) return fallback;
  const { data, error } = await sb
    .from("admin_role_assignments")
    .select("admin_role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.admin_role) return fallback;
  return roleFromProfileRole(data.admin_role) ?? fallback;
}

export function jsonDenied(reason: string, status: number) {
  return NextResponse.json({ ok: false, error: reason }, { status });
}

export async function adminGate(permission?: AdminPermission) {
  const auth = await requireAdminAuth(permission);
  if (!auth.ok) {
    const message =
      auth.reason === "forbidden"
        ? "permission denied"
        : auth.reason === "unauthenticated"
          ? "unauthenticated"
          : "service_unavailable";
    return { ok: false as const, response: jsonDenied(message, auth.status) };
  }
  return {
    ok: true as const,
    ctx: { userId: auth.user.id, role: auth.role, profile: auth.profile },
  };
}

export async function readActionBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json ?? {})) {
      if (v == null) continue;
      out[k] = typeof v === "string" ? v : String(v);
    }
    return out;
  }
  const form = await request.formData();
  const out: Record<string, string> = {};
  form.forEach((v, k) => {
    out[k] = String(v);
  });
  return out;
}
