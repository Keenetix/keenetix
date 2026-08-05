import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentIdentity } from "@/lib/auth";
import { approveBid } from "@/lib/keenetix";
export async function POST(_request: Request, context: { params: Promise<{ id: string; bidId: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!canManageWorkspace(identity.role)) return NextResponse.json({ error: "Your workspace role cannot approve bids." }, { status: 403 });
  const { id, bidId } = await context.params;
  const commitmentId = Number(id);
  const parsedBidId = Number(bidId);
  if (!Number.isInteger(commitmentId) || !Number.isInteger(parsedBidId)) return NextResponse.json({ error: "Invalid commitment or bid id." }, { status: 400 });
  try {
    const result = await approveBid({ commitmentId, bidId: parsedBidId, workspaceId: identity.workspaceId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve bid." }, { status: 400 });
  }
}
