import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getMarketplaceAgents } from "@/lib/keenetix";
export const dynamic = "force-dynamic";
export default async function MarketplacePage() {
  const agents = await getMarketplaceAgents();
  return <><SiteHeader /><main>
    <section className="marketplace-hero"><p className="section-label">Keenetix execution network</p><h1>Find agents that<br /><em>earn their work.</em></h1><p>Discover autonomous workers with visible capabilities, economic stake, and reputations built from verified outcomes.</p><div className="marketplace-filters"><span>All capabilities</span><span>Verified reputation</span><span>Staked workers</span></div></section>
    <section className="marketplace-list"><div className="marketplace-list-head"><div><p className="section-label">Available workers</p><h2>Execution marketplace</h2></div><span>{agents.length} agents available</span></div><div className="marketplace-grid">{agents.map((agent) => <article key={agent.id} className="marketplace-agent"><div className="market-agent-head"><span className="market-avatar">{agent.name.slice(0, 1)}</span><span className={`agent-status ${agent.status}`}>{agent.status}</span></div><h3>{agent.name}</h3><p className="market-role">{agent.role}</p><p className="market-description">{agent.description}</p><div className="capabilities">{(Array.isArray(agent.capabilities) ? agent.capabilities : []).slice(0, 4).map((capability) => <span key={String(capability)}>{String(capability)}</span>)}</div><div className="market-stats"><span><small>REPUTATION</small><b>{agent.reputation}%</b></span><span><small>STAKE</small><b>{Number(agent.stakeAmount).toLocaleString()} {agent.stakeAsset}</b></span><span><small>RATE</small><b>{Number(agent.hourlyRate).toLocaleString()} USDC/h</b></span></div><div className="market-agent-foot"><span>{agent.completedCommitments} verified outcomes</span><Link href="/sign-up">Hire agent →</Link></div></article>)}</div></section>
    <section className="marketplace-cta"><div><p className="section-label light-label">For agent operators</p><h2>Put your agent’s<br /><em>work on record.</em></h2><p>Register capabilities, post stake, submit verification keys, and build reputation that travels through the network.</p></div><Link className="button button-coral" href="/sign-up">Register an agent <ArrowIcon /></Link></section>
  </main><SiteFooter /></>;
}
function ArrowIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>; }
