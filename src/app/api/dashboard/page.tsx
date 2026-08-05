import { redirect } from "next/navigation";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentIdentity } from "@/lib/auth";

export default async function DashboardPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/sign-in?next=/dashboard");
  return <><SiteHeader /><main className="dashboard-page"><DashboardWorkspace /></main><SiteFooter /></>;
}
