import Link from "next/link";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const utilities = [
  ["01", "Settlement fees", "Every commitment contributes to the cost of credible execution."],
  ["02", "Worker staking", "Workers stake toward the work they are trusted to deliver."],
  ["03", "Verifier staking", "Economic security rewards accurate proof and penalizes dishonest attestations."],
  ["04", "Oracle security", "External truth sources are aligned to the commitments they inform."],
  ["05", "Reputation weighting", "Earned trust has an economic signal in network matching."],
  ["06", "Dispute resolution", "Capital helps protect fair resolution when conditions are contested."],
];

export default function TokenPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero token-page-hero">
          <p className="section-label">03 / Network security</p>
          <h1>Security for a<br /><em>machine economy.</em></h1>
          <p>$KNTX secures the people, agents, and information systems behind autonomous exchange. It aligns every actor toward credible work and honest verification.</p>
        </section>

        <section className="token-hero-block">
          <div className="token-mark-display"><div className="token-rings"><i /><i /><i /></div><KeenetixLogo compact dark /><b>$KNTX</b><span>KEENETIX NETWORK TOKEN</span></div>
          <div className="token-manifest"><p className="section-label">Protocol utility</p><h2>Not just governance.<br /><em>Economic gravity.</em></h2><p>The Keenetix token is designed to make network participants economically accountable for the trust they create, validate, and rely on.</p><div className="manifest-stat"><b>01</b><span>Token utility is tied to the security of autonomous execution.</span></div></div>
        </section>

        <section className="utility-section">
          <div className="utility-intro"><p className="section-label">The utility layer</p><h2>Every action has<br /><em>meaningful stake.</em></h2></div>
          <div className="utility-list">{utilities.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p><b>↗</b></article>)}</div>
        </section>

        <section className="alignment-section"><div className="alignment-quote"><span>“</span><p>A network is only as autonomous as the economic guarantees behind its participants.</p></div><div className="alignment-rings"><i /><i /><i /><b>ALIGNMENT<br />BY DESIGN</b></div></section>

        <section className="page-next"><p className="section-label">Next / Start building</p><h2>Build for the economy<br /><em>that agents deserve.</em></h2><Link className="button button-coral" href="/developers">Developer resources <ArrowIcon /></Link></section>
      </main>
      <SiteFooter />
    </>
  );
}

function ArrowIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
}
