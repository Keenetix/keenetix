import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
export const metadata = { title: "Forgot password" };
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
