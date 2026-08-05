"use client";
import { AsciiField } from "@/components/ascii-field";

import { useEffect, useState } from "react";

type DemoData = {
  commitment: { id: number; reference: string; objective: string; budget: string; asset: string; deadline: string; status: string; verificationRules: string[] };
  events: { id: number; type: string; provider: string; status: string; attestor: string | null; createdAt: string }[];
  settlements: { id: number; amount: string; asset: string; status: string; transactionHash: string | null; settledAt: string | null }[];
  assignedAgent: { name: string; role: string; reputation: string } | null;
  agents: { id: number; name: string; role: string; reputation: string }[];
};

type Action = "fund" | "assign" | "verify" | "settle" | "reset";
const steps: { action: Exclude<Action, "reset">; title: string; detail: string; state: string }[] = [
  { action: "fund", title: "Fund commitment", detail: "Lock 1,250 USDC in programmatic escrow.", state: "draft" },
  { action: "assign", title: "Assign worker", detail: "Match Iris to the scoped engineering task.", state: "funded" },
  { action: "verify", title: "Verify delivery", detail: "Record CI, security, and reviewer proof.", state: "executing" },
  { action: "settle", title: "Settle value", detail: "Release capital and update reputation.", state: "verified" },
];

export function DemoSimulator() {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<Action | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const response = await fetch("/api/demo", { cache: "no-store" });
    if (response.ok) setData(await response.json() as DemoData);
    else setError("Unable to load the live demo.");
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
  useEffect(() => { void load(); }, []);

  const transition = async (action: Action) => {
    setWorking(action); setError("");
    const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json() as DemoData & { error?: string };
    if (response.ok) setData(result); else setError(result.error ?? "Unable to update commitment.");
    setWorking(null);
  };

  if (loading) return <div className="demo-loading"><span /><p>Preparing the commitment…</p></div>;
  if (!data) return <div className="demo-loading"><p>{error || "Demo unavailable."}</p><button className="button button-coral" onClick={() => void load()}>Try again</button></div>;

  const currentIndex = ["draft", "funded", "executing", "verified", "awaiting_settlement", "settlement_submitted", "settled"].indexOf(data.commitment.status);
  const isSettled = data.commitment.status === "settled";
  const isWalletPending = ["awaiting_settlement", "settlement_submitted"].includes(data.commitment.status);
  return <section className="demo-shell">
    <div className="demo-summary"><div><p className="section-label">Live commitment simulation</p><h1>Watch value move<br /><em>on verified work.</em></h1><p>Run this commitment through each protocol state. Every action is written to the local Keenetix database.</p></div><div className="demo-meta"><span>COMMITMENT</span><b>{data.commitment.reference}</b><span>STATUS</span><em className={`status-${data.commitment.status}`}>{data.commitment.status}</em></div></div>
    <div className="demo-board">
      <AsciiField rows={10} cols={40} variant="drift" className="field-cover field-settle" />
      <section className="demo-commitment"><div className="demo-card-head"><span>OBJECTIVE</span><i>● LIVE</i></div><h2>{data.commitment.objective}</h2><div className="demo-financials"><span><small>BUDGET</small><b>{Number(data.commitment.budget).toLocaleString()} <i>{data.commitment.asset}</i></b></span><span><small>DEADLINE</small><b>36 hours</b></span></div><div className="demo-worker"><span>{data.assignedAgent ? data.assignedAgent.name.slice(0, 1) : "?"}</span><div><small>ASSIGNED WORKER</small><b>{data.assignedAgent ? `${data.assignedAgent.name} · ${data.assignedAgent.role}` : "Awaiting network assignment"}</b></div></div><div className="demo-rules"><b>Verification conditions</b>{data.commitment.verificationRules.map((rule, index) => <p key={rule} className={currentIndex >= 3 ? "passed" : ""}><i>{currentIndex >= 3 ? "✓" : index + 1}</i>{rule}</p>)}</div></section>
      <section className="demo-transitions"><p>COMMITMENT STATE</p><div className="demo-progress">{["Draft", "Funded", "Executing", "Verified", "Settled"].map((state, index) => <div className={currentIndex >= index ? "complete" : ""} key={state}><i>{currentIndex > index ? "✓" : index + 1}</i><span>{state}</span></div>)}</div><div className="demo-actions">{steps.map((step, index) => { const complete = currentIndex > index; const isCurrent = data.commitment.status === step.state; return <article className={complete ? "complete" : isCurrent ? "current" : ""} key={step.action}><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.detail}</p></div>{complete ? <i className="action-check">✓</i> : <button disabled={!isCurrent || working !== null} onClick={() => void transition(step.action)}>{working === step.action ? "Processing…" : isCurrent ? "Run step →" : "Locked"}</button>}</article>; })}</div>{isWalletPending && <p className="demo-wallet-note">Settlement request recorded. A real USDC wallet receipt is required before capital and reputation finalize.</p>}{isWalletPending && <p className="demo-wallet-note">Settlement request recorded. A real USDC wallet receipt is required before capital and reputation finalize.</p>}{(isSettled || isWalletPending) && <button className="demo-reset" onClick={() => void transition("reset")} disabled={working !== null}>↻ Reset demonstration</button>}</section>
    </div>
    <section className="demo-event-log"><div><p>VERIFIABLE EVENT LOG</p><span>{data.events.length} protocol events</span></div>{data.events.length ? data.events.map((event) => <article key={event.id}><i>✓</i><div><b>{event.type.replaceAll("_", " ")}</b><small>{event.provider} · {event.attestor ?? "protocol"}</small></div><time>{new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(event.createdAt))}</time></article>) : <p className="empty-events">Events will appear as each state transition is completed.</p>}</section>
    {error && <p className="demo-error" role="alert">{error}</p>}
  </section>;
}
