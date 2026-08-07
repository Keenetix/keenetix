"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeenetixLogo } from "@/components/keenetix-logo";
import { csrfFetch } from "@/lib/csrf-fetch";
import { SITE } from "@/lib/site";
import { WorkspaceTeam } from "@/components/workspace-team";

type Agent = { id: number; name: string; role: string; status: string; reputation: string; completedCommitments: number };
type Commitment = { id: number; reference: string; objective: string; budget: string; asset: string; deadline: string; status: string; assignedAgentName: string | null; createdAt: string };
type ApiKey = { id: number; name: string; keyPrefix: string; scopes: string[]; rateLimitPerMinute: number; lastUsedAt: string | null; createdAt: string };
type Settlement = { amount: string; status: string; asset: string; transactionHash: string | null; settledAt: string | null; createdAt: string; reference: string };
type ProtocolEvent = { id: number; type: string; status: string; createdAt: string; reference: string; agentName: string | null };
type UserWorkspace = { workspaceId: number; workspaceName: string; organizationName: string; role: string };
type Dispute = { id: number; commitmentId: number; reason: string; status: string; outcome: string | null; splitBps: number | null; resolution: string | null; previousStatus: string; createdAt: string; resolvedAt: string | null; reference: string; objective: string; budget: string; asset: string; commitmentStatus: string; agentName: string | null; raisedByName: string | null };
type ReputationRecord = { id: number; reliability: string; quality: string; efficiency: string; delta: string; note: string; createdAt: string; commitmentId: number | null; reference: string | null; objective: string | null };
type ReputationReport = { agent: { id: number; name: string }; records: ReputationRecord[]; summary: { records: number; reliability: number | null; quality: number | null; efficiency: number | null; positive: number; negative: number; netDelta: number } };
type Summary = { activeCommitments: number; totalCommitments: number; settledValue: number; escrowedValue: number; escrowedCommitments: number; activeAgents: number; openDisputes: number; disputedValue: number };
type Workspace = { workspace: { id: number; name: string; slug: string }; identity: { name: string; email: string; role: string; emailVerified: boolean }; workspaces: UserWorkspace[]; commitments: Commitment[]; agents: Agent[]; apiKeys: ApiKey[]; settlements: Settlement[]; events: ProtocolEvent[]; disputes: Dispute[]; summary: Summary };
type View = "overview" | "commitments" | "agents" | "disputes" | "keys" | "team";
type Outcome = "release" | "refund" | "split";

const statusLabels: Record<string, string> = { draft: "Draft", funded: "Funded", executing: "Executing", verified: "Verified", awaiting_settlement: "Awaiting settlement", settlement_submitted: "Settling", settled: "Settled", disputed: "Disputed", refunded: "Refunded" };

/** Commitment states that still hold escrow, and so can still be contested. */
const DISPUTABLE = ["funded", "executing", "verified", "awaiting_settlement", "settlement_submitted"];

const OUTCOMES: { key: Outcome; label: string; detail: string }[] = [
  { key: "release", label: "Release to worker", detail: "Drop the claim. The commitment resumes exactly where it froze and settles in full." },
  { key: "refund", label: "Refund the funder", detail: "Return the capital, cancel pending settlement, and record a reliability penalty against the agent." },
  { key: "split", label: "Split the escrow", detail: "Award the worker a share of the budget. The remainder stays with the funder." },
];

/**
 * The overview board reads commitments as a pipeline. `attention` folds every
 * post-verification state together because they all block the same thing —
 * releasing escrow — and all of them wait on the workspace owner.
 */
const PIPELINE: { key: string; label: string; statuses: string[]; empty: string }[] = [
  { key: "draft", label: "DRAFT", statuses: ["draft"], empty: "No unfunded drafts." },
  { key: "funded", label: "FUNDED", statuses: ["funded"], empty: "Nothing waiting on an agent." },
  { key: "executing", label: "EXECUTING", statuses: ["executing"], empty: "No work under way." },
  { key: "attention", label: "AWAITING SETTLEMENT", statuses: ["verified", "awaiting_settlement", "settlement_submitted", "disputed"], empty: "No escrow waiting on you." },
  { key: "settled", label: "SETTLED", statuses: ["settled"], empty: "No settlements yet." },
];

export function DashboardWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<Workspace | null>(null);
  const [view, setView] = useState<View>("overview");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState("");
  const [keyLoading, setKeyLoading] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState(params.get("verified") ? "Your email is verified." : params.get("verifyError") ?? "");
  const [resending, setResending] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [disputing, setDisputing] = useState<Commitment | null>(null);
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const [inspecting, setInspecting] = useState<Agent | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  const loadWorkspace = async () => {
    setLoading(true);
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (response.ok) setData(await response.json() as Workspace);
    else setError("The developer workspace is temporarily unavailable.");
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
  useEffect(() => { void loadWorkspace(); }, []);

  const revokeKey = async (keyId: number) => {
    setError("");
    const response = await csrfFetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? "Unable to revoke API key.");
    else await loadWorkspace();
  };
  const signOut = async () => {
    await csrfFetch("/api/auth/sign-out", { method: "POST" });
    window.location.assign("/");
  };
  const createKey = async () => {
    setKeyLoading(true);
    setError("");
    const response = await csrfFetch("/api/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Dashboard development key" }) });
    const result = await response.json() as { rawKey?: string; error?: string };
    if (response.ok && result.rawKey) {
      setNewKey(result.rawKey);
      await loadWorkspace();
    } else setError(result.error ?? "Unable to create an API key.");
    setKeyLoading(false);
  };
  const resendVerification = async () => {
    setResending(true);
    const response = await csrfFetch("/api/auth/resend-verification", { method: "POST" });
    setResending(false);
    setVerifyNotice(response.ok ? "Verification email sent. Check your inbox." : "Unable to send verification email.");
  };
  const switchWorkspace = async (workspaceId: number) => {
    setSwitching(true);
    const response = await csrfFetch("/api/workspace/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId }) });
    if (response.ok) { router.refresh(); await loadWorkspace(); }
    setSwitching(false);
  };

  if (loading) return <div className="dashboard-loading"><span /><p>Loading your Keenetix workspace…</p></div>;
  if (!data) return <div className="dashboard-loading"><p>{error || "Unable to load dashboard."}</p><button className="button button-coral" onClick={() => void loadWorkspace()}>Try again</button></div>;

  const openDisputes = data.disputes.filter((dispute) => dispute.status === "open");
  const attention = data.commitments.find((commitment) => PIPELINE[3].statuses.includes(commitment.status));
  const unfunded = data.commitments.find((commitment) => commitment.status === "draft");
  const settledRecently = data.settlements.filter((settlement) => settlement.status === "settled" && withinDays(settlement.settledAt ?? settlement.createdAt, 30));
  const committedValue = data.commitments.reduce((total, commitment) => total + Number(commitment.budget), 0);
  const canResolve = ["owner", "admin"].includes(data.identity.role);
  const headings: Record<View, string> = { overview: "Overview", commitments: "Commitments", agents: "Execution network", disputes: "Disputes", keys: "API credentials", team: "Workspace team" };

  // On a phone the rail is a collapsed bar; selecting a destination should close it again.
  const go = (next: View) => { setView(next); setRailOpen(false); };

  return <div className="workspace-shell">
    <aside className={`workspace-rail ${railOpen ? "is-open" : ""}`.trim()}>
      <div className="rail-top">
        <a className="rail-brand" href={SITE.url} aria-label="Keenetix home"><KeenetixLogo /></a>
        <button className="rail-toggle" aria-expanded={railOpen} aria-controls="workspace-nav" onClick={() => setRailOpen((open) => !open)}>
          {railOpen ? <CloseIcon /> : <MenuIcon />}<span>{railOpen ? "Close" : "Menu"}</span>
        </button>
      </div>

      <div className="rail-workspace">
        <small>WORKSPACE</small>
        {data.workspaces.length > 1
          ? <select aria-label="Switch workspace" value={data.workspace.id} disabled={switching} onChange={(event) => void switchWorkspace(Number(event.target.value))}>{data.workspaces.map((item) => <option key={item.workspaceId} value={item.workspaceId}>{item.organizationName} / {item.workspaceName}</option>)}</select>
          : <b>{data.workspace.name}</b>}
      </div>

      <nav className="rail-nav" id="workspace-nav" aria-label="Workspace">
        <button className={view === "overview" ? "active" : ""} onClick={() => go("overview")}><GridIcon /><span>Overview</span><em /></button>
        <button className={view === "commitments" ? "active" : ""} onClick={() => go("commitments")}><ListIcon /><span>Commitments</span><em className="rail-count">{data.summary.totalCommitments}</em></button>
        <button className={view === "agents" ? "active" : ""} onClick={() => go("agents")}><AgentIcon /><span>Agents</span><em className="rail-muted">{data.agents.length}</em></button>
        <Link href="/settlement"><CardIcon /><span>Settlement</span><em /></Link>
        <button className={view === "disputes" ? "active" : ""} onClick={() => go("disputes")}><ScaleIcon /><span>Disputes</span>{openDisputes.length ? <em className="rail-alert">{openDisputes.length}</em> : <em />}</button>
        <hr />
        <button className={view === "keys" ? "active" : ""} onClick={() => go("keys")}><CodeIcon /><span>API keys</span><em /></button>
        <a href={`${SITE.url}/docs`}><DocIcon /><span>Documentation</span><em /></a>
        <button className={view === "team" ? "active" : ""} onClick={() => go("team")}><TeamIcon /><span>Team</span><em /></button>
      </nav>

      <div className="rail-foot">
        <div className="rail-treasury">
          <p>IN ESCROW</p>
          <b>{Math.round(data.summary.escrowedValue).toLocaleString()} <span>USDC</span></b>
          <div className="rail-meter"><i style={{ width: `${committedValue ? (data.summary.escrowedValue / committedValue) * 100 : 0}%` }} /></div>
          <span>{data.summary.escrowedCommitments} live · {Math.round(data.summary.settledValue).toLocaleString()} settled to date</span>
        </div>
        <div className="rail-user">
          <span className="rail-avatar">{initials(data.identity.name)}</span>
          <div><b>{data.identity.name}</b><small>{data.identity.role}</small></div>
          <button className="sign-out-button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    </aside>

    <main className="workspace-main">
      <header className="workspace-head">
        <div>
          <p className="section-label">{headings[view]} · {data.identity.role} view</p>
          <h1>{view === "overview" ? <>{greeting()}, <em>{firstName(data.identity.name)}.</em></> : <>{headings[view]}.</>}</h1>
        </div>
        <div className="workspace-head-actions">
          <span className="network-health"><i />Network healthy</span>
          <Link className="button button-dark button-small" href="/settlement">Settle escrow</Link>
          <button className="button button-coral button-small" onClick={() => setFormOpen(true)}>Create commitment <ArrowIcon /></button>
        </div>
      </header>

      {!data.identity.emailVerified && <p className="verify-banner">Verify your email to secure this account. <button onClick={() => void resendVerification()} disabled={resending}>{resending ? "Sending…" : "Resend verification email"}</button></p>}
      {verifyNotice && <p className="verify-banner verify-banner-ok">{verifyNotice}</p>}

      {view === "overview" && <div className="workspace-body">
        <section className="overview-strip">
          <div className="strip-callout">
            <p>NEEDS YOU NOW</p>
            {openDisputes.length
              ? <><b>{openDisputes.length === 1 ? `${openDisputes[0].reference} is disputed` : `${openDisputes.length} commitments are disputed`}</b><span>{formatMoney(String(data.summary.disputedValue), "USDC")} is frozen until you release, refund, or split it.</span><button className="strip-action" onClick={() => setView("disputes")}>Resolve dispute</button></>
              : attention
              ? <><b>{attention.assignedAgentName ?? "An agent"} finished {attention.reference}</b><span>{formatMoney(attention.budget, attention.asset)} releases from escrow once settlement is confirmed.</span><Link className="strip-action" href="/settlement">Open settlement</Link></>
              : unfunded
                ? <><b>{unfunded.reference} is still a draft</b><span>No agent can bid on {formatMoney(unfunded.budget, unfunded.asset)} of work until escrow is posted.</span><button className="strip-action" onClick={() => setView("commitments")}>Review drafts</button></>
                : <><b>Nothing is waiting on you</b><span>Every commitment in this workspace is either executing or already settled.</span><button className="strip-action" onClick={() => setFormOpen(true)}>Create commitment</button></>}
          </div>
          <div className="strip-stat">
            <span>IN FLIGHT</span>
            <div><b>{data.summary.escrowedCommitments}</b><small>{Math.round(data.summary.escrowedValue).toLocaleString()} USDC escrowed</small></div>
          </div>
          <div className="strip-stat">
            <span>SETTLED · 30D</span>
            <div><b>${Math.round(settledRecently.reduce((total, settlement) => total + Number(settlement.amount), 0)).toLocaleString()}</b><small>across {settledRecently.length} {settledRecently.length === 1 ? "settlement" : "settlements"}</small></div>
          </div>
          <div className="strip-stat">
            <span>AGENT REPUTATION</span>
            <div className="strip-stat-chart">
              <div><b>{averageReputation(data.agents)}%</b><small>across {data.agents.length} agents</small></div>
              <div className="spark">{data.agents.slice(0, 6).map((agent) => <i key={agent.id} style={{ height: `${Math.max(8, Number(agent.reputation))}%` }} />)}</div>
            </div>
          </div>
        </section>

        <div className="board-head">
          <div><p className="panel-eyebrow">COMMITMENT PIPELINE</p><h2>Everything in flight, by lifecycle state</h2></div>
          <button className="link-button" onClick={() => setView("commitments")}>Open full board →</button>
        </div>

        <div className="pipeline-board">
          {PIPELINE.map((column) => {
            const items = data.commitments.filter((commitment) => column.statuses.includes(commitment.status));
            const [lead, ...rest] = items;
            return <div key={column.key} className={`pipeline-column column-${column.key}`}>
              <div className="pipeline-head"><span>{column.label}</span><span>{items.length}</span></div>
              {lead ? <PipelineCard commitment={lead} /> : <p className="pipeline-empty">{column.empty}</p>}
              <span className="pipeline-note">{lead ? columnNote(column.key, lead, rest.length) : "Nothing here right now."}</span>
            </div>;
          })}
        </div>

        <div className="overview-grid">
          <section className="dash-panel">
            <div className="panel-head">
              <div><p>ESCROW FLOW · 6 WEEKS</p><h2>Committed vs. settled</h2></div>
              <div className="chart-legend"><span><i className="key-committed" />Committed</span><span><i className="key-settled" />Settled</span></div>
            </div>
            <EscrowChart commitments={data.commitments} settlements={data.settlements} />
          </section>

          <section className="dash-panel">
            <div className="panel-head">
              <div><p>EXECUTION NETWORK</p><h2>Your agents</h2></div>
              <span className="agent-count"><i /> {data.summary.activeAgents} active</span>
            </div>
            <AgentList agents={data.agents.slice(0, 3)} onSelect={setInspecting} />
          </section>

          <section className="dash-panel event-panel">
            <p className="panel-eyebrow">PROTOCOL ACTIVITY</p>
            <h2>Recent events</h2>
            {data.events.length
              ? data.events.map((event) => <article key={event.id}><time>{formatTime(event.createdAt)}</time><div><b>{event.type.replace(/_/g, ".")}</b><small>{[event.agentName, event.reference].filter(Boolean).join(" · ")}</small></div></article>)
              : <p className="event-empty">No protocol events recorded yet.</p>}
          </section>
        </div>
      </div>}

      {view === "commitments" && <div className="workspace-body"><section className="dash-panel commitments-panel full-panel"><div className="panel-head"><div><p>COMMITMENTS</p><h2>All economic work</h2></div><button className="button button-dark button-small" onClick={() => setFormOpen(true)}>Create new <ArrowIcon /></button></div><CommitmentTable commitments={data.commitments} onDispute={setDisputing} /></section></div>}

      {view === "disputes" && <div className="workspace-body"><section className="dash-panel full-panel"><div className="panel-head"><div><p>ARBITRATION</p><h2>Contested escrow</h2></div><span className="agent-count"><i /> {formatMoney(String(data.summary.disputedValue), "USDC")} frozen</span></div><DisputeTable disputes={data.disputes} canResolve={canResolve} onResolve={setResolving} /></section></div>}

      {view === "agents" && <div className="workspace-body"><section className="dash-panel full-panel"><div className="panel-head"><div><p>EXECUTION NETWORK</p><h2>Agents in this workspace</h2></div><span className="agent-count"><i /> {data.summary.activeAgents} active</span></div><AgentList agents={data.agents} onSelect={setInspecting} /></section></div>}

      {view === "team" && <div className="workspace-body"><WorkspaceTeam role={data.identity.role} /></div>}

      {view === "keys" && <div className="workspace-body"><section className="api-key-view"><div className="api-key-intro"><p className="section-label">API credentials</p><h2>Keys for your<br /><em>agent runtime.</em></h2><p>Keys are scoped to this developer workspace. Store them in your secrets manager and never expose them in a client bundle.</p><button className="button button-coral" onClick={() => void createKey()} disabled={keyLoading}>{keyLoading ? "Creating key…" : "Create API key"} <ArrowIcon /></button></div><div className="api-key-panel">{newKey && <div className="new-key"><b>Copy this key now</b><code>{newKey}</code><button onClick={() => void navigator.clipboard.writeText(newKey)}>Copy</button><small>For security, it will not be shown again.</small></div>}<div className="key-table"><div className="key-table-head"><span>Name & scopes</span><span>Key</span><span>Created</span><span /></div>{data.apiKeys.length ? data.apiKeys.map((key) => <div key={key.id}><b>{key.name}<small>{key.scopes.join(" · ")}</small></b><code>{key.keyPrefix}</code><small>{formatDate(key.createdAt)}</small><button onClick={() => void revokeKey(key.id)}>Revoke</button></div>) : <p>No API keys created yet.</p>}</div></div></section></div>}

      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {formOpen && <CommitmentForm agents={data.agents} onClose={() => setFormOpen(false)} onCreated={async () => { setFormOpen(false); setView("commitments"); await loadWorkspace(); }} />}
      {disputing && <DisputeForm commitment={disputing} onClose={() => setDisputing(null)} onRaised={async () => { setDisputing(null); setView("disputes"); await loadWorkspace(); }} />}
      {resolving && <ResolveForm dispute={resolving} onClose={() => setResolving(null)} onResolved={async () => { setResolving(null); await loadWorkspace(); }} />}
      {inspecting && <ReputationPanel agent={inspecting} onClose={() => setInspecting(null)} />}
    </main>
  </div>;
}

