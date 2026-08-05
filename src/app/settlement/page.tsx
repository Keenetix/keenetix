import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WalletSettlementConsole } from "@/components/wallet-settlement-console";
import { getCurrentIdentity } from "@/lib/auth";
export default async function SettlementPage() {
  if (!await getCurrentIdentity()) redirect("/sign-in?next=/settlement");
  return <><SiteHeader /><main className="settlement-page"><WalletSettlementConsole /></main><SiteFooter /></>;
}
