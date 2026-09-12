# گرم (Geram) — AI Handoff

**تاریخ:** 2026-09-12  
**مخاطب:** هوش مصنوعی / توسعه‌دهنده بعدی  
**هدف:** تصویر دقیق از آنچه تا امروز ساخته شده، چه چیزهایی دمو است، و چه چیزی هنوز واقعی نیست.

---

## 1) یک‌خطی محصول

گرم یک پلتفرم فارسی RTL برای **خرید، نگهداری و پس‌انداز طلا** است. الان در حالت **DEMO / SANDBOX** است: ظاهر و جریان کاربری تقریباً کامل است، ولی پول واقعی، درگاه پرداخت، OTP واقعی، KYC واقعی و دفترکل حسابداری هنوز وجود ندارد.

- مارکتینگ: `https://geram.vercel.app` (و لوکال `http://localhost:3000`)
- ورود سندباکس: `/auth/login`
- اپ کاربر: `/app/*`
- پنل ادمین: `/admin/*`
- بک‌اند دیتا/آث: **Supabase** پروژه `geram` (`wlxlobhetjbrhbfpsmzp`)

---

## 2) استک

| لایه | انتخاب |
|---|---|
| Framework | Next.js 15 (App Router) + Turbopack |
| UI | React 19, TypeScript, Tailwind v4, Vazirmatn, RTL |
| Auth/DB | Supabase (Postgres + GoTrue) — `@supabase/ssr` + `@supabase/supabase-js` |
| Validation | Zod |
| Charts | recharts |
| Motion | gsap (لندینگ)، motion (اپ) |
| Deploy | Vercel + GitHub Actions |
| تست | ندارد (Jest/Playwright/…) |

پکیج‌منیجر: npm. مونوریپو نیست. Nest/Prisma/Redis نیست.

---

## 3) وضعیت محیط‌ها (سپتامبر ۲۰۲۶)

### لوکال
- با `.env.local` + `npm run dev` بالا می‌آید.
- لاگین سندباکس بعد از فیکس‌های محلی کار می‌کند.

### پروداکشن (`geram.vercel.app`)
- سایت و صفحات بالا هستند (HTTP 200).
- **لاگین هنوز باگ دارد** تا وقتی فیکس `phone-auth` دیپلوی نشود: خطای `Phone logins are disabled`.
- Supabase بعد از pause دوباره restore شده و `ACTIVE_HEALTHY` است.

### تغییرات لوکال که هنوز commit/deploy نشده‌اند
1. `lib/db/phone-auth.ts` — اگر Phone Auth خاموش باشد، به جای پرتاب خطا روی نتیجه email می‌ماند تا signup/service-role ادامه پیدا کند.
2. `supabase/migrations/20260912193000_auto_confirm_sandbox_phone_users.sql` — ایمیل‌های `p*@geram.vercel.app` را auto-confirm می‌کند (این migration روی DB لوکال/remote با MCP اعمال شده؛ فایل در ریپو untracked است).

---

## 4) معماری ذهنی

```
/ (مارکتینگ دست‌نخورده از نظر طراحی)
   │
   ├─ /auth/login  ── SANDBOX OTP ──► Supabase session
   ├─ /auth/onboarding
   │
   ├─ /app/*       ── DemoStore (کلاینت) ⇄ platform-sync (upsert با RLS)
   ├─ /admin/*     ── خواندن DB + تنظیمات کارمزد
   └─ /api/*       ── auth، قیمت، commerce، referral، cron
```

**قانون محصول (مطلوب):** سرور/Postgres مرجع مالی است؛ مرورگر مرجع مالی نیست.

**واقعیت فعلی کد:** خرید/فروش/واریز در UI از `demo-store` روی کلاینت محاسبه و بعد به جدول‌ها sync می‌شود. یعنی در سندباکس، کلاینت عملاً شبیه‌ساز است و DB آینه است — نه دفترکل واقعی.

---

## 5) نقشه مسیرها

### عمومی / احراز هویت
| مسیر | کار |
|---|---|
| `/` | لندینگ مارکتینگ (Hero، فیچرها، GSAP، RTL طلایی) |
| `/auth/login` | ورود با موبایل + OTP سندباکس |
| `/auth/onboarding` | آنبوردینگ بعد از ورود |

