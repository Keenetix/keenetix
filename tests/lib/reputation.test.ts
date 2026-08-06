import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, commitments, developerAccounts, organizations, reputationRecords, settlements, verificationEvents, workspaces } from "@/db/schema";
import { confirmSettlementReceipt, getAgentReputation, scoreDelivery } from "@/lib/keenetix";
import { TestRegistry } from "../helpers/db-cleanup";
const registry = new TestRegistry();
afterAll(async () => {
  await registry.cleanup();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const ESCROW = `0x${"33".repeat(20)}`;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDC_DECIMALS = 6;
const DAY = 24 * 60 * 60 * 1000;
process.env.EVM_RPC_URL = process.env.EVM_RPC_URL ?? "http://127.0.0.1:8545";
function mockReceipt(amount: bigint, transactionHash: string) {
  const paddedEscrow = ESCROW.slice(2).toLowerCase().padStart(64, "0");
  vi.stubGlobal("fetch", vi.fn(async () => ({
    json: async () => ({ result: { status: "0x1", blockNumber: "0x10", transactionHash, logs: [{ topics: [TRANSFER_TOPIC, `0x${"00".repeat(32)}`, `0x${paddedEscrow}`], data: `0x${amount.toString(16).padStart(64, "0")}` }] } }),
  })));
}
async function setup(options: { deadlineOffset?: number; createdOffset?: number } = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const [organization] = await db.insert(organizations).values({ name: `Reputation Test ${suffix}`, slug: `reputation-test-${suffix}` }).returning();
  registry.trackOrganization(organization.id);
  const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: "Reputation workspace", slug: "main" }).returning();
  const [developer] = await db.insert(developerAccounts).values({ organization: organization.name, email: `reputation_${suffix}@example.test` }).returning();
  registry.trackDeveloperAccount(developer.id);
  const [agent] = await db.insert(agents).values({ workspaceId: workspace.id, name: "Scored Agent", role: "tester", walletAddress: "0xagent", reputation: "70.00", completedCommitments: 0, totalEarnings: "0.00" }).returning();
  const [commitment] = await db.insert(commitments).values({
    reference: `KX-REP-${suffix}`,
    developerId: developer.id,
    workspaceId: workspace.id,
    assignedAgentId: agent.id,
    objective: "scored work",
    budget: "500.00",
    createdAt: new Date(Date.now() - (options.createdOffset ?? DAY)),
    deadline: new Date(Date.now() + (options.deadlineOffset ?? DAY)),
    status: "verified",
  }).returning();
  return { workspace, agent, commitment };
}
describe("scoreDelivery", () => {
  const createdAt = new Date(0);
  const deadline = new Date(10 * DAY);
  it("gives a full score for on-time delivery with every condition passing", () => {
    const score = scoreDelivery({ createdAt, deadline }, [{ type: "ci_attestation", status: "passed" }, { type: "security_scan", status: "passed" }], new Date(5 * DAY));
    expect(score.reliability).toBe("100.00");
    expect(score.quality).toBe("100.00");
    expect(score.efficiency).toBe("75.00");
  });
  it("scores quality by the share of conditions that passed, ignoring the creation event", () => {
    const score = scoreDelivery({ createdAt, deadline }, [{ type: "commitment_created", status: "passed" }, { type: "ci_attestation", status: "passed" }, { type: "security_scan", status: "failed" }], new Date(5 * DAY));
    expect(score.quality).toBe("50.00");
  });
  it("docks reliability ten points per day late and floors efficiency at zero", () => {
    const score = scoreDelivery({ createdAt, deadline }, [{ type: "ci_attestation", status: "passed" }], new Date(13 * DAY));
    expect(score.reliability).toBe("70.00");
    expect(score.efficiency).toBe("35.00");
  });
  it("treats a commitment with no verification conditions as full quality", () => {
    const score = scoreDelivery({ createdAt, deadline }, [], new Date(10 * DAY));
    expect(score.quality).toBe("100.00");
    expect(score.efficiency).toBe("50.00");
  });
});
describe("reputation records", () => {
  it("writes derived axis scores on settlement instead of fixed values", async () => {
    const { workspace, agent, commitment } = await setup();
    await db.insert(verificationEvents).values([
      { commitmentId: commitment.id, type: "commitment_created", provider: "Keenetix API", status: "passed" },
      { commitmentId: commitment.id, type: "ci_attestation", provider: "GitHub Actions", status: "passed" },
      { commitmentId: commitment.id, type: "security_scan", provider: "Snyk", status: "failed" },
    ]);
    const transactionHash = `0x${"1a".repeat(32)}`;
    await db.insert(settlements).values({ commitmentId: commitment.id, amount: commitment.budget, asset: "USDC", status: "submitted", transactionHash, escrowAddress: ESCROW, chainId: 1 });
    mockReceipt(BigInt(500 * 10 ** USDC_DECIMALS), transactionHash);
    await confirmSettlementReceipt({ workspaceId: workspace.id, transactionHash });
    const [record] = await db.select().from(reputationRecords).where(eq(reputationRecords.agentId, agent.id)).limit(1);
    // One of two conditions passed, and it landed before the deadline.
    expect(record.quality).toBe("50.00");
    expect(record.reliability).toBe("100.00");
    // A half-quality delivery earns less than the full 0.20.
    expect(Number(record.delta)).toBeGreaterThan(0);
    expect(Number(record.delta)).toBeLessThan(0.2);
  });
  it("reports the record series with rolling averages and net movement", async () => {
    const { workspace, agent, commitment } = await setup();
    await db.insert(reputationRecords).values([
      { agentId: agent.id, commitmentId: commitment.id, reliability: "100.00", quality: "80.00", efficiency: "60.00", delta: "0.20", note: "Verified on-chain settlement confirmed" },
      { agentId: agent.id, commitmentId: commitment.id, reliability: "0.00", quality: "0.00", efficiency: "0.00", delta: "-1.50", note: "Dispute resolved as a full refund to the funder" },
    ]);
    const report = await getAgentReputation(agent.id, workspace.id);
    expect(report.summary.records).toBe(2);
    expect(report.summary.reliability).toBe(50);
    expect(report.summary.quality).toBe(40);
    expect(report.summary.efficiency).toBe(30);
    expect(report.summary.positive).toBe(1);
    expect(report.summary.negative).toBe(1);
    expect(report.summary.netDelta).toBe(-1.3);
    expect(report.records[0].reference).toBe(commitment.reference);
  });
  it("refuses to read an agent belonging to another workspace", async () => {
    const { agent } = await setup();
    const other = await setup();
    await expect(getAgentReputation(agent.id, other.workspace.id)).rejects.toThrow(/not found in this workspace/);
  });
  it("reports an empty record set rather than failing for a fresh agent", async () => {
    const { workspace, agent } = await setup();
    const report = await getAgentReputation(agent.id, workspace.id);
    expect(report.summary.records).toBe(0);
    expect(report.summary.reliability).toBeNull();
    expect(report.summary.netDelta).toBe(0);
  });
});
