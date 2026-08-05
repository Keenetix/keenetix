import { createHash } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agents, apiKeys, commitments, developerAccounts, organizations, reputationRecords, settlements, users, verificationEvents, verificationIntegrations, workspaceMemberships, workspaces } from "@/db/schema";
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
    workerList = await db.insert(agents).values([
      { workspaceId: workspace.id, name: "Iris", role: "Software engineering agent", description: "Autonomous full-stack software delivery, test remediation, and refactors.", capabilities: ["typescript", "github", "ci-cd", "security"], hourlyRate: "125.00", stakeAmount: "2400.00", isPublic: true, walletAddress: "0x8d31...bE4a", reputation: "98.70", completedCommitments: 128, totalEarnings: "48200.00" },
      { workspaceId: workspace.id, name: "Vector", role: "Infrastructure agent", description: "Deployments, cloud reliability, and infrastructure-as-code execution.", capabilities: ["terraform", "kubernetes", "aws", "deployments"], hourlyRate: "148.00", stakeAmount: "3100.00", isPublic: true, walletAddress: "0x5c12...Aa11", reputation: "97.90", completedCommitments: 94, totalEarnings: "39750.00" },
      { workspaceId: workspace.id, name: "Morrow", role: "Verification agent", description: "Independent CI, security, and delivery proof attestation.", capabilities: ["verification", "security", "attestation"], hourlyRate: "92.00", stakeAmount: "5200.00", isPublic: true, walletAddress: "0x7f99...D210", reputation: "99.10", completedCommitments: 211, totalEarnings: "61350.00" },
    ]).returning();
  }
  const [integration] = await db.select().from(verificationIntegrations).where(and(eq(verificationIntegrations.workspaceId, workspace.id), eq(verificationIntegrations.provider, "github"))).limit(1);
  if (!integration) await db.insert(verificationIntegrations).values({ workspaceId: workspace.id, provider: "github", status: "ready", configuration: { eventTypes: ["workflow_run", "check_run", "deployment_status"] } });
  return { workspace, account, workers: workerList };
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
export async function submitSettlementReceipt(input: { workspaceId: number; commitmentId: number; transactionHash: string; chainId: number; escrowAddress: string }) {
  const [commitment] = await db.select().from(commitments).where(and(eq(commitments.id, input.commitmentId), eq(commitments.workspaceId, input.workspaceId))).limit(1);
  if (!commitment) throw new Error("Commitment not found in this workspace.");
  if (!["verified", "awaiting_settlement"].includes(commitment.status)) throw new Error("Settlement is only available after verification.");
  const [existing] = await db.select().from(settlements).where(eq(settlements.commitmentId, commitment.id)).orderBy(desc(settlements.createdAt)).limit(1);
  const values = { amount: commitment.budget, asset: commitment.asset, status: "submitted", transactionHash: input.transactionHash, chainId: input.chainId, escrowAddress: input.escrowAddress };
  const settlement = existing ? (await db.update(settlements).set(values).where(eq(settlements.id, existing.id)).returning())[0] : (await db.insert(settlements).values({ commitmentId: commitment.id, ...values }).returning())[0];
  await db.update(commitments).set({ status: "settlement_submitted", updatedAt: new Date() }).where(eq(commitments.id, commitment.id));
  await logAudit({ workspaceId: input.workspaceId, action: "settlement.submitted", entityType: "settlement", entityId: settlement.id, metadata: { transactionHash: input.transactionHash, chainId: input.chainId } });
  return settlement;
}
export async function confirmSettlementReceipt(input: { workspaceId: number; transactionHash: string }) {
  const rpcUrl = process.env.EVM_RPC_URL;
  if (!rpcUrl) throw new Error("EVM_RPC_URL must be configured to verify an on-chain receipt.");
  const response = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [input.transactionHash] }), cache: "no-store" });
  const payload = await response.json() as { result?: { status?: string; blockNumber?: string; transactionHash?: string } | null };
  if (!payload.result) return { status: "pending" as const };
  if (payload.result.status !== "0x1") throw new Error("The submitted transaction reverted on-chain.");
  const [settlement] = await db.select().from(settlements).innerJoin(commitments, eq(settlements.commitmentId, commitments.id)).where(and(eq(settlements.transactionHash, input.transactionHash), eq(commitments.workspaceId, input.workspaceId))).limit(1);
  if (!settlement) throw new Error("Settlement transaction not found.");
  const commitment = settlement.commitments;
  await db.update(settlements).set({ status: "settled", receipt: payload.result, settledAt: new Date() }).where(eq(settlements.id, settlement.settlements.id));
  await db.update(commitments).set({ status: "settled", updatedAt: new Date() }).where(eq(commitments.id, commitment.id));
  if (commitment.assignedAgentId) {
    const [worker] = await db.select().from(agents).where(eq(agents.id, commitment.assignedAgentId)).limit(1);
    if (worker) {
      const nextReputation = Math.min(99.99, Number(worker.reputation) + 0.2).toFixed(2);
      await db.update(agents).set({ status: "available", reputation: nextReputation, completedCommitments: worker.completedCommitments + 1, totalEarnings: (Number(worker.totalEarnings) + Number(commitment.budget)).toFixed(2) }).where(eq(agents.id, worker.id));
      await db.insert(reputationRecords).values({ agentId: worker.id, commitmentId: commitment.id, reliability: "99.00", quality: "98.00", efficiency: "97.00", delta: ".20", note: "Verified on-chain settlement confirmed" });
    }
  }
  await logAudit({ workspaceId: input.workspaceId, action: "settlement.confirmed", entityType: "settlement", entityId: settlement.settlements.id, metadata: { transactionHash: input.transactionHash, blockNumber: payload.result.blockNumber } });
  return { status: "settled" as const, blockNumber: payload.result.blockNumber };
}
export async function getMarketplaceAgents() {
  const publicWorkspace = await ensurePublicDemoWorkspace();
  await ensureWorkspace(publicWorkspace.id);
  const rows = await db.select({ id: agents.id, name: agents.name, role: agents.role, description: agents.description, capabilities: agents.capabilities, hourlyRate: agents.hourlyRate, stakeAmount: agents.stakeAmount, stakeAsset: agents.stakeAsset, reputation: agents.reputation, completedCommitments: agents.completedCommitments, totalEarnings: agents.totalEarnings, status: agents.status, workspaceName: workspaces.name }).from(agents).leftJoin(workspaces, eq(agents.workspaceId, workspaces.id)).where(eq(agents.isPublic, true)).orderBy(desc(agents.reputation));
  ;
 return rows;
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
