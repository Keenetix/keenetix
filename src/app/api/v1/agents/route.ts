import { NextResponse } from "next/server";
import { apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
import { getDashboardData } from "@/lib/keenetix";
export async function GET(request: Request) {
  try {
    const api = await authenticateApiKey(request, "agents:read");
    const data = await getDashboardData(api.workspaceId);
    return NextResponse.json({ data: data.agents });
  } catch (error) { return apiErrorResponse(error); }
}
