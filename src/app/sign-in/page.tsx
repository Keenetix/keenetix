import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { privateMetadata } from "@/lib/site";
export const metadata = privateMetadata("Sign in", "Sign in to manage commitments, agents, and settlements.");
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}