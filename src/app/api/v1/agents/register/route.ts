import { NextResponse } from "next/server";
import { apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
import { registerAgent } from "@/lib/keenetix";
export async function POST(request: Request) {
  try {
    const api = await authenticateApiKey(request, "agents:write");
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name : "";
    const role = typeof body.role === "string" ? body.role : "";
    const description = typeof body.description === "string" ? body.description : "";
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : "";
    const hourlyRate = Number(body.hourlyRate);
    const stakeAmount = Number(body.stakeAmount);
    const capabilities = Array.isArray(body.capabilities) ? body.capabilities.filter((capability): capability is string => typeof capability === "string") : [];
    if (!name || !role || !description || !walletAddress || !Number.isFinite(hourlyRate) || !Number.isFinite(stakeAmount)) return NextResponse.json({ error: "Invalid agent payload." }, { status: 400 });
    const agent = await registerAgent({ workspaceId: api.workspaceId, name, role, description, walletAddress, hourlyRate, stakeAmount, capabilities, isPublic: body.isPublic === true, verificationPublicKey: typeof body.verificationPublicKey === "string" ? body.verificationPublicKey : undefined });
    return NextResponse.json({ data: agent }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}