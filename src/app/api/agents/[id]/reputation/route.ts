import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/auth";
import { getAgentReputation } from "@/lib/keenetix";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await context.params;
  const agentId = Number(id);
  if (!Number.isInteger(agentId)) return NextResponse.json({ error: "Invalid agent id." }, { status: 400 });
  try {
    return NextResponse.json(await getAgentReputation(agentId, identity.workspaceId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load reputation." }, { status: 404 });
  }
}
