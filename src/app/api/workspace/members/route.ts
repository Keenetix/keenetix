import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, workspaceMemberships } from "@/db/schema";
import { createInvite, getCurrentIdentity, type WorkspaceRole } from "@/lib/auth";
import { logAudit } from "@/lib/api-security";
import { appOrigin } from "@/lib/url";
const roles: WorkspaceRole[] = ["admin", "builder", "member", "viewer"];
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const members = await db.select({ id: workspaceMemberships.id, userId: users.id, name: users.name, email: users.email, role: workspaceMemberships.role, createdAt: workspaceMemberships.createdAt }).from(workspaceMemberships).innerJoin(users, eq(workspaceMemberships.userId, users.id)).where(eq(workspaceMemberships.workspaceId, identity.workspaceId));
  return NextResponse.json({ members });
}
export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!["owner", "admin"].includes(identity.role)) return NextResponse.json({ error: "Only owners and admins can manage team roles." }, { status: 403 });
  try {
    const body = await request.json() as { email?: unknown; role?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" && roles.includes(body.role as WorkspaceRole) ? body.role as WorkspaceRole : "member";
    const result = await createInvite({ workspaceId: identity.workspaceId, email, role, invitedByUserId: identity.userId, origin: appOrigin(request) });
    await logAudit({ workspaceId: identity.workspaceId, userId: identity.userId, action: result.status === "invited" ? "workspace_invite.created" : "workspace_member.updated", entityType: result.status === "invited" ? "invite" : "workspace_member", entityId: email, metadata: { email, role } });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update member." }, { status: 400 });
  }
}
