import { BrandLogo } from "@/components/brand/BrandLogo";
import { Faq } from "@/components/landing/Faq";
import { LivePrices } from "@/components/landing/LivePrices";
import { ArrowLeft, Gift, MapPin, PiggyBank, ShieldCheck, Users, Wallet, Zap, Package, UserCheck, Repeat } from "lucide-react";
import Link from "next/link";

const BRANCH = "تهران، خیابان ولیعصر، نرسیده به چهارراه پارک‌وی، کوچه مهناز، پلاک ۲۷";

const steps = [
  { icon: UserCheck, title: "ثبت‌نام و احراز هویت", body: "با شماره موبایل وارد شوید و احراز هویت آنلاین را کامل کنید." },
  { icon: Wallet, title: "شارژ کیف پول", body: "کیف پول تومانی خود را شارژ کنید تا آماده خرید باشید." },
  { icon: Repeat, title: "خرید، فروش و نگهداری", body: "با قیمت لحظه‌ای طلا، نقره یا مس بخرید، نگه دارید و هر زمان خواستید بفروشید." },
];

const benefits = [
  { icon: Zap, title: "خرید و فروش لحظه‌ای", body: "معامله با قیمت زنده بازار؛ مبلغ فروش بلافاصله به کیف پول شما برمی‌گردد." },
  { icon: Package, title: "تحویل فیزیکی در شعبه", body: "دارایی خود را از پنل درخواست دهید و در زمان انتخابی از شعبه تحویل بگیرید." },
  { icon: PiggyBank, title: "طرح پس‌انداز", body: "خرید خودکار و دوره‌ای طلا با مبلغ دلخواه؛ کم‌کم پس‌انداز طلایی بسازید." },
  { icon: Gift, title: "کارت هدیه", body: "طلا هدیه بدهید؛ کارت هدیه بسازید و برای عزیزانتان بفرستید." },
  { icon: Users, title: "دعوت از دوستان", body: "با لینک اختصاصی خود دوستانتان را به گرم دعوت کنید." },
  { icon: ShieldCheck, title: "برداشت امن", body: "برداشت تومان فقط به حساب بانکی تأییدشده به نام خود شما انجام می‌شود." },
];

const metals = [
  { title: "طلای ۱۸ عیار", dot: "#E0A800", body: "انتخاب آشنا برای حفظ ارزش پول در برابر تورم؛ از مبالغ کم شروع کنید." },
  { title: "نقره", dot: "#A8B0BC", body: "راهی برای متنوع کردن سبد دارایی با سرمایه کمتر." },
  { title: "مس", dot: "#C26A3D", body: "فلز صنعتی پرکاربرد؛ گزینه‌ای تازه برای سرمایه‌گذاری گرمی." },
];

