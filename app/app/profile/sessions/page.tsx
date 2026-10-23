"use client";

import { NoData } from "@/components/app/NoData";
import { PageHeader } from "@/components/app/PageHeader";

export default function SessionsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="نشست‌های فعال"
        description="فهرست دستگاه‌های واردشده هنوز از سرور خوانده نمی‌شود."
        backHref="/app/profile"
      />
      <NoData />
    </div>
  );
}
