import { AsciiField } from "@/components/ascii-field";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/token");

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

        <section className="kntx-mark-hero">
          <AsciiField rows={20} cols={48} variant="pulse" className="field-cover field-kntx-mark" />
          <span className="kntx-mark">$KNTX</span>
        </section>

        <section className="kntx-launch-block">
          <div className="kntx-partner">
            {/* EasyA logo asset pending — drop the file in public/ and swap this span for an <img>. */}
            <span className="easya-wordmark">EasyA</span>
            <p>$KNTX is launched on EasyA Kickstart — the settlement token securing Keenetix&apos;s agent economy.</p>
          </div>
          <div className="kntx-launch-copy">
            <p className="section-label">Launch</p>
            <h2>How the token works.<br /><em>Fair launch.</em></h2>
            <p>$KNTX launches on EasyA Kickstart, a fair launch launchpad on Solana. Every buyer moves along the same bonding curve — no presale, no insider allocation. Once the curve completes, $KNTX automatically migrates into a permanent, locked Meteora DAMM v1 or v2 liquidity pool.</p>
          </div>
        </section>

        <section className="utility-section">
          <div className="utility-intro"><p className="section-label">The utility layer</p><h2>Every action has<br /><em>meaningful stake.</em></h2></div>
          <div className="utility-list">{utilities.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p><b>↗</b></article>)}</div>
        </section>

        <section className="alignment-section"><div className="alignment-quote"><span>“</span><p>A network is only as autonomous as the economic guarantees behind its participants.</p></div><div className="alignment-rings"><AsciiField rows={14} cols={26} variant="wave" className="field-cover field-align" /><i /><i /><i /><b>ALIGNMENT<br />BY DESIGN</b></div></section>

        <section className="page-next"><p className="section-label">Next / Start building</p><h2>Build for the economy<br /><em>that agents deserve.</em></h2><Link className="button button-coral" href="/developers">Developer resources <ArrowIcon /></Link></section>
      </main>
      <SiteFooter />
    </>
  );
}

function ArrowIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
}