function Cta({ children, secondary }: { children: React.ReactNode; secondary?: boolean }) {
  return (
    <Link
      href="/auth/login"
      className={
        secondary
          ? "inline-flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-6 text-[15px] font-semibold text-text transition hover:border-black/20"
          : "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#FFB800] px-6 text-[15px] font-bold text-[#1C1917] shadow-[0_10px_24px_-12px_rgba(196,143,0,0.8)] transition hover:bg-[#F2AE00]"
      }
    >
      {children}
    </Link>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center md:mb-10">
      <h2 className="text-2xl font-extrabold text-text md:text-3xl">{title}</h2>
      {sub ? <p className="mt-3 text-[15px] leading-7 text-text-secondary">{sub}</p> : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="geram-app min-h-dvh bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-black/[0.05] bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <BrandLogo href="/" size="sm" showWordmark />
          <nav className="hidden items-center gap-7 text-[14px] text-text-secondary md:flex" aria-label="بخش‌ها">
            <a href="#prices" className="hover:text-text">قیمت‌ها</a>
            <a href="#how" className="hover:text-text">نحوه کار</a>
            <a href="#benefits" className="hover:text-text">امکانات</a>
            <a href="#faq" className="hover:text-text">سوالات متداول</a>
          </nav>
          <Link href="/auth/login" className="inline-flex h-10 items-center rounded-xl bg-[#FFB800] px-4 text-[14px] font-bold text-[#1C1917] hover:bg-[#F2AE00]">
            ورود / ثبت‌نام
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,184,0,0.18),transparent)]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-12 text-center md:px-6 md:pb-16 md:pt-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#F1D58A] bg-[#FFF7E0] px-3 py-1 text-[12px] font-semibold text-[#7A5600]">
              طلا، نقره و مس — آنلاین و با امکان تحویل فیزیکی
            </span>
            <h1 className="mx-auto mt-5 max-w-3xl text-[30px] font-black leading-[1.5] text-text md:text-5xl md:leading-[1.4]">
              طلای واقعی بخرید،
              <span className="text-[#A87A00]"> گرم به گرم </span>
              پس‌انداز کنید
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-8 text-text-secondary md:text-[17px]">
              خرید و فروش لحظه‌ای طلای ۱۸ عیار، نقره و مس با قیمت زنده بازار و کارمزد شفاف؛ بدون اجرت ساخت، با امکان تحویل حضوری در شعبه.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Cta>
                شروع کنید
                <ArrowLeft size={18} />
              </Cta>
              <a href="#how" className="text-[14px] font-semibold text-text-secondary underline-offset-4 hover:underline">
                چطور کار می‌کند؟
              </a>
            </div>
            <div id="prices" className="mx-auto mt-10 max-w-4xl scroll-mt-24 text-right">
              <LivePrices />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <SectionTitle title="سه فلز، یک کیف پول" sub="دارایی‌تان را بین طلا، نقره و مس تقسیم کنید و همه را یک‌جا ببینید." />
          <div className="grid gap-4 md:grid-cols-3">
            {metals.map((m) => (
              <div key={m.title} className="rounded-3xl border border-black/[0.06] bg-white p-6">
                <span className="block h-10 w-10 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, #fff8, ${m.dot})` }} />
                <h3 className="mt-4 text-lg font-bold text-text">{m.title}</h3>
                <p className="mt-2 text-[14px] leading-7 text-text-secondary">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-20 bg-white/60 py-12 md:py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <SectionTitle title="خرید طلا در سه قدم" sub="چند دقیقه تا اولین خرید" />
            <ol className="grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="relative rounded-3xl border border-black/[0.06] bg-white p-6">
                  <span className="absolute left-5 top-5 text-3xl font-black text-[#F1D58A] tabular-nums">۰{(i + 1).toLocaleString("fa-IR")}</span>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF4D6] text-[#8A6100]">
                    <s.icon size={22} />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-text">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-7 text-text-secondary">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="benefits" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 md:px-6 md:py-16">
          <SectionTitle title="چرا گرم؟" sub="امکاناتی که همین حالا در پنل گرم در دسترس است." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="flex gap-4 rounded-3xl border border-black/[0.06] bg-white p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF4D6] text-[#8A6100]">
                  <b.icon size={20} />
                </span>
                <div>
                  <h3 className="text-[16px] font-bold text-text">{b.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-7 text-text-secondary">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 md:px-6 md:pb-16">
          <div className="grid items-center gap-8 rounded-[32px] border border-black/[0.06] bg-white p-6 md:grid-cols-2 md:p-10">
            <div>
              <h2 className="text-2xl font-extrabold text-text md:text-3xl">تحویل فیزیکی در شعبه حضوری</h2>
              <ul className="mt-5 space-y-3 text-[15px] text-text-secondary">
                {["ثبت درخواست تحویل از پنل کاربری", "انتخاب محصول، روز و ساعت مراجعه", "تحویل حضوری در شعبه گرم"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C48F00]" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#FAF8F5] p-4">
                <MapPin className="mt-0.5 shrink-0 text-[#8A6100]" size={20} />
                <div>
                  <div className="text-[13px] font-semibold text-muted-app">آدرس شعبه</div>
                  <address className="mt-1 text-[15px] not-italic leading-7 text-text">{BRANCH}</address>
                </div>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-[15px] font-bold text-text">قیمت لحظه‌ای بازار</h3>
              <LivePrices variant="list" />
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-12 md:px-6 md:pb-16">
          <SectionTitle title="سوالات متداول" />
          <Faq />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 md:px-6">
          <div className="rounded-[32px] bg-[#1C1917] px-6 py-10 text-center md:py-14">
            <h2 className="text-2xl font-extrabold text-white md:text-3xl">برای اولین خرید آماده‌اید؟</h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-[#E7E5E4]">ثبت‌نام چند دقیقه طول می‌کشد. از هر مبلغی شروع کنید.</p>
            <div className="mt-6">
              <Cta>ورود / ثبت‌نام</Cta>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.06] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-start md:justify-between md:px-6">
          <div className="max-w-sm">
            <BrandLogo href="/" size="sm" showWordmark />
            <p className="mt-3 text-[13px] leading-7 text-text-secondary">خرید، فروش و نگهداری آنلاین طلا، نقره و مس.</p>
            <p className="mt-2 text-[13px] leading-7 text-text-secondary">{BRANCH}</p>
            <a href="mailto:info@geram.co" className="mt-1 inline-block text-[13px] text-text-secondary hover:text-text">info@geram.co</a>
          </div>
          <nav className="flex gap-6 text-[14px] text-text-secondary" aria-label="لینک‌ها">
            <Link href="/terms" className="hover:text-text">قوانین و مقررات</Link>
            <Link href="/privacy" className="hover:text-text">حریم خصوصی</Link>
            <Link href="/auth/login" className="hover:text-text">ورود</Link>
          </nav>
        </div>
        <div className="border-t border-black/[0.05] py-4 text-center text-[12px] text-muted-app">© گرم</div>
      </footer>
    </div>
  );
}
