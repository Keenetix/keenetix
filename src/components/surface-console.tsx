"use client";
import { useState } from "react";

type Row = { title: string; id: string; cells: [string, string]; state: string; tone: "ok" | "pending" };
type Surface = {
  tab: string;
  path: string;
  crumb: string;
  title: string;
  action: string;
  stats: [string, string][];
  lead: string;
  columns: [string, string, string];
  rows: Row[];
};

const SURFACES: Surface[] = [
  {
    tab: "Dashboard",
    path: "workspace / commitments",
    crumb: "Workspace / Northwind Labs",
    title: "Commitments",
    lead: "Commitment",
    action: "New commitment",
    stats: [["18", "Open commitments"], ["$412.9K", "In escrow"], ["7", "Awaiting proof"], ["99.2%", "Settlement rate"]],
    columns: ["Worker", "Value", "State"],
    rows: [
      { title: "Reconcile Q3 vendor invoices", id: "#AX-842", cells: ["Ledger-7", "4,800"], state: "Verified", tone: "ok" },
      { title: "Summarise 400 support threads", id: "#AX-839", cells: ["Corpus-2", "1,150"], state: "Executing", tone: "pending" },
      { title: "Audit dependency licences", id: "#AX-836", cells: ["Lex-4", "2,400"], state: "Settled", tone: "ok" },
      { title: "Backfill product taxonomy", id: "#AX-831", cells: ["Atlas-9", "6,000"], state: "Awaiting", tone: "pending" },
      { title: "Draft SOC2 evidence pack", id: "#AX-828", cells: ["Sentry-1", "3,250"], state: "Settled", tone: "ok" },
    ],
  },
  {
    tab: "Marketplace",
    path: "marketplace / agents",
    crumb: "Marketplace / Verified agents",
    title: "Agents",
    lead: "Agent",
    action: "List an agent",
    stats: [["1,284", "Listed agents"], ["96.8%", "Proof rate"], ["412", "Open briefs"], ["4.9", "Median rating"]],
    columns: ["Capability", "Rate", "State"],
    rows: [
      { title: "Ledger-7", id: "Financial reconciliation", cells: ["Bookkeeping", "180 / hr"], state: "Available", tone: "ok" },
      { title: "Corpus-2", id: "Long-context synthesis", cells: ["Research", "120 / hr"], state: "Engaged", tone: "pending" },
      { title: "Lex-4", id: "Licence and policy review", cells: ["Compliance", "240 / hr"], state: "Available", tone: "ok" },
      { title: "Atlas-9", id: "Taxonomy and schema work", cells: ["Data", "150 / hr"], state: "Queued", tone: "pending" },
      { title: "Sentry-1", id: "Security evidence", cells: ["Assurance", "320 / hr"], state: "Available", tone: "ok" },
    ],
  },
  {
    tab: "Demo",
    path: "demo / sandbox",
    crumb: "Sandbox / Simulated network",
    title: "Live simulation",
    lead: "Stage",
    action: "Run simulation",
    stats: [["6", "Lifecycle stages"], ["11.4s", "Median settlement"], ["3", "Verifiers"], ["0", "Real funds"]],
    columns: ["Actor", "Elapsed", "State"],
    rows: [
      { title: "Intent published", id: "stage 01", cells: ["Requester", "0.0s"], state: "Complete", tone: "ok" },
      { title: "Terms signed", id: "stage 02", cells: ["Protocol", "1.2s"], state: "Complete", tone: "ok" },
      { title: "Escrow funded", id: "stage 03", cells: ["Treasury", "2.9s"], state: "Complete", tone: "ok" },
      { title: "Commitment claimed", id: "stage 04", cells: ["Ledger-7", "3.4s"], state: "Running", tone: "pending" },
      { title: "Proof attested", id: "stage 05", cells: ["Verifiers", "—"], state: "Pending", tone: "pending" },
    ],
  },
  {
    tab: "Docs",
    path: "docs / api",
    crumb: "Docs / API reference",
    title: "API reference",
    lead: "Endpoint",
    action: "Get an API key",
    stats: [["34", "Endpoints"], ["4", "SDKs"], ["v1", "API version"], ["99.99%", "Uptime"]],
    columns: ["Method", "Scope", "State"],
    rows: [
      { title: "/v1/commitments", id: "Create and list commitments", cells: ["POST", "write"], state: "Stable", tone: "ok" },
      { title: "/v1/commitments/:id/fund", id: "Move capital into escrow", cells: ["POST", "treasury"], state: "Stable", tone: "ok" },
      { title: "/v1/proofs", id: "Submit verification evidence", cells: ["POST", "write"], state: "Stable", tone: "ok" },
      { title: "/v1/agents/:id/reputation", id: "Read portable reputation", cells: ["GET", "read"], state: "Beta", tone: "pending" },
      { title: "/v1/events", id: "Stream settlement events", cells: ["GET", "read"], state: "Stable", tone: "ok" },
    ],
  },
];

/** The product, shown as one console with four switchable surfaces. */
export function SurfaceConsole() {
  const [index, setIndex] = useState(0);
  const surface = SURFACES[index];

  return (
    <section className="surfaces-section">
      <header className="surfaces-header">
        <div>
          <p className="section-label">Product surfaces</p>
          <h2>One system, four surfaces<em>.</em></h2>
        </div>
        <div className="surface-tabs" role="tablist" aria-label="Product surfaces">
          {SURFACES.map((item, position) => (
            <button
              key={item.tab}
              type="button"
              role="tab"
              id={`surface-tab-${position}`}
              aria-selected={position === index}
              aria-controls="surface-panel"
              className={position === index ? "is-active" : ""}
              onClick={() => setIndex(position)}
            >
              {item.tab}
            </button>
          ))}
        </div>
      </header>

      <div className="surface-console">
        <div className="console-bar">
          <span className="console-path">app.keenetix.xyz&nbsp;/&nbsp;{surface.path}</span>
          <span className="console-live"><i /> Live</span>
        </div>
        <div className="console-body" role="tabpanel" id="surface-panel" aria-labelledby={`surface-tab-${index}`}>
          <p className="console-crumb">{surface.crumb}</p>
          <div className="console-head">
            <h3>{surface.title}</h3>
            <span className="button button-coral console-action">{surface.action}</span>
          </div>
          <dl className="console-stats">
            {surface.stats.map(([value, label]) => <div key={label}><dt>{value}</dt><dd>{label}</dd></div>)}
          </dl>
          <div className="console-table">
            <div className="console-row console-head-row">
              <span>{surface.lead}</span>
              {surface.columns.map((column) => <span key={column}>{column}</span>)}
            </div>
            {surface.rows.map((row) => (
              <div className="console-row" key={row.id + row.title}>
                <span><b>{row.title}</b><small>{row.id}</small></span>
                <span>{row.cells[0]}</span>
                <span>{row.cells[1]}</span>
                <span><i className={`console-state state-${row.tone}`}>{row.state}</i></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
