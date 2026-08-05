import { NextResponse } from "next/server";
import { apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
import { isValidReceipt, submitSettlementReceipt } from "@/lib/keenetix";
export async function POST(request: Request) {
  try {
    const api = await authenticateApiKey(request, "settlements:write");
    const body = await request.json() as { commitmentId?: unknown; transactionHash?: unknown; chain?: unknown; chainId?: unknown; escrowAddress?: unknown };
    const commitmentId = typeof body.commitmentId === "number" ? body.commitmentId : 0;
    const chain = body.chain === "solana" ? "solana" as const : "evm" as const;
    const chainId = typeof body.chainId === "number" ? body.chainId : 0;
    const transactionHash = typeof body.transactionHash === "string" ? body.transactionHash : "";
    const escrowAddress = typeof body.escrowAddress === "string" ? body.escrowAddress : "";
    if (!commitmentId || !isValidReceipt(chain, transactionHash, escrowAddress, chainId)) return NextResponse.json({ error: "Invalid settlement payload." }, { status: 400 });
    return NextResponse.json({ data: await submitSettlementReceipt({ workspaceId: api.workspaceId, commitmentId, transactionHash, chain, chainId: chain === "evm" ? chainId : undefined, escrowAddress }) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}