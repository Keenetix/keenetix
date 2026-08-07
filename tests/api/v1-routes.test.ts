import { createHash, randomBytes } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, apiKeys, apiRateLimits, commitments, developerAccounts, disputes, organizations, workspaces } from "@/db/schema";
import type { ApiScope } from "@/lib/api-security";
import { TestRegistry } from "../helpers/db-cleanup";
import { GET as listCommitments, POST as createCommitment } from "@/app/api/v1/commitments/route";
import { GET as listDisputes, POST as raiseDispute } from "@/app/api/v1/disputes/route";
import { POST as resolveDispute } from "@/app/api/v1/disputes/[id]/resolve/route";
import { GET as agentReputation } from "@/app/api/v1/agents/[id]/reputation/route";
const registry = new TestRegistry();
afterAll(async () => {
  await registry.cleanup();
});
const ALL_SCOPES: ApiScope[] = ["commitments:read", "commitments:write", "agents:read", "agents:write", "verifications:write", "settlements:write", "audit:read", "disputes:read", "disputes:write"];
type Fixture = Awaited<ReturnType<typeof setup>>;
async function setup(options: { scopes?: ApiScope[]; rateLimitPerMinute?: number; revoked?: boolean } = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const [organization] = await db.insert(organizations).values({ name: `Route Test ${suffix}`, slug: `route-test-${suffix}` }).returning();
  registry.trackOrganization(organization.id);
  const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: "Route workspace", slug: "main" }).returning();
  const [developer] = await db.insert(developerAccounts).values({ organization: organization.name, email: `route_${suffix}@example.test` }).returning();
  registry.trackDeveloperAccount(developer.id);
  const [agent] = await db.insert(agents).values({ workspaceId: workspace.id, name: "Route Agent", role: "tester", walletAddress: "0xagent", reputation: "80.00" }).returning();
  const [commitment] = await db.insert(commitments).values({ reference: `KX-RT-${suffix}`, developerId: developer.id, workspaceId: workspace.id, assignedAgentId: agent.id, objective: "route work", budget: "900.00", deadline: new Date(Date.now() + 86400000), status: "verified" }).returning();
  const rawKey = `kntx_live_${randomBytes(16).toString("hex")}`;
  const [key] = await db.insert(apiKeys).values({
    developerId: developer.id,
    workspaceId: workspace.id,
    name: "Route test key",
    keyPrefix: rawKey.slice(0, 18),
    keyHash: createHash("sha256").update(rawKey).digest("hex"),
    scopes: options.scopes ?? ALL_SCOPES,
    rateLimitPerMinute: options.rateLimitPerMinute ?? 60,
    revokedAt: options.revoked ? new Date() : null,
  }).returning();
  return { workspace, agent, commitment, rawKey, keyId: key.id };
}
function request(fixture: Fixture | { rawKey: string } | null, path: string, init: { method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (fixture) headers.Authorization = `Bearer ${fixture.rawKey}`;
  return new Request(`https://www.keenetix.xyz${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
describe("v1 authentication gate", () => {
  it("rejects a request with no bearer key", async () => {
    const response = await listCommitments(request(null, "/api/v1/commitments"));
    expect(response.status).toBe(401);
  });
  it("rejects a key that does not look like a Keenetix key", async () => {
    const response = await listCommitments(request({ rawKey: "sk_live_something_else" }, "/api/v1/commitments"));
    expect(response.status).toBe(401);
  });
  it("rejects an unknown key", async () => {
    const response = await listCommitments(request({ rawKey: `kntx_live_${"0".repeat(32)}` }, "/api/v1/commitments"));
    expect(response.status).toBe(401);
  });
  it("rejects a revoked key", async () => {
    const fixture = await setup({ revoked: true });
    const response = await listCommitments(request(fixture, "/api/v1/commitments"));
    expect(response.status).toBe(401);
  });
});
describe("v1 scope gate", () => {
  it("refuses to list disputes without disputes:read", async () => {
    const fixture = await setup({ scopes: ["commitments:read"] });
    const response = await listDisputes(request(fixture, "/api/v1/disputes"));
    expect(response.status).toBe(403);
    expect((await response.json() as { error: string }).error).toMatch(/required scope/);
  });
  it("refuses to resolve a dispute with only disputes:read", async () => {
    const fixture = await setup({ scopes: ["disputes:read"] });
    const response = await resolveDispute(request(fixture, "/api/v1/disputes/1/resolve", { method: "POST", body: { outcome: "refund", note: "no" } }), params(1));
    expect(response.status).toBe(403);
  });
  it("refuses to create a commitment with only commitments:read", async () => {
    const fixture = await setup({ scopes: ["commitments:read"] });
    const response = await createCommitment(request(fixture, "/api/v1/commitments", { method: "POST", body: { objective: "x", budget: 10, deadline: new Date().toISOString() } }));
    expect(response.status).toBe(403);
  });
  it("allows a scoped read to succeed", async () => {
    const fixture = await setup({ scopes: ["commitments:read"] });
    const response = await listCommitments(request(fixture, "/api/v1/commitments"));
    expect(response.status).toBe(200);
    expect((await response.json() as { data: unknown[] }).data).toHaveLength(1);
  });
});
describe("v1 rate limiting", () => {
  it("returns 429 once the per-minute budget is spent, and counts every request", async () => {
    const fixture = await setup({ rateLimitPerMinute: 3 });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push((await listCommitments(request(fixture, "/api/v1/commitments"))).status);
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });
  it("does not let concurrent requests race past the limit", async () => {
    const fixture = await setup({ rateLimitPerMinute: 5 });
    const responses = await Promise.all(Array.from({ length: 20 }, () => listCommitments(request(fixture, "/api/v1/commitments"))));
    const allowed = responses.filter((response) => response.status === 200).length;
    expect(allowed).toBe(5);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(15);
  });
  it("starts a fresh window once the previous one has expired", async () => {
    const fixture = await setup({ rateLimitPerMinute: 2 });
    await listCommitments(request(fixture, "/api/v1/commitments"));
    await listCommitments(request(fixture, "/api/v1/commitments"));
    expect((await listCommitments(request(fixture, "/api/v1/commitments"))).status).toBe(429);
    await db.update(apiRateLimits).set({ windowStartedAt: new Date(Date.now() - 61_000) }).where(eq(apiRateLimits.apiKeyId, fixture.keyId));
    expect((await listCommitments(request(fixture, "/api/v1/commitments"))).status).toBe(200);
  });
});
describe("v1 error mapping", () => {
  it("answers a broken rule with 400 and the reason, not a 500", async () => {
    const fixture = await setup();
    await db.insert(disputes).values({ commitmentId: fixture.commitment.id, reason: "first", previousStatus: "verified" });
    await db.update(commitments).set({ status: "disputed" }).where(eq(commitments.id, fixture.commitment.id));
    // Escrow already frozen, so the state guard is what refuses a second dispute.
    const response = await raiseDispute(request(fixture, "/api/v1/disputes", { method: "POST", body: { commitmentId: fixture.commitment.id, reason: "second" } }));
    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toMatch(/no escrow to dispute/);
  });
  it("refuses a duplicate dispute even if the commitment status never froze", async () => {
    const fixture = await setup();
    await db.insert(disputes).values({ commitmentId: fixture.commitment.id, reason: "first", previousStatus: "verified" });
    const response = await raiseDispute(request(fixture, "/api/v1/disputes", { method: "POST", body: { commitmentId: fixture.commitment.id, reason: "second" } }));
    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toMatch(/already exists/);
  });
  it("answers a missing resource with 404", async () => {
    const fixture = await setup();
    const response = await agentReputation(request(fixture, "/api/v1/agents/999999999/reputation"), params(999999999));
    expect(response.status).toBe(404);
  });
  it("does not leak another workspace's escrow through the resolve route", async () => {
    const owner = await setup();
    const stranger = await setup();
    const [dispute] = await db.insert(disputes).values({ commitmentId: owner.commitment.id, reason: "contested", previousStatus: "verified" }).returning();
    await db.update(commitments).set({ status: "disputed" }).where(eq(commitments.id, owner.commitment.id));
    const response = await resolveDispute(request(stranger, `/api/v1/disputes/${dispute.id}/resolve`, { method: "POST", body: { outcome: "refund", note: "not mine" } }), params(dispute.id));
    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toMatch(/funded this commitment/);
    const [unchanged] = await db.select().from(disputes).where(eq(disputes.id, dispute.id)).limit(1);
    expect(unchanged.status).toBe("open");
  });
  it("rejects a malformed dispute id before touching the database", async () => {
    const fixture = await setup();
    const response = await resolveDispute(request(fixture, "/api/v1/disputes/not-a-number/resolve", { method: "POST", body: { outcome: "release", note: "x" } }), { params: Promise.resolve({ id: "not-a-number" }) });
    expect(response.status).toBe(400);
  });
});
describe("v1 pagination", () => {
  it("honours limit and offset and clamps an absurd limit", async () => {
    const fixture = await setup();
    const [developer] = await db.select().from(developerAccounts).where(eq(developerAccounts.organization, `Route Test ${fixture.workspace.slug}`)).limit(1);
    const extra = Array.from({ length: 3 }, (_, index) => ({
      reference: `KX-PAGE-${Math.random().toString(36).slice(2, 8)}-${index}`,
      developerId: developer?.id ?? fixture.commitment.developerId,
      workspaceId: fixture.workspace.id,
      objective: `page ${index}`,
      budget: "10.00",
      deadline: new Date(Date.now() + 86400000),
    }));
    await db.insert(commitments).values(extra);
    const paged = await listCommitments(request(fixture, "/api/v1/commitments?limit=2"));
    expect((await paged.json() as { data: unknown[] }).data).toHaveLength(2);
    const offset = await listCommitments(request(fixture, "/api/v1/commitments?limit=2&offset=3"));
    expect((await offset.json() as { data: unknown[] }).data).toHaveLength(1);
    const absurd = await listCommitments(request(fixture, "/api/v1/commitments?limit=99999"));
    expect(absurd.status).toBe(200);
  });
});
