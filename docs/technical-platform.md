# گرم (Gram) — داکیومنت فنی پلتفرم

**نسخه سند:** 1.0  
**تاریخ:** ۱۴ مرداد ۱۴۰۵ / 14 Aug 2026  
**مخاطب:** مهندسی، محصول، عملیات  
**وضعیت محصول:** DEMO / SANDBOX — ظاهر محصول کامل است؛ ریل مالی واقعی (SMS، درگاه، دفترکل دوطرفه، تسویه بانکی) هنوز وجود ندارد.

زنده: [https://geram.vercel.app](https://geram.vercel.app)  
ریپو: [https://github.com/moazzamitr-bit/geram](https://github.com/moazzamitr-bit/geram)

---

## ۱. خلاصه محصول

گرم پلتفرم فارسی/RTL خرید و فروش **طلای ۱۸ عیار، نقره ۹۲۵ و مس** است با:

- قیمت لایو بازار آزاد (منبع TGJU)
- کارمزد شفاف قبل از تأیید (قابل تنظیم در ادمین)
- کیف‌پول ریالی + موجودی جداگانه برای هر فلز
- اهداف پس‌انداز، خرید دوره‌ای (DCA)، هشدار قیمت، تحویل فیزیکی، رفرال، اشتراک «گرم پلاس»
- پنل ادمین برای مشاهده کاربران/تراکنش‌ها و ویرایش تنظیمات درآمد

واحد پول UI: **تومان**. واحد وزن داخلی: **میلی‌گرم** (`*_mg`). قیمت‌ها: **تومان / گرم**.

---

## ۲. استک فنی

| لایه | فناوری |
|---|---|
| فریم‌ورک | Next.js 15.4 (App Router) + React 19 + TypeScript strict |
| استایل | Tailwind CSS v4، توکن‌ها در `app/globals.css` |
| فونت | Vazirmatn (`next/font`)، `lang=fa` `dir=rtl` |
| موشن | GSAP (لندینگ)، `motion` (آماده) |
| چارت | Recharts |
| بک‌اند موقت | Route Handlerهای Next (`app/api/*`) |
| دیتابیس / Auth | Supabase (Postgres + Auth + RLS) پروژه `wlxlobhetjbrhbfpsmzp` |
| کرون | Vercel Cron روزانه `0 6 * * *` → `/api/cron/revenue` |
| استقرار | Vercel team `mehdis-projects-441f3be1`، دامنه `geram.vercel.app` |
| PWA | `public/manifest.webmanifest` (بدون service worker) |

اسکریپت‌ها: `dev` (Turbopack)، `build`، `start`، `lint`. تست خودکار وجود ندارد.

---

## ۳. معماری اجرایی

```
Browser (RTL PWA)
  ├── /                 Marketing (Hero, live metals, features)
  ├── /auth/*           Phone OTP login + onboarding
  ├── /app/*            Authenticated product (client-gated)
  └── /admin/*          Admin (middleware + role)

Next.js App
  ├── AuthProvider          lib/auth/auth-context.tsx
  ├── DemoStoreProvider     lib/app/demo-store.tsx   ← منبع حقیقت کلاینت
  ├── API routes            app/api/*
  └── Middleware            فقط /admin/*

Supabase
  ├── auth.users
  ├── public.* (RLS)
  └── service_role (cron, phone user create, price persist)
```

دو حالت اجرا:

1. **Live:** اگر `NEXT_PUBLIC_SUPABASE_*` ست باشد، سشن Supabase + همگام‌سازی کیف/تراکنش از `lib/db/platform-sync.ts`.
2. **Offline sandbox:** `localStorage` کلیدهای `gram_demo_session_v1` و `gram_demo_platform_v2`.

در هر دو حالت، **موتور معامله روی کلاینت** (`buyMetal` / `sellMetal`) اجرا می‌شود و سپس در صورت live به جداول `wallets` / `transactions` upsert می‌شود. دفترکل دوطرفه سروری وجود ندارد.

---

## ۴. ساختار ریپو

```
app/
  (marketing)/page.tsx      لندینگ
  auth/login, onboarding
  app/                      محصول کاربر
  admin/                    پنل ادمین
  api/                      BFF
components/                 home, app, admin, ui, layout, brand
lib/
  auth/                     AuthContext
  app/                      demo-store, navigation, pnl
  market/                   instruments, price-provider, history-provider
  commerce/                 fees, kyc, cron-jobs, settings
  db/                       platform-sync, phone-auth, admin-queries, types
  supabase/                 client, server, admin (service role)
supabase/migrations/
docs/
```

Path alias: `@/*` → ریشه پروژه.

---

## ۵. احراز هویت

### ۵.۱ کاربر نهایی (موبایل)

مسیر: `/auth/login` → OTP → `/auth/onboarding` → `/app/dashboard`

- شماره: `09xxxxxxxxx`
- OTP سندباکس: `NEXT_PUBLIC_DEMO_OTP` یا `123456` (بدون SMS واقعی)
- محدودیت UI: ۶۰ث ریترای، ۵ تلاش OTP (سمت کلاینت)

API: `POST /api/auth/phone-login` `{ phone, otp }`

پیاده‌سازی [`lib/db/phone-auth.ts`](../lib/db/phone-auth.ts):

- ایمیل مصنوعی: `p{digits}@geram.vercel.app`
- رمز قطعی: `gram-{PHONE_AUTH_PEPPER}-{digits}`
- با service role کاربر ساخته می‌شود؛ در غیر این صورت signUp با anon
- پاسخ: `access_token` + `refresh_token` → `supabase.auth.setSession`

گیت `/app/*`: کلاینتی در `AppShell` (نه middleware). اگر لاگین نباشد → login؛ اگر onboarding تمام نشده → onboarding.

### ۵.۲ ادمین

- مسیر: `/admin/login` — ایمیل + رمز عبور Supabase
- نقش: `profiles.role = 'admin'`
- Middleware فقط وجود سشن را چک می‌کند؛ نقش در layout ادمین بررسی می‌شود

### ۵.۳ KYC

وضعیت‌ها: `UNVERIFIED | PENDING | VERIFIED | REJECTED | NEEDS_UPDATE`

- UI کاربر: `/app/profile/kyc` — سندباکس (کد ملی + تاریخ تولد → PENDING؛ دکمه شبیه‌سازی VERIFIED)
- گیت فعلی: فقط **فروش به بانک، برداشت، تحویل** (`isKycVerified`)
- خرید/فروش به کیف‌پول بدون KYC مجاز است
- ادمین `/admin/kyc`: فقط مشاهده، بدون تأیید/رد

---

## ۶. بازار و قیمت

کاتالوگ [`lib/market/instruments.ts`](../lib/market/instruments.ts):

| id | عنوان | منبع TGJU | حداقل خرید (تومان) |
|---|---|---|---|
| `gold18` | طلای ۱۸ عیار | `geram18` (ریال → تومان) | ۵۰۰٬۰۰۰ |
| `silver925` | نقره ۹۲۵ | `silver_925` | ۲۰۰٬۰۰۰ |
| `copper` | مس | `copper` (USD/تن) × `price_dollar_rl` | ۱۰۰٬۰۰۰ |

فرمول مس:

```
tomanPerGram = round( (usdPerTonne / 1_000_000) * (dollarRial / 10) )
```

کش قیمت: ۲۵ث در حافظه سرور. Fallback آفلاین در کاتالوگ.

API:

- `GET /api/market/price` — یک فلز (`?instrument=gold18`)
- `GET /api/market/price?all=1` — هر سه
- `GET /api/market/price?persist=1` — درج در `market_prices` (نیاز به service role)
- `GET /api/market/history?instrument=&range=1d|7d|1m|3m|1y`

تاریخچه: TGJU `summary-table/{key}`؛ مس از ترکیب تاریخچه copper و دلار. اینترادی طلا موجود است؛ نقره/مس معمولاً به روزانه fallback می‌کنند.

کلاینت هر ۳۰ث `/api/market/price?all=1` را پول می‌کند.

---

## ۷. مدل معامله (خرید / فروش)

منبع حقیقت فعلی: [`lib/app/demo-store.tsx`](../lib/app/demo-store.tsx)

### خرید

1. تب فلز (`?instrument=`)
2. مبلغ تومان
3. `buyQuote`: کارمزد = max(minFee, floor(amount × percent))
4. فلز دریافتی: `floor((net / price) * 1000)` میلی‌گرم
5. چک: بازار باز، حداقل خرید، موجودی ریالی
6. کسر تومان، افزایش `gold_mg` / `silver_mg` / `copper_mg`، به‌روزرسانی میانگین خرید
7. تراکنش نوع `خرید`، وضعیت `تکمیل‌شده`

تایمر ۳۰ث روی صفحه خرید **فقط UI** است؛ قفل قیمت سروری وجود ندارد.

### فروش

1. وزن یا مبلغ هدف
2. `sellQuote`: ناخالص = وزن × قیمت؛ کارمزد از ناخالص
3. مقصد: کیف‌پول (آنی) یا بانک (در انتظار + KYC)
4. کسر فلز؛ افزایش `toman_available` یا `toman_pending`

سفارش نهایی در UI غیرقابل لغو است، اما هیچ state machine سروری برای این موضوع وجود ندارد.

### PnL

[`lib/app/pnl.ts`](../lib/app/pnl.ts): میانگین موزون خرید per instrument؛ سود تحقق‌نیافته = ارزش روز − بهای تمام‌شده.

---

## ۸. کیف‌پول، واریز، برداشت، تحویل

| عملیات | رفتار فعلی |
|---|---|
| واریز | افزایش آنی `toman_available` — بدون درگاه |
| برداشت | KYC + شبا تأییدشده؛ کارمزد ثابت؛ وضعیت «در انتظار تسویه» — تسویه واقعی نیست |
| حساب بانکی | افزودن در پروفایل؛ در دمو verified می‌شود |
| تحویل | کاتالوگ شمش طلا؛ کسر `gold_mg` + کارمزد ریالی؛ نقره/مس هنوز ندارند |

موجودی‌ها:

- ریال: `toman_available`, `toman_pending`
- فلز: `gold_mg`, `silver_mg`, `copper_mg`
- میانگین: `avg_buy_price_toman`, `avg_buy_price_silver_toman`, `avg_buy_price_copper_toman`

---

## ۹. درآمد و محصول تجاری

تنظیمات در `platform_settings` (کلیدهای `fees`, `plus`, `referral`) با پیش‌فرض:

| مورد | رایگان | پلاس |
|---|---|---|
| کارمزد خرید | ۰٫۷٪ (حداقل ۵۰هزار) | ۰٫۴٪ (حداقل ۲۵هزار) |
| کارمزد فروش | ۰٫۵٪ (حداقل ۳۰هزار) | ۰٫۳٪ (حداقل ۱۵هزار) |
| برداشت | ۱۵هزار | ۰ |
| اجرای DCA | ۲۵هزار | ۱۰هزار |
| سقف DCA فعال | ۱ | ۱۰ |
| هشدار SMS | خیر | بله |
| قیمت پلاس | — | ۹۹هزار / ماه (سندباکس) |

ادمین: `PUT /api/admin/commerce-settings` (فقط role=admin).

### گرم پلاس

فعال‌سازی سندباکس: `POST /api/commerce/plus/activate-sandbox` — ۳۰ روز `plan_tier=plus`. بدون درگاه اشتراک.

### DCA

`/app/scheduled-purchases` + کرون `runDcaCron`. **فقط طلا.** از کیف ریالی کسر می‌شود.

### هشدار قیمت

بازار: بالاتر/پایین‌تر از قیمت. SMS فقط پلاس. auto-buy اختیاری — کرون **فقط طلا**.

### رفرال

کد ۸حرفی از UUID. `POST /api/referral/apply`. رویداد `PENDING`؛ پرداخت پاداش خودکار نیست (نیاز به KYC طبق تنظیم).

کرون: `GET|POST /api/cron/revenue` با `Authorization: Bearer CRON_SECRET`، روزانه ساعت ۶ UTC.

---

## ۱۰. مدل داده (Supabase)

مایگریشن‌ها:

1. `20260808120000_gram_core.sql` — هسته + RLS + تریگر ساخت profile/wallet
2. `20260808121000_wallets_update_own.sql` — کاربر می‌تواند wallet خودش را update کند (برای سینک کلاینت)
3. `20260810120000_revenue_features.sql` — پلاس، رفرال، settings، alert orders
4. `20260812190000_multi_metal.sql` — نقره/مس + `transactions.instrument`

### جداول اصلی

| جدول | نقش |
|---|---|
| `profiles` | کاربر، KYC، role، onboarding، plan، referral_code |
| `wallets` | موجودی ریال و سه فلز |
| `transactions` | خرید/فروش/واریز/برداشت/تحویل/کارمزد؛ `gold_mg` = میلی‌گرم همان `instrument` |
| `bank_accounts` | شبا |
| `goals` | اهداف پس‌انداز ریالی |
| `scheduled_purchases` | DCA |
| `delivery_requests` | تحویل فیزیکی |
| `support_tickets` / `support_messages` | پشتیبانی |
| `notifications` | اعلان درون‌برنامه |
| `market_prices` | تاریخچه قیمت persistشده |
| `price_alerts` / `price_alert_orders` | هشدار و سفارش خودکار |
| `platform_settings` | JSON کارمزد/پلاس/رفرال |
| `referral_events` | دعوت |
| `audit_logs` | لاگ ادمین (کم‌استفاده) |

RLS: کاربر ردیف خودش را می‌بیند؛ ادمین همه را. `market_prices` خواندنی عمومی. کاربر مجاز به **update کیف خودش** است — این برای سندباکس لازم است اما برای تولید خطرناک است (باید به RPC اتمی منتقل شود).

تریگر `handle_new_user`: روی `auth.users` insert → profile + wallet خالی.

---

## ۱۱. APIها

| متد | مسیر | توضیح |
|---|---|---|
| POST | `/api/auth/phone-login` | OTP سندباکس → سشن |
| GET | `/api/market/price` | قیمت لایو |
| GET | `/api/market/history` | نمودار |
| GET | `/api/commerce/settings` | کارمزد عمومی |
| GET | `/api/commerce/plan` | پلن کاربر + کد رفرال + KYC |
| POST | `/api/commerce/plus/activate-sandbox` | فعال‌سازی پلاس |
| POST | `/api/referral/apply` | اعمال کد دعوت |
| GET/PUT | `/api/admin/commerce-settings` | تنظیمات درآمد |
| GET/POST | `/api/cron/revenue` | DCA + auto-buy |

معامله، واریز، برداشت، تحویل **API سروری ندارند**؛ از کلاینت به جداول می‌روند.

---

## ۱۲. نقشه مسیرها

### بازاریابی `/`

هیرو برند «گرم»، قیمت لایو سه فلز، امکانات، آمار، موکاپ اپ، خبرنامه، فوتر. بدون نام رقبا.

### محصول `/app/*`

| مسیر | کار |
|---|---|
| `/app/dashboard` | دارایی کل + میانبر |
| `/app/buy` `/app/sell` | معامله با تب فلز |
| `/app/market` | قیمت، نمودار، هشدار |
| `/app/portfolio` | PnL سه‌فلزی |
| `/app/wallet` | واریز/برداشت |
| `/app/transactions/[id]` | رسید |
| `/app/goals` | اهداف |
| `/app/scheduled-purchases` | DCA |
| `/app/delivery` | تحویل طلا |
| `/app/trust` | مرکز اعتماد نمایشی |
| `/app/support` | تیکت |
| `/app/profile/*` | KYC، شبا، امنیت، نشست، مدارک، رضایت |

ناوبری: [`lib/app/navigation.ts`](../lib/app/navigation.ts) — دسکتاپ سایدبار راست، موبایل bottom nav.

### ادمین `/admin/*`

داشبورد، کاربران، کیف‌ها (طلا/نقره/مس)، تراکنش‌ها، رفرال، KYC، بازار، اهداف، تحویل، پشتیبانی، تنظیمات کارمزد.

اکثر صفحات **فقط خواندنی** هستند.

---

## ۱۳. واحدها و قراردادهای مالی

| مفهوم | قرارداد |
|---|---|
| نمایش پول | تومان |
| ذخیره ریال در DB | فیلد `*_toman` ولی نام‌گذاری تاریخی گاهی `rial` در استور کلاینت |
| وزن | میلی‌گرم integer؛ UI گرم با ۳ رقم اعشار |
| قیمت | تومان / گرم |
| کارمزد خرید | از مبلغ پرداختی کسر می‌شود سپس وزن محاسبه می‌شود |
| کارمزد فروش | از ارزش ناخالص کسر می‌شود |

**هشدار:** محاسبات با `number` جاوااسکریپت و `Math.floor` است. برای تولید باید bigint / decimal و ledger دوطرفه جایگزین شود.

---

## ۱۴. امنیت (وضعیت فعلی)

| موضوع | وضعیت |
|---|---|
| OTP واقعی / شاهکار | نیست — کد ثابت عمومی |
| رمز موبایل | قطعی از pepper (قابل بازسازی اگر pepper لو برود) |
| گیت `/app` سروری | نیست |
| Quote lock / idempotency معامله | نیست |
| کاربر می‌تواند wallet را مستقیم update کند | بله (سیاست RLS) |
| PIN معامله / 2FA | UI امنیتی هست؛ PIN اجباری نیست |
| Cron | Bearer `CRON_SECRET` |
| Service role | فقط سرور (`lib/supabase/admin.ts`) |
| اسپرد خرید/فروش جدا از کارمزد | نیست |

---

## ۱۵. محیط و استقرار

متغیرها (`.env.example`):

```
NEXT_PUBLIC_APP_MODE
NEXT_PUBLIC_DEMO_OTP
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
PHONE_AUTH_PEPPER
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

دیپلوی: `vercel deploy --prod`. گاهی لازم است alias دستی روی `geram.vercel.app`.

مایگریشن جدید را باید در SQL Editor سوپابیس اجرا کرد؛ اپ بدون ستون‌های نقره/مس با fallback طلا-only سینک می‌کند.

---

## ۱۶. آنچه هست در برابر آنچه برای تولید لازم است

| قابلیت | سندباکس امروز | تولید |
|---|---|---|
| ورود موبایل | OTP ثابت | SMS + رمز عبور |
| KYC | شبیه‌سازی | شاهکار + تأیید ادمین؛ گیت قبل از معامله |
| قیمت | TGJU لایو | + اسپرد + قفل quote |
| خرید/فروش | کلاینت | API اتمی + ledger |
| واریز | جعلی | درگاه بانکی، کارت به‌نام کاربر |
| برداشت | صف نمایشی | پایا/ساتنا |
| تحویل | طلا دمو | سه فلز + هزینه ضرب/حمل |
| انتقال P2P | نیست | طبق سقف AML |
| DCA / هشدار | طلا | هر فلز |
| ادمین | مشاهده + کارمزد | تسویه، KYC، توقف بازار |
| PWA | manifest | SW + پوش |

---

## ۱۷. نقاط ورود کد (مرجع سریع)

| موضوع | فایل |
|---|---|
| استور معامله | `lib/app/demo-store.tsx` |
| سینک DB | `lib/db/platform-sync.ts` |
| قیمت | `lib/market/price-provider.ts` |
| کارمزد | `lib/commerce/fees.ts` |
| کرون | `lib/commerce/cron-jobs.ts` |
| فون لاگین | `lib/db/phone-auth.ts` |
| شِل اپ | `components/app/AppShell.tsx` |
| لندینگ قیمت لایو | `components/home/LiveMetalsSection.tsx` |

---

## ۱۸. حساب‌های سندباکس

- کاربر: هر `09xxxxxxxxx` + OTP `123456`
- ادمین: کاربر با `profiles.role='admin'` (seed در `supabase/seed_admin.sql`)

---

*این سند وضعیت کد را توصیف می‌کند، نه وعده محصول نهایی. برای نقشه تولید به پلن حلقه احراز → شارژ → معامله → برداشت مراجعه شود.*
