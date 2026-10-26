import { redirect } from "next/navigation";

/** Trust centre is hidden until it has real, verifiable content. */
export default function TrustPage() {
  redirect("/app/dashboard");
}
