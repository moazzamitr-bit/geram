export const navItems = [
  { label: "خانه", href: "#home" },
  { label: "بازار فلزات", href: "#metals" },
  { label: "امکانات", href: "#features" },
  { label: "اپلیکیشن", href: "#app" },
  { label: "درباره ما", href: "#about" },
] as const;

export const heroTrustItems = [
  {
    title: "بیمه سراسری",
    caption: "برای دارایی شما",
    icon: "shield",
  },
  {
    title: "پشتوانه واقعی",
    caption: "نگهداری در خزانه معتبر",
    icon: "vault",
  },
  {
    title: "مجوز رسمی",
    caption: "فعالیت در چارچوب قانونی",
    icon: "badge",
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
    id: "physical-delivery",
    title: "تحویل فیزیکی",
    description:
      "در صورت نیاز، دارایی خود را به‌صورت فیزیکی تحویل بگیرید.",
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
    value: "۲۴/۷",
    label: "دسترسی به بازار",
  },
] as const;

export const footerGroups = [
  {
    title: "معامله",
    links: [
      { label: "خرید طلا", href: "/app/buy?instrument=gold18" },
      { label: "خرید نقره", href: "/app/buy?instrument=silver925" },
      { label: "خرید مس", href: "/app/buy?instrument=copper" },
      { label: "بازار فلزات", href: "/app/market" },
      { label: "فروش", href: "/app/sell" },
    ],
  },
  {
    title: "امکانات",
    links: [
      { label: "پرتفوی چندفلزی", href: "/app/portfolio" },
      { label: "پس‌انداز هدفمند", href: "/app/goals" },
      { label: "تحویل فیزیکی", href: "/app/delivery" },
      { label: "اپلیکیشن", href: "#app" },
      { label: "مرکز اعتماد", href: "/app/trust" },
    ],
  },
  {
    title: "شرکت",
    links: [
      { label: "درباره ما", href: "#about" },
      { label: "مجوزها و تاییدیه‌ها", href: "/app/trust" },
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

export const chartData = [
  { label: "۲۱ اردیبهشت", value: 6200000 },
  { label: "۲۲ اردیبهشت", value: 6350000 },
  { label: "۲۳ اردیبهشت", value: 6280000 },
  { label: "۲۴ اردیبهشت", value: 6480000 },
  { label: "۲۵ اردیبهشت", value: 6610000 },
  { label: "۲۶ اردیبهشت", value: 6550000 },
  { label: "۲۷ اردیبهشت", value: 6720000 },
  { label: "۲۸ اردیبهشت", value: 6854000 },
] as const;

export const portfolioChartData = [
  { label: "۱", value: 21000000 },
  { label: "۵", value: 21800000 },
  { label: "۱۰", value: 21500000 },
  { label: "۱۵", value: 22600000 },
  { label: "۲۰", value: 23200000 },
  { label: "۲۵", value: 23800000 },
  { label: "۳۰", value: 24630000 },
] as const;
