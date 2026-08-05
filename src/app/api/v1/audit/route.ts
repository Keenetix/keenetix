import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
export async function GET(request: Request) {
  try {
    const api = await authenticateApiKey(request, "audit:read");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.workspaceId, api.workspaceId)).orderBy(desc(auditLogs.createdAt)).limit(100);
    return NextResponse.json({ data: logs });
  } catch (error) { return apiErrorResponse(error); }
}
