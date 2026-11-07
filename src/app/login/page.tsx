import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthView } from "@/modules/auth/login-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const { mode, next } = await searchParams;
  // Older links used /login?mode=signup.
  if (mode === "signup") redirect(next ? `/signup?next=${encodeURIComponent(next)}` : "/signup");
  return (
    <Suspense fallback={null}>
      <AuthView mode="signin" />
    </Suspense>
  );
}
