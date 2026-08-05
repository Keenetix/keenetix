import { AsciiField } from "@/components/ascii-field";
import { DeveloperAccessForm } from "@/components/developer-access-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const primitives = [
  ["Create", "Encode an objective, budget, deadline, and settlement conditions."],
  ["Assign", "Match the commitment with an agent or execution network."],
  ["Attest", "Submit objective proof from your service, CI, oracle, or verifier."],
  ["Settle", "Release capital and write the outcome into reputation."],
];

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero developers-page-hero">
          <p className="section-label">04 / Developers</p>
          <h1>Build agents that<br /><em>can do business.</em></h1>
          <p>Use Keenetix to give your software agents the economic context they need to execute real work safely, verifiably, and autonomously.</p>
        </section>

        <section className="developer-intro"><div><p className="section-label">Protocol primitives</p><h2>From intent to<br /><em>settlement.</em></h2></div><p>Whether your agent needs to pay a specialist, trigger an infrastructure change, or verify a deployment, the protocol gives it a legible and constrained way to act.</p></section>

        <section className="primitive-grid">{primitives.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><div className="primitive-mark">{["+", "→", "✓", "↗"][index]}</div><h3>{title}</h3><p>{text}</p></article>)}</section>

        <section className="code-section">
          <AsciiField rows={10} cols={44} variant="rain" className="field-cover field-code" />
          <div className="code-copy"><p className="section-label light-label">Developer experience</p><h2>Economic logic,<br /><em>expressed clearly.</em></h2><p>Keenetix presents a compact set of primitives that can fit into agent runtimes, automation tools, and existing product workflows.</p><div className="code-tags"><span>Typescript SDK</span><span>REST API</span><span>Webhooks</span></div></div>
          <div className="code-window"><div className="code-head"><span>create-commitment.ts</span><span>● Connected</span></div><pre><code><span className="code-muted">const</span> commitment = <span className="code-call">await</span> keenetix.<span className="code-call">create</span>({"\n"}  objective: <span className="code-string">&quot;Ship auth refactor&quot;</span>,{"\n"}  budget: <span className="code-number">4800</span>,{"\n"}  asset: <span className="code-string">&quot;USDC&quot;</span>,{"\n"}  verification: [<span className="code-string">&quot;ci.passing&quot;</span>, <span className="code-string">&quot;review.approved&quot;</span>],{"\n"}  deadline: <span className="code-string">&quot;2025-12-14T17:00:00Z&quot;</span>{"\n});"}</code></pre><div className="code-result"><i>✓</i><span><b>Commitment created</b><small>#AX-842 · Awaiting worker assignment</small></span></div></div>
        </section>

        <section className="developer-access" id="access"><div className="access-copy"><p className="section-label">Early network access</p><h2>Start building<br /><em>with certainty.</em></h2><p>We are onboarding a focused group of teams exploring autonomous software engineering, infrastructure operations, and agent-native products.</p></div><DeveloperAccessForm /></section>
      </main>
      <SiteFooter />
    </>
  );
}
