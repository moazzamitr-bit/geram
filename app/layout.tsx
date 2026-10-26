import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://geram.co";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "گرم | طلا، نقره و مس در یک کیف‌پول",
    template: "%s | گرم",
  },
  description:
    "خرید و فروش آنلاین طلا، نقره و مس با قیمت لایو، کارمزد شفاف و بدون اجرت ساخت.",
  applicationName: "گرم",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/favicon-32.png?v=2", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    // Cream status bar everywhere so the installed app looks seamless.
    statusBarStyle: "default",
    title: "گرم",
  },
  // Next emits mobile-web-app-capable. Older iOS still reads the apple- prefix.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "گرم | طلا، نقره و مس در یک کیف‌پول",
    description:
      "خرید و فروش آنلاین طلا، نقره و مس با قیمت لایو، کارمزد شفاف و بدون اجرت ساخت.",
    locale: "fa_IR",
    type: "website",
    images: [{ url: "/brand/logo.png", width: 528, height: 525, alt: "گرم" }],
  },
};

export const viewport: Viewport = {
  // Cream browser chrome / status bar matching the app background (#faf8f5).
  // Keep in sync with manifest theme_color and /app viewport.
  themeColor: "#FAF8F5",
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
    <html lang="fa" dir="rtl">
      <head>
        {/* Dana (Persian digits) from /public/fonts, defined once in globals.css. */}
        <link rel="preload" href="/fonts/DanaFaNum-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-[100] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#0A0C0E]"
        >
          پرش به محتوای اصلی
        </a>
        <RegisterServiceWorker />
        <GoogleAnalytics />
        {/* AuthProvider is mounted under /auth and /app. Marketing pages do
            not read the session, and the Supabase browser client is large. */}
        {children}
      </body>
    </html>
  );
}
