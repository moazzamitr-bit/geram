import {
  AdminNotice,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/AdminUI";
import { adminDb } from "@/lib/admin/queries";
import { maskPhone } from "@/lib/admin/mask";
import { formatUgAsGrams } from "@/lib/ledger/display";
import { listCustomerLedgerViews } from "@/lib/ledger/read";
import { formatToman } from "@/lib/utils";
import Link from "next/link";

type ProfileBits = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export default async function AdminWalletsPage() {
  const ledger = await listCustomerLedgerViews();
  const profiles = new Map<string, ProfileBits>();
  if (ledger.ok && ledger.views.length > 0) {
    const sb = await adminDb();
    if (sb) {
      const { data } = await sb
        .from("profiles")
        .select("id, first_name, last_name, phone")
        .in(
          "id",
          ledger.views.map((view) => view.holderId)
        );
      for (const row of data ?? []) {
        profiles.set(String(row.id), row as ProfileBits);
      }
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="کیف پول‌ها"
        description="موجودی قابل استفاده و رزرو از دفترکل. جدول wallets خوانده نمی‌شود و داده نمونه ندارد."
      />
      {!ledger.ok ? (
        <AdminNotice title="دفترکل">{ledger.error}</AdminNotice>
      ) : (
        <AdminTable
          headers={["کاربر", "تومان قابل استفاده", "تومان رزرو", "طلا", "نقره", "مس"]}
          empty={ledger.views.length === 0}
        >
          {ledger.views.map((view) => {
            const profile = profiles.get(view.holderId);
            const name = profile
              ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                maskPhone(profile.phone)
              : view.holderId.slice(0, 8);
            return (
              <tr key={view.holderId} className="border-b border-white/5">
                <td className="px-4 py-3">
                  <Link className="text-gold" href={`/admin/users/${view.holderId}`}>
                    {name}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatToman(view.availableToman)}</td>
                <td className="px-4 py-3">{formatToman(view.reservedToman)}</td>
                <td className="px-4 py-3">
                  {formatUgAsGrams(view.metals.GOLD.availableUg)}
                  <span className="mt-1 block text-[11px] text-white/40">
                    رزرو {formatUgAsGrams(view.metals.GOLD.reservedUg)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatUgAsGrams(view.metals.SILVER.availableUg)}
                  <span className="mt-1 block text-[11px] text-white/40">
                    رزرو {formatUgAsGrams(view.metals.SILVER.reservedUg)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatUgAsGrams(view.metals.COPPER.availableUg)}
                  <span className="mt-1 block text-[11px] text-white/40">
                    رزرو {formatUgAsGrams(view.metals.COPPER.reservedUg)}
                  </span>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </div>
  );
}
