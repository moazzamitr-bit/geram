import { isClosedBetaInactiveAdminPath } from "@/lib/admin/closed-beta";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Bell,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  Flag,
  Gift,
  Headphones,
  Landmark,
  LayoutDashboard,
  LineChart,
  Package,
  Scale,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  Ticket,
  ToggleLeft,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/** Full catalog. Closed-beta nav uses `adminNavGroups`, which drops inactive routes. */
export const adminNavCatalog: AdminNavGroup[] = [
  {
    id: "overview",
    label: "نمای کلی",
    items: [
      { label: "داشبورد", href: "/admin", icon: LayoutDashboard },
      { label: "سلامت عملیات", href: "/admin/health", icon: Activity },
      { label: "حوادث اعتماد", href: "/admin/incidents", icon: AlertTriangle },
      { label: "آمادگی انتشار", href: "/admin/readiness", icon: ClipboardCheck },
    ],
  },
  {
    id: "customers",
    label: "مشتریان",
    items: [
      { label: "کاربران", href: "/admin/users", icon: Users },
      { label: "احراز هویت", href: "/admin/kyc", icon: ShieldCheck },
      { label: "کارت‌ها و شبا", href: "/admin/bank-accounts", icon: Landmark },
      { label: "نشست‌ها و دستگاه", href: "/admin/sessions", icon: Shield },
      { label: "رویدادهای امنیتی", href: "/admin/security", icon: AlertTriangle },
    ],
  },
  {
    id: "financial",
    label: "عملیات مالی",
    items: [
      { label: "معاملات", href: "/admin/trades", icon: Scale },
      { label: "نقل‌قول‌ها", href: "/admin/quotes", icon: Search },
      { label: "واریز", href: "/admin/deposits", icon: Banknote },
      { label: "برداشت تومانی", href: "/admin/withdrawals", icon: CreditCard },
      { label: "دفترکل", href: "/admin/ledger", icon: BookOpen },
      { label: "کیف پول‌ها", href: "/admin/wallets", icon: Wallet },
      { label: "تراکنش‌ها", href: "/admin/transactions", icon: Wallet },
      { label: "موقعیت نقد", href: "/admin/cash", icon: Banknote },
      { label: "تطبیق", href: "/admin/reconciliation", icon: ClipboardCheck },
    ],
  },
  {
    id: "metal",
    label: "عملیات فلز",
    items: [
      { label: "بازار و قیمت", href: "/admin/market", icon: LineChart },
      { label: "خزانه‌داری", href: "/admin/treasury", icon: Warehouse },
      { label: "موجودی / لات", href: "/admin/inventory", icon: Package },
      { label: "تأمین", href: "/admin/procurement", icon: Truck },
      { label: "حضانت", href: "/admin/custody", icon: Shield },
    ],
  },
  {
    id: "product",
    label: "عملیات محصول",
    items: [
      { label: "طرح پس‌انداز", href: "/admin/savings", icon: Flag },
      { label: "هشدار قیمت", href: "/admin/alerts", icon: Bell },
      { label: "معرفی دوستان", href: "/admin/referrals", icon: Gift },
      { label: "گرم پلاس", href: "/admin/plus", icon: Flag },
      { label: "کارت هدیه", href: "/admin/gifts", icon: Gift },
      { label: "برداشت فیزیکی", href: "/admin/delivery", icon: Package },
    ],
  },
  {
    id: "support",
    label: "پشتیبانی",
    items: [
      { label: "تیکت‌ها", href: "/admin/support", icon: Headphones },
      { label: "اعلان‌ها", href: "/admin/notifications", icon: Ticket },
    ],
  },
  {
    id: "control",
    label: "مرکز کنترل",
    items: [
      { label: "کلیدهای اضطراری", href: "/admin/switches", icon: ToggleLeft },
      { label: "شارژ و موجودی", href: "/admin/approvals", icon: ClipboardCheck },
      { label: "وضعیت سرویس‌ها", href: "/admin/providers", icon: Activity },
      { label: "فلگ ویژگی", href: "/admin/flags", icon: Flag },
      { label: "کارمزد و سقف", href: "/admin/settings", icon: Settings },
      { label: "لاگ حسابرسی", href: "/admin/audit", icon: BookOpen },
      { label: "ادمین‌ها و نقش", href: "/admin/admins", icon: Users },
      { label: "تنظیمات سیستم", href: "/admin/system", icon: Settings },
    ],
  },
];

/** Groups shown in the closed-beta admin shell. */
export const adminNavGroups: AdminNavGroup[] = adminNavCatalog
  .map((group) => ({
    ...group,
    items: group.items.filter((item) => !isClosedBetaInactiveAdminPath(item.href)),
  }))
  .filter((group) => group.items.length > 0);

/** Flat list kept for any leftover imports. */
export const adminNav: AdminNavItem[] = adminNavGroups.flatMap((g) => g.items);
