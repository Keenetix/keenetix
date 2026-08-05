import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function DashboardPage() {
  return <><SiteHeader /><main className="dashboard-page"><DashboardWorkspace /></main><SiteFooter /></>;
}
