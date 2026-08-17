import { createHash, randomBytes } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, apiKeys, commitments, developerAccounts, disputes, organizations, workspaces } from "@/db/schema";
import { TestRegistry } from "../helpers/db-cleanup";
import { Keenetix, KeenetixError } from "../../packages/keenetix-sdk/src/index.js";
import { GET as listCommitments, POST as createCommitment } from "@/app/api/v1/commitments/route";
import { GET as listAgents } from "@/app/api/v1/agents/route";
import { GET as agentReputation } from "@/app/api/v1/agents/[id]/reputation/route";
import { GET as listDisputes, POST as raiseDispute } from "@/app/api/v1/disputes/route";
import { POST as resolveDispute } from "@/app/api/v1/disputes/[id]/resolve/route";
import { POST as registerAgent } from "@/app/api/v1/agents/register/route";
import { POST as oracleVerification } from "@/app/api/v1/verifications/oracle/route";
import { POST as submitSettlement } from "@/app/api/v1/settlements/route";
import { GET as listAudit } from "@/app/api/v1/audit/route";
const registry = new TestRegistry();
afterAll(async () => {
  await registry.cleanup();
});
/**
 * Routes the SDK's fetch straight into the real handlers, so the client's declared response
 * types are checked against what the API actually returns rather than a hand-written mock.
 */
function routedFetch(): typeof globalThis.fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as string, init);
    const { pathname } = new URL(request.url);
    const reputation = pathname.match(/^\/api\/v1\/agents\/(\d+)\/reputation$/);
    if (reputation) return agentReputation(request, { params: Promise.resolve({ id: reputation[1] }) });
    const resolve = pathname.match(/^\/api\/v1\/disputes\/(\d+)\/resolve$/);
    if (resolve) return resolveDispute(request, { params: Promise.resolve({ id: resolve[1] }) });
    if (pathname === "/api/v1/commitments") return request.method === "POST" ? createCommitment(request) : listCommitments(request);
    if (pathname === "/api/v1/agents") return listAgents(request);
    if (pathname === "/api/v1/agents/register") return registerAgent(request);
    if (pathname === "/api/v1/disputes") return request.method === "POST" ? raiseDispute(request) : listDisputes(request);
    if (pathname === "/api/v1/verifications/oracle") return oracleVerification(request);
    if (pathname === "/api/v1/settlements") return submitSettlement(request);
    if (pathname === "/api/v1/audit") return listAudit(request);
    throw new Error(`Unrouted path in test: ${pathname}`);
  }) as typeof globalThis.fetch;
}
async function setup(scopes?: string[]) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const [organization] = await db.insert(organizations).values({ name: `SDK Test ${suffix}`, slug: `sdk-test-${suffix}` }).returning();
  registry.trackOrganization(organization.id);
  const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: "SDK workspace", slug: "main" }).returning();
  const [developer] = await db.insert(developerAccounts).values({ organization: organization.name, email: `sdk_${suffix}@example.test` }).returning();
  registry.trackDeveloperAccount(developer.id);
  const [agent] = await db.insert(agents).values({ workspaceId: workspace.id, name: "SDK Agent", role: "tester", walletAddress: "0xagent", reputation: "80.00" }).returning();
  const [commitment] = await db.insert(commitments).values({ reference: `KX-SDK-${suffix}`, developerId: developer.id, workspaceId: workspace.id, assignedAgentId: agent.id, objective: "sdk work", budget: "1000.00", deadline: new Date(Date.now() + 86400000), status: "verified" }).returning();
  const rawKey = `kntx_live_${randomBytes(16).toString("hex")}`;
  await db.insert(apiKeys).values({
    developerId: developer.id,
    workspaceId: workspace.id,
    name: "SDK test key",
    keyPrefix: rawKey.slice(0, 18),
    keyHash: createHash("sha256").update(rawKey).digest("hex"),
    scopes: scopes ?? ["commitments:read", "commitments:write", "agents:read", "agents:write", "disputes:read", "disputes:write"],
    rateLimitPerMinute: 120,
  });
  const client = new Keenetix({ apiKey: rawKey, baseUrl: "https://www.keenetix.xyz", fetch: routedFetch() });
  return { workspace, agent, commitment, client };
}
describe("Keenetix client", () => {
  it("refuses to construct without an API key", () => {
    expect(() => new Keenetix({ apiKey: "" })).toThrow(/API key is required/);
  });
  it("lists commitments with the declared shape", async () => {
    const { client, commitment } = await setup();
    const list = await client.commitments.list();
    expect(list).toHaveLength(1);
    expect(list[0].reference).toBe(commitment.reference);
    expect(list[0].assignedAgentName).toBe("SDK Agent");
    expect(list[0].status).toBe("verified");
    expect(typeof list[0].budget).toBe("string");
  });
  it("passes pagination through to the query string", async () => {
    const { client, workspace, commitment } = await setup();
    await db.insert(commitments).values({ reference: `KX-SDK2-${Math.random().toString(36).slice(2, 8)}`, developerId: commitment.developerId, workspaceId: workspace.id, objective: "second", budget: "5.00", deadline: new Date(Date.now() + 86400000) });
    expect(await client.commitments.list({ limit: 1 })).toHaveLength(1);
    expect(await client.commitments.list({ limit: 10 })).toHaveLength(2);
  });
  it("creates a commitment and returns the full row", async () => {
    const { client } = await setup();
    const created = await client.commitments.create({ objective: "Ship the auth refactor", budget: 4800, deadline: new Date(Date.now() + 86400000).toISOString(), verificationRules: ["ci.checks.passing"] });
    expect(created.reference).toMatch(/^KX-/);
    expect(created.status).toBe("draft");
    expect(created.verificationRules).toEqual(["ci.checks.passing"]);
  });
  it("reads an agent's reputation report", async () => {
    const { client, agent } = await setup();
    const report = await client.agents.reputation(agent.id);
    expect(report.agent.name).toBe("SDK Agent");
    expect(report.summary.records).toBe(0);
    expect(report.summary.reliability).toBeNull();
  });
  it("raises and resolves a dispute through the client", async () => {
    const { client, commitment } = await setup();
    const dispute = await client.disputes.raise({ commitmentId: commitment.id, reason: "Delivered branch does not build." });
    expect(dispute.status).toBe("open");
    expect(dispute.previousStatus).toBe("verified");
    const listed = await client.disputes.list();
    expect(listed[0].reference).toBe(commitment.reference);
    expect(listed[0].agentName).toBe("SDK Agent");
    const result = await client.disputes.resolve(dispute.id, { outcome: "split", splitBps: 2500, note: "Quarter of the scope landed." });
    expect(result.award).toBe("250.00");
    expect(result.commitmentStatus).toBe("verified");
    expect(result.dispute.outcome).toBe("split");
  });
  it("throws a KeenetixError carrying the status and reason", async () => {
    const { client, commitment } = await setup();
    await db.insert(disputes).values({ commitmentId: commitment.id, reason: "first", previousStatus: "verified" });
    await db.update(commitments).set({ status: "disputed" }).where(eq(commitments.id, commitment.id));
    const failure = await client.disputes.raise({ commitmentId: commitment.id, reason: "second" }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(KeenetixError);
    const error = failure as KeenetixError;
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/no escrow to dispute/);
    expect(error.isAuthError).toBe(false);
    expect(error.isRateLimited).toBe(false);
  });
  it("registers an agent and returns the declared shape", async () => {
    const { client } = await setup(["agents:read", "agents:write"]);
    const agent = await client.agents.register({ name: "Registered", role: "worker", description: "does things", hourlyRate: 120, stakeAmount: 500, walletAddress: "0xfeed", capabilities: ["typescript"] });
    expect(agent.name).toBe("Registered");
    expect(agent.reputation).toBe("50.00");
    expect(agent.capabilities).toEqual(["typescript"]);
  });
  it("records an oracle verification event", async () => {
    const { client, commitment } = await setup(["verifications:write", "commitments:read"]);
    const event = await client.verifications.oracle({ commitmentReference: commitment.reference, provider: "GitHub Actions", type: "ci_attestation", evidence: { checks: 12 }, status: "passed" });
    expect(event.commitmentId).toBe(commitment.id);
    expect(event.status).toBe("passed");
    expect(event.evidence).toEqual({ checks: 12 });
    expect(event.attestor).toBe("oracle-adapter");
  });
  it("submits a settlement receipt with the input the types describe", async () => {
    const { client, commitment } = await setup(["settlements:write"]);
    const settlement = await client.settlements.submit({ commitmentId: commitment.id, transactionHash: `0x${"ab".repeat(32)}`, escrowAddress: `0x${"cd".repeat(20)}`, chain: "evm", chainId: 1 });
    expect(settlement.commitmentId).toBe(commitment.id);
    expect(settlement.status).toBe("submitted");
    expect(settlement.amount).toBe("1000.00");
  });
  it("lists audit entries", async () => {
    const { client } = await setup(["audit:read", "commitments:read"]);
    await client.commitments.list();
    const entries = await client.audit.list();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].action).toBe("api.request");
    expect(typeof entries[0].metadata).toBe("object");
  });
  it("flags a scope refusal as an auth error", async () => {
    const { client } = await setup(["commitments:read"]);
    const failure = await client.disputes.list().catch((error: unknown) => error) as KeenetixError;
    expect(failure).toBeInstanceOf(KeenetixError);
    expect(failure.status).toBe(403);
    expect(failure.isAuthError).toBe(true);
    expect(failure.path).toBe("/api/v1/disputes");
  });
});