### اپ کاربر `/app/*`
| مسیر | کار |
|---|---|
| `/app` | ریدایرکت به داشبورد |
| `/app/dashboard` | موجودی و میانبرها (نشان «داده نمایشی») |
| `/app/buy` | خرید طلا (شبیه‌سازی کلاینت) |
| `/app/sell` | فروش طلا (شبیه‌سازی کلاینت) |
| `/app/market` | قیمت زنده + نمودار + هشدار قیمت |
| `/app/portfolio` | دارایی و PnL |
| `/app/wallet` | کیف تومان (واریز/برداشت UI) |
| `/app/transactions` | لیست تراکنش‌ها |
| `/app/transactions/[id]` | جزئیات + تایم‌لاین |
| `/app/goals` / `new` / `[id]` | اهداف پس‌انداز |
| `/app/scheduled-purchases` | خرید زمان‌بندی‌شده / DCA |
| `/app/delivery` / `new` / `[id]` | درخواست تحویل فیزیکی |
| `/app/trust` | مرکز اعتماد (محتوای نمایشی) |
| `/app/notifications` | اعلان‌ها |
| `/app/support` / `[id]` | تیکت پشتیبانی |
| `/app/profile` | پروفایل + کد معرف |
| `/app/profile/kyc` | فرم KYC سندباکس |
| `/app/profile/bank-accounts` | شبا |
| `/app/profile/documents` | رسیدها (نمایشی) |
| `/app/profile/security` | PIN/امنیت (نمایشی) |
| `/app/profile/sessions` | نشست‌ها (هاردکد دمو) |
| `/app/profile/consents` | رضایت‌ها (لوکال دمو) |

### ادمین `/admin/*`
| مسیر | کار |
|---|---|
| `/admin/login` | ورود ایمیل/رمز؛ نقش `profiles.role = admin` |
| `/admin` | نمای کلی شمارنده‌ها |
| `/admin/users` | کاربران |
| `/admin/wallets` | موجودی‌ها |
| `/admin/transactions` | تراکنش‌ها |
| `/admin/referrals` | رویدادهای معرف |
| `/admin/kyc` | صف KYC |
| `/admin/market` | قیمت‌ها |
| `/admin/goals` | اهداف |
| `/admin/delivery` | تحویل‌ها |
| `/admin/support` | پشتیبانی |
| `/admin/settings` | کارمزد / Plus / referral + سلامت DB |

Middleware فقط برای `/admin/*` سشن چک می‌کند (به‌جز login). چک نقش ادمین در صفحه/API است، نه middleware.

### API
| مسیر | کار |
|---|---|
| `POST /api/auth/phone-login` | OTP سندباکس → کاربر تلفنی → session tokens |
| `GET /api/market/price` | قیمت طلا ۱۸ عیار (TGJU) + کش؛ `?persist=1` با service role |
| `GET /api/market/history` | تاریخچه نمودار |
| `GET /api/commerce/settings` | تنظیمات عمومی کارمزد/Plus/referral |
| `GET /api/commerce/plan` | پلن کاربر + کد معرف |
| `POST /api/commerce/plus/activate-sandbox` | فعال‌سازی رایگان Plus ۳۰ روزه (سندباکس) |
| `GET\|PUT /api/admin/commerce-settings` | تنظیمات ادمین |
| `POST /api/referral/apply` | اعمال کد دعوت → `referral_events` با وضعیت PENDING |
| `GET\|POST /api/cron/revenue` | کرون DCA + خرید هشدار قیمت (`CRON_SECRET`) |

کرون Vercel: روزانه `0 6 * * *` روی `/api/cron/revenue`.

---

## 6) ماتریس فیچر (واقعی در برابر دمو)

