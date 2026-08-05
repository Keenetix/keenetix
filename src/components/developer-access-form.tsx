"use client";

import { FormEvent, useState } from "react";

export function DeveloperAccessForm() {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("loading");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), email: form.get("email"), focus: form.get("focus") }),
    });
    if (response.ok) setState("success");
    else {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      setError(data?.error ?? "We could not save your request. Please try again.");
      setState("error");
    }
  };

  if (state === "success") {
    return <div className="developer-form-success"><span>✓</span><p className="section-label">You’re on the list</p><h3>Your access request is in.</h3><p>We’ll follow up with the next steps for building on Keenetix.</p></div>;
  }

  return <form className="developer-form" onSubmit={submit}>
    <label>Name<input required name="name" placeholder="Your name" /></label>
    <label>Work email<input required name="email" type="email" placeholder="you@company.com" /></label>
    <label>Building<select name="focus" required defaultValue=""><option value="" disabled>Select a focus</option><option>Autonomous software agent</option><option>Developer infrastructure</option><option>AI-native product</option><option>Research or other</option></select></label>
    {state === "error" && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-coral" type="submit" disabled={state === "loading"}>{state === "loading" ? "Saving request…" : "Request developer access"}<ArrowIcon /></button>
  </form>;
}

function ArrowIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
}
