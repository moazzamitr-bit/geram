import { createServiceClient } from "@/lib/supabase/admin";
import type { AdminRole } from "./rbac";

export type AuditInput = {
  actorId: string | null;
  role?: AdminRole | string;
  action: string;
  entity: string;
  entityId?: string | null;
  reason?: string;
  result?: "ok" | "denied" | "error";
  meta?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const admin = createServiceClient();
    const meta = {
      role: input.role ?? null,
      reason: input.reason ?? null,
      result: input.result ?? "ok",
      ...(input.meta ?? {}),
    };
    const { error } = await admin.from("audit_logs").insert({
      actor_id: input.actorId,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      meta,
    });
    if (error) console.error("writeAudit", error.message);
  } catch (err) {
    console.error("writeAudit", err instanceof Error ? err.message : err);
  }
}

export async function listAudit(limit = 200) {
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("audit_logs")
      .select("*, profiles(first_name,last_name,email,role)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      const { data: plain } = await admin
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return plain ?? [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}
