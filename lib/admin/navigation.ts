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

export const adminNavGroups: AdminNavGroup[] = [
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
      { label: "حساب‌های بانکی", href: "/admin/bank-accounts", icon: Landmark },
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
      { label: "برداشت", href: "/admin/withdrawals", icon: CreditCard },
      { label: "دفترکل", href: "/admin/ledger", icon: BookOpen },
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
      { label: "اهداف", href: "/admin/goals", icon: Target },
      { label: "خرید دوره‌ای", href: "/admin/dca", icon: Flag },
      { label: "هشدار قیمت", href: "/admin/alerts", icon: Bell },
      { label: "رفرال", href: "/admin/referrals", icon: Gift },
      { label: "گرم پلاس", href: "/admin/plus", icon: Flag },
      { label: "تحویل فیزیکی", href: "/admin/delivery", icon: Package },
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
      { label: "تأیید دو مرحله‌ای", href: "/admin/approvals", icon: ClipboardCheck },
      { label: "وضعیت سرویس‌ها", href: "/admin/providers", icon: Activity },
      { label: "فلگ ویژگی", href: "/admin/flags", icon: Flag },
      { label: "کارمزد و سقف", href: "/admin/settings", icon: Settings },
      { label: "لاگ حسابرسی", href: "/admin/audit", icon: BookOpen },
      { label: "ادمین‌ها و نقش", href: "/admin/admins", icon: Users },
      { label: "تنظیمات سیستم", href: "/admin/system", icon: Settings },
    ],
  },
];

/** Flat list kept for any leftover imports. */
export const adminNav: AdminNavItem[] = adminNavGroups.flatMap((g) => g.items);
