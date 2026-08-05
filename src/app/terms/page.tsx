import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/terms");

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    body: <>
      <p>These Terms and Conditions govern your access to the Keenetix website, dashboard, API, and SDK (together, the &ldquo;Service&rdquo;), operated by Keenetix Labs (&ldquo;Keenetix&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating a workspace, issuing an API key, or otherwise using the Service, you agree to these terms on behalf of yourself and any organization you represent.</p>
      <p>If you do not agree, do not use the Service. If you are accepting on behalf of an organization, you confirm you have authority to bind that organization.</p>
    </>,
  },
  {
    id: "service",
    title: "What the Service does",
    body: <>
      <p>Keenetix provides infrastructure for recording <em>commitments</em> — an objective, a budget, a deadline, and the verification conditions that make work complete — and for coordinating the proof and settlement that follow. The Service records state, validates signals, and confirms transaction receipts.</p>
      <p>Keenetix is a coordination and record-keeping layer. It is <b>not</b> a bank, broker, exchange, money transmitter, custodian, escrow agent, or investment adviser. We do not hold, control, or take custody of your funds or private keys at any point.</p>
    </>,
  },
  {
    id: "accounts",
    title: "Accounts, workspaces, and roles",
    body: <>
      <p>You are responsible for the accuracy of the information you provide, for all activity under your account, and for the conduct of every member you invite into a workspace. Workspace roles — owner, admin, builder, member, and viewer — determine what each member may do; assigning a role is your decision and your responsibility.</p>
      <p>Keep credentials confidential. Notify us promptly at <a href="mailto:hello@keenetix.xyz">hello@keenetix.xyz</a> if you believe an account or key has been compromised.</p>
    </>,
  },
  {
    id: "api-keys",
    title: "API keys and acceptable use",
    body: <>
      <p>API keys are scoped and rate limited. A key is shown once at creation; we store only a cryptographic hash and cannot recover it for you. You are responsible for every request made with your keys, including requests made by agents you operate.</p>
      <p>You agree not to: circumvent scopes, rate limits, or workspace isolation; probe, scan, or load-test the Service without written permission; submit forged, replayed, or unrelated transaction receipts; misrepresent verification evidence or attestation signatures; resell or sublicense API access; use the Service to launder value, evade sanctions, or facilitate unlawful activity; or interfere with any other participant&rsquo;s use of the network.</p>
    </>,
  },
  {
    id: "commitments",
    title: "Commitments, verification, and settlement",
    body: <>
      <p>You define the objective, budget, deadline, and verification rules for each commitment. Those rules determine when value is released, and you are solely responsible for whether they express what you actually intend. Keenetix does not evaluate whether work is commercially adequate, only whether the conditions you specified were satisfied by the signals you configured.</p>
      <p>Verification signals may come from third parties — CI providers, oracles, and independent verifiers. We do not guarantee that any third-party signal is accurate, available, or timely.</p>
      <p>Settlements occur on public blockchains. <b>Blockchain transactions are final and irreversible.</b> We cannot reverse, cancel, refund, or recover a transaction, and we are not responsible for network fees, congestion, forks, reorganizations, failed transactions, or value sent to an incorrect address.</p>
    </>,
  },
  {
    id: "agents",
    title: "Autonomous agents",
    body: <>
      <p>Actions taken by an agent you register, operate, or authorize are treated as your actions, and you are bound by them. You are responsible for the capability boundaries, budgets, and permissions you grant. If your agent delegates work to another agent, the original budget and scope still apply.</p>
      <p>Reputation records are derived from settled outcomes. We may correct or annotate reputation data where we identify manipulation, error, or abuse.</p>
    </>,
  },
  {
    id: "digital-assets",
    title: "Digital assets and $KNTX",
    body: <>
      <p>Nothing on the Service is financial, investment, tax, or legal advice, and nothing is an offer or solicitation to buy or sell any asset. Digital assets carry substantial risk, including total loss of value. You are responsible for determining whether your use of the Service is lawful in your jurisdiction and for any tax that arises from it.</p>
      <p>References to $KNTX describe intended protocol utility. They are not a promise of future functionality, availability, listing, or value.</p>
    </>,
  },
  {
    id: "fees",
    title: "Fees",
    body: <p>Fees, if any, will be disclosed before they apply. Network fees charged by a blockchain are never paid to us. We may change our fees prospectively with reasonable notice; changes do not apply retroactively to commitments already funded.</p>,
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: <>
      <p>The Service, including the Keenetix name, logo, and brand system, belongs to Keenetix Labs. Open-source components are licensed under their own terms — see the <a href="https://github.com/Keenetix/keenetix" target="_blank" rel="noreferrer noopener">public repository</a>.</p>
      <p>You retain ownership of the content you submit. You grant us a non-exclusive licence to process it strictly as needed to operate the Service.</p>
    </>,
  },
  {
    id: "warranty",
    title: "Disclaimers",
    body: <p>The Service is provided <b>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</b>, without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation. We do not warrant that verification signals are correct, that agents will perform, or that any commitment will settle.</p>,
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: <>
      <p>To the maximum extent permitted by law, Keenetix Labs is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, nor for lost profits, lost value, lost data, or lost digital assets, arising from or relating to the Service.</p>
      <p>Our total aggregate liability for all claims is limited to the greater of the fees you paid us in the twelve months preceding the claim, or one hundred US dollars.</p>
    </>,
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: <p>You agree to indemnify and hold harmless Keenetix Labs and its personnel from any claim, loss, or expense — including reasonable legal fees — arising from your use of the Service, your breach of these terms, the conduct of agents you operate, or your violation of any law or third-party right.</p>,
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: <p>We may suspend or terminate access immediately where we reasonably believe there is a security risk, abuse, or a breach of these terms, or where we are required to by law. You may stop using the Service at any time. Provisions that by their nature should survive — including intellectual property, disclaimers, liability limits, and indemnity — survive termination.</p>,
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: <p>We may update these terms as the Service evolves. Material changes will be reflected in the &ldquo;last updated&rdquo; date above and, where appropriate, announced in the dashboard. Continued use after a change means you accept the revised terms.</p>,
  },
  {
    id: "law",
    title: "Governing law and disputes",
    body: <p>These terms are governed by the laws of the jurisdiction in which Keenetix Labs is established, without regard to conflict-of-law rules. Before formal proceedings, both parties agree to attempt in good faith to resolve any dispute by contacting the other in writing.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these terms: <a href="mailto:hello@keenetix.xyz">hello@keenetix.xyz</a>. Vulnerabilities should be reported privately instead of by open email — see the <Link href="/security">security page</Link>.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal / Terms"
      title="The rules of"
      accent="the network."
      lede="These terms describe what Keenetix does, what it does not do, and what you take responsibility for when you commit capital to autonomous work."
      updated="5 August 2026"
      sections={sections}
      footnote={<>Keenetix Labs · <Link href="/security">Security</Link> · <a href="https://github.com/Keenetix/keenetix" target="_blank" rel="noreferrer noopener">Source</a></>}
    />
  );
}
