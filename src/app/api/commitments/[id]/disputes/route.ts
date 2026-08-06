import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/auth";
import { createDispute, listDisputes } from "@/lib/keenetix";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await context.params;
  const commitmentId = Number(id);
  if (!Number.isInteger(commitmentId)) return NextResponse.json({ error: "Invalid commitment id." }, { status: 400 });
  const all = await listDisputes(identity.workspaceId);
  return NextResponse.json({ disputes: all.filter((dispute) => dispute.commitmentId === commitmentId) });
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await context.params;
  const commitmentId = Number(id);
  if (!Number.isInteger(commitmentId)) return NextResponse.json({ error: "Invalid commitment id." }, { status: 400 });
  try {
    const body = await request.json() as { reason?: unknown };
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) return NextResponse.json({ error: "Provide a reason for the dispute." }, { status: 400 });
    const dispute = await createDispute({ commitmentId, userId: identity.userId, workspaceId: identity.workspaceId, reason });
    return NextResponse.json({ dispute }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to raise dispute." }, { status: 400 });
  }
}
