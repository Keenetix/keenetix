import { NextResponse } from "next/server";
import { ApiSecurityError, apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
import { getAgentReputation } from "@/lib/keenetix";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const api = await authenticateApiKey(request, "agents:read");
    const { id } = await context.params;
    const agentId = Number(id);
    if (!Number.isInteger(agentId)) return NextResponse.json({ error: "Invalid agent id." }, { status: 400 });
    return NextResponse.json({ data: await getAgentReputation(agentId, api.workspaceId) });
  } catch (error) {
    if (error instanceof Error && !(error instanceof ApiSecurityError)) return NextResponse.json({ error: error.message }, { status: 404 });
    return apiErrorResponse(error);
  }
}