| حوزه | وضعیت | توضیح |
|---|---|---|
| لندینگ | ✅ تولید | طراحی حفظ‌شده |
| Auth موبایل | ✅ سندباکس | OTP ثابت `123456`؛ SMS واقعی نیست |
| داشبورد و ناوبری اپ | ✅ UI کامل | داده هیبرید دمو/سوپابیس |
| خرید/فروش | ⚠️ شبیه‌سازی | کلاینت محاسبه می‌کند؛ بدون درگاه |
| کیف پول تومان | ⚠️ شبیه‌سازی | واریز/برداشت واقعی نیست |
| قیمت بازار | ✅ نسبتاً زنده | اسکrape/منبع TGJU + fallback دمو |
| پورتفویو / تراکنش‌ها | ✅ UI + sync | نه دفترکل دوطرفه |
| اهداف پس‌انداز | ✅ UI + persist | |
| DCA / خرید زمان‌بندی | ✅ UI + کرون سرور | کرون با service role موجودی را عوض می‌کند |
| هشدار قیمت / auto-buy | ✅ جزئی | کرون سفارش هشدار را پردازش می‌کند |
| تحویل فیزیکی | ⚠️ سندباکس | CRUD درخواست؛ لجستیک واقعی نیست |
| پشتیبانی | ✅ سندباکس | تیکت/پیام روی جداول Supabase |
| KYC | ⚠️ دمو | فرم + وضعیت؛ بدون سرویس هویتی |
| معرف / Plus | ⚠️ ناقص | کد و رویداد PENDING؛ پرداخت پاداش خودکار نیست |
| ادمین | ✅ خواندن + تنظیمات | نه workflow کامل ops/RBAC سخت |
| Trust / Sessions / Consents / Security | ⚠️ دمو | عمدتاً UI یا هاردکد |
| پرداخت / حضانت طلا / تسویه | ❌ | ساخته نشده |
| دفترکل (ledger) | ❌ | جدول ledger نیست |
| تست خودکار | ❌ | |

---

## 7) مدل داده (Supabase)

### هسته (`supabase/migrations/20260808120000_gram_core.sql`)
- `profiles` — phone, email, names, `kyc_status`, `role` (`user`|`admin`), `onboarding_done`
- `wallets` — `gold_mg`, `toman_available`, `toman_pending`, `avg_buy_price_toman` (۱:۱ با پروفایل)
- `bank_accounts`
- `transactions` — type, amounts, fee, status, timeline jsonb
- `goals`
- `scheduled_purchases`
- `delivery_requests`
- `support_tickets` / `support_messages`
- `notifications`
- `market_prices`
- `price_alerts`
- `audit_logs`

Trigger ثبت‌نام: `handle_new_user` → ساخت profile + wallet.  
RLS روی جداول هسته فعال است.  
`is_admin()` از روی `profiles.role`.

### کیف پول کلاینت (`20260808121000_wallets_update_own.sql`)
کاربر authenticated می‌تواند wallet خودش را UPDATE/INSERT کند — این برای sync کلاینت لازم شده و با «مرجع مالی فقط سرور» در تضاد است.

### درآمد / Plus / معرف (`20260810120000_revenue_features.sql`)
- فیلدهای پلن و referral روی `profiles`
- `platform_settings` (JSON کارمزد/Plus/referral)
- `referral_events`
- `price_alert_orders`
- فیلدهای DCA و auto_buy

### سندباکس auth (`20260912193000_…` — محلی)
auto-confirm برای ایمیل‌های `p%@geram.vercel.app`.

---

## 8) احراز هویت موبایل (سندباکس)

جریان:
1. کاربر شماره `09xxxxxxxxx` می‌دهد.
2. OTP باید برابر `NEXT_PUBLIC_DEMO_OTP` یا پیش‌فرض `123456` باشد.
3. سرور `ensurePhoneUser`:
   - ایمیل مصنوعی: `p{digits}@geram.vercel.app`
   - پسورد: `gram-{pepper}-{digits}`
   - pepper: `PHONE_AUTH_PEPPER` → وگرنه ۲۴ کاراکتر اول service role → وگرنه `gram-dev-pepper`
   - E.164: `+98…`
4. اگر `SUPABASE_SERVICE_ROLE_KEY` باشد: `admin.createUser` با confirm، بعد sign-in.
5. اگر نباشد: `signUp` با anon + sign-in (نیاز به confirm ایمیل).
6. API توکن‌ها را برمی‌گرداند؛ کلاینت `setSession` می‌کند.

بدون env سوپابیس: ورود کاملاً localStorage دمو.

ادمین: ایمیل/رمز + نقش admin در `profiles` (نمونه شناخته‌شده در UI: `admin@geram.ir`).

---

## 9) متغیرهای محیطی

| متغیر | نقش |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ضروری برای حالت live |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ضروری برای حالت live |
| `SUPABASE_SERVICE_ROLE_KEY` | کرون، persist قیمت، provisioning مطمئن کاربر |
| `PHONE_AUTH_PEPPER` | ثبات پسورد کاربران تلفنی |
| `NEXT_PUBLIC_DEMO_OTP` | OTP سندباکس (پیش‌فرض 123456) |
| `CRON_SECRET` | محافظت `/api/cron/revenue` |
| `NEXT_PUBLIC_APP_MODE` | در `.env.example` هست؛ در کد عملاً استفاده نمی‌شود |

سوییچ live/demo واقعی: وجود URL+anon (`hasSupabaseEnv` / `isSupabaseConfigured`).

---

## 10) ساختار ریپو (کلیدی)

```
app/                 # صفحات + API routes
components/          # UI مارکتینگ و اپ
lib/
  auth/              # AuthProvider، سشن دمو/لایو
  db/                # phone-auth، queryها
  supabase/          # client / server / admin
  commerce/          # تنظیمات کارمزد و پلن
  …                  # demo-store / platform-sync و …
supabase/migrations/ # اسکمای Postgres
docs/                # معماری فاز ۰/۱ (نسبت به کد فعلی قدیمی‌اند)
scripts/             # setup env پروداکشن
middleware.ts        # گارد /admin
vercel.json          # کرون روزانه
```

مستندات `docs/current-architecture.md` و phase-0/1 مربوط به زمانی‌اند که فقط لندینگ بوده؛ **کد الان خیلی جلوتر است**. این فایل handoff مرجع فعلی است.

---

## 11) قوانین غیرقابل‌مذاکره محصول (برای توسعه بعدی)

1. **پول واقعی نساز** مگر با درگاه/لجر/تسویه صریح.
2. هدف نهایی: **Postgres مرجع مالی** باشد؛ mutation کیف از مرورگر باید حذف شود.
3. خرید/فروش واقعی باید پشت quote سروری + ledger دوطرفه برود (فاز ۲ در docs، هنوز پیاده نشده).
4. لندینگ `/` از نظر طراحی دست‌نخورده بماند مگر درخواست صریح.
5. UI فارسی RTL و زبان برند (طلا/تیره) حفظ شود.

---

## 12) بدهی فنی / کار بعدی پیشنهادی

### فوری
- [ ] Commit + deploy فیکس `phone-auth` تا لاگین پروداکشن درست شود
- [ ] اطمینان از وجود `SUPABASE_SERVICE_ROLE_KEY` و `PHONE_AUTH_PEPPER` و `CRON_SECRET` در Vercel
- [ ] نگه داشتن migration auto-confirm در pipeline

### فاز بعدی واقعی (هنوز نیست)
- [ ] Ledger دوطرفه + mutation فقط سرور
- [ ] OTP واقعی (SMS)
- [ ] درگاه پرداخت تومان
- [ ] KYC provider
- [ ] پرداخت پاداش referral
- [ ] تست‌ها (unit/e2e)
- [ ] RBAC سخت‌تر ادمین در middleware

---

## 13) دستورهای سریع

```bash
npm install
cp .env.example .env.local   # پر کردن کلیدها
npm run dev
```

ورود سندباکس:
1. برو به `/auth/login`
2. هر شماره معتبر `09xxxxxxxxx`
3. OTP: `123456`

ادمین: `/admin/login` (نیاز به کاربر با `role=admin` در Supabase).

---

## 14) خلاصه برای مدل بعدی

اگر فقط یک پاراگراف بخواهی:

> گرم یک اپ Next.js 15 + Supabase فارسی برای طلاست. لندینگ، اپ کاربر کامل، ادمین، قیمت زنده، اهداف، DCA کرون، پشتیبانی و تحویل سندباکس پیاده شده‌اند. احراز هویت موبایل با OTP ثابت سندباکس و ایمیل مصنوعی است. خرید/فروش هنوز شبیه‌سازی کلاینتی است و دفترکل/پرداخت واقعی وجود ندارد. پروداکشن روی Vercel بالاست ولی تا دیپلوی فیکس phone-auth، لاگین سرور خطای Phone logins are disabled می‌دهد.

---

*این سند برای handoff به AI نوشته شده؛ اولویت با واقعیت کد است، نه ادعاهای مارکتینگ یا docs قدیمی فاز ۰.*
