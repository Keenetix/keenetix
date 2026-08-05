import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, commitments, developerAccounts, organizations, settlements, workspaces } from "@/db/schema";
import { confirmSettlementReceipt } from "@/lib/keenetix";
import { TestRegistry } from "../helpers/db-cleanup";
const registry = new TestRegistry();
afterAll(async () => {
  await registry.cleanup();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const ESCROW = `0x${"11".repeat(20)}`;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDC_DECIMALS = 6;
process.env.EVM_RPC_URL = process.env.EVM_RPC_URL ?? "http://127.0.0.1:8545";
async function setupCommitment(budget: number, transactionHash: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const [organization] = await db.insert(organizations).values({ name: `Settlement Test ${suffix}`, slug: `settlement-test-${suffix}` }).returning();
  registry.trackOrganization(organization.id);
  const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: "Settlement workspace", slug: "main" }).returning();
  const [developer] = await db.insert(developerAccounts).values({ organization: organization.name, email: `settlement_${suffix}@example.test` }).returning();
  registry.trackDeveloperAccount(developer.id);
  const [agent] = await db.insert(agents).values({ workspaceId: workspace.id, name: "Test Agent", role: "tester", walletAddress: "0xagent", reputation: "50.00", completedCommitments: 0, totalEarnings: "0.00" }).returning();
  const [commitment] = await db.insert(commitments).values({ reference: `KX-TEST-${suffix}`, developerId: developer.id, workspaceId: workspace.id, assignedAgentId: agent.id, objective: "test settlement", budget: budget.toFixed(2), deadline: new Date(Date.now() + 86400000), status: "verified" }).returning();
  await db.insert(settlements).values({ commitmentId: commitment.id, amount: commitment.budget, asset: "USDC", status: "submitted", transactionHash, escrowAddress: ESCROW, chainId: 1 });
  return { workspace, commitment, agent };
}
function mockReceipt(amount: bigint, transactionHash: string) {
  const data = `0x${amount.toString(16).padStart(64, "0")}`;
  const paddedEscrow = ESCROW.slice(2).toLowerCase().padStart(64, "0");
  vi.stubGlobal("fetch", vi.fn(async () => ({
    json: async () => ({ result: { status: "0x1", blockNumber: "0x10", transactionHash, logs: [{ topics: [TRANSFER_TOPIC, `0x${"00".repeat(32)}`, `0x${paddedEscrow}`], data }] } }),
  })));
}
describe("settlement confirmation idempotency", () => {
  it("settles once and does not double-credit the agent on repeated confirmation calls", async () => {
    const transactionHash = `0x${"ab".repeat(32)}`;
    const budget = 500;
    const { workspace, commitment, agent } = await setupCommitment(budget, transactionHash);
    const amount = BigInt(Math.round(budget * 10 ** USDC_DECIMALS));
    mockReceipt(amount, transactionHash);
    const first = await confirmSettlementReceipt({ workspaceId: workspace.id, transactionHash });
    expect(first.status).toBe("settled");
    const [afterFirst] = await db.select().from(agents).where(eq(agents.id, agent.id)).limit(1);
    expect(afterFirst.completedCommitments).toBe(1);
    const second = await confirmSettlementReceipt({ workspaceId: workspace.id, transactionHash });
    expect(second.status).toBe("settled");
    const [afterSecond] = await db.select().from(agents).where(eq(agents.id, agent.id)).limit(1);
    expect(afterSecond.completedCommitments).toBe(1);
    expect(Number(afterSecond.totalEarnings)).toBe(budget);
    const [commitmentRow] = await db.select().from(commitments).where(eq(commitments.id, commitment.id)).limit(1);
    expect(commitmentRow.status).toBe("settled");
  });
  it("rejects a receipt that pays the wrong amount to the escrow", async () => {
    const transactionHash = `0x${"cd".repeat(32)}`;
    const { workspace } = await setupCommitment(250, transactionHash);
    mockReceipt(BigInt(1), transactionHash);
    await expect(confirmSettlementReceipt({ workspaceId: workspace.id, transactionHash })).rejects.toThrow(/does not pay the required amount/);
  });
});
