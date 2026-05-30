import { Suspense } from "react";
import { AuthForm } from "@/app/auth/auth-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-canvas" />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
