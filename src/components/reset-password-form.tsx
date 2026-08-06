"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { WordTapestry } from "@/components/word-tapestry";
import { SITE } from "@/lib/site";
export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: form.get("password") }) });
    const result = await response.json() as { error?: string };
    setLoading(false);
    if (response.ok) router.push("/sign-in?next=/dashboard");
    else setError(result.error ?? "Unable to reset your password.");
  };
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <a href={SITE.url}><KeenetixLogo /></a>
        <p className="section-label">Reset password</p>
        <h1>Choose a new<br /><em>password.</em></h1>
        {token ? (
          <form onSubmit={submit}>
            <label>New password<input name="password" type="password" required minLength={8} placeholder="••••••••" /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="button button-coral" disabled={loading}>{loading ? "Saving…" : "Reset password"}</button>
          </form>
        ) : <p className="form-error">This link is missing its reset token. Request a new one.</p>}
        <p className="auth-switch">Need a new link? <Link href="/forgot-password">Request one</Link></p>
      </div>
      <div className="auth-aside">
        <WordTapestry word="keenetix" rows={44} />
        <div className="tapestry-overlay">
          <p className="tapestry-caption">KEENETIX / <span>a kinetic tapestry of the network</span></p>
          <span className="tapestry-word">keenetix</span>
        </div>
      </div>
    </div>
  );
}
