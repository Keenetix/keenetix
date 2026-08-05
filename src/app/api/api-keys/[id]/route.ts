import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { canManageWorkspace, getCurrentIdentity } from "@/lib/auth";
import { logAudit } from "@/lib/api-security";
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!canManageWorkspace(identity.role)) return NextResponse.json({ error: "Your workspace role cannot revoke API keys." }, { status: 403 });
  const { id } = await context.params;
  const keyId = Number(id);
  if (!Number.isInteger(keyId)) return NextResponse.json({ error: "Invalid API key id." }, { status: 400 });
  const [key] = await db.select().from(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.workspaceId, identity.workspaceId))).limit(1);
  if (!key) return NextResponse.json({ error: "API key not found." }, { status: 404 });
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));
  await logAudit({ workspaceId: identity.workspaceId, userId: identity.userId, action: "api_key.revoked", entityType: "api_key", entityId: keyId, metadata: { name: key.name } });
  return NextResponse.json({ ok: true });
}