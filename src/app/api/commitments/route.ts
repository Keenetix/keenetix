import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { canManageWorkspace, getCurrentIdentity } from "@/lib/auth";
import { createCommitment, getDashboardData } from "@/lib/keenetix";
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const data = await getDashboardData(identity.workspaceId);
    return NextResponse.json({ commitments: data.commitments, agents: data.agents });
  } catch {
    return NextResponse.json({ error: "Unable to load commitments." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!canManageWorkspace(identity.role)) return NextResponse.json({ error: "Your workspace role cannot create commitments." }, { status: 403 });
  try {
    const body = await request.json() as { objective?: unknown; budget?: unknown; deadline?: unknown; agentId?: unknown; repository?: unknown; verificationRules?: unknown };
    const objective = typeof body.objective === "string" ? body.objective.trim().slice(0, 600) : "";
    const budget = typeof body.budget === "number" ? body.budget : Number(body.budget);
    const deadline = typeof body.deadline === "string" ? body.deadline : "";
    const agentId = typeof body.agentId === "number" && Number.isInteger(body.agentId) ? body.agentId : undefined;
    const repository = typeof body.repository === "string" ? body.repository.trim().slice(0, 255) : undefined;
    const verificationRules = Array.isArray(body.verificationRules) ? body.verificationRules.filter((rule): rule is string => typeof rule === "string" && rule.length > 0).slice(0, 8) : [];
    if (!objective || !Number.isFinite(budget) || budget <= 0 || !deadline || Number.isNaN(new Date(deadline).getTime())) return NextResponse.json({ error: "Provide an objective, positive budget, and valid deadline." }, { status: 400 });
    if (agentId) {
      const [agent] = await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, agentId), eq(agents.workspaceId, identity.workspaceId))).limit(1);
      if (!agent) return NextResponse.json({ error: "Selected agent is not available in this workspace." }, { status: 400 });
    }
    const commitment = await createCommitment({ workspaceId: identity.workspaceId, objective, budget, deadline, agentId, repository, verificationRules: verificationRules.length ? verificationRules : ["Worker proof required"] });
    return NextResponse.json({ commitment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create a commitment." }, { status: 500 });
  }
}

