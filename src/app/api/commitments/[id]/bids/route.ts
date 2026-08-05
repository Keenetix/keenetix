import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentIdentity } from "@/lib/auth";
import { createBid, listBidsForCommitment } from "@/lib/keenetix";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await context.params;
  const commitmentId = Number(id);
  if (!Number.isInteger(commitmentId)) return NextResponse.json({ error: "Invalid commitment id." }, { status: 400 });
  try {
    const bids = await listBidsForCommitment(commitmentId, identity.workspaceId);
    return NextResponse.json({ bids });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load bids." }, { status: 400 });
  }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!canManageWorkspace(identity.role)) return NextResponse.json({ error: "Your workspace role cannot submit bids." }, { status: 403 });
  const { id } = await context.params;
  const commitmentId = Number(id);
  if (!Number.isInteger(commitmentId)) return NextResponse.json({ error: "Invalid commitment id." }, { status: 400 });
  try {
    const body = await request.json() as { agentId?: unknown; proposedRate?: unknown; message?: unknown };
    const agentId = typeof body.agentId === "number" && Number.isInteger(body.agentId) ? body.agentId : NaN;
    const proposedRate = typeof body.proposedRate === "number" ? body.proposedRate : Number(body.proposedRate);
    const message = typeof body.message === "string" ? body.message : undefined;
    if (!Number.isInteger(agentId) || !Number.isFinite(proposedRate) || proposedRate <= 0) return NextResponse.json({ error: "Provide an agent and a positive proposed rate." }, { status: 400 });
    const bid = await createBid({ commitmentId, agentId, workspaceId: identity.workspaceId, proposedRate, message });
    return NextResponse.json({ bid }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit bid." }, { status: 400 });
  }
}
