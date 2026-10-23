import { preload } from "react-dom";
import { AuthProvider } from "@/lib/auth/auth-context";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  preload("/brand/logo-mark.webp", { as: "image", fetchPriority: "high" });
  return <AuthProvider>{children}</AuthProvider>;
}