function PipelineCard({ commitment }: { commitment: Commitment }) {
  const urgent = PIPELINE[3].statuses.includes(commitment.status);
  const executing = commitment.status === "executing";
  return <article className={`pipeline-card ${urgent ? "is-urgent" : ""}`.trim()}>
    <div>
      <small>{commitment.reference}{executing ? ` · due ${formatDate(commitment.deadline)}` : commitment.status === "settled" ? ` · ${formatDate(commitment.createdAt)}` : ""}</small>
      <b>{commitment.objective}</b>
      {(executing || urgent) && <>
        <div className="pipeline-meter"><i style={{ width: `${urgent ? 100 : elapsed(commitment)}%` }} /></div>
        <small className="pipeline-progress">{urgent ? statusLabels[commitment.status] ?? commitment.status : `${elapsed(commitment)}% of the window elapsed`}</small>
      </>}
    </div>
    <div className="pipeline-foot">
      <span>{formatMoney(commitment.budget, commitment.asset)}</span>
      {commitment.assignedAgentName ? <span className="pipeline-avatar">{initials(commitment.assignedAgentName)}</span> : <span className="pipeline-avatar is-empty" />}
    </div>
  </article>;
}

function EscrowChart({ commitments, settlements }: { commitments: Commitment[]; settlements: Settlement[] }) {
  const weeks = escrowWeeks(commitments, settlements);
  const peak = Math.max(1, ...weeks.flatMap((week) => [week.committed, week.settled]));
  return <>
    <div className="escrow-chart">
      {weeks.map((week) => <div key={week.start}>
        <span className="bar-committed" style={{ height: `${(week.committed / peak) * 100}%` }} title={`${Math.round(week.committed).toLocaleString()} USDC committed`} />
        <span className="bar-settled" style={{ height: `${(week.settled / peak) * 100}%` }} title={`${Math.round(week.settled).toLocaleString()} USDC settled`} />
      </div>)}
    </div>
    <div className="escrow-axis">{weeks.map((week) => <span key={week.start}>{formatDate(week.start)}</span>)}</div>
  </>;
}

