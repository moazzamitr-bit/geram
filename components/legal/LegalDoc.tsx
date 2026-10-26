import Link from "next/link";
import { contactInfo, legalEntity } from "@/lib/data";

export type LegalSection = { title: string; items: string[] };

export function LegalDoc({
  title,
  intro,
  updated,
  sections,
  other,
}: {
  title: string;
  intro: string[];
  updated: string;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <main dir="rtl" className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <nav className="mb-8 flex items-center justify-between text-[13px]">
          <Link href="/" className="font-extrabold text-gold">گرم</Link>
          <Link href={other.href} className="text-muted-app hover:text-gold">{other.label}</Link>
        </nav>
        <h1 className="text-[26px] font-extrabold leading-tight">{title}</h1>
        <p className="mt-2 text-[12px] text-muted-app">آخرین به‌روزرسانی: {updated}</p>
        <div className="mt-6 space-y-3 text-[14px] leading-8">
          {intro.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <ol className="mt-8 space-y-7">
          {sections.map((s, i) => (
            <li key={s.title} id={`s${i + 1}`}>
              <h2 className="text-[17px] font-extrabold">ماده {(i + 1).toLocaleString("fa-IR")}: {s.title}</h2>
              <ul className="mt-3 space-y-2 text-[14px] leading-8">
                {s.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="shrink-0 text-muted-app">{(i + 1).toLocaleString("fa-IR")}-{(j + 1).toLocaleString("fa-IR")}.</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <footer className="mt-12 border-t border-border pt-6 text-[13px] leading-7 text-muted-app">
          <p>{legalEntity.name}، شناسه ملی {legalEntity.nationalId}</p>
          <p>نشانی: {contactInfo.address}</p>
          <p>ایمیل: <a className="text-gold" href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a></p>
        </footer>
      </div>
    </main>
  );
}
