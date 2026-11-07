import { Suspense } from "react";
import { AuthView } from "@/modules/auth/login-view";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AuthView mode="reset" />
    </Suspense>
  );
}