function AgentList({ agents, onSelect }: { agents: Agent[]; onSelect?: (agent: Agent) => void }) {
  if (!agents.length) return <p className="table-empty">No agents in this workspace yet.</p>;
  return <div className="agent-list">{agents.map((agent) => {
    const body = <><span className="agent-avatar">{initials(agent.name)}</span><div><b>{agent.name}</b><small>{agent.role}</small></div><span className="agent-rep">{agent.reputation}% <small>reputation</small></span><span className={`agent-status ${agent.status}`}>{agent.status}</span></>;
    return onSelect
      ? <button className="agent-row" key={agent.id} onClick={() => onSelect(agent)}>{body}</button>
      : <article key={agent.id}>{body}</article>;
  })}</div>;
}

function ReputationPanel({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [data, setData] = useState<ReputationReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void (async () => {
      const response = await fetch(`/api/agents/${agent.id}/reputation`, { cache: "no-store" });
      const result = await response.json() as ReputationReport & { error?: string };
      if (!live) return;
      if (response.ok) setData(result); else setError(result.error ?? "Unable to load reputation.");
    })();
    return () => { live = false; };
  }, [agent.id]);
  const axes: { key: keyof ReputationReport["summary"]; label: string }[] = [
    { key: "reliability", label: "RELIABILITY" },
    { key: "quality", label: "QUALITY" },
    { key: "efficiency", label: "EFFICIENCY" },
  ];
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="commitment-modal reputation-modal" role="dialog" aria-modal="true" aria-labelledby="reputation-title" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
    <p className="section-label">{agent.role}</p>
    <h2 id="reputation-title">{agent.name}.</h2>
    {error && <p className="form-error">{error}</p>}
    {!data && !error && <p className="reputation-loading">Loading reputation record…</p>}
    {data && <>
      <div className="reputation-axes">
        {axes.map((axis) => {
          const value = data.summary[axis.key] as number | null;
          return <div key={axis.key}><span>{axis.label}</span><b>{value === null ? "—" : `${value}%`}</b><div className="axis-meter"><i style={{ width: `${value ?? 0}%` }} /></div></div>;
        })}
      </div>
      <p className="reputation-meta">Headline {agent.reputation}% · {data.summary.records} {data.summary.records === 1 ? "record" : "records"} · {data.summary.positive} up, {data.summary.negative} down · net {data.summary.netDelta > 0 ? "+" : ""}{data.summary.netDelta}</p>
      <div className="reputation-log">
        {data.records.length
          ? data.records.map((record) => <article key={record.id}>
            <em className={Number(record.delta) < 0 ? "is-down" : "is-up"}>{Number(record.delta) > 0 ? "+" : ""}{record.delta}</em>
            <div><b>{record.note}</b><small>{[record.reference, `R ${record.reliability}`, `Q ${record.quality}`, `E ${record.efficiency}`].filter(Boolean).join(" · ")}</small></div>
            <time>{formatDate(record.createdAt)}</time>
          </article>)
          : <p className="table-empty">No reputation records yet. Settling or disputing a commitment writes one.</p>}
      </div>
    </>}
  </section></div>;
}

