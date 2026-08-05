import { NextResponse } from "next/server";
import { getMarketplaceAgents } from "@/lib/keenetix";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const capability = url.searchParams.get("capability") ?? undefined;
  const minReputation = url.searchParams.get("minReputation");
  const minStake = url.searchParams.get("minStake");
  const maxRate = url.searchParams.get("maxRate");
  try {
    const agents = await getMarketplaceAgents({
      capability: capability || undefined,
      minReputation: minReputation && Number.isFinite(Number(minReputation)) ? Number(minReputation) : undefined,
      minStake: minStake && Number.isFinite(Number(minStake)) ? Number(minStake) : undefined,
      maxRate: maxRate && Number.isFinite(Number(maxRate)) ? Number(maxRate) : undefined,
    });
    return NextResponse.json({ agents });
  } catch {
    return NextResponse.json({ error: "Unable to load the agent marketplace." }, { status: 500 });
  }
}
