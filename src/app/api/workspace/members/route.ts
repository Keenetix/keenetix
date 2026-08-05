import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { organizationMemberships, users, workspaceMemberships } from "@/db/schema";
import { getCurrentIdentity, type WorkspaceRole } from "@/lib/auth";
import { logAudit } from "@/lib/api-security";
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
  const body = await request.json() as { email?: unknown; role?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" && roles.includes(body.role as WorkspaceRole) ? body.role as WorkspaceRole : "member";
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return NextResponse.json({ error: "The invited user must create a Keenetix account first." }, { status: 404 });
  const [existing] = await db.select().from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, identity.workspaceId), eq(workspaceMemberships.userId, user.id))).limit(1);
  if (existing) {
    await db.update(workspaceMemberships).set({ role }).where(eq(workspaceMemberships.id, existing.id));
  } else {
    const [orgMembership] = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.organizationId, identity.organizationId), eq(organizationMemberships.userId, user.id))).limit(1);
    if (!orgMembership) await db.insert(organizationMemberships).values({ organizationId: identity.organizationId, userId: user.id, role: role === "admin" ? "admin" : "member" });
    await db.insert(workspaceMemberships).values({ workspaceId: identity.workspaceId, userId: user.id, role });
  }
  await logAudit({ workspaceId: identity.workspaceId, userId: identity.userId, action: "workspace_member.updated", entityType: "workspace_member", entityId: user.id, metadata: { email, role } });
  return NextResponse.json({ ok: true });
}