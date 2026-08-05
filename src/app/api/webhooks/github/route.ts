import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { commitments, verificationEvents } from "@/db/schema";
import { logAudit } from "@/lib/api-security";
type GitHubPayload = {
  workflow_run?: { name?: string; conclusion?: string; html_url?: string; id?: number };
  check_run?: { name?: string; conclusion?: string; html_url?: string; id?: number };
  deployment_status?: { state?: string; environment?: string; target_url?: string; id?: number };
  repository?: { full_name?: string };
};
export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "GitHub webhook integration is not configured." }, { status: 503 });
  const rawBody = await request.text();
  const received = request.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const valid = received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!valid) return NextResponse.json({ error: "Invalid GitHub webhook signature." }, { status: 401 });
  try {
    const payload = JSON.parse(rawBody) as GitHubPayload;
    const eventName = request.headers.get("x-github-event") ?? "unknown";
    const source = payload.workflow_run ?? payload.check_run;
    const referenceSource = `${source?.name ?? ""} ${payload.repository?.full_name ?? ""}`;
    const reference = referenceSource.match(/KX-[A-Z0-9-]+/i)?.[0]?.toUpperCase();
    if (!reference) return NextResponse.json({ accepted: true, recorded: false, reason: "No commitment reference found in workflow or check name." });
    const [commitment] = await db.select().from(commitments).where(eq(commitments.reference, reference)).limit(1);
    if (!commitment || !commitment.workspaceId) return NextResponse.json({ accepted: true, recorded: false, reason: "Commitment not found." });
    const conclusion = source?.conclusion ?? payload.deployment_status?.state ?? "pending";
    const passed = ["success", "passed", "ready"].includes(conclusion);
    const [event] = await db.insert(verificationEvents).values({ commitmentId: commitment.id, type: eventName, provider: "github", status: passed ? "passed" : conclusion === "pending" ? "pending" : "failed", evidence: { repository: payload.repository?.full_name, conclusion, runUrl: source?.html_url ?? payload.deployment_status?.target_url, externalId: source?.id ?? payload.deployment_status?.id }, attestor: "github-webhook" }).returning();
    await logAudit({ workspaceId: commitment.workspaceId, action: "verification.github_recorded", entityType: "verification_event", entityId: event.id, metadata: { eventName, reference, conclusion } });
    return NextResponse.json({ accepted: true, recorded: true, verificationEventId: event.id });
  } catch {
    return NextResponse.json({ error: "GitHub webhook payload could not be processed." }, { status: 400 });
  }
}
