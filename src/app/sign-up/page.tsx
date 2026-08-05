import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Create workspace" };
export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
