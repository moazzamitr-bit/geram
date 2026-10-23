/* eslint-disable @next/next/no-html-link-for-pages --
   next/link in this root slot is a client reference. Next bundled it into
   the marketing page chunk, so login and /app downloaded the homepage and
   recharts. A full document navigation is the right 404 behavior.
*/

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-svh flex-col items-center justify-center gap-4 bg-bg px-4 text-center text-text"
    >
      <p className="text-[56px] font-extrabold text-gold">۴۰۴</p>
      <h1 className="text-[20px] font-bold">صفحه پیدا نشد</h1>
      <p className="max-w-sm text-[14px] leading-7 text-muted-app">
        آدرسی که وارد کردید وجود ندارد یا جابه‌جا شده است.
      </p>
      <div className="mt-2 flex gap-3">
        {/* Anchors, not next/link. Link is a client component, and this
            slot is rendered on every route. Next was bundling that reference
            into the marketing page, so login and the app shell downloaded
            the homepage chunk and recharts. */}
        <a
          href="/"
          className="rounded-xl bg-gold px-5 py-2.5 text-[14px] font-bold text-[#0A0C0E]"
        >
          صفحه اصلی
        </a>
        <a
          href="/app/dashboard"
          className="rounded-xl border border-white/10 px-5 py-2.5 text-[14px] text-text-secondary"
        >
          داشبورد
        </a>
      </div>
    </main>
  );
}
