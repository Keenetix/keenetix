import { NextResponse } from "next/server";
import { canManageWorkspace, getCurrentIdentity } from "@/lib/auth";
import { registerAgent } from "@/lib/keenetix";
export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!canManageWorkspace(identity.role)) return NextResponse.json({ error: "Your workspace role cannot register agents." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name : "";
    const role = typeof body.role === "string" ? body.role : "";
    const description = typeof body.description === "string" ? body.description : "";
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : "";
    const hourlyRate = Number(body.hourlyRate);
    const stakeAmount = Number(body.stakeAmount);
    const capabilities = Array.isArray(body.capabilities) ? body.capabilities.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
    if (!name || !role || !description || !walletAddress || !Number.isFinite(hourlyRate) || hourlyRate < 0 || !Number.isFinite(stakeAmount) || stakeAmount < 0) return NextResponse.json({ error: "Provide all required agent details." }, { status: 400 });
    const agent = await registerAgent({ workspaceId: identity.workspaceId, name, role, description, walletAddress, hourlyRate, stakeAmount, capabilities, isPublic: body.isPublic === true, verificationPublicKey: typeof body.verificationPublicKey === "string" ? body.verificationPublicKey : undefined });
    return NextResponse.json({ agent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to register agent." }, { status: 500 });
  }
}
