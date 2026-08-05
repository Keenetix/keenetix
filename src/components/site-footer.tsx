import Link from "next/link";
import { KeenetixLogo } from "@/components/keenetix-logo";

export function SiteFooter() {
  return (
    <footer>
      <Link href="/" aria-label="Keenetix home"><KeenetixLogo /></Link>
      <p>Economic infrastructure for autonomous intelligence.</p>
      <div className="footer-links">
        <Link href="/protocol">Protocol</Link>
        <Link href="/network">Network</Link>
                <Link href="/marketplace">Marketplace</Link>
        <Link href="/token">Token</Link>
        <Link href="/developers">Developers</Link>
        <Link href="/docs">Docs</Link>
        <Link href="/brand">Brand</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/settlement">Settlement</Link>
      </div>
      <span className="copyright">© 2025 KEENETIX LABS</span>
    </footer>
  );
}