function CommitmentTable({ commitments, onDispute }: { commitments: Commitment[]; onDispute: (commitment: Commitment) => void }) {
  if (!commitments.length) return <p className="table-empty">No commitments created yet.</p>;
  return <div className="commitment-table has-actions"><div className="commitment-table-head"><span>Commitment</span><span>Worker</span><span>Budget</span><span>Status</span><span /></div>{commitments.map((commitment) => <div key={commitment.id}><div><b>{commitment.objective}</b><small>{commitment.reference} · due {formatDate(commitment.deadline)}</small></div><span>{commitment.assignedAgentName ?? "Unassigned"}</span><span>{formatMoney(commitment.budget, commitment.asset)}</span><em className={`status-${commitment.status}`}>{statusLabels[commitment.status] ?? commitment.status}</em>{DISPUTABLE.includes(commitment.status) ? <button className="row-action" onClick={() => onDispute(commitment)}>Dispute</button> : <span />}</div>)}</div>;
}

function DisputeTable({ disputes, canResolve, onResolve }: { disputes: Dispute[]; canResolve: boolean; onResolve: (dispute: Dispute) => void }) {
  if (!disputes.length) return <p className="table-empty">No commitment has been contested in this workspace.</p>;
  return <div className="dispute-list">{disputes.map((dispute) => <article key={dispute.id} className={dispute.status === "open" ? "is-open" : ""}>
    <div className="dispute-head">
      <div><b>{dispute.objective}</b><small>{dispute.reference} · {formatMoney(dispute.budget, dispute.asset)} · {dispute.agentName ?? "Unassigned"}</small></div>
      <em className={`status-${dispute.status === "open" ? "disputed" : dispute.commitmentStatus}`}>{dispute.status === "open" ? "Open" : outcomeLabel(dispute)}</em>
    </div>
    <p className="dispute-reason">“{dispute.reason}”</p>
    <div className="dispute-foot">
      <small>{dispute.status === "open"
        ? `Raised ${formatDate(dispute.createdAt)}${dispute.raisedByName ? ` by ${dispute.raisedByName}` : " via API"} · frozen at ${statusLabels[dispute.previousStatus] ?? dispute.previousStatus}`
        : `Resolved ${dispute.resolvedAt ? formatDate(dispute.resolvedAt) : ""} · ${dispute.resolution ?? ""}`}</small>
      {dispute.status === "open" && (canResolve
        ? <button className="button button-coral button-small" onClick={() => onResolve(dispute)}>Resolve <ArrowIcon /></button>
        : <small className="dispute-locked">Only owners and admins can resolve.</small>)}
    </div>
  </article>)}</div>;
}

