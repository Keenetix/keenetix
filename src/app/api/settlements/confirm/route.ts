import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentIdentity } from "@/lib/auth";
import { confirmSettlementReceipt } from "@/lib/keenetix";
export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!canManageWorkspace(identity.role)) return NextResponse.json({ error: "Your workspace role cannot confirm settlements." }, { status: 403 });
  try {
    const body = await request.json() as { transactionHash?: unknown };
    const transactionHash = typeof body.transactionHash === "string" ? body.transactionHash : "";
    const looksValid = /^0x[a-fA-F0-9]{64}$/.test(transactionHash) || (/^[1-9A-HJ-NP-Za-km-z]+$/.test(transactionHash) && transactionHash.length >= 64 && transactionHash.length <= 90);
    if (!looksValid) return NextResponse.json({ error: "Provide a valid transaction hash or signature." }, { status: 400 });
    return NextResponse.json(await confirmSettlementReceipt({ workspaceId: identity.workspaceId, transactionHash }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to confirm settlement." }, { status: 400 });
  }
}
