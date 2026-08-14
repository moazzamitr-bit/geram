# گرم (Gram)

پلتفرم خرید و فروش طلا، نقره و مس برای کاربران ایرانی.

## داکیومنت فنی

مرجع کامل معماری، API، دیتابیس، احراز، معامله و شکاف تولید:

- **[docs/technical-platform.md](docs/technical-platform.md)**

آرشیو فازهای اولیه:

- `docs/current-architecture.md`
- `docs/architecture/phase-0-audit.md`
- `docs/architecture/phase-1-foundation.md`

## اجرا

```bash
npm install
npm run dev
```

- لندینگ: [http://localhost:3000](http://localhost:3000)
- ورود سندباکس: [http://localhost:3000/auth/login](http://localhost:3000/auth/login)
- محصول: `/app/*` — ادمین: `/admin/*`

### حساب دمو

1. هر شماره معتبر `09xxxxxxxxx`
2. کد OTP سندباکس: `123456`

## نکات مهم

- فعلاً حالت **DEMO / SANDBOX** است؛ درگاه بانکی، SMS واقعی و دفترکل سروری وجود ندارد.
- قیمت لایو از TGJU می‌آید؛ خرید/فروش روی کلاینت اجرا و در صورت تنظیم بودن Supabase همگام می‌شود.
