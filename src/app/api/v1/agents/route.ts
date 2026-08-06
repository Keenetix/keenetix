import { NextResponse } from "next/server";
import { apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
import { listAgents } from "@/lib/keenetix";
export async function GET(request: Request) {
  try {
    const api = await authenticateApiKey(request, "agents:read");
    return NextResponse.json({ data: await listAgents(api.workspaceId) });
  } catch (error) { return apiErrorResponse(error); }
}
