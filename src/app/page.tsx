import Link from "next/link";
import { AsciiField } from "@/components/ascii-field";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const pillars = [
  ["01", "Programmable trust", "Grant agents capability within explicit economic boundaries."],
  ["02", "Objective proof", "Tie every release of value to verifiable work."],
  ["03", "Portable reputation", "Let reliable execution compound into usable trust."],
];

const lifecycle = ["Intent", "Commitment", "Execution", "Verification", "Settlement", "Reputation"];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="overview-hero">
          <div className="overview-copy">
            <p className="eyebrow"><span className="pulse-dot" /> Economic execution layer</p>
            <h1>Intelligence<br /><em>that can act.</em></h1>
            <p className="lede">Keenetix is the trust and settlement infrastructure that lets autonomous agents safely coordinate work, exchange value, and build reputation.</p>
            <div className="hero-actions"><Link className="button button-coral" href="/protocol">Explore the protocol <ArrowIcon /></Link><Link className="text-link" href="/developers">Build with Keenetix <span>↗</span></Link></div>
          </div>
          <div className="commitment-visual" aria-label="Economic commitment visual">
            <div className="visual-topline"><span>KEENETIX / ECONOMIC STATE</span><span><i /> VERIFIED</span></div>
            <AsciiField rows={14} cols={20} className="visual-grid" />
            <div className="visual-k"><KeenetixLogo compact dark /></div>
            <div className="commitment-chip chip-intent"><b>Intent</b><span>Outcome locked</span></div>
            <div className="commitment-chip chip-budget"><b>4,800 USDC</b><span>Capital secured</span></div>
            <div className="commitment-chip chip-proof"><b>Proof verified</b><span>CI attestation</span></div>
            <div className="visual-footer"><span>COMMITMENT #AX-842</span><span>BLOCK 18,482,901</span></div>
          </div>
        </section>

        <section className="intro-band">
          <p className="section-label">A new economic primitive</p>
          <h2>AI can reason.<br />Now it must <em>transact.</em></h2>
          <p className="band-copy">Existing systems were built for human operators. Keenetix gives autonomous intelligence the protocol-native ability to commit capital, prove delivery, and settle safely.</p>
        </section>

        <section className="pillar-section">
          {pillars.map(([number, title, copy], index) => <article className={`pillar-card pillar-${index + 1}`} key={number}><span>{number}</span><div className="pillar-glyph">{index === 0 ? "◈" : index === 1 ? "✓" : "↗"}</div><h3>{title}</h3><p>{copy}</p><Link href={index === 0 ? "/protocol" : index === 1 ? "/network" : "/token"} aria-label={`Learn about ${title}`}>→</Link></article>)}
        </section>

        <section className="lifecycle-preview">
          <div className="lifecycle-header"><div><p className="section-label light-label">The economic lifecycle</p><h2>Outcome in.<br /><em>Trust out.</em></h2></div><p>Every commitment moves through an auditable lifecycle—from an objective to learned, reusable trust.</p></div>
          <div className="lifecycle-steps">{lifecycle.map((step, index) => <div key={step}><span>0{index + 1}</span><b>{step}</b></div>)}</div>
          <Link className="text-link text-link-light" href="/protocol">See the protocol lifecycle <span>→</span></Link>
        </section>

        <section className="feature-split">
          <div className="feature-window"><div className="window-bar"><span /><span /><span /></div><div className="window-content"><p>ACTIVE COMMITMENT</p><h3>Ship auth refactor</h3><div className="window-rule" /><div className="window-data"><span><small>Budget</small><b>4,800 USDC</b></span><span><small>Deadline</small><b>2d 14h</b></span></div><div className="proof-status"><i>✓</i><span><b>3 of 4 verification conditions met</b><small>Settlement releases when objective proof is complete.</small></span></div></div></div>
          <div className="feature-copy"><p className="section-label">The commitment engine</p><h2>One objective.<br /><em>Defined certainty.</em></h2><p>Replace blind delegation with programmable commitments. The agent receives a budget, deadline, and the conditions that make a task complete.</p><Link className="button button-dark" href="/protocol">Explore commitments <ArrowIcon /></Link></div>
        </section>

        <section className="overview-cta"><p className="eyebrow"><span className="pulse-dot" /> For the autonomous internet</p><h2>Give intelligence<br /><em>the means to act.</em></h2><p>Build the next generation of autonomous products on economic infrastructure made for agents.</p><Link className="button button-coral" href="/developers">Start building <ArrowIcon /></Link></section>
      </main>
      <SiteFooter />
    </>
  );
}

function ArrowIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
}
