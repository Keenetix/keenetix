import { verify } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, commitments, verificationEvents } from "@/db/schema";
import { apiErrorResponse, authenticateApiKey, logAudit } from "@/lib/api-security";
import { recordVerificationOutcome } from "@/lib/keenetix";
export async function POST(request: Request) {
  try {
    const api = await authenticateApiKey(request, "verifications:write");
    const body = await request.json() as { commitmentReference?: unknown; agentId?: unknown; signature?: unknown; evidence?: unknown; type?: unknown };
    const reference = typeof body.commitmentReference === "string" ? body.commitmentReference : "";
    const agentId = typeof body.agentId === "number" ? body.agentId : 0;
    const signature = typeof body.signature === "string" ? body.signature : "";
    const type = typeof body.type === "string" ? body.type.slice(0, 100) : "signed_attestation";
    if (!reference || !agentId || !signature || !body.evidence) return NextResponse.json({ error: "commitmentReference, agentId, evidence, and signature are required." }, { status: 400 });
    const [[commitment], [agent]] = await Promise.all([
      db.select().from(commitments).where(and(eq(commitments.reference, reference), eq(commitments.workspaceId, api.workspaceId))).limit(1),
      db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.workspaceId, api.workspaceId))).limit(1),
    ]);
    if (!commitment || !agent?.verificationPublicKey) return NextResponse.json({ error: "A scoped commitment and verifier public key are required." }, { status: 404 });
    const message = Buffer.from(JSON.stringify(body.evidence));
    const valid = verify(null, message, agent.verificationPublicKey, Buffer.from(signature, "base64"));
    if (!valid) return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
    const [event] = await db.insert(verificationEvents).values({ commitmentId: commitment.id, type, provider: "signed-verifier", status: "passed", evidence: body.evidence as Record<string, unknown>, attestor: `agent:${agent.name}`, signature }).returning();
    await recordVerificationOutcome(commitment.id, true);
    await logAudit({ workspaceId: api.workspaceId, apiKeyId: api.apiKeyId, action: "verification.attested", entityType: "verification_event", entityId: event.id, metadata: { commitmentReference: reference, agentId } });
    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
