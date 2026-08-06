"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { WordTapestry } from "@/components/word-tapestry";
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get("error") ?? "");
  const isSignUp = mode === "sign-up";
  const destination = params.get("next")?.startsWith("/") ? params.get("next")! : "/dashboard";
  const oauthHref = (provider: "google" | "github") => `/api/auth/${provider}?next=${encodeURIComponent(destination)}`;
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
        <div className="oauth-row">
          <a className="oauth-button" href={oauthHref("google")}><GoogleMark />Continue with Google</a>
          <a className="oauth-button" href={oauthHref("github")}><GithubMark />Continue with GitHub</a>
        </div>
        <div className="auth-divider"><span>or</span></div>
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
        <WordTapestry word="keenetix" rows={44} />
        <div className="tapestry-overlay">
          <p className="tapestry-caption">KEENETIX / <span>a kinetic tapestry of the network</span></p>
          <span className="tapestry-word">keenetix</span>
        </div>
      </div>
    </div>
  );
}
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.85.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.49c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.17-.89-1.17-.72-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.11 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.91.08 2.11.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
    </svg>
  );
}
