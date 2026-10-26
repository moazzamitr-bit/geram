export const navItems = [
  { label: "خانه", href: "#home" },
  { label: "بازار فلزات", href: "#metals" },
  { label: "امکانات", href: "#features" },
  { label: "اپلیکیشن", href: "#app" },
  { label: "درباره ما", href: "#about" },
] as const;

// Only claims the product can back today. Insurance, custody and licence
// badges come back when the contracts/licence actually exist.
export const heroTrustItems = [
  {
    title: "قیمت قطعی",
    caption: "قبل از تأیید، بدون تغییر",
    icon: "shield",
  },
  {
    title: "کارمزد ۰٫۵٪",
    caption: "بدون حداقل کارمزد",
    icon: "badge",
  },
  {
    title: "از ۱۰۰ هزار تومان",
    caption: "حداقل خرید هر سه فلز",
    icon: "vault",
  },
] as const;

export const features = [
  {
    id: "multi-metal",
    title: "طلا، نقره و مس",
    description:
      "سه فلز در یک کیف‌پول — خرید و فروش لحظه‌ای با قیمت لایو بازار آزاد.",
    icon: "chart",
  },
  {
    id: "transparent-fees",
    title: "کارمزد شفاف",
    description:
      "قبل از تأیید، قیمت هر گرم، کارمزد و مقدار نهایی را دقیق می‌بینید.",
    icon: "badge",
  },
  {
    id: "no-making-fee",
    title: "بدون اجرت ساخت",
    description:
      "فقط فلز؛ بدون هزینه ساخت و بدون حاشیه پنهان روی خرید و فروش.",
    icon: "zap",
  },
  {
    id: "targeted-savings",
    title: "اهداف و خرید دوره‌ای",
    description:
      "برای هدف مالی برنامه‌ بریزید و با خرید زمان‌بندی‌شده منظم پس‌انداز کنید.",
    icon: "target",
  },
  {
    id: "firm-quote",
    title: "قیمت قطعی",
    description:
      "قبل از خرید یا فروش، قیمت قطعی با شمارش معکوس می‌گیرید و همان را تأیید می‌کنید.",
    icon: "package",
  },
] as const;

export const metrics = [
  {
    value: "۳ فلز",
    label: "طلا · نقره · مس",
  },
  {
    value: "۳۰ث",
    label: "به‌روزرسانی قیمت",
  },
  {
    value: "۰ اجرت",
    label: "بدون هزینه ساخت",
  },
  {
    value: "۰٫۵٪",
    label: "کارمزد معامله",
  },
] as const;

export const footerGroups = [
  {
    title: "معامله",
    links: [
      { label: "خرید طلا", href: "/app/trade/gold" },
      { label: "خرید نقره", href: "/app/trade/silver" },
      { label: "خرید مس", href: "/app/trade/copper" },
      { label: "بازار فلزات", href: "/app/market" },
      { label: "فروش", href: "/app/trade/gold?side=sell" },
    ],
  },
  {
    title: "امکانات",
    links: [
      { label: "پرتفوی چندفلزی", href: "/app/portfolio" },
      { label: "پس‌انداز خودکار", href: "/app/savings" },
      { label: "سقف تراکنش‌ها", href: "/app/profile/limits" },
      { label: "اپلیکیشن", href: "#app" },
    ],
  },
  {
    title: "شرکت",
    links: [
      { label: "درباره ما", href: "#about" },
      { label: "پشتیبانی", href: "/app/support" },
      { label: "تماس با ما", href: "#contact" },
    ],
  },
] as const;

export const contactInfo = {
  phone: "۰۲۱-۹۱۰۰۹۰۰۰",
  email: "support@gram.ir",
  address: "تهران، خیابان ولیعصر، برج آناهیتا، طبقه ۱۲",
} as const;

