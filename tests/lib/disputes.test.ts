import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, commitments, developerAccounts, disputes, organizations, reputationRecords, settlements, users, workspaces } from "@/db/schema";
import { confirmSettlementReceipt, createDispute, resolveDispute, submitSettlementReceipt } from "@/lib/keenetix";
import { TestRegistry } from "../helpers/db-cleanup";
const registry = new TestRegistry();
afterAll(async () => {
  await registry.cleanup();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const ESCROW = `0x${"22".repeat(20)}`;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDC_DECIMALS = 6;
process.env.EVM_RPC_URL = process.env.EVM_RPC_URL ?? "http://127.0.0.1:8545";
function mockReceipt(amount: bigint, transactionHash: string) {
  const paddedEscrow = ESCROW.slice(2).toLowerCase().padStart(64, "0");
  vi.stubGlobal("fetch", vi.fn(async () => ({
    json: async () => ({ result: { status: "0x1", blockNumber: "0x10", transactionHash, logs: [{ topics: [TRANSFER_TOPIC, `0x${"00".repeat(32)}`, `0x${paddedEscrow}`], data: `0x${amount.toString(16).padStart(64, "0")}` }] } }),
  })));
}
async function setupDisputable(status = "verified", budget = 1000) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const [organization] = await db.insert(organizations).values({ name: `Dispute Test ${suffix}`, slug: `dispute-test-${suffix}` }).returning();
  registry.trackOrganization(organization.id);
  const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: "Dispute workspace", slug: "main" }).returning();
  const email = `dispute_${suffix}@example.test`;
  const [user] = await db.insert(users).values({ name: "Dispute Owner", email, passwordHash: "x" }).returning();
  registry.trackEmail(email);
  const [developer] = await db.insert(developerAccounts).values({ organization: organization.name, email: `dev_${email}` }).returning();
  registry.trackDeveloperAccount(developer.id);
  const [agent] = await db.insert(agents).values({ workspaceId: workspace.id, name: "Disputed Agent", role: "tester", walletAddress: "0xagent", reputation: "80.00", status: "executing", completedCommitments: 4, totalEarnings: "900.00" }).returning();
  const [commitment] = await db.insert(commitments).values({ reference: `KX-DSP-${suffix}`, developerId: developer.id, workspaceId: workspace.id, assignedAgentId: agent.id, objective: "contested work", budget: budget.toFixed(2), deadline: new Date(Date.now() + 86400000), status }).returning();
  return { workspace, user, agent, commitment };
}
describe("dispute resolution", () => {
  it("restores the frozen lifecycle state when the claim is released", async () => {
    const { workspace, user, commitment } = await setupDisputable("executing");
    const dispute = await createDispute({ commitmentId: commitment.id, userId: user.id, workspaceId: workspace.id, reason: "Delivered branch does not build." });
    const [frozen] = await db.select().from(commitments).where(eq(commitments.id, commitment.id)).limit(1);
    expect(frozen.status).toBe("disputed");
    const result = await resolveDispute({ disputeId: dispute.id, workspaceId: workspace.id, outcome: "release", note: "Build failure was a stale cache.", userId: user.id });
    expect(result.commitmentStatus).toBe("executing");
    const [resumed] = await db.select().from(commitments).where(eq(commitments.id, commitment.id)).limit(1);
    expect(resumed.status).toBe("executing");
  });
  it("refunds the funder, cancels pending settlement, and penalises the agent", async () => {
    const { workspace, user, agent, commitment } = await setupDisputable("awaiting_settlement");
    await db.insert(settlements).values({ commitmentId: commitment.id, amount: commitment.budget, asset: "USDC", status: "awaiting_wallet" });
    const dispute = await createDispute({ commitmentId: commitment.id, userId: user.id, workspaceId: workspace.id, reason: "Work was never delivered." });
    const result = await resolveDispute({ disputeId: dispute.id, workspaceId: workspace.id, outcome: "refund", note: "No deliverable produced by the deadline.", userId: user.id });
    expect(result.commitmentStatus).toBe("refunded");
    const [settlement] = await db.select().from(settlements).where(eq(settlements.commitmentId, commitment.id)).limit(1);
    expect(settlement.status).toBe("cancelled");
    const [worker] = await db.select().from(agents).where(eq(agents.id, agent.id)).limit(1);
    expect(Number(worker.reputation)).toBe(78.5);
    expect(worker.status).toBe("available");
    expect(Number(worker.totalEarnings)).toBe(900);
    const [record] = await db.select().from(reputationRecords).where(eq(reputationRecords.commitmentId, commitment.id)).limit(1);
    expect(Number(record.delta)).toBe(-1.5);
  });
  it("writes the reduced award onto the settlement row when the escrow is split", async () => {
    const { workspace, user, agent, commitment } = await setupDisputable("verified", 1000);
    const dispute = await createDispute({ commitmentId: commitment.id, userId: user.id, workspaceId: workspace.id, reason: "Only part of the scope landed." });
    const result = await resolveDispute({ disputeId: dispute.id, workspaceId: workspace.id, outcome: "split", splitBps: 4000, note: "Two of five conditions met.", userId: user.id });
    expect(result.award).toBe("400.00");
    expect(result.commitmentStatus).toBe("verified");
    const [settlement] = await db.select().from(settlements).where(eq(settlements.commitmentId, commitment.id)).limit(1);
    expect(Number(settlement.amount)).toBe(400);
    expect(settlement.status).toBe("awaiting_wallet");
    const [worker] = await db.select().from(agents).where(eq(agents.id, agent.id)).limit(1);
    expect(Number(worker.reputation)).toBe(79.5);
  });
  it("settles a split award on-chain for the reduced amount, not the full budget", async () => {
    const { workspace, user, agent, commitment } = await setupDisputable("verified", 1000);
    const dispute = await createDispute({ commitmentId: commitment.id, userId: user.id, workspaceId: workspace.id, reason: "Partial delivery." });
    await resolveDispute({ disputeId: dispute.id, workspaceId: workspace.id, outcome: "split", splitBps: 4000, note: "Two of five conditions met.", userId: user.id });
    const transactionHash = `0x${"ef".repeat(32)}`;
    await submitSettlementReceipt({ workspaceId: workspace.id, commitmentId: commitment.id, transactionHash, chain: "evm", chainId: 1, escrowAddress: ESCROW });
    // The escrow pays the awarded 400, so a receipt for the full 1000 must not be accepted.
    mockReceipt(BigInt(1000 * 10 ** USDC_DECIMALS), transactionHash);
    await expect(confirmSettlementReceipt({ workspaceId: workspace.id, transactionHash })).rejects.toThrow(/does not pay the required amount/);
    mockReceipt(BigInt(400 * 10 ** USDC_DECIMALS), transactionHash);
    const result = await confirmSettlementReceipt({ workspaceId: workspace.id, transactionHash });
    expect(result.status).toBe("settled");
    const [worker] = await db.select().from(agents).where(eq(agents.id, agent.id)).limit(1);
    expect(Number(worker.totalEarnings)).toBe(1300);
  });
  it("rejects a second resolution of the same dispute", async () => {
    const { workspace, user, commitment } = await setupDisputable();
    const dispute = await createDispute({ commitmentId: commitment.id, userId: user.id, workspaceId: workspace.id, reason: "Contested." });
    await resolveDispute({ disputeId: dispute.id, workspaceId: workspace.id, outcome: "release", note: "Resolved in the worker's favour.", userId: user.id });
    await expect(resolveDispute({ disputeId: dispute.id, workspaceId: workspace.id, outcome: "refund", note: "Changed my mind.", userId: user.id })).rejects.toThrow(/already been resolved/);
  });
  it("refuses to resolve a dispute over another workspace's escrow", async () => {
    const { workspace, user, commitment } = await setupDisputable();
    const other = await setupDisputable();
    const dispute = await createDispute({ commitmentId: commitment.id, userId: user.id, workspaceId: workspace.id, reason: "Contested." });
    await expect(resolveDispute({ disputeId: dispute.id, workspaceId: other.workspace.id, outcome: "refund", note: "Not mine to decide.", userId: other.user.id })).rejects.toThrow(/funded this commitment/);
    const [stillOpen] = await db.select().from(disputes).where(and(eq(disputes.id, dispute.id), eq(disputes.status, "open"))).limit(1);
    expect(stillOpen).toBeTruthy();
  });
  it("refuses to dispute a commitment that holds no escrow", async () => {
    const { workspace, user, commitment } = await setupDisputable("settled");
    await expect(createDispute({ commitmentId: commitment.id, userId: user.id, workspaceId: workspace.id, reason: "Too late." })).rejects.toThrow(/no escrow to dispute/);
    const [untouched] = await db.select().from(commitments).where(eq(commitments.id, commitment.id)).limit(1);
    expect(untouched.status).toBe("settled");
  });
  it("rejects a split outside the 1–9999 basis point range", async () => {
    const { workspace, user, commitment } = await setupDisputable();
    const dispute = await createDispute({ commitmentId: commitment.id, userId: user.id, workspaceId: workspace.id, reason: "Contested." });
    await expect(resolveDispute({ disputeId: dispute.id, workspaceId: workspace.id, outcome: "split", splitBps: 10000, note: "All of it.", userId: user.id })).rejects.toThrow(/basis points/);
  });
});
