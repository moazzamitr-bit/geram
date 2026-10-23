import {
  ArrowLeftRight,
  Bell,
  FileText,
  Headphones,
  Home,
  LineChart,
  Package,
  PieChart,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  accent?: boolean;
  badgeKey?: "notifications";
};

export type AppNavSection = {
  label?: string;
  items: AppNavItem[];
};

export const desktopNavSections: AppNavSection[] = [
  {
    items: [
      { label: "خانه", href: "/app/dashboard", icon: Home },
      { label: "خرید و فروش", href: "/app/buy", icon: ArrowLeftRight },
      { label: "واریز و برداشت", href: "/app/wallet", icon: Wallet },
      { label: "گزارشات", href: "/app/transactions", icon: FileText },
      { label: "دارایی‌های من", href: "/app/portfolio", icon: PieChart },
    ],
  },
  {
    label: "سایر",
    items: [
      { label: "بازار", href: "/app/market", icon: LineChart },
      { label: "اهداف", href: "/app/goals", icon: Target },
      { label: "تحویل", href: "/app/delivery", icon: Package },
      { label: "پشتیبانی", href: "/app/support", icon: Headphones },
      {
        label: "اعلان‌ها",
        href: "/app/notifications",
        icon: Bell,
        badgeKey: "notifications",
      },
    ],
  },
];

/** @deprecated use desktopNavSections */
export const desktopMainNav: AppNavItem[] = desktopNavSections.flatMap((s) => s.items);

export const desktopBottomNav: AppNavItem[] = [
  { label: "تنظیمات", href: "/app/profile", icon: Settings },
];

export const mobileBottomNav: AppNavItem[] = [
  { label: "خانه", href: "/app/dashboard", icon: Home },
  { label: "معامله", href: "/app/buy", icon: ArrowLeftRight },
  { label: "دارایی", href: "/app/portfolio", icon: PieChart },
  { label: "کیف پول", href: "/app/wallet", icon: Wallet },
  { label: "حساب", href: "/app/profile", icon: Settings },
];

export const notificationsNav = {
  label: "اعلان‌ها",
  href: "/app/notifications",
  icon: Bell,
};
