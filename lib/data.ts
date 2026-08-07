export const navItems = [
  { label: "خانه", href: "#home" },
  { label: "امکانات", href: "#features" },
  { label: "قیمت طلا", href: "#price" },
  { label: "باشگاه گرم", href: "#club" },
  { label: "راهنما", href: "#guide" },
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
    id: "targeted-savings",
    title: "پس‌انداز هدفمند",
    description: "برای اهداف مالی خود برنامه‌ریزی کنید و قدم‌به‌قدم به آن‌ها برسید.",
    icon: "target",
  },
  {
    id: "physical-delivery",
    title: "تحویل فیزیکی",
    description: "طلای خود را در وزن‌های مختلف به‌صورت فیزیکی دریافت کنید.",
    icon: "package",
  },
  {
    id: "liquidity",
    title: "نقدشوندگی سریع",
    description: "در چند ثانیه دارایی خود را به ریال تبدیل کنید.",
    icon: "zap",
  },
  {
    id: "security",
    title: "امنیت بی‌نظیر",
    description: "با استانداردهای امنیتی سطح بالا از دارایی شما محافظت می‌کنیم.",
    icon: "lock",
  },
  {
    id: "smart-invest",
    title: "سرمایه‌گذاری هوشمند",
    description: "با ابزارهای تحلیلی، تصمیم‌های دقیق‌تری برای دارایی خود بگیرید.",
    icon: "chart",
  },
] as const;

export const metrics = [
  {
    value: "۱٬۲۰۰٬۰۰۰+",
    label: "کاربر فعال",
  },
  {
    value: "۲.۵+ تن",
    label: "طلای معامله‌شده",
  },
  {
    value: "۹۸٪+",
    label: "رضایت کاربران",
  },
  {
    value: "۲۴/۷",
    label: "پشتیبانی",
  },
] as const;

export const footerGroups = [
  {
    title: "دسترسی سریع",
    links: [
      { label: "خرید طلا", href: "#" },
      { label: "فروش طلا", href: "#" },
      { label: "قیمت طلا", href: "#price" },
      { label: "کارمزدها", href: "#" },
      { label: "سوالات متداول", href: "#" },
    ],
  },
  {
    title: "امکانات",
    links: [
      { label: "پس‌انداز هدفمند", href: "#features" },
      { label: "تحویل فیزیکی", href: "#features" },
      { label: "باشگاه گرم", href: "#club" },
      { label: "اپلیکیشن موبایل", href: "#app" },
      { label: "امنیت", href: "#features" },
    ],
  },
  {
    title: "شرکت",
    links: [
      { label: "درباره ما", href: "#about" },
      { label: "مجوزها و تاییدیه‌ها", href: "#" },
      { label: "وبلاگ", href: "#" },
      { label: "فرصت‌های شغلی", href: "#" },
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
