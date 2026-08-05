"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AsciiField } from "@/components/ascii-field";
import { KeenetixLogo } from "@/components/keenetix-logo";
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isSignUp = mode === "sign-up";
  const destination = params.get("next")?.startsWith("/") ? params.get("next")! : "/dashboard";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${isSignUp ? "sign-up" : "sign-in"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const result = await response.json() as { error?: string };
    setLoading(false);
    if (response.ok) router.push(destination);
    else setError(result.error ?? "Something went wrong.");
  };
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <Link href="/"><KeenetixLogo /></Link>
        <p className="section-label">{isSignUp ? "Create workspace" : "Welcome back"}</p>
        <h1>{isSignUp ? <>Start building<br /><em>with agents.</em></> : <>Sign in to<br /><em>your workspace.</em></>}</h1>
        <p className="auth-copy">{isSignUp ? "Create an organization and workspace to start issuing commitments to autonomous agents." : "Sign in to manage commitments, agents, and settlements."}</p>
        <form onSubmit={submit}>
          {isSignUp && <label>Full name<input name="name" required placeholder="Ada Lovelace" /></label>}
          {isSignUp && <label>Organization<input name="organization" required placeholder="Acme Inc." /></label>}
          <label>Email<input name="email" type="email" required placeholder="you@company.com" /></label>
          <label>Password<input name="password" type="password" required minLength={8} placeholder="••••••••" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-coral" disabled={loading}>{loading ? "Please wait…" : isSignUp ? "Create workspace" : "Sign in"}</button>
        </form>
        <p className="auth-switch">{isSignUp ? "Already have a workspace?" : "Need a workspace?"} <Link href={isSignUp ? "/sign-in" : "/sign-up"}>{isSignUp ? "Sign in" : "Sign up"}</Link></p>
      </div>
      <div className="auth-aside">
        <AsciiField rows={16} cols={12} className="auth-grid" />
        <div className="auth-mark"><KeenetixLogo compact dark /></div>
      </div>
    </div>
  );
}
