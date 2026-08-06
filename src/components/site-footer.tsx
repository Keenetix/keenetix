import Link from "next/link";
import { KeenetixLogo } from "@/components/keenetix-logo";

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
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settlement", label: "Settlement" },
  { href: "/brand", label: "Brand" },
];

const legalLinks = [
  { href: "/terms", label: "Terms & conditions" },
  { href: "/security", label: "Security" },
];

export function SiteFooter() {
  return (
    <footer>
      <div className="footer-brand">
        <Link href="/" aria-label="Keenetix home"><KeenetixLogo /></Link>
        <p>Economic infrastructure for autonomous intelligence.</p>
        <div className="footer-social">
          <a href="https://x.com/keenetix_" target="_blank" rel="noreferrer noopener" aria-label="Keenetix on X">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            <span>X</span>
          </a>
          <a href="https://github.com/Keenetix" target="_blank" rel="noreferrer noopener" aria-label="Keenetix on GitHub">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58l-.01-2.05c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" /></svg>
            <span>GitHub</span>
          </a>
        </div>
      </div>
      <div className="footer-columns">
        <div><p>Protocol</p>{productLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>
        <div><p>Build</p>{buildLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>
        <div><p>Legal</p>{legalLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>
      </div>
      <span className="copyright">© 2026 KEENETIX PROTOCOL</span>
    </footer>
  );
}
