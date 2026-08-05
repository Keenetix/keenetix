"use client";

import { FormEvent, useEffect, useState } from "react";
import { WorkspaceTeam } from "@/components/workspace-team";

type Agent = { id: number; name: string; role: string; status: string; reputation: string; completedCommitments: number };
type Commitment = { id: number; reference: string; objective: string; budget: string; asset: string; deadline: string; status: string; assignedAgentName: string | null; createdAt: string };
type ApiKey = { id: number; name: string; keyPrefix: string; scopes: string[]; rateLimitPerMinute: number; lastUsedAt: string | null; createdAt: string };
type Workspace = { workspace: { id: number; name: string; slug: string }; identity: { name: string; email: string; role: string }; commitments: Commitment[]; agents: Agent[]; apiKeys: ApiKey[]; summary: { activeCommitments: number; totalCommitments: number; settledValue: number; activeAgents: number } };

const statusLabels: Record<string, string> = { draft: "Draft", funded: "Funded", executing: "Executing", verified: "Verified", settled: "Settled" };

export function DashboardWorkspace() {
  const [data, setData] = useState<Workspace | null>(null);
  onst [view, setView] = useState<"overview" | "commitments" | "keys" | "team">("overview");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState("");
  const [keyLoading, setKeyLoading] = useState(false);

  const loadWorkspace = async () => {
    setLoading(true);
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (response.ok) setData(await response.json() as Workspace);
    else setError("The developer workspace is temporarily unavailable.");
    setLoading(false);
  };

  useEffect(() => { void loadWorkspace(); }, []);

  const revokeKey = async (keyId: number) => {
    setError("");
    const response = await fetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? "Unable to revoke API key.");
    else await loadWorkspace();
  };
  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.assign("/");
  };
  const createKey = async () => {
    setKeyLoading(true);
    setError("");
    const response = await fetch("/api/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Dashboard development key" }) });
    const result = await response.json() as { rawKey?: string; error?: string };
    if (response.ok && result.rawKey) {
      setNewKey(result.rawKey);
      await loadWorkspace();
    } else setError(result.error ?? "Unable to create an API key.");
    setKeyLoading(false);
  };

  if (loading) return <div className="dashboard-loading"><span /><p>Loading your Keenetix workspace…</p></div>;
  if (!data) return <div className="dashboard-loading"><p>{error || "Unable to load dashboard."}</p><button className="button button-coral" onClick={() => void loadWorkspace()}>Try again</button></div>;

  return <section className="dashboard-shell">
    <div className="dashboard-top"><div><p className="section-label">Developer workspace · {data.identity.role}</p><h1>Welcome back,<br /><em>{data.identity.name}.</em></h1></div><div className="dashboard-top-actions"><button className="sign-out-button" onClick={() => void signOut()}>Sign out</button><button className="button button-coral" onClick={() => setFormOpen(true)}>Create commitment <ArrowIcon /></button></div></div>
    <div className="dashboard-tabs"><button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>Overview</button><button className={view === "commitments" ? "active" : ""} onClick={() => setView("commitments")}>Commitments <span>{data.summary.totalCommitments}</span></button><button className={view === "keys" ? "active" : ""} onClick={() => setView("keys")}>API keys</button><button className={view === "team" ? "active" : ""} onClick={() => setView("team")}>Team</button>

    {view === "overview" && <>
      <div className="dashboard-stats"><Stat value={String(data.summary.activeCommitments)} label="Active commitments" /><Stat value={`$${data.summary.settledValue.toLocaleString()}`} label="Value settled" /><Stat value={String(data.summary.activeAgents)} label="Active agents" /><Stat value={`${data.agents[0]?.reputation ?? "—"}%`} label="Top agent reputation" /></div>
      <div className="dashboard-grid"><section className="dash-panel commitments-panel"><div className="panel-head"><div><p>COMMITMENTS</p><h2>Recent economic work</h2></div><button onClick={() => setView("commitments")}>View all →</button></div><CommitmentTable commitments={data.commitments.slice(0, 4)} /></section><section className="dash-panel sdk-panel"><p>QUICKSTART</p><h2>Create your first<br />commitment.</h2><pre><code><span>import</span> {`{ Keenetix }`} <span>from</span> <i>"@keenetix/sdk"</i>{"\n\n"}<b>await</b> keenetix.commitments.create({"\n"}  objective: <i>"Ship a feature"</i>,{"\n"}  budget: <strong>4800</strong>{"\n})"}</code></pre><button onClick={() => setFormOpen(true)}>Open commitment builder →</button></section></div>
      <section className="dash-panel agents-panel"><div className="panel-head"><div><p>EXECUTION NETWORK</p><h2>Available agents</h2></div><span className="agent-count"><i /> {data.agents.length} available</span></div><div className="agent-list">{data.agents.map((agent) => <article key={agent.id}><span className="agent-avatar">{agent.name.slice(0, 1)}</span><div><b>{agent.name}</b><small>{agent.role}</small></div><span className="agent-rep">{agent.reputation}% <small>reputation</small></span><span className={`agent-status ${agent.status}`}>{agent.status}</span></article>)}</div></section>
    </>}

    {view === "commitments" && <section className="dash-panel commitments-panel full-panel"><div className="panel-head"><div><p>COMMITMENTS</p><h2>All economic work</h2></div><button className="button button-dark button-small" onClick={() => setFormOpen(true)}>Create new <ArrowIcon /></button></div><CommitmentTable commitments={data.commitments} /></section>}

    {view === "team" && <WorkspaceTeam role={data.identity.role} />}
    {view === "keys" && <section className="api-key-view"><div className="api-key-intro"><p className="section-label">API credentials</p><h2>Keys for your<br /><em>agent runtime.</em></h2><p>Keys are scoped to this developer workspace. Store them in your secrets manager and never expose them in a client bundle.</p><button className="button button-coral" onClick={() => void createKey()} disabled={keyLoading}>{keyLoading ? "Creating key…" : "Create API key"} <ArrowIcon /></button></div><div className="api-key-panel">{newKey && <div className="new-key"><b>Copy this key now</b><code>{newKey}</code><button onClick={() => void navigator.clipboard.writeText(newKey)}>Copy</button><small>For security, it will not be shown again.</small></div>}<div className="key-table"><div className="key-table-head"><span>Name</span><span>Key</span><span>Created</span></div>{data.apiKeys.length ? data.apiKeys.map((key) => <div key={key.id}><b>{key.name}</b><code>{key.keyPrefix}</code><small>{formatDate(key.createdAt)}</small></div>) : <p>No API keys created yet.</p><div className="key-table-head"><span>Name & scopes</span><span>Key</span><span>Created</span><span /></div>{data.apiKeys.length ? data.apiKeys.map((key) => <div key={key.id}><b>{key.name}<small>{key.scopes.join(" · ")}</small></b><code>{key.keyPrefix}</code><small>{formatDate(key.createdAt)}</small><button onClick={() => void revokeKey(key.id)}>Revoke</button></div>) : <p>No API keys created yet.</p>}}</div></div></section>}

    {error && <p className="dashboard-error" role="alert">{error}</p>}
    {formOpen && <CommitmentForm agents={data.agents} onClose={() => setFormOpen(false)} onCreated={async () => { setFormOpen(false); setView("commitments"); await loadWorkspace(); }} />}
  </section>;
}

