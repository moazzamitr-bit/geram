"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoldButton } from "@/components/ui/GoldButton";
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin/rbac";

export function RoleAssignForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [adminRole, setAdminRole] = useState<AdminRole>("OPERATIONS_ADMIN");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, adminRole, reason }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || data.ok === false) {
        setErr(data.error || "ناموفق");
        return;
      }
      setMsg(data.message || "ثبت شد.");
      setReason("");
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "خطا");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <select
        value={adminRole}
        onChange={(e) => setAdminRole(e.target.value as AdminRole)}
        className="h-10 w-full rounded-xl border border-white/10 bg-[#070B12] px-3 text-[12px]"
      >
        {ADMIN_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <textarea
        required
        minLength={8}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="دلیل تخصیص نقش"
        className="h-16 w-full rounded-xl border border-white/10 bg-[#070B12] p-2 text-[12px]"
      />
      <GoldButton type="submit" size="sm" disabled={loading}>
        {loading ? "…" : "اعمال نقش"}
      </GoldButton>
      {msg && <p className="text-[12px] text-positive">{msg}</p>}
      {err && <p className="text-[12px] text-negative">{err}</p>}
    </form>
  );
}
