import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, commitments, developerAccounts, organizations, settlements, workspaces } from "@/db/schema";
import { TestRegistry } from "../helpers/db-cleanup";
const registry = new TestRegistry();
afterAll(async () => {
  await registry.cleanup();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@solana/web3.js");
  vi.resetModules();
});
const ESCROW_TOKEN_ACCOUNT = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
const USDC_DECIMALS = 6;
async function setupCommitment(budget: number, transactionHash: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const [organization] = await db.insert(organizations).values({ name: `Solana Settlement Test ${suffix}`, slug: `solana-settlement-test-${suffix}` }).returning();
  registry.trackOrganization(organization.id);
  const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: "Solana Settlement workspace", slug: "main" }).returning();
  const [developer] = await db.insert(developerAccounts).values({ organization: organization.name, email: `solana_settlement_${suffix}@example.test` }).returning();
  registry.trackDeveloperAccount(developer.id);
  const [agent] = await db.insert(agents).values({ workspaceId: workspace.id, name: "Test Agent", role: "tester", walletAddress: "solana-agent", reputation: "50.00", completedCommitments: 0, totalEarnings: "0.00" }).returning();
  const [commitment] = await db.insert(commitments).values({ reference: `KX-SOL-${suffix}`, developerId: developer.id, workspaceId: workspace.id, assignedAgentId: agent.id, objective: "test solana settlement", budget: budget.toFixed(2), deadline: new Date(Date.now() + 86400000), status: "verified" }).returning();
  await db.insert(settlements).values({ commitmentId: commitment.id, amount: commitment.budget, asset: "USDC", status: "submitted", chain: "solana", transactionHash, escrowAddress: ESCROW_TOKEN_ACCOUNT });
  return { workspace, commitment, agent };
}
function mockParsedTransaction(paidUnits: string, destination: string) {
  vi.stubEnv("SOLANA_RPC_URL", "https://example.invalid/rpc");
  vi.doMock("@solana/web3.js", () => ({
    Connection: class {
      async getParsedTransaction() {
        return {
          slot: 42,
          meta: { err: null },
          transaction: { message: { instructions: [{ program: "spl-token", parsed: { type: "transferChecked", info: { destination, tokenAmount: { amount: paidUnits } } } }] } },
        };
      }
    },
  }));
}
describe("solana settlement confirmation", () => {
  it("settles once an SPL transfer to the escrow token account is observed", async () => {
    const transactionHash = "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi";
    const budget = 500;
    const { workspace, commitment, agent } = await setupCommitment(budget, transactionHash);
    const amount = (BigInt(Math.round(budget * 10 ** USDC_DECIMALS))).toString();
    mockParsedTransaction(amount, ESCROW_TOKEN_ACCOUNT);
    const { confirmSettlementReceipt } = await import("@/lib/keenetix");
    const first = await confirmSettlementReceipt({ workspaceId: workspace.id, transactionHash });
    expect(first.status).toBe("settled");
    const [afterFirst] = await db.select().from(agents).where(eq(agents.id, agent.id)).limit(1);
    expect(afterFirst.completedCommitments).toBe(1);
    const [commitmentRow] = await db.select().from(commitments).where(eq(commitments.id, commitment.id)).limit(1);
    expect(commitmentRow.status).toBe("settled");
  });
  it("rejects an SPL transfer that pays the wrong amount", async () => {
    const transactionHash = "3xqM1kzXk3sVfmvcz9qC6vXsHktZoNQezA9zP58aebi9";
    const { workspace } = await setupCommitment(250, transactionHash);
    mockParsedTransaction("1", ESCROW_TOKEN_ACCOUNT);
    const { confirmSettlementReceipt } = await import("@/lib/keenetix");
    await expect(confirmSettlementReceipt({ workspaceId: workspace.id, transactionHash })).rejects.toThrow(/does not pay the required amount/);
  });
});