function DisputeForm({ commitment, onClose, onRaised }: { commitment: Commitment; onClose: () => void; onRaised: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await csrfFetch(`/api/commitments/${commitment.id}/disputes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: form.get("reason") }) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (response.ok) await onRaised(); else setError(result.error ?? "Unable to raise dispute.");
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="commitment-modal" role="dialog" aria-modal="true" aria-labelledby="dispute-title" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
    <p className="section-label">Raise a dispute</p>
    <h2 id="dispute-title">Freeze this escrow.</h2>
    <p>{formatMoney(commitment.budget, commitment.asset)} on {commitment.reference} stops moving until an owner or admin releases, refunds, or splits it.</p>
    <form onSubmit={submit}>
      <label>Why is this contested?<textarea name="reason" required maxLength={1000} placeholder="e.g. The CI attestation passed but the delivered branch does not build." /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-coral" disabled={saving}>{saving ? "Raising dispute…" : "Raise dispute"} <ArrowIcon /></button>
    </form>
  </section></div>;
}

function ResolveForm({ dispute, onClose, onResolved }: { dispute: Dispute; onClose: () => void; onResolved: () => Promise<void> }) {
  const [outcome, setOutcome] = useState<Outcome>("release");
  const [splitPercent, setSplitPercent] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const budget = Number(dispute.budget);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await csrfFetch(`/api/disputes/${dispute.id}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, note: form.get("note"), splitBps: outcome === "split" ? Math.round(splitPercent * 100) : undefined }) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (response.ok) await onResolved(); else setError(result.error ?? "Unable to resolve dispute.");
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="commitment-modal" role="dialog" aria-modal="true" aria-labelledby="resolve-title" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
    <p className="section-label">Resolve dispute · {dispute.reference}</p>
    <h2 id="resolve-title">Decide where the escrow goes.</h2>
    <p className="dispute-quote">“{dispute.reason}”</p>
    <form onSubmit={submit}>
      <fieldset className="outcome-choice">
        <legend>Outcome</legend>
        {OUTCOMES.map((option) => <label key={option.key} className={outcome === option.key ? "active" : ""}>
          <input type="radio" name="outcome" value={option.key} checked={outcome === option.key} onChange={() => setOutcome(option.key)} />
          <b>{option.label}</b><small>{option.detail}</small>
        </label>)}
      </fieldset>
      {outcome === "split" && <label className="split-control">
        Worker share — {splitPercent}% ({formatMoney((budget * splitPercent / 100).toFixed(2), dispute.asset)} of {formatMoney(dispute.budget, dispute.asset)})
        <input type="range" min={1} max={99} step={1} value={splitPercent} onChange={(event) => setSplitPercent(Number(event.target.value))} />
      </label>}
      <label>Resolution note<textarea name="note" required maxLength={1000} placeholder="Record the reasoning. This is written to the audit log and shown to both parties." /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-coral" disabled={saving}>{saving ? "Resolving…" : `Resolve as ${outcome}`} <ArrowIcon /></button>
    </form>
  </section></div>;
}