describe("settlement input typing", () => {
  it("rejects an EVM receipt with no chainId, so the type has to require one", async () => {
    const { client, commitment } = await setup(["settlements:write"]);
    // Cast past the fixed type to prove the API really does refuse this payload.
    const failure = await client.settlements.submit({
      commitmentId: commitment.id,
      transactionHash: `0x${"ab".repeat(32)}`,
      escrowAddress: `0x${"cd".repeat(20)}`,
      chain: "evm",
    } as unknown as Parameters<typeof client.settlements.submit>[0]).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(KeenetixError);
    expect((failure as KeenetixError).status).toBe(400);
  });
  it("accepts a Solana receipt without a chainId", async () => {
    const { client, commitment } = await setup(["settlements:write"]);
    const settlement = await client.settlements.submit({
      commitmentId: commitment.id,
      transactionHash: "5".repeat(80),
      escrowAddress: "9".repeat(40),
      chain: "solana",
    });
    expect(settlement.chain).toBe("solana");
    expect(settlement.chainId).toBeNull();
  });
});

describe("timeouts", () => {
  it("aborts a stalled request and reports it as a timeout", async () => {
    const stalled: typeof globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })) as typeof globalThis.fetch;
    const client = new Keenetix({ apiKey: "kntx_live_x", fetch: stalled, timeoutMs: 120 });
    const failure = await client.commitments.list().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(KeenetixError);
    expect((failure as KeenetixError).status).toBe(408);
    expect((failure as KeenetixError).message).toMatch(/timed out/);
  });
});
