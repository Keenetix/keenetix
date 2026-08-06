"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthAside } from "@/components/auth-aside";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { SITE } from "@/lib/site";
export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email") }) });
    setLoading(false);
    setSent(true);
  };
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <a href={SITE.url}><KeenetixLogo /></a>
        <p className="section-label">Reset password</p>
        <h1>Forgot your<br /><em>password?</em></h1>
        <p className="auth-copy">Enter the email on your account and we&apos;ll send you a link to reset your password.</p>
        {sent ? <p className="auth-copy">If an account exists for that email, a reset link is on its way.</p> : (
          <form onSubmit={submit}>
            <label>Email<input name="email" type="email" required placeholder="you@company.com" /></label>
            <button className="button button-coral" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
          </form>
        )}
        <p className="auth-switch">Remembered it? <Link href="/sign-in">Sign in</Link></p>
      </div>
      <AuthAside />
    </div>
  );
}
