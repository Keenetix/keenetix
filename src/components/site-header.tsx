"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { KeenetixLogo } from "@/components/keenetix-logo";

const links = [
  { href: "/protocol", label: "Protocol" },
   { href: "/network", label: "Network" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/token", label: "Token" },
  { href: "/developers", label: "Developers" },
  { href: "/docs", label: "Docs" },
];

function ArrowIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
}

function CloseIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccessOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const openAccess = () => {
    setSubmitted(false);
    setError("");
    setMenuOpen(false);
    setAccessOpen(true);
  };

  const submitAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), email: form.get("email"), focus: form.get("focus") }),
    });
    setIsSubmitting(false);
    if (response.ok) setSubmitted(true);
    else {
      const data = await response.json().catch(() => null) as { error?: string } | null;
      setError(data?.error ?? "We could not save your request. Please try again.");
    }
  };

  return (
    <>
      <nav className="nav" aria-label="Main navigation">
        <Link href="/" aria-label="Keenetix home"><KeenetixLogo /></Link>
        <div className="nav-links">
          {links.map((link) => <Link key={link.href} className={pathname === link.href ? "active" : ""} href={link.href}>{link.label}</Link>)}
        </div>
        <div className="nav-actions">
          <Link className={`nav-text-link ${pathname === "/dashboard" ? "active" : ""}`} href="/dashboard">Dashboard</Link>
          <button className="button button-small button-dark" onClick={openAccess}>Request access <ArrowIcon /></button>
        </div>
        <button className="menu-button" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /></button>
      </nav>

      {menuOpen && <div className="mobile-menu">
        {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}
        <button className="button button-dark" onClick={openAccess}>Request access <ArrowIcon /></button>
      </div>}

      {accessOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAccessOpen(false)}>
        <section className="access-modal" role="dialog" aria-modal="true" aria-labelledby="access-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setAccessOpen(false)} aria-label="Close request access dialog"><CloseIcon /></button>
          {submitted ? <div className="success-state"><span className="success-mark">✓</span><p className="section-label">Request received</p><h2>Welcome to the next layer.</h2><p>We’ll be in touch with the next steps for accessing the Keenetix network.</p><button className="button button-dark" onClick={() => setAccessOpen(false)}>Back to site <ArrowIcon /></button></div> : <><p className="section-label">Early network access</p><h2 id="access-title">Start building with certainty.</h2><p className="modal-copy">Tell us a little about what you are building. We are onboarding a focused group of teams.</p><form onSubmit={submitAccess}><label>Name<input required name="name" placeholder="Your name" /></label><label>Work email<input required type="email" name="email" placeholder="you@company.com" /></label><label>What are you building?<select defaultValue="" name="focus" required><option value="" disabled>Select an option</option><option>Autonomous software agent</option><option>Developer infrastructure</option><option>AI-native product</option><option>Research or other</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-lime" type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving request…" : "Request access"} <ArrowIcon /></button></form></>}
        </section>
      </div>}
    </>
  );
}
