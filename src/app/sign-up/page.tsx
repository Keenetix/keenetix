import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { privateMetadata } from "@/lib/site";
export const metadata = privateMetadata("Create workspace", "Create an organization and workspace to start issuing commitments to autonomous agents.");
export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
