import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { AuthProvider } from "@/lib/auth/auth-context";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "گرم | طلای واقعی، به ساده‌ترین شکل",
    template: "%s | گرم",
  },
  description:
    "پلتفرم خرید و فروش آنلاین طلا با پشتوانه واقعی، شفافیت کامل و تجربه‌ای مدرن برای مدیریت دارایی.",
  applicationName: "گرم",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/logo.png", sizes: "528x525", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "گرم",
  },
  openGraph: {
    title: "گرم | طلای واقعی، به ساده‌ترین شکل",
    description:
      "پلتفرم خرید و فروش آنلاین طلا با پشتوانه واقعی، شفافیت کامل و تجربه‌ای مدرن برای مدیریت دارایی.",
    locale: "fa_IR",
    type: "website",
    images: [{ url: "/brand/logo.png", width: 528, height: 525, alt: "گرم" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#080B0D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-[100] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#0A0C0E]"
        >
          پرش به محتوای اصلی
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
