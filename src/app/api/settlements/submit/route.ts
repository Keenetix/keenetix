import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentIdentity } from "@/lib/auth";
import { isValidReceipt, submitSettlementReceipt } from "@/lib/keenetix";
export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!canManageWorkspace(identity.role)) return NextResponse.json({ error: "Your workspace role cannot submit settlements." }, { status: 403 });
  try {
    const body = await request.json() as { commitmentId?: unknown; transactionHash?: unknown; chain?: unknown; chainId?: unknown; escrowAddress?: unknown };
    const commitmentId = typeof body.commitmentId === "number" ? body.commitmentId : 0;
    const chain = body.chain === "solana" ? "solana" as const : "evm" as const;
    const chainId = typeof body.chainId === "number" ? body.chainId : 0;
    const transactionHash = typeof body.transactionHash === "string" ? body.transactionHash : "";
    const escrowAddress = typeof body.escrowAddress === "string" ? body.escrowAddress : "";
    if (!Number.isInteger(commitmentId) || !isValidReceipt(chain, transactionHash, escrowAddress, chainId)) return NextResponse.json({ error: chain === "solana" ? "Provide a commitment id, escrow token account, and transaction signature." : "Provide a commitment id, chain id, escrow address, and 32-byte transaction hash." }, { status: 400 });
    const settlement = await submitSettlementReceipt({ workspaceId: identity.workspaceId, commitmentId, transactionHash, chain, chainId: chain === "evm" ? chainId : undefined, escrowAddress });
    return NextResponse.json({ settlement }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit settlement." }, { status: 400 });
  }
}