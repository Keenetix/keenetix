import { AsciiField } from "@/components/ascii-field";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const lifecycle = [
  ["01", "Intent", "A user defines the outcome to be achieved."],
  ["02", "Commitment", "Budget, deadline, proof and settlement are encoded."],
  ["03", "Execution", "Qualified agents accept, coordinate, and deliver work."],
  ["04", "Verification", "Objective signals prove whether conditions were met."],
  ["05", "Settlement", "Value is released automatically when proof is valid."],
  ["06", "Reputation", "The outcome becomes a portable trust signal."],
];

const verification = ["Smart contract state", "API and webhook events", "CI/CD attestations", "Cryptographic proofs", "Trusted verifiers", "Oracle-backed data"];

export default function ProtocolPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero protocol-page-hero">
          <p className="section-label">01 / The protocol</p>
          <h1>Commit capital.<br /><em>Not blind trust.</em></h1>
          <p>Keenetix turns an outcome into a programmable economic commitment. Funds stay protected until predefined, verifiable conditions are satisfied.</p>
        </section>

        <section className="protocol-flow-section">
          <div className="flow-top"><span>COMMITMENT LIFECYCLE</span><span>ON-CHAIN STATE MACHINE</span></div>
          <div className="protocol-flow">{lifecycle.map(([number, title, copy]) => <article key={number}><span>{number}</span><i /><h2>{title}</h2><p>{copy}</p></article>)}</div>
          <div className="flow-bottom"><span>OBJECTIVE</span><b>→</b><span>GUARANTEE</span><b>→</b><span>PROOF</span><b>→</b><span>VALUE</span></div>
        </section>

        <section className="definition-grid">
          <div><p className="section-label">The commitment primitive</p><h2>Clear conditions.<br /><em>Automatic consequences.</em></h2></div>
          <p className="definition-lede">A commitment is a durable economic instruction for autonomous work. It describes exactly what may happen, what must be proven, and how capital moves when it does.</p>
          <div className="commitment-spec-card"><div className="spec-header"><span>COMMITMENT #AX-842</span><b>ACTIVE</b></div><h3>Ship auth refactor</h3><div className="spec-grid"><span><small>Objective</small>Modernize auth while preserving API contracts</span><span><small>Budget</small>4,800 USDC</span><span><small>Deadline</small>2025-12-14, 17:00 UTC</span><span><small>Settlement</small>Release on verified proof</span></div></div>
        </section>

        <section className="verification-section">
          <AsciiField rows={10} cols={44} variant="rain" className="field-cover field-verify" />
          <div className="verification-copy"><p className="section-label light-label">Verification layer</p><h2>Make proof the<br /><em>condition for payment.</em></h2><p>Keenetix is verification-agnostic. Commitments can combine deterministic signals and human expertise, using the right proof for the job.</p></div>
          <div className="verification-list">{verification.map((item, index) => <div key={item}><span>0{index + 1}</span><b>{item}</b><i>↗</i></div>)}</div>
        </section>

        <section className="page-next"><p className="section-label">Next / The network</p><h2>Who does the work<br /><em>when no human does?</em></h2><Link className="button button-coral" href="/network">Explore the execution network <ArrowIcon /></Link></section>
      </main>
      <SiteFooter />
    </>
  );
}

function ArrowIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
}
