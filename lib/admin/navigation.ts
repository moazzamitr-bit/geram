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
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const adminNav: AdminNavItem[] = [
  { label: "داشبورد", href: "/admin", icon: LayoutDashboard },
  { label: "کاربران", href: "/admin/users", icon: Users },
  { label: "کیف پول‌ها", href: "/admin/wallets", icon: Wallet },
  { label: "تراکنش‌ها", href: "/admin/transactions", icon: Landmark },
  { label: "احراز هویت", href: "/admin/kyc", icon: ShieldCheck },
  { label: "بازار و قیمت", href: "/admin/market", icon: LineChart },
  { label: "اهداف", href: "/admin/goals", icon: Target },
  { label: "تحویل فیزیکی", href: "/admin/delivery", icon: Package },
  { label: "پشتیبانی", href: "/admin/support", icon: Headphones },
  { label: "تنظیمات", href: "/admin/settings", icon: Settings },
];
