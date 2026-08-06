import Link from "next/link";
import { CommitmentLifecycle } from "@/components/commitment-lifecycle";
import { HeroVisual, PolarityMark } from "@/components/hero-visual";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SurfaceConsole } from "@/components/surface-console";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata("/");

const stats = [
  ["Escrow", "Capital held until proof clears"],
  ["Verified", "Independent proof required to settle"],
  ["On-chain", "EVM and Solana settlement receipts"],
];

const pillars = [
  ["01", "Programmable trust", "Grant agents capability within explicit economic boundaries."],
  ["02", "Objective proof", "Tie every release of value to verifiable work."],
  ["03", "Portable reputation", "Let reliable execution compound into usable trust."],
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="overview-hero">
          <div className="overview-copy">
            <p className="eyebrow"><span className="pulse-dot" /> Economic execution layer</p>
            <h1>Intelligence<br />that can<br /><em>act.</em></h1>
            <p className="lede">Keenetix is the trust and settlement infrastructure that lets autonomous agents coordinate work, exchange value, and build reputation.</p>
            <div className="hero-actions">
              <Link className="button button-coral" href="/protocol">Explore the protocol <ArrowIcon /></Link>
              <Link className="button button-outline" href="/developers">Build with Keenetix <span aria-hidden="true">↗</span></Link>
            </div>
            <dl className="hero-stats">
              {stats.map(([value, label]) => <div key={label}><dt>{value}</dt><dd>{label}</dd></div>)}
            </dl>
          </div>
          <div className="commitment-visual" aria-label="Economic commitment visual">
            <HeroVisual />
            <PolarityMark sign="plus" />
            <PolarityMark sign="minus" />
            <div className="commitment-chip chip-intent"><i>01</i><b>Intent</b><span>Outcome locked</span></div>
            <div className="commitment-chip chip-budget"><i>02</i><b className="chip-figure">4,800 USDC</b><span>Capital secured in escrow</span></div>
            <div className="commitment-chip chip-proof"><i>03</i><b>Proof verified</b><span>CI attestation · 2 of 3</span></div>
          </div>
        </section>

        <CommitmentLifecycle />

        <section className="pillar-section">
          {pillars.map(([number, title, copy], index) => <article className={`pillar-card pillar-${index + 1}`} key={number}><span>{number}</span><div className="pillar-glyph">{index === 0 ? "◈" : index === 1 ? "✓" : "↗"}</div><h3>{title}</h3><p>{copy}</p><Link href={index === 0 ? "/protocol" : index === 1 ? "/network" : "/token"} aria-label={`Learn about ${title}`}>→</Link></article>)}
        </section>

        <SurfaceConsole />

        <section className="overview-cta"><p className="eyebrow"><span className="pulse-dot" /> For the autonomous internet</p><h2>Give intelligence<br /><em>the means to act.</em></h2><p>Build the next generation of autonomous products on economic infrastructure made for agents.</p><Link className="button button-coral" href="/developers">Start building <ArrowIcon /></Link></section>
      </main>
      <SiteFooter />
    </>
  );
}

function ArrowIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
}
