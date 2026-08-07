# گرم (Gram)

پلتفرم خرید، نگهداری و پس‌انداز طلای واقعی برای کاربران ایرانی.

## وضعیت فعلی

- لندینگ مارکتینگ در `/` (دست‌نخورده از نظر طراحی)
- فونداسیون اپلیکیشن احراز هویت‌شده در `/app/*` (فاز ۱)
- ورود سندباکس در `/auth/login`

## اجرا

```bash
npm install
npm run dev
```

- لندینگ: [http://localhost:3000](http://localhost:3000)
- ورود سندباکس: [http://localhost:3000/auth/login](http://localhost:3000/auth/login)

### حساب دمو

1. هر شماره معتبر `09xxxxxxxxx`
2. کد OTP سندباکس: `123456`

## معماری

جزئیات در:

- `docs/current-architecture.md`
- `docs/architecture/phase-0-audit.md`
- `docs/architecture/phase-1-foundation.md`

## نکات مهم

- فعلاً حالت **DEMO / SANDBOX** است؛ عملیات مالی واقعی وجود ندارد.
- داده‌های داشبورد با نشان «داده نمایشی» علامت‌گذاری شده‌اند.
- دفتر کل، خرید/فروش واقعی و ادمین در فازهای بعدی پیاده می‌شوند.
