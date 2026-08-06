import { NextResponse } from "next/server";
import { ApiSecurityError, apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
import { createDispute, listDisputes } from "@/lib/keenetix";
export async function GET(request: Request) {
  try {
    const api = await authenticateApiKey(request, "disputes:read");
    return NextResponse.json({ data: await listDisputes(api.workspaceId) });
  } catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const api = await authenticateApiKey(request, "disputes:write");
    const body = await request.json() as Record<string, unknown>;
    const commitmentId = Number(body.commitmentId);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!Number.isInteger(commitmentId) || !reason) return NextResponse.json({ error: "commitmentId and reason are required." }, { status: 400 });
    const dispute = await createDispute({ commitmentId, workspaceId: api.workspaceId, reason, apiKeyId: api.apiKeyId });
    return NextResponse.json({ data: dispute }, { status: 201 });
  } catch (error) {
    // Dispute rules ("already open", "nothing to dispute") are caller errors, not server faults.
    if (error instanceof Error && !(error instanceof ApiSecurityError)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiErrorResponse(error);
  }
}
