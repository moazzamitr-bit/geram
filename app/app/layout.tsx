import { AppShell } from "@/components/app/AppShell";
import { DemoStoreProvider } from "@/lib/app/demo-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoStoreProvider>
      <AppShell>{children}</AppShell>
    </DemoStoreProvider>
  );
}
