import {
  Bell,
  HandCoins,
  Headphones,
  Home,
  Landmark,
  LineChart,
  Package,
  PieChart,
  Settings,
  ShieldCheck,
  ShoppingBag,
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
      { label: "خرید فلز", href: "/app/buy", icon: ShoppingBag, accent: true },
      { label: "فروش فلز", href: "/app/sell", icon: HandCoins },
      { label: "بازار", href: "/app/market", icon: LineChart },
    ],
  },
  {
    label: "دارایی",
    items: [
      { label: "پرتفوی", href: "/app/portfolio", icon: PieChart },
      { label: "اهداف", href: "/app/goals", icon: Target },
      { label: "کیف پول", href: "/app/wallet", icon: Wallet },
      { label: "تراکنش‌ها", href: "/app/transactions", icon: Landmark },
      { label: "تحویل فیزیکی", href: "/app/delivery", icon: Package },
    ],
  },
  {
    label: "اعتماد و پشتیبانی",
    items: [
      { label: "مرکز اعتماد", href: "/app/trust", icon: ShieldCheck },
      {
        label: "اعلان‌ها",
        href: "/app/notifications",
        icon: Bell,
        badgeKey: "notifications",
      },
      { label: "پشتیبانی", href: "/app/support", icon: Headphones },
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
  { label: "بازار", href: "/app/market", icon: LineChart },
  { label: "خرید", href: "/app/buy", icon: ShoppingBag, accent: true },
  { label: "اهداف", href: "/app/goals", icon: Target },
  { label: "حساب من", href: "/app/profile", icon: Settings },
];

export const notificationsNav = {
  label: "اعلان‌ها",
  href: "/app/notifications",
  icon: Bell,
};
