import { Suspense } from "react";
import { AuthView } from "@/modules/auth/login-view";

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <AuthView mode="signup" />
    </Suspense>
  );
}
