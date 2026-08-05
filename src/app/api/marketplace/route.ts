import { NextResponse } from "next/server";
import { getMarketplaceAgents } from "@/lib/keenetix";
export async function GET() {
  try {
    return NextResponse.json({ agents: await getMarketplaceAgents() });
  } catch {
    return NextResponse.json({ error: "Unable to load the agent marketplace." }, { status: 500 });
  }
}
