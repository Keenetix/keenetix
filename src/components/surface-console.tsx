"use client";
import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import { SITE } from "@/lib/site";

type Row = { title: string; id: string; cells: [string, string]; state: string; tone: "ok" | "pending" };
type Surface = {
  key: string;
  tab: string;
  href: string;
  /** True for the dashboard: it lives on the app subdomain, not this marketing page's host. */
  crossHost?: boolean;
  path: string;
  crumb: string;
  title: string;
  lead: string;
  action: string;
  stats: [string, string][];
  columns: [string, string, string];
  rows: Row[];
};

const SURFACES: Surface[] = [
  {
    key: "dashboard",
    tab: "Dashboard",
    href: "/dashboard",
    crossHost: true,
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
    key: "marketplace",
    tab: "Marketplace",
    href: "/marketplace",
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
    key: "demo",
    tab: "Demo",
    href: "/demo",
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
    key: "docs",
    tab: "Docs",
    href: "/docs",
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

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
const getHash = () => window.location.hash.slice(1);
const getServerHash = () => "";

/** The product, shown as one console with four switchable, deep-linkable surfaces. */
export function SurfaceConsole() {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // The active tab is the URL hash itself (e.g. #marketplace); useSyncExternalStore
  // keeps it in sync with back/forward navigation without setState in an effect.
  const hash = useSyncExternalStore(subscribeToHash, getHash, getServerHash);
  const hashIndex = SURFACES.findIndex((item) => item.key === hash);
  const index = hashIndex >= 0 ? hashIndex : 0;
  const surface = SURFACES[index];

  const select = (position: number) => {
    history.replaceState(null, "", `#${SURFACES[position].key}`);
    // replaceState doesn't fire hashchange itself, so nudge the store to resync.
    window.dispatchEvent(new Event("hashchange"));
  };

  const onTabKeyDown = (event: React.KeyboardEvent, position: number) => {
    const last = SURFACES.length - 1;
    const next = event.key === "ArrowRight" ? (position === last ? 0 : position + 1)
      : event.key === "ArrowLeft" ? (position === 0 ? last : position - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

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
              key={item.key}
              ref={(el) => { tabRefs.current[position] = el; }}
              type="button"
              role="tab"
              id={`surface-tab-${item.key}`}
              aria-selected={position === index}
              aria-controls={`surface-panel-${item.key}`}
              tabIndex={position === index ? 0 : -1}
              className={position === index ? "is-active" : ""}
              onClick={() => select(position)}
              onKeyDown={(event) => onTabKeyDown(event, position)}
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
        <div className="console-body" role="tabpanel" id={`surface-panel-${surface.key}`} aria-labelledby={`surface-tab-${surface.key}`}>
          <p className="console-crumb">{surface.crumb}</p>
          <div className="console-head">
            <h3>{surface.title}</h3>
            {surface.crossHost
              ? <a className="button button-coral console-action" href={`${SITE.appUrl}${surface.href}`}>{surface.action}</a>
              : <Link className="button button-coral console-action" href={surface.href}>{surface.action}</Link>}
          </div>
          <dl className="console-stats">
            {surface.stats.map(([value, label]) => <div key={label}><dt>{value}</dt><dd>{label}</dd></div>)}
          </dl>
          <div className="console-table">
            <div className="console-row console-head-row">
              <span>{surface.lead}</span>
              {surface.columns.map((column) => <span key={column}>{column}</span>)}
            </div>
            {surface.rows.map((row) => {
              const cells = <>
                <span><b>{row.title}</b><small>{row.id}</small></span>
                <span>{row.cells[0]}</span>
                <span>{row.cells[1]}</span>
                <span><i className={`console-state state-${row.tone}`}>{row.state}</i></span>
              </>;
              return surface.crossHost
                ? <a className="console-row" href={`${SITE.appUrl}${surface.href}`} key={row.id + row.title}>{cells}</a>
                : <Link className="console-row" href={surface.href} key={row.id + row.title}>{cells}</Link>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
