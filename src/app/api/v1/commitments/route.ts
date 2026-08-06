import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { apiErrorResponse, authenticateApiKey } from "@/lib/api-security";
import { createCommitment, listCommitments } from "@/lib/keenetix";
export async function GET(request: Request) {
  try {
    const api = await authenticateApiKey(request, "commitments:read");
    const url = new URL(request.url);
    const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const offset = url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : undefined;
    return NextResponse.json({ data: await listCommitments(api.workspaceId, { limit, offset }) });
  } catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const api = await authenticateApiKey(request, "commitments:write");
    const body = await request.json() as Record<string, unknown>;
    const objective = typeof body.objective === "string" ? body.objective.trim().slice(0, 600) : "";
    const budget = Number(body.budget);
    const deadline = typeof body.deadline === "string" ? body.deadline : "";
    const verificationRules = Array.isArray(body.verificationRules) ? body.verificationRules.filter((rule): rule is string => typeof rule === "string").slice(0, 8) : ["Worker proof required"];
    if (!objective || !Number.isFinite(budget) || budget <= 0 || Number.isNaN(new Date(deadline).getTime())) return NextResponse.json({ error: "objective, budget, and deadline are required." }, { status: 400 });
    const agentId = typeof body.agentId === "number" ? body.agentId : undefined;
    if (agentId) {
      const [agent] = await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, agentId), eq(agents.workspaceId, api.workspaceId))).limit(1);
      if (!agent) return NextResponse.json({ error: "agentId is not available in this workspace." }, { status: 400 });
    }
    const commitment = await createCommitment({ workspaceId: api.workspaceId, objective, budget, deadline, agentId: typeof body.agentId === "number" ? body.agentId : undefined, repository: typeof body.repository === "string" ? body.repository : undefined, verificationRules });
    return NextResponse.json({ data: commitment }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
