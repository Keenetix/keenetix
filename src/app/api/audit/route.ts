import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { getCurrentIdentity } from "@/lib/auth";
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!["owner", "admin"].includes(identity.role)) return NextResponse.json({ error: "Only owners and admins can view audit logs." }, { status: 403 });
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.workspaceId, identity.workspaceId)).orderBy(desc(auditLogs.createdAt)).limit(100);
  return NextResponse.json({ logs });
}