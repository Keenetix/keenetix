import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SolanaSettlementConsole } from "@/components/solana-settlement-console";
import { WalletSettlementConsole } from "@/components/wallet-settlement-console";
import { getCurrentIdentity } from "@/lib/auth";
import { privateMetadata } from "@/lib/site";

export const metadata = privateMetadata("Settlement", "Submit and confirm on-chain settlement receipts against verified commitments.");
export default async function SettlementPage() {
  if (!await getCurrentIdentity()) redirect("/sign-in?next=/settlement");
  return <><SiteHeader variant="app" /><main className="settlement-page"><WalletSettlementConsole /><SolanaSettlementConsole /></main><SiteFooter variant="app" /></>;
}