function Stat({ value, label }: { value: string; label: string }) { return <article><b>{value}</b><span>{label}</span></article>; }

function CommitmentTable({ commitments }: { commitments: Commitment[] }) {
  if (!commitments.length) return <p className="table-empty">No commitments created yet.</p>;
  return <div className="commitment-table"><div className="commitment-table-head"><span>Commitment</span><span>Worker</span><span>Budget</span><span>Status</span></div>{commitments.map((commitment) => <div key={commitment.id}><div><b>{commitment.objective}</b><small>{commitment.reference} · due {formatDate(commitment.deadline)}</small></div><span>{commitment.assignedAgentName ?? "Unassigned"}</span><span>{formatMoney(commitment.budget, commitment.asset)}</span><em className={`status-${commitment.status}`}>{statusLabels[commitment.status] ?? commitment.status}</em></div>)}</div>;
}

function CommitmentForm({ agents, onClose, onCreated }: { agents: Agent[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/commitments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective: form.get("objective"), budget: Number(form.get("budget")), deadline: form.get("deadline"), agentId: form.get("agentId") ? Number(form.get("agentId")) : undefined, verificationRules: ["CI checks pass", "Security scan clear", "Reviewer attestation"] }) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (response.ok) await onCreated(); else setError(result.error ?? "Unable to create commitment.");
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="commitment-modal" role="dialog" aria-modal="true" aria-labelledby="commitment-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><p className="section-label">New commitment</p><h2 id="commitment-title">Define an outcome.</h2><p>Set the capital, deadline, worker, and conditions that make work complete.</p><form onSubmit={submit}><label>Objective<textarea name="objective" required placeholder="e.g. Ship the authentication refactor with no API regressions." /></label><div className="form-pair"><label>Budget (USDC)<input name="budget" required min="1" step="1" type="number" placeholder="4800" /></label><label>Deadline<input name="deadline" required type="datetime-local" /></label></div><label>Assign worker<select name="agentId" defaultValue=""><option value="">Assign later</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} — {agent.role}</option>)}</select></label><div className="rule-preview"><span>Verification conditions</span><p>✓ CI checks pass · ✓ Security scan clear · ✓ Reviewer attestation</p></div>{error && <p className="form-error">{error}</p>}<button className="button button-coral" disabled={saving}>{saving ? "Creating commitment…" : "Create commitment"} <ArrowIcon /></button></form></section></div>;
}

function ArrowIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>; }
function formatMoney(amount: string, asset: string) { return `${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${asset}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value)); }
