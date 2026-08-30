import { Suspense } from "react";
import { AuthForm } from "@/app/(app)/auth/auth-form";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-canvas" />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
