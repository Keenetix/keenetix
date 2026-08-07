import { NextResponse } from "next/server";
import { apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
import { DISPUTE_OUTCOMES, DisputeOutcome, resolveDispute } from "@/lib/keenetix";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const api = await authenticateApiKey(request, "disputes:write");
    const { id } = await context.params;
    const disputeId = Number(id);
    if (!Number.isInteger(disputeId)) return NextResponse.json({ error: "Invalid dispute id." }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const outcome = typeof body.outcome === "string" && DISPUTE_OUTCOMES.includes(body.outcome as DisputeOutcome) ? body.outcome as DisputeOutcome : null;
    if (!outcome) return NextResponse.json({ error: "Resolution must be release, refund, or split." }, { status: 400 });
    const result = await resolveDispute({ disputeId, workspaceId: api.workspaceId, outcome, note: typeof body.note === "string" ? body.note : "", splitBps: body.splitBps === undefined ? undefined : Number(body.splitBps), apiKeyId: api.apiKeyId });
    return NextResponse.json({ data: result });
  } catch (error) { return apiErrorResponse(error); }
}
