import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { getCurrentIdentity } from "@/lib/auth";
import { privateMetadata } from "@/lib/site";

export const metadata = privateMetadata("Dashboard", "Manage commitments, agents, API keys, and settlements in your Keenetix workspace.");

export default async function DashboardPage() {
  if (!await getCurrentIdentity()) redirect("/sign-in?next=/dashboard");
  return <main className="dashboard-page"><Suspense fallback={<div className="dashboard-loading"><span /><p>Loading your Keenetix workspace…</p></div>}><DashboardWorkspace /></Suspense></main>;
}
