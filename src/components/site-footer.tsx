import Link from "next/link";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { SITE } from "@/lib/site";

const productLinks = [
  { href: "/protocol", label: "Protocol" },
  { href: "/network", label: "Network" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/token", label: "Token" },
  { href: "/demo", label: "Demo" },
];

const buildLinks = [
  { href: "/developers", label: "Developers" },
  { href: "/docs", label: "Docs" },
  { href: "/dashboard", label: "Dashboard", app: true },
  { href: "/settlement", label: "Settlement", app: true },
  { href: "/brand", label: "Brand" },
];

const legalLinks = [
  { href: "/terms", label: "Terms & conditions" },
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
];

type FooterLinkItem = { href: string; label: string; app?: boolean };

/** "marketing" (default) is keenetix.xyz; "app" is app.keenetix.xyz. Links that
 * don't belong to the current host render as a plain `<a>` to the other one. */
export function SiteFooter({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const isApp = variant === "app";

  const renderLink = ({ href, label, app }: FooterLinkItem) => {
    const crossHost = isApp ? !app : Boolean(app);
    return crossHost
      ? <a key={href} href={`${isApp ? SITE.url : SITE.appUrl}${href}`}>{label}</a>
      : <Link key={href} href={href}>{label}</Link>;
  };

  return (
    <footer>
      <div className="footer-brand">
        {isApp
          ? <a href={SITE.url} aria-label="Keenetix home"><KeenetixLogo /></a>
          : <Link href="/" aria-label="Keenetix home"><KeenetixLogo /></Link>}
        <p>Economic infrastructure for autonomous intelligence.</p>
        <div className="footer-social">
          <a href="https://x.com/keenetix_xyz" target="_blank" rel="noreferrer noopener" aria-label="Keenetix on X">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            <span>X</span>
          </a>
          <a href="https://github.com/Keenetix" target="_blank" rel="noreferrer noopener" aria-label="Keenetix on GitHub">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58l-.01-2.05c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" /></svg>
            <span>GitHub</span>
          </a>
        </div>
        <a className="footer-badge" href="https://orynth.dev/projects/keenetix" target="_blank" rel="noopener">
          {/* eslint-disable-next-line @next/next/no-img-element -- badge is served and versioned by Orynth */}
          <img src="https://orynth.dev/api/badge/keenetix?theme=dark&style=default" alt="Featured on Orynth" width={260} height={80} loading="lazy" />
        </a>
      </div>
      <div className="footer-columns">
        <div><p>Protocol</p>{productLinks.map(renderLink)}</div>
        <div><p>Build</p>{buildLinks.map(renderLink)}</div>
        <div><p>Legal</p>{legalLinks.map(renderLink)}</div>
      </div>
      <span className="copyright">© 2026 KEENETIX PROTOCOL</span>
    </footer>
  );
}
