import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/auth";
import { DISPUTE_OUTCOMES, DisputeOutcome, resolveDispute } from "@/lib/keenetix";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  // Releasing or refunding escrow moves capital, so it sits with workspace administration.
  if (!["owner", "admin"].includes(identity.role)) return NextResponse.json({ error: "Only owners and admins can resolve a dispute." }, { status: 403 });
  const { id } = await context.params;
  const disputeId = Number(id);
  if (!Number.isInteger(disputeId)) return NextResponse.json({ error: "Invalid dispute id." }, { status: 400 });
  try {
    const body = await request.json() as { outcome?: unknown; note?: unknown; splitBps?: unknown };
    const outcome = typeof body.outcome === "string" && DISPUTE_OUTCOMES.includes(body.outcome as DisputeOutcome) ? body.outcome as DisputeOutcome : null;
    if (!outcome) return NextResponse.json({ error: "Resolution must be release, refund, or split." }, { status: 400 });
    const result = await resolveDispute({ disputeId, workspaceId: identity.workspaceId, outcome, note: typeof body.note === "string" ? body.note : "", splitBps: body.splitBps === undefined ? undefined : Number(body.splitBps), userId: identity.userId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resolve dispute." }, { status: 400 });
  }
}
