import { AppShell } from "@/components/app/AppShell";
import { VerificationGateProvider } from "@/components/app/VerificationGate";
import { DemoStoreProvider } from "@/lib/app/demo-store";
import { AuthProvider } from "@/lib/auth/auth-context";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#F6F4F1",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: "گرم",
    statusBarStyle: "default",
    // Two portrait splash sizes. Other iPhones keep iOS's default blank splash
    // (skipped: 393×852 @3 and older 375×667 devices).
    startupImage: [
      {
        url: "/splash/apple-splash-1170x2532.png?v=2",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/splash/apple-splash-1290x2796.png?v=2",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
    ],
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DemoStoreProvider>
        <VerificationGateProvider>
          <AppShell>{children}</AppShell>
        </VerificationGateProvider>
      </DemoStoreProvider>
    </AuthProvider>
  );
}
