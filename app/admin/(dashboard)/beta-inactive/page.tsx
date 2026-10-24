import { AdminPageHeader } from "@/components/admin/AdminUI";
import Link from "next/link";

export default function AdminBetaInactivePage() {
  return (
    <div>
      <AdminPageHeader
        title="در بتای بسته فعال نیست"
        description="این بخش در بتای بسته خاموش است. صفحه حذف نشده و بعداً می‌تواند دوباره روشن شود."
      />
      <Link href="/admin" className="text-[14px] text-gold">
        بازگشت به داشبورد
      </Link>
    </div>
  );
}
