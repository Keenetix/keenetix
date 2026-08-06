"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { WordTapestry } from "@/components/word-tapestry";
import { SITE } from "@/lib/site";
type Invite = { email: string; role: string; workspaceName: string; organizationName: string; needsAccount: boolean };
export function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    void (async () => {
      const response = await fetch(`/api/workspace/invites/accept?token=${encodeURIComponent(token)}`);
      const data = await response.json() as { invite?: Invite; error?: string };
      if (response.ok && data.invite) setInvite(data.invite); else setError(data.error ?? "This invite is invalid or has expired.");
      setLoading(false);
    })();
  }, [token]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/workspace/invites/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name: form.get("name"), password: form.get("password") }) });
    const result = await response.json() as { error?: string };
    setSubmitting(false);
    if (response.ok) router.push("/dashboard"); else setError(result.error ?? "Unable to accept this invite.");
  };
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <a href={SITE.url}><KeenetixLogo /></a>
        <p className="section-label">Workspace invite</p>
        <h1>Join the<br /><em>workspace.</em></h1>
        {loading && <p className="auth-copy">Checking your invite…</p>}
        {!loading && invite && <>
          <p className="auth-copy">You&apos;ve been invited to join <b>{invite.organizationName} / {invite.workspaceName}</b> as {invite.role} ({invite.email}).</p>
          <form onSubmit={submit}>
            {invite.needsAccount && <label>Full name<input name="name" required placeholder="Ada Lovelace" /></label>}
            {invite.needsAccount && <label>Password<input name="password" type="password" required minLength={8} placeholder="••••••••" /></label>}
            {error && <p className="form-error">{error}</p>}
            <button className="button button-coral" disabled={submitting}>{submitting ? "Joining…" : "Accept invite"}</button>
          </form>
        </>}
        {!loading && !invite && <p className="form-error">{error}</p>}
        <p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p>
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