function CommitmentForm({ agents, onClose, onCreated }: { agents: Agent[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await csrfFetch("/api/commitments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective: form.get("objective"), budget: Number(form.get("budget")), deadline: form.get("deadline"), agentId: form.get("agentId") ? Number(form.get("agentId")) : undefined, verificationRules: ["CI checks pass", "Security scan clear", "Reviewer attestation"] }) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (response.ok) await onCreated(); else setError(result.error ?? "Unable to create commitment.");
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="commitment-modal" role="dialog" aria-modal="true" aria-labelledby="commitment-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><p className="section-label">New commitment</p><h2 id="commitment-title">Define an outcome.</h2><p>Set the capital, deadline, worker, and conditions that make work complete.</p><form onSubmit={submit}><label>Objective<textarea name="objective" required placeholder="e.g. Ship the authentication refactor with no API regressions." /></label><div className="form-pair"><label>Budget (USDC)<input name="budget" required min="1" step="1" type="number" placeholder="4800" /></label><label>Deadline<input name="deadline" required type="datetime-local" /></label></div><label>Assign worker<select name="agentId" defaultValue=""><option value="">Assign later</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} — {agent.role}</option>)}</select></label><div className="rule-preview"><span>Verification conditions</span><p>✓ CI checks pass · ✓ Security scan clear · ✓ Reviewer attestation</p></div>{error && <p className="form-error">{error}</p>}<button className="button button-coral" disabled={saving}>{saving ? "Creating commitment…" : "Create commitment"} <ArrowIcon /></button></form></section></div>;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

function escrowWeeks(commitments: Commitment[], settlements: Settlement[]) {
  const origin = Date.now() - 5 * WEEK;
  const weeks = Array.from({ length: 6 }, (_, index) => ({ start: new Date(origin + index * WEEK).toISOString(), committed: 0, settled: 0 }));
  const place = (key: "committed" | "settled", value: number, at: string) => {
    const index = Math.floor((new Date(at).getTime() - origin) / WEEK);
    if (index >= 0 && index < weeks.length) weeks[index][key] += value;
  };
  commitments.forEach((commitment) => place("committed", Number(commitment.budget), commitment.createdAt));
  settlements.filter((settlement) => settlement.status === "settled").forEach((settlement) => place("settled", Number(settlement.amount), settlement.settledAt ?? settlement.createdAt));
  return weeks;
}

function columnNote(key: string, lead: Commitment, extra: number) {
  const more = extra ? ` +${extra} more.` : "";
  if (key === "draft") return `Unfunded — no bids until escrow posts.${more}`;
  if (key === "funded") return `Escrow posted. Awaiting agent selection.${more}`;
  if (key === "executing") return `${lead.assignedAgentName ?? "Unassigned"} · due ${formatDate(lead.deadline)}.${more}`;
  if (key === "attention") return `Blocking settlement.${more}`;
  return `Value released to the worker.${more}`;
}

function elapsed(commitment: Commitment) {
  const start = new Date(commitment.createdAt).getTime();
  const end = new Date(commitment.deadline).getTime();
  if (end <= start) return 100;
  return Math.min(100, Math.max(3, Math.round(((Date.now() - start) / (end - start)) * 100)));
}

function outcomeLabel(dispute: Dispute) {
  if (dispute.outcome === "split") return `Split ${Math.round((dispute.splitBps ?? 0) / 100)}%`;
  if (dispute.outcome === "refund") return "Refunded";
  if (dispute.outcome === "release") return "Released";
  return "Resolved";
}
function withinDays(value: string, days: number) { return Date.now() - new Date(value).getTime() <= days * 24 * 60 * 60 * 1000; }
function averageReputation(agents: Agent[]) { return agents.length ? Math.round(agents.reduce((total, agent) => total + Number(agent.reputation), 0) / agents.length) : 0; }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part.slice(0, 1).toUpperCase()).join(""); }
function firstName(name: string) { return name.trim().split(/\s+/)[0]; }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; }
function formatMoney(amount: string, asset: string) { return `${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${asset}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }

function ArrowIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>; }
function GridIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>; }
function ListIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h10" /></svg>; }
function AgentIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" /></svg>; }
function CardIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="6" width="18" height="12" /><path d="M3 10h18" /></svg>; }
function CodeIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 8-5 4 5 4M15 8l5 4-5 4" /></svg>; }
function DocIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" /><path d="M8 10h8M8 14h6" /></svg>; }
function MenuIcon() { return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>; }
function CloseIcon() { return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>; }
function ScaleIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 4v16M6 8h12M4 19h16" /><path d="m6 8-3 6h6zM18 8l-3 6h6z" /></svg>; }
function TeamIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.4" /><path d="M3 19c0-3.2 2.7-5 6-5s6 1.8 6 5" /></svg>; }
