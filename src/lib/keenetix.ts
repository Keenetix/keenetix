import { createHash } from "crypto";
import { and, desc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { agents, apiKeys, commitmentBids, commitments, developerAccounts, disputes, organizations, reputationRecords, settlements, users, verificationEvents, verificationIntegrations, workspaceMemberships, workspaces } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/api-security";
const PUBLIC_DEMO_EMAIL = "demo@keenetix.local";
const PUBLIC_DEMO_WORKSPACE = "public-demo";
export type DemoAction = "fund" | "assign" | "verify" | "settle" | "reset";
const defaultRules = ["All CI checks pass", "Security scan is clear", "Reviewer attestation recorded"];
export async function ensureWorkspace(workspaceId: number) {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!workspace) throw new Error("Workspace not found.");
  const systemEmail = `workspace-${workspace.id}@keenetix.local`;
  let [account] = await db.select().from(developerAccounts).where(eq(developerAccounts.email, systemEmail)).limit(1);
  if (!account) [account] = await db.insert(developerAccounts).values({ organization: workspace.name, email: systemEmail }).returning();
  let workerList = await db.select().from(agents).where(eq(agents.workspaceId, workspace.id)).orderBy(agents.id);
  if (!workerList.length) {
    const isPublic = workspace.slug === PUBLIC_DEMO_WORKSPACE;
    workerList = await db.insert(agents).values([
      { workspaceId: workspace.id, name: "Iris", role: "Software engineering agent", description: "Autonomous full-stack software delivery, test remediation, and refactors.", capabilities: ["typescript", "github", "ci-cd", "security"], hourlyRate: "125.00", stakeAmount: "2400.00", isPublic, walletAddress: "0x8d31...bE4a", reputation: "98.70", completedCommitments: 128, totalEarnings: "48200.00" },
      { workspaceId: workspace.id, name: "Vector", role: "Infrastructure agent", description: "Deployments, cloud reliability, and infrastructure-as-code execution.", capabilities: ["terraform", "kubernetes", "aws", "deployments"], hourlyRate: "148.00", stakeAmount: "3100.00", isPublic, walletAddress: "0x5c12...Aa11", reputation: "97.90", completedCommitments: 94, totalEarnings: "39750.00" },
      { workspaceId: workspace.id, name: "Morrow", role: "Verification agent", description: "Independent CI, security, and delivery proof attestation.", capabilities: ["verification", "security", "attestation"], hourlyRate: "92.00", stakeAmount: "5200.00", isPublic, walletAddress: "0x7f99...D210", reputation: "99.10", completedCommitments: 211, totalEarnings: "61350.00" },
    ]).returning();
  }
  const [integration] = await db.select().from(verificationIntegrations).where(and(eq(verificationIntegrations.workspaceId, workspace.id), eq(verificationIntegrations.provider, "github"))).limit(1);
  if (!integration) await db.insert(verificationIntegrations).values({ workspaceId: workspace.id, provider: "github", status: "ready", configuration: { eventTypes: ["workflow_run", "check_run", "deployment_status"] } });
  return { workspace, account, workers: workerList };
}
export async function recordVerificationOutcome(commitmentId: number, passed: boolean) {
  if (!passed) return;
  await db.update(commitments).set({ status: "verified", updatedAt: new Date() }).where(and(eq(commitments.id, commitmentId), inArray(commitments.status, ["funded", "executing"])));
}
async function ensurePublicDemoWorkspace() {
  let [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, PUBLIC_DEMO_WORKSPACE)).limit(1);
  if (!workspace) {
    let [demoUser] = await db.select().from(users).where(eq(users.email, PUBLIC_DEMO_EMAIL)).limit(1);
    if (!demoUser) [demoUser] = await db.insert(users).values({ name: "Keenetix Demo", email: PUBLIC_DEMO_EMAIL, passwordHash: hashPassword(`demo-${Date.now()}-${Math.random()}`) }).returning();
    const [organization] = await db.insert(organizations).values({ name: "Keenetix Demo Network", slug: "keenetix-demo-network" }).returning();
    [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: "Public lifecycle demonstration", slug: PUBLIC_DEMO_WORKSPACE }).returning();
    await db.insert(workspaceMemberships).values({ userId: demoUser.id, workspaceId: workspace.id, role: "owner" });
  }
  return workspace;
}
export async function getDashboardData(workspaceId: number) {
  const { workspace } = await ensureWorkspace(workspaceId);
  const [commitmentRows, workerRows, keyRows, settlementRows] = await Promise.all([
    db.select({ id: commitments.id, reference: commitments.reference, objective: commitments.objective, budget: commitments.budget, asset: commitments.asset, deadline: commitments.deadline, status: commitments.status, assignedAgentName: agents.name, createdAt: commitments.createdAt }).from(commitments).leftJoin(agents, eq(commitments.assignedAgentId, agents.id)).where(eq(commitments.workspaceId, workspace.id)).orderBy(desc(commitments.createdAt)),
    db.select().from(agents).where(eq(agents.workspaceId, workspace.id)).orderBy(desc(agents.reputation)),
    db.select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, scopes: apiKeys.scopes, rateLimitPerMinute: apiKeys.rateLimitPerMinute, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(and(eq(apiKeys.workspaceId, workspace.id), isNull(apiKeys.revokedAt))).orderBy(desc(apiKeys.createdAt)),
    db.select({ amount: settlements.amount, status: settlements.status }).from(settlements).innerJoin(commitments, eq(settlements.commitmentId, commitments.id)).where(eq(commitments.workspaceId, workspace.id)),
  ]);
  const settledValue = settlementRows.filter((settlement) => settlement.status === "settled").reduce((total, settlement) => total + Number(settlement.amount), 0);
  return { workspace, commitments: commitmentRows, agents: workerRows, apiKeys: keyRows, summary: { activeCommitments: commitmentRows.filter((commitment) => !["settled", "draft"].includes(commitment.status)).length, totalCommitments: commitmentRows.length, settledValue, activeAgents: workerRows.filter((agent) => agent.status !== "offline").length } };
}
export async function createCommitment(input: { workspaceId: number; objective: string; budget: number; deadline: string; agentId?: number; verificationRules: string[]; repository?: string }) {
  const { account } = await ensureWorkspace(input.workspaceId);
  const suffix = createHash("sha256").update(`${input.workspaceId}:${Date.now()}:${input.objective}`).digest("hex").slice(0, 6).toUpperCase();
  const [commitment] = await db.insert(commitments).values({ reference: `KX-${suffix}`, developerId: account.id, workspaceId: input.workspaceId, assignedAgentId: input.agentId, objective: input.objective, budget: input.budget.toFixed(2), asset: "USDC", deadline: new Date(input.deadline), status: input.agentId ? "funded" : "draft", repository: input.repository, verificationRules: input.verificationRules }).returning();
  await db.insert(verificationEvents).values({ commitmentId: commitment.id, type: "commitment_created", provider: "Keenetix API", status: "passed", evidence: { source: "developer-dashboard" }, attestor: "Keenetix protocol" });
  await logAudit({ workspaceId: input.workspaceId, action: "commitment.created", entityType: "commitment", entityId: commitment.id, metadata: { reference: commitment.reference } });
  return commitment;
}
export async function getDemoData() {
  const workspace = await ensurePublicDemoWorkspace();
  const { account, workers } = await ensureWorkspace(workspace.id);
  const reference = `KX-DEMO-${workspace.id}`;
  let [demo] = await db.select().from(commitments).where(eq(commitments.reference, reference)).limit(1);
  if (!demo) [demo] = await db.insert(commitments).values({ reference, developerId: account.id, workspaceId: workspace.id, objective: "Resolve authentication CI failure", budget: "1250.00", asset: "USDC", deadline: new Date(Date.now() + 1000 * 60 * 60 * 36), status: "draft", isDemo: true, verificationRules: defaultRules }).returning();
  const [eventRows, settlementRows, assigned] = await Promise.all([
    db.select().from(verificationEvents).where(eq(verificationEvents.commitmentId, demo.id)).orderBy(verificationEvents.createdAt),
    db.select().from(settlements).where(eq(settlements.commitmentId, demo.id)).orderBy(desc(settlements.createdAt)),
    demo.assignedAgentId ? db.select().from(agents).where(eq(agents.id, demo.assignedAgentId)).limit(1) : Promise.resolve([]),
  ]);
  return { commitment: demo, events: eventRows, settlements: settlementRows, assignedAgent: assigned[0] ?? null, agents: workers, workspaceId: workspace.id };
}
export async function advanceDemo(action: DemoAction) {
  const demoData = await getDemoData();
  const { commitment: demo, agents: workers, workspaceId } = demoData;
  if (action === "reset") {
    await Promise.all([db.delete(verificationEvents).where(eq(verificationEvents.commitmentId, demo.id)), db.delete(settlements).where(eq(settlements.commitmentId, demo.id)), db.delete(reputationRecords).where(eq(reputationRecords.commitmentId, demo.id))]);
    await db.update(commitments).set({ status: "draft", assignedAgentId: null, updatedAt: new Date() }).where(eq(commitments.id, demo.id));
    await db.update(agents).set({ status: "available" }).where(eq(agents.workspaceId, workspaceId));
    return getDemoData();
  }
  const expected: Record<Exclude<DemoAction, "reset">, string> = { fund: "draft", assign: "funded", verify: "executing", settle: "verified" };
  if (demo.status !== expected[action]) throw new Error(`This commitment cannot ${action} while it is ${demo.status}.`);
  if (action === "fund") {
    await db.update(commitments).set({ status: "funded", updatedAt: new Date() }).where(eq(commitments.id, demo.id));
    await db.insert(verificationEvents).values({ commitmentId: demo.id, type: "escrow_funded", provider: "Keenetix settlement layer", status: "passed", evidence: { amount: demo.budget, asset: demo.asset }, attestor: "Keenetix protocol" });
  }
  if (action === "assign") {
    const worker = workers.find((agent) => agent.name === "Iris") ?? workers[0];
    await db.update(commitments).set({ status: "executing", assignedAgentId: worker.id, updatedAt: new Date() }).where(eq(commitments.id, demo.id));
    await db.update(agents).set({ status: "executing" }).where(eq(agents.id, worker.id));
    await db.insert(verificationEvents).values({ commitmentId: demo.id, type: "worker_assigned", provider: "Keenetix execution network", status: "passed", evidence: { worker: worker.name }, attestor: "Keenetix protocol" });
  }
  if (action === "verify") {
    await db.update(commitments).set({ status: "verified", updatedAt: new Date() }).where(eq(commitments.id, demo.id));
    await db.insert(verificationEvents).values([{ commitmentId: demo.id, type: "ci_attestation", provider: "GitHub Actions", status: "passed", evidence: { checks: 28, branch: "fix/auth-ci" }, attestor: "github-actions[bot]" }, { commitmentId: demo.id, type: "security_scan", provider: "Snyk", status: "passed", evidence: { findings: 0 }, attestor: "snyk-oracle" }, { commitmentId: demo.id, type: "review_attestation", provider: "Keenetix verifier", status: "passed", evidence: { reviewer: "Morrow" }, attestor: "agent:Morrow" }]);
  }
  if (action === "settle") {
    await db.update(commitments).set({ status: "awaiting_settlement", updatedAt: new Date() }).where(eq(commitments.id, demo.id));
    await db.insert(settlements).values({ commitmentId: demo.id, amount: demo.budget, asset: demo.asset, status: "awaiting_wallet" });
    await db.insert(verificationEvents).values({ commitmentId: demo.id, type: "settlement_requested", provider: "Keenetix settlement layer", status: "pending", evidence: { next: "wallet_receipt" }, attestor: "Keenetix protocol" });
  }
  return getDemoData();
}
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
export function isValidReceipt(chain: "evm" | "solana", transactionHash: string, escrowAddress: string, chainId: number) {
  if (chain === "solana") return BASE58_RE.test(transactionHash) && transactionHash.length >= 64 && transactionHash.length <= 90 && BASE58_RE.test(escrowAddress) && escrowAddress.length >= 32 && escrowAddress.length <= 44;
  return Number.isInteger(chainId) && !!chainId && /^0x[a-fA-F0-9]{64}$/.test(transactionHash) && /^0x[a-fA-F0-9]{40}$/.test(escrowAddress);
}
export async function submitSettlementReceipt(input: { workspaceId: number; commitmentId: number; transactionHash: string; chain?: "evm" | "solana"; chainId?: number; escrowAddress: string }) {
  const chain = input.chain ?? "evm";
  const [commitment] = await db.select().from(commitments).where(and(eq(commitments.id, input.commitmentId), eq(commitments.workspaceId, input.workspaceId))).limit(1);
  if (!commitment) throw new Error("Commitment not found in this workspace.");
  if (!["verified", "awaiting_settlement"].includes(commitment.status)) throw new Error("Settlement is only available after verification.");
  const [existing] = await db.select().from(settlements).where(eq(settlements.commitmentId, commitment.id)).orderBy(desc(settlements.createdAt)).limit(1);
  const values = { amount: commitment.budget, asset: commitment.asset, status: "submitted", transactionHash: input.transactionHash, chain, chainId: input.chainId ?? null, escrowAddress: input.escrowAddress };
  const settlement = existing ? (await db.update(settlements).set(values).where(eq(settlements.id, existing.id)).returning())[0] : (await db.insert(settlements).values({ commitmentId: commitment.id, ...values }).returning())[0];
  await db.update(commitments).set({ status: "settlement_submitted", updatedAt: new Date() }).where(eq(commitments.id, commitment.id));
  await logAudit({ workspaceId: input.workspaceId, action: "settlement.submitted", entityType: "settlement", entityId: settlement.id, metadata: { transactionHash: input.transactionHash, chain, chainId: input.chainId } });
  return settlement;
}
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDC_DECIMALS = 6;
type SettlementRow = typeof settlements.$inferSelect;
type CommitmentRow = typeof commitments.$inferSelect;
export async function confirmSettlementReceipt(input: { workspaceId: number; transactionHash: string }) {
  const [row] = await db.select().from(settlements).innerJoin(commitments, eq(settlements.commitmentId, commitments.id)).where(and(eq(settlements.transactionHash, input.transactionHash), eq(commitments.workspaceId, input.workspaceId))).limit(1);
  if (!row) throw new Error("Settlement transaction not found.");
  if (row.settlements.status === "settled") {
    return { status: "settled" as const, blockNumber: (row.settlements.receipt as { blockNumber?: string } | null)?.blockNumber };
  }
  if (row.settlements.chain === "solana") return confirmSolanaSettlement(input.workspaceId, row.settlements, row.commitments);
  return confirmEvmSettlement(input.workspaceId, row.settlements, row.commitments);
}
async function confirmEvmSettlement(workspaceId: number, settlement: SettlementRow, commitment: CommitmentRow) {
  const rpcUrl = process.env.EVM_RPC_URL;
  if (!rpcUrl) throw new Error("EVM_RPC_URL must be configured to verify an on-chain receipt.");
  const response = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [settlement.transactionHash] }), cache: "no-store" });
  const payload = await response.json() as { result?: { status?: string; blockNumber?: string; transactionHash?: string; logs?: { topics?: string[]; data?: string }[] } | null };
  if (!payload.result) return { status: "pending" as const };
  if (payload.result.status !== "0x1") throw new Error("The submitted transaction reverted on-chain.");
  const expectedTo = settlement.escrowAddress?.toLowerCase();
  const expectedAmount = BigInt(Math.round(Number(commitment.budget) * 10 ** USDC_DECIMALS));
  const transferLog = payload.result.logs?.find((log) => log.topics?.[0] === ERC20_TRANSFER_TOPIC && log.topics.length === 3 && `0x${log.topics[2].slice(-40)}`.toLowerCase() === expectedTo);
  if (!expectedTo || !transferLog || BigInt(transferLog.data ?? "0x0") !== expectedAmount) {
    throw new Error("The transaction does not pay the required amount to the commitment escrow.");
  }
  return finalizeSettlement(workspaceId, settlement, commitment, payload.result, payload.result.blockNumber);
}
async function confirmSolanaSettlement(workspaceId: number, settlement: SettlementRow, commitment: CommitmentRow) {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("SOLANA_RPC_URL must be configured to verify a Solana receipt.");
  const { Connection } = await import("@solana/web3.js");
  const connection = new Connection(rpcUrl, "confirmed");
  const parsed = await connection.getParsedTransaction(settlement.transactionHash!, { maxSupportedTransactionVersion: 0 });
  if (!parsed) return { status: "pending" as const };
  if (parsed.meta?.err) throw new Error("The submitted transaction failed on-chain.");
  const expectedTo = settlement.escrowAddress;
  const expectedAmount = BigInt(Math.round(Number(commitment.budget) * 10 ** USDC_DECIMALS));
  const instructions = parsed.transaction.message.instructions as unknown as { program?: string; parsed?: { type?: string; info?: { destination?: string; amount?: string; tokenAmount?: { amount?: string } } } }[];
  const transferIx = instructions.find((ix) => ix.program === "spl-token" && (ix.parsed?.type === "transfer" || ix.parsed?.type === "transferChecked") && ix.parsed.info?.destination === expectedTo);
  const paidAmount = transferIx?.parsed?.info?.tokenAmount?.amount ?? transferIx?.parsed?.info?.amount;
  if (!expectedTo || !transferIx || !paidAmount || BigInt(paidAmount) !== expectedAmount) {
    throw new Error("The transaction does not pay the required amount to the commitment escrow.");
  }
  return finalizeSettlement(workspaceId, settlement, commitment, { slot: parsed.slot }, String(parsed.slot));
}
async function finalizeSettlement(workspaceId: number, settlement: SettlementRow, commitment: CommitmentRow, receipt: unknown, blockReference?: string) {
  await db.update(settlements).set({ status: "settled", receipt, settledAt: new Date() }).where(eq(settlements.id, settlement.id));
  await db.update(commitments).set({ status: "settled", updatedAt: new Date() }).where(eq(commitments.id, commitment.id));
  if (commitment.assignedAgentId) {
    const [worker] = await db.select().from(agents).where(eq(agents.id, commitment.assignedAgentId)).limit(1);
    if (worker) {
      const nextReputation = Math.min(99.99, Number(worker.reputation) + 0.2).toFixed(2);
      await db.update(agents).set({ status: "available", reputation: nextReputation, completedCommitments: worker.completedCommitments + 1, totalEarnings: (Number(worker.totalEarnings) + Number(commitment.budget)).toFixed(2) }).where(eq(agents.id, worker.id));
      await db.insert(reputationRecords).values({ agentId: worker.id, commitmentId: commitment.id, reliability: "99.00", quality: "98.00", efficiency: "97.00", delta: ".20", note: "Verified on-chain settlement confirmed" });
    }
  }
  await logAudit({ workspaceId, action: "settlement.confirmed", entityType: "settlement", entityId: settlement.id, metadata: { transactionHash: settlement.transactionHash, blockReference } });
  return { status: "settled" as const, blockNumber: blockReference };
}
export async function getMarketplaceAgents(filters: { capability?: string; minReputation?: number; minStake?: number; maxRate?: number } = {}) {
  const publicWorkspace = await ensurePublicDemoWorkspace();
  await ensureWorkspace(publicWorkspace.id);
  const conditions = [eq(agents.isPublic, true)];
  if (filters.minReputation !== undefined) conditions.push(gte(agents.reputation, filters.minReputation.toFixed(2)));
  if (filters.minStake !== undefined) conditions.push(gte(agents.stakeAmount, filters.minStake.toFixed(2)));
  if (filters.maxRate !== undefined) conditions.push(lte(agents.hourlyRate, filters.maxRate.toFixed(2)));
  const rows = await db.select({ id: agents.id, name: agents.name, role: agents.role, description: agents.description, capabilities: agents.capabilities, hourlyRate: agents.hourlyRate, stakeAmount: agents.stakeAmount, stakeAsset: agents.stakeAsset, reputation: agents.reputation, completedCommitments: agents.completedCommitments, totalEarnings: agents.totalEarnings, status: agents.status, workspaceName: workspaces.name }).from(agents).leftJoin(workspaces, eq(agents.workspaceId, workspaces.id)).where(and(...conditions)).orderBy(desc(agents.reputation));
  if (!filters.capability) return rows;
  const capability = filters.capability.toLowerCase();
  return rows.filter((agent) => (Array.isArray(agent.capabilities) ? agent.capabilities : []).some((item) => String(item).toLowerCase() === capability));
}
export async function createBid(input: { commitmentId: number; agentId: number; workspaceId: number; proposedRate: number; message?: string }) {
  const [commitment] = await db.select().from(commitments).where(eq(commitments.id, input.commitmentId)).limit(1);
  if (!commitment) throw new Error("Commitment not found.");
  if (commitment.assignedAgentId) throw new Error("This commitment already has an assigned worker.");
  if (!["draft", "funded"].includes(commitment.status)) throw new Error("This commitment is not accepting bids.");
  const [agent] = await db.select().from(agents).where(and(eq(agents.id, input.agentId), eq(agents.workspaceId, input.workspaceId))).limit(1);
  if (!agent) throw new Error("Selected agent is not registered to your workspace.");
  const [existing] = await db.select({ id: commitmentBids.id }).from(commitmentBids).where(and(eq(commitmentBids.commitmentId, input.commitmentId), eq(commitmentBids.agentId, input.agentId))).limit(1);
  if (existing) throw new Error("This agent has already bid on this commitment.");
  const [bid] = await db.insert(commitmentBids).values({ commitmentId: input.commitmentId, agentId: input.agentId, workspaceId: input.workspaceId, proposedRate: input.proposedRate.toFixed(2), message: input.message?.trim().slice(0, 500) ?? "" }).returning();
  await logAudit({ workspaceId: input.workspaceId, action: "bid.created", entityType: "commitment_bid", entityId: bid.id, metadata: { commitmentId: input.commitmentId, agentId: input.agentId } });
  return bid;
}
export async function listBidsForCommitment(commitmentId: number, workspaceId: number) {
  const [commitment] = await db.select({ id: commitments.id }).from(commitments).where(and(eq(commitments.id, commitmentId), eq(commitments.workspaceId, workspaceId))).limit(1);
  if (!commitment) throw new Error("Commitment not found in this workspace.");
  return db.select({ id: commitmentBids.id, proposedRate: commitmentBids.proposedRate, message: commitmentBids.message, status: commitmentBids.status, createdAt: commitmentBids.createdAt, agentId: agents.id, agentName: agents.name, agentReputation: agents.reputation }).from(commitmentBids).innerJoin(agents, eq(commitmentBids.agentId, agents.id)).where(eq(commitmentBids.commitmentId, commitmentId)).orderBy(desc(commitmentBids.createdAt));
}
export async function approveBid(input: { commitmentId: number; bidId: number; workspaceId: number }) {
  const [commitment] = await db.select().from(commitments).where(and(eq(commitments.id, input.commitmentId), eq(commitments.workspaceId, input.workspaceId))).limit(1);
  if (!commitment) throw new Error("Commitment not found in this workspace.");
  if (commitment.assignedAgentId) throw new Error("This commitment already has an assigned worker.");
  const [bid] = await db.select().from(commitmentBids).where(and(eq(commitmentBids.id, input.bidId), eq(commitmentBids.commitmentId, input.commitmentId))).limit(1);
  if (!bid || bid.status !== "pending") throw new Error("This bid is not available to approve.");
  const [updatedCommitment] = await db.update(commitments).set({ assignedAgentId: bid.agentId, status: "funded", updatedAt: new Date() }).where(eq(commitments.id, commitment.id)).returning();
  const [updatedBid] = await db.update(commitmentBids).set({ status: "approved" }).where(eq(commitmentBids.id, bid.id)).returning();
  await db.update(commitmentBids).set({ status: "rejected" }).where(and(eq(commitmentBids.commitmentId, commitment.id), ne(commitmentBids.id, bid.id)));
  await db.update(agents).set({ status: "executing" }).where(eq(agents.id, bid.agentId));
  await db.insert(verificationEvents).values({ commitmentId: commitment.id, type: "bid_approved", provider: "Keenetix marketplace", status: "passed", evidence: { bidId: bid.id, proposedRate: bid.proposedRate }, attestor: "Keenetix protocol" });
  await logAudit({ workspaceId: input.workspaceId, action: "bid.approved", entityType: "commitment_bid", entityId: bid.id, metadata: { commitmentId: commitment.id, agentId: bid.agentId } });
  return { commitment: updatedCommitment, bid: updatedBid };
}
export async function createDispute(input: { commitmentId: number; userId: number; workspaceId: number; reason: string }) {
  const [commitment] = await db.select().from(commitments).where(eq(commitments.id, input.commitmentId)).limit(1);
  if (!commitment) throw new Error("Commitment not found.");
  let authorized = commitment.workspaceId === input.workspaceId;
  if (!authorized && commitment.assignedAgentId) {
    const [agent] = await db.select({ workspaceId: agents.workspaceId }).from(agents).where(eq(agents.id, commitment.assignedAgentId)).limit(1);
    authorized = agent?.workspaceId === input.workspaceId;
  }
  if (!authorized) throw new Error("You do not have access to dispute this commitment.");
  const [existing] = await db.select({ id: disputes.id }).from(disputes).where(and(eq(disputes.commitmentId, input.commitmentId), eq(disputes.status, "open"))).limit(1);
  if (existing) throw new Error("An open dispute already exists for this commitment.");
  const [dispute] = await db.insert(disputes).values({ commitmentId: input.commitmentId, raisedByUserId: input.userId, reason: input.reason.trim().slice(0, 1000) }).returning();
  await db.update(commitments).set({ status: "disputed", updatedAt: new Date() }).where(eq(commitments.id, commitment.id));
  await logAudit({ workspaceId: input.workspaceId, userId: input.userId, action: "dispute.raised", entityType: "dispute", entityId: dispute.id, metadata: { commitmentId: commitment.id } });
  return dispute;
}
export async function registerAgent(input: { workspaceId: number; name: string; role: string; description: string; capabilities: string[]; hourlyRate: number; stakeAmount: number; walletAddress: string; isPublic: boolean; verificationPublicKey?: string }) {
  await ensureWorkspace(input.workspaceId);
  const [agent] = await db.insert(agents).values({
    workspaceId: input.workspaceId,
    name: input.name.trim().slice(0, 120),
    role: input.role.trim().slice(0, 120),
    description: input.description.trim().slice(0, 1000),
    capabilities: input.capabilities.slice(0, 16),
    hourlyRate: input.hourlyRate.toFixed(2),
    stakeAmount: input.stakeAmount.toFixed(2),
    walletAddress: input.walletAddress.trim().slice(0, 100),
    isPublic: input.isPublic,
    verificationPublicKey: input.verificationPublicKey?.trim().slice(0, 3000),
    reputation: "50.00",
  }).returning();
  await logAudit({ workspaceId: input.workspaceId, action: "agent.registered", entityType: "agent", entityId: agent.id, metadata: { name: agent.name, capabilities: input.capabilities } });
  return agent;
}
