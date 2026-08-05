import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Sign in" };
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}