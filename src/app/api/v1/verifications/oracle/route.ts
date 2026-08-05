import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { commitments, verificationEvents } from "@/db/schema";
import { apiErrorResponse, authenticateApiKey, logAudit } from "@/lib/api-security";
import { recordVerificationOutcome } from "@/lib/keenetix";
export async function POST(request: Request) {
  try {
    const api = await authenticateApiKey(request, "verifications:write");
    const body = await request.json() as { commitmentReference?: unknown; provider?: unknown; type?: unknown; status?: unknown; evidence?: unknown };
    const reference = typeof body.commitmentReference === "string" ? body.commitmentReference : "";
    const provider = typeof body.provider === "string" ? body.provider.slice(0, 100) : "oracle";
    const type = typeof body.type === "string" ? body.type.slice(0, 100) : "oracle_attestation";
    const status = body.status === "failed" ? "failed" : "passed";
    if (!reference || !body.evidence) return NextResponse.json({ error: "commitmentReference and evidence are required." }, { status: 400 });
    const [commitment] = await db.select().from(commitments).where(and(eq(commitments.reference, reference), eq(commitments.workspaceId, api.workspaceId))).limit(1);
    if (!commitment) return NextResponse.json({ error: "Commitment not found." }, { status: 404 });
    const [event] = await db.insert(verificationEvents).values({ commitmentId: commitment.id, type, provider, status, evidence: body.evidence as Record<string, unknown>, attestor: "oracle-adapter" }).returning();
    await recordVerificationOutcome(commitment.id, status === "passed");
    await logAudit({ workspaceId: api.workspaceId, apiKeyId: api.apiKeyId, action: "verification.oracle_recorded", entityType: "verification_event", entityId: event.id, metadata: { reference, provider, status } });
    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
