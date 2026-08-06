import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/privacy");

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Scope",
    body: <>
      <p>This policy describes what Keenetix Protocol (&ldquo;Keenetix&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects when you use the website, dashboard, API, and SDK (together, the &ldquo;Service&rdquo;), why we collect it, and the choices you have. It should be read alongside our <Link href="/terms">Terms &amp; Conditions</Link>.</p>
      <p>Keenetix does not custody funds or private keys. On-chain activity you initiate is public by nature of the blockchain you use, independent of this policy.</p>
    </>,
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    body: <>
      <p><b>Account data</b> — name, email address, and a salted password hash if you sign up with a password. If you sign in with Google or GitHub, we store the provider&rsquo;s account identifier for your profile, not your password.</p>
      <p><b>Workspace data</b> — organization and workspace names, member roles, invites you send, and API keys you generate (we store a cryptographic hash of each key, never the key itself after creation).</p>
      <p><b>Commitment and settlement data</b> — objectives, budgets, deadlines, verification signals, submitted transaction hashes, and the on-chain receipts we read back to confirm them.</p>
      <p><b>Operational data</b> — session identifiers, sign-in timestamps, audit log entries for actions taken in your workspace, and the minimum request metadata (such as IP address and timestamp) needed to enforce API rate limits and investigate abuse.</p>
    </>,
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    body: <p>To operate your account and workspace, authenticate sign-in, send transactional email (verification, password reset, invites), enforce API scopes and rate limits, confirm on-chain settlement, maintain audit logs and reputation records, and secure the Service against abuse. We do not use your data to serve third-party advertising, and we do not sell it.</p>,
  },
  {
    id: "legal-basis",
    title: "Legal basis",
    body: <p>Where applicable law requires a legal basis, we rely on: performance of a contract (operating the Service you signed up for), legitimate interests (security, fraud prevention, and abuse investigation), and consent (where you explicitly opt in, such as marketing communications you request).</p>,
  },
  {
    id: "sharing",
    title: "Who we share data with",
    body: <>
      <p>We share data only where necessary to run the Service:</p>
      <p><b>Infrastructure providers</b> — our database and application hosts, and our transactional email provider, process data on our behalf under their own security commitments.</p>
      <p><b>Blockchain networks</b> — settlement transactions you submit are broadcast to public chains you choose; that data is visible to anyone who reads the chain and is not something we control.</p>
      <p><b>Legal requirements</b> — we may disclose data where required by law, subpoena, or to protect the rights, property, or safety of Keenetix, our users, or the public.</p>
      <p>We do not sell personal data, and we do not share it with third parties for their own marketing purposes.</p>
    </>,
  },
  {
    id: "cookies",
    title: "Cookies and similar technology",
    body: <p>We use a small number of strictly necessary cookies: a session cookie to keep you signed in, and a CSRF token cookie to protect your account from cross-site request forgery. Neither is used for advertising or cross-site tracking. Our marketing pages load a cookieless analytics script (Ahrefs) that reports aggregate traffic without identifying individual visitors.</p>,
  },
  {
    id: "retention",
    title: "Retention",
    body: <p>We retain account and workspace data for as long as your account is active, and audit and settlement records for as long as needed to preserve an accurate history of commitments and their outcomes, including after account closure where retention is required for security, dispute resolution, or legal compliance. Password reset and email verification tokens expire quickly and are deleted once used or expired.</p>,
  },
  {
    id: "security",
    title: "Security",
    body: <p>Passwords are hashed, never stored in plaintext. API keys are shown once and stored as a hash. Mutating requests are protected against cross-site request forgery. See our <Link href="/security">security page</Link> for how to report a vulnerability.</p>,
  },
  {
    id: "your-choices",
    title: "Your choices and rights",
    body: <p>You can update your account details from the dashboard, and you can ask us to access, correct, export, or delete your personal data by contacting <a href="mailto:hello@keenetix.xyz">hello@keenetix.xyz</a>. Depending on your jurisdiction, you may have additional rights under laws such as the GDPR or CCPA; we will respond to verified requests within a reasonable time. Deleting your account does not remove settlement records already committed to a public blockchain, which we cannot alter.</p>,
  },
  {
    id: "children",
    title: "Children",
    body: <p>The Service is not directed to children, and we do not knowingly collect data from anyone under the age of 16. If you believe a child has provided us data, contact us and we will delete it.</p>,
  },
  {
    id: "international",
    title: "International transfers",
    body: <p>Our infrastructure providers may process data in countries other than your own. Where required, we rely on appropriate safeguards for such transfers.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>We may update this policy as the Service evolves. Material changes will be reflected in the &ldquo;last updated&rdquo; date above and, where appropriate, announced in the dashboard. Continued use after a change means you accept the revised policy.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about this policy or your data: <a href="mailto:hello@keenetix.xyz">hello@keenetix.xyz</a>.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal / Privacy"
      title="What we hold,"
      accent="and why."
      lede="A plain account of what Keenetix collects when you use the website, dashboard, API, and SDK, why we collect it, and the choices you have."
      updated="6 August 2026"
      sections={sections}
      footnote={<>Keenetix Protocol · <Link href="/terms">Terms</Link> · <Link href="/security">Security</Link></>}
    />
  );
}
