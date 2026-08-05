import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/security");

const sections: LegalSection[] = [
  {
    id: "reporting",
    title: "Reporting a vulnerability",
    body: <>
      <p>Report privately — never in a public issue. Use <a href="https://github.com/Keenetix/keenetix/security/advisories/new" target="_blank" rel="noreferrer noopener">GitHub private advisories</a> or email <a href="mailto:hello@keenetix.xyz">hello@keenetix.xyz</a>.</p>
      <p>Include where the issue is, how to reproduce it, and what an attacker gains. We aim to acknowledge within three business days and to share a remediation timeline within ten. We credit reporters in the advisory unless you prefer to stay anonymous.</p>
    </>,
  },
  {
    id: "priority",
    title: "What we treat as critical",
    body: <>
      <p>Keenetix releases capital against cryptographic proof, so findings in these areas are triaged first:</p>
      <ul className="legal-list">
        <li><b>Scope bypass</b> — an API key acting beyond the permissions it was granted.</li>
        <li><b>Tenancy break</b> — any query reaching rows outside the caller&rsquo;s workspace.</li>
        <li><b>Premature settlement</b> — a path reaching a settled state without valid verification.</li>
        <li><b>Receipt forgery</b> — a forged, replayed, or unrelated transaction accepted as confirmation.</li>
        <li><b>Signature bypass</b> — defeating Ed25519 attestation checks or webhook HMAC comparison.</li>
        <li><b>Session compromise</b> — fixation, cookie scope, or hash bypass in authentication.</li>
      </ul>
    </>,
  },
  {
    id: "credentials",
    title: "How credentials are stored",
    body: <>
      <p>Raw API keys and session tokens are never persisted. We store SHA-256 hashes and match against them, so a database dump alone yields no usable credential. A key is displayed once at creation and cannot be recovered afterwards — only a short prefix is retained so the dashboard can tell keys apart.</p>
      <p>Passwords are hashed. Revoked keys are rejected at authentication, before any scope or rate-limit evaluation.</p>
    </>,
  },
  {
    id: "isolation",
    title: "Workspace isolation",
    body: <p>The workspace is the tenancy boundary. Every request resolves to a workspace before it touches data — from the session cookie for browser traffic, or from the API key for machine traffic — and every query is filtered by that identifier. A workspace identifier supplied by a client is never trusted.</p>,
  },
  {
    id: "api",
    title: "API surface controls",
    body: <>
      <p>Each <code>/api/v1</code> request passes through the same sequence: bearer key lookup by hash, revocation check, scope enforcement, per-key rate limiting on a fixed sixty-second window, and an audit log entry recording method, path, and forwarded IP.</p>
      <p>Because auditing happens inside the authentication layer rather than in individual handlers, a new endpoint is audited by construction.</p>
    </>,
  },
  {
    id: "verification",
    title: "Verification integrity",
    body: <>
      <p>Three independent sources can attest that a condition was met, each with its own trust mechanism: verifier attestations are checked with Ed25519 against a registered public key; oracle submissions require a scoped key and recorded evidence; GitHub CI results are validated by HMAC-SHA256 using a constant-time comparison.</p>
      <p>A passing signal can only advance a commitment that is funded or executing. A late or duplicated proof cannot rewind a commitment that has already settled.</p>
    </>,
  },
  {
    id: "settlement",
    title: "Settlement safeguards",
    body: <>
      <p>Keenetix never holds keys and never signs a transaction. Wallets sign in your browser; the server verifies the result on chain.</p>
      <p>Receipts are validated for shape before any network call — EVM receipts require a non-zero chain id, a 32-byte transaction hash, and a 20-byte escrow address; Solana receipts require a base58 signature and escrow token account within expected length bounds. Confirmation is a two-step handshake: a receipt is submitted, then read back from the chain before the settlement is marked complete. Value is only released for commitments already in a verified state.</p>
    </>,
  },
  {
    id: "scope",
    title: "Out of scope",
    body: <p>Findings against marketing pages with no data impact, missing hardening headers without a demonstrated exploit, rate-limit tuning opinions, automated scanner output without a working proof of concept, and social engineering are out of scope.</p>,
  },
  {
    id: "safe-harbour",
    title: "Safe harbour",
    body: <p>If you make a good-faith effort to comply with this policy, we will not pursue legal action against you for your research. Please avoid privacy violations, service degradation, and any destruction or exfiltration of data that is not yours. Give us reasonable time to remediate before public disclosure.</p>,
  },
  {
    id: "supported",
    title: "Supported versions",
    body: <p>The <code>main</code> branch is the only supported version. Fixes ship forward; there are no backports.</p>,
  },
];

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust / Security"
      title="Proof is the"
      accent="only key."
      lede="How Keenetix protects credentials, isolates workspaces, verifies proof, and handles the disclosure of vulnerabilities."
      updated="5 August 2026"
      sections={sections}
      footnote={<>Report privately to <a href="mailto:hello@keenetix.xyz">hello@keenetix.xyz</a> · <Link href="/terms">Terms</Link></>}
    />
  );
}
