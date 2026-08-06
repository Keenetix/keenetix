"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { SITE } from "@/lib/site";

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

function XIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
}

function GitHubIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58l-.01-2.05c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" /></svg>;
}

const social = [
  { href: "https://x.com/keenetix_xyz", label: "Keenetix on X", icon: <XIcon /> },
  { href: "https://github.com/Keenetix", label: "Keenetix on GitHub", icon: <GitHubIcon /> },
];

/**
 * "marketing" (default) is the public site at keenetix.xyz; "app" is the
 * authenticated app at app.keenetix.xyz. Marketing nav and the Dashboard link
 * point cross-host with a plain `<a>` from whichever host they don't belong to.
 */
export function SiteHeader({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const pathname = usePathname();
  const isApp = variant === "app";
  const logoHref = isApp ? SITE.url : "/";
  const dashboardActive = pathname === "/dashboard";
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
        {isApp
          ? <a href={logoHref} aria-label="Keenetix home"><KeenetixLogo /></a>
          : <Link href={logoHref} aria-label="Keenetix home"><KeenetixLogo /></Link>}
        <div className="nav-links">
          {links.map((link) => isApp
            ? <a key={link.href} href={`${SITE.url}${link.href}`}>{link.label}</a>
            : <Link key={link.href} className={pathname === link.href ? "active" : ""} href={link.href}>{link.label}</Link>)}
        </div>
        <div className="nav-actions">
          {isApp
            ? <Link className={`nav-text-link ${dashboardActive ? "active" : ""}`} href="/dashboard">Dashboard</Link>
            : <a className="nav-text-link" href={`${SITE.appUrl}/dashboard`}>Dashboard</a>}
          <div className="nav-social">
            {social.map((item) => <a key={item.href} href={item.href} target="_blank" rel="noreferrer noopener" aria-label={item.label} title={item.label}>{item.icon}</a>)}
          </div>
          <button className="button button-small button-dark" onClick={openAccess}>Request access <ArrowIcon /></button>
        </div>
        <button className="menu-button" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /></button>
      </nav>

      {menuOpen && <div className="mobile-menu">
        {links.map((link) => isApp
          ? <a key={link.href} href={`${SITE.url}${link.href}`}>{link.label}</a>
          : <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}
        {isApp
          ? <Link href="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          : <a href={`${SITE.appUrl}/dashboard`}>Dashboard</a>}
        <button className="button button-dark" onClick={openAccess}>Request access <ArrowIcon /></button>
        <div className="nav-social mobile-social">
          {social.map((item) => <a key={item.href} href={item.href} target="_blank" rel="noreferrer noopener" aria-label={item.label} title={item.label}>{item.icon}<span>{item.href.includes("x.com") ? "X" : "GitHub"}</span></a>)}
        </div>
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
