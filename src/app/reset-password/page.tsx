import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";
export const metadata = { title: "Reset password" };
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
