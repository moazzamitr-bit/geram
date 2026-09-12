import {
  Headphones,
  Landmark,
  LayoutDashboard,
  LineChart,
  Package,
  Settings,
  ShieldCheck,
  Target,
  Users,
  Wallet,
  Gift,
  Vault,
  Boxes,
  ChartPie,
  TriangleAlert,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
};

export const adminNav: AdminNavItem[] = [
  {
    label: "داشبورد",
    href: "/admin",
    icon: LayoutDashboard,
    hint: "نمای کلی کاربران، موجودی و تیکت‌ها",
  },
  {
    label: "خزانه‌داری",
    href: "/admin/treasury",
    icon: Vault,
    hint: "موجودی فیزیکی، پوشش و WAC",
  },
  {
    label: "انبار فلزات",
    href: "/admin/inventory",
    icon: Boxes,
    hint: "لات‌های خرید فیزیکی",
  },
  {
    label: "سود و زیان",
    href: "/admin/pnl",
    icon: ChartPie,
    hint: "اسپرد، کارمزد و COGS",
  },
  {
    label: "ریسک",
    href: "/admin/risk",
    icon: TriangleAlert,
    hint: "پوشش، سناریو و شوک قیمت",
  },
  {
    label: "تأمین فلز",
    href: "/admin/procurement",
    icon: ShoppingCart,
    hint: "پیشنهاد خرید با تأیید ادمین",
  },
  {
    label: "کاربران",
    href: "/admin/users",
    icon: Users,
    hint: "لیست ثبت‌نام‌شده‌ها و نقش‌ها",
  },
  {
    label: "کیف پول‌ها",
    href: "/admin/wallets",
    icon: Wallet,
    hint: "موجودی طلا و تومان هر نفر",
  },
  {
    label: "تراکنش‌ها",
    href: "/admin/transactions",
    icon: Landmark,
    hint: "خرید، فروش، واریز و برداشت",
  },
  {
    label: "رفرال",
    href: "/admin/referrals",
    icon: Gift,
    hint: "پاداش دعوت دوستان",
  },
  {
    label: "احراز هویت",
    href: "/admin/kyc",
    icon: ShieldCheck,
    hint: "صف بررسی مدارک KYC",
  },
  {
    label: "بازار و قیمت",
    href: "/admin/market",
    icon: LineChart,
    hint: "قیمت مرجع طلای ۱۸ عیار",
  },
  {
    label: "اهداف",
    href: "/admin/goals",
    icon: Target,
    hint: "اهداف پس‌انداز کاربران",
  },
  {
    label: "تحویل فیزیکی",
    href: "/admin/delivery",
    icon: Package,
    hint: "درخواست طلای فیزیکی",
  },
  {
    label: "پشتیبانی",
    href: "/admin/support",
    icon: Headphones,
    hint: "تیکت‌های کاربران",
  },
  {
    label: "تنظیمات",
    href: "/admin/settings",
    icon: Settings,
    hint: "کارمزد، Plus و اتصال DB",
  },
];
