import { redirect } from "next/navigation";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentIdentity } from "@/lib/auth";
import { privateMetadata } from "@/lib/site";

export const metadata = privateMetadata("Dashboard", "Manage commitments, agents, API keys, and settlements in your Keenetix workspace.");

export default async function DashboardPage() {
  if (!await getCurrentIdentity()) redirect("/sign-in?next=/dashboard");
  return <><SiteHeader /><main className="dashboard-page"><DashboardWorkspace /></main><SiteFooter /></>;
}
