import {
  AdminBadge,
  AdminNotice,
  AdminPageHeader,
} from "@/components/admin/AdminUI";
import { SupportReplyForm } from "@/components/admin/SupportReplyForm";
import { getTicket } from "@/lib/admin/queries";
import { maskEmail, maskPhone } from "@/lib/admin/mask";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) notFound();
  const profile = Array.isArray(ticket.profiles) ? ticket.profiles[0] : ticket.profiles;
  const messages = Array.isArray(ticket.support_messages) ? ticket.support_messages : [];

  return (
    <div>
      <AdminPageHeader
        title={ticket.subject}
        action={<AdminBadge tone={ticket.status === "OPEN" ? "warning" : "neutral"}>{ticket.status}</AdminBadge>}
      />
      <AdminNotice title="یادداشت داخلی">
        یادداشت داخلی در audit ذخیره می‌شود و به کاربر نشان داده نمی‌شود. sender=admin در پیام‌ها استفاده نمی‌شود.
      </AdminNotice>
      <p className="mb-4 text-[13px] text-white/60">
        کاربر:{" "}
        <Link className="text-gold" href={`/admin/users/${ticket.user_id}`}>
          {profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || maskPhone(profile.phone)
            : ticket.user_id}
        </Link>
        <span className="mr-3" dir="ltr">{maskEmail(profile?.email)}</span>
      </p>
      <div className="mb-6 space-y-3">
        {messages
          .slice()
          .sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at))
          .map((m: { id: string; sender: string; body: string; created_at: string }) => (
            <div key={m.id} className="rounded-2xl border border-white/10 bg-[#0F1724] p-4 text-[13px]">
              <p className="text-[11px] text-white/40">
                {m.sender} · {new Date(m.created_at).toLocaleString("fa-IR")}
              </p>
              <p className="mt-2 leading-7">{m.body}</p>
            </div>
          ))}
      </div>
      <SupportReplyForm ticketId={id} />
    </div>
  );
}
