import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import "./globals.css";

// Bundled locally: next/font/google downloads at build time, and Google Fonts
// is unreachable from Iranian servers, which broke the production build there.
const vazirmatn = localFont({
  src: "./fonts/Vazirmatn-Variable.woff2",
  weight: "100 900",
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "گرم | طلا، نقره و مس در یک کیف‌پول",
    template: "%s | گرم",
  },
  description:
    "خرید و فروش آنلاین طلا، نقره و مس با قیمت لایو، کارمزد شفاف و بدون اجرت ساخت.",
  applicationName: "گرم",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    // Marketing pages stay dark. /app overrides this to "default" for the cream shell.
    statusBarStyle: "black-translucent",
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
  // Browser chrome on the marketing site. The installed PWA uses the manifest
  // cream theme, and /app overrides themeColor so the logged-in shell matches.
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
        <RegisterServiceWorker />
        {/* AuthProvider is mounted under /auth and /app. Marketing pages do
            not read the session, and the Supabase browser client is large. */}
        {children}
      </body>
    </html>
  );
}
