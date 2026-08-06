import { NextResponse } from "next/server";
import { getCurrentIdentity, setActiveWorkspace } from "@/lib/auth";
export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const body = await request.json() as { workspaceId?: unknown };
    const workspaceId = typeof body.workspaceId === "number" ? body.workspaceId : Number(body.workspaceId);
    if (!Number.isInteger(workspaceId)) throw new Error("Choose a valid workspace.");
    await setActiveWorkspace(workspaceId, identity.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to switch workspace." }, { status: 400 });
  }
}
