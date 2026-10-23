import { UserLoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string }>;
}) {
  const params = await searchParams;
  return (
    <UserLoginForm
      initialError={params.error ?? ""}
      initialTab={params.tab === "register" ? "register" : "login"}
    />
  );
}
