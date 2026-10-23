import { AdminLoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <AdminLoginForm initialError={params.error ?? ""} />;
}
