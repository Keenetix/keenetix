import { createHash } from "crypto";
import { and, desc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { agents, apiKeys, commitmentBids, commitments, developerAccounts, disputes, organizations, reputationRecords, settlements, users, verificationEvents, verificationIntegrations, workspaceMemberships, workspaces } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { ProtocolError, logAudit } from "@/lib/api-security";
const PUBLIC_DEMO_EMAIL = "demo@keenetix.local";
const PUBLIC_DEMO_WORKSPACE = "public-demo";
export type DemoAction = "fund" | "assign" | "verify" | "settle" | "reset";
export type DisputeOutcome = "release" | "refund" | "split";
export const DISPUTE_OUTCOMES: DisputeOutcome[] = ["release", "refund", "split"];
const defaultRules = ["All CI checks pass", "Security scan is clear", "Reviewer attestation recorded"];
/** Only escrowed work can be disputed — a draft holds no capital, and a settled one has already paid out. */
const DISPUTABLE_STATES = ["funded", "executing", "verified", "awaiting_settlement", "settlement_submitted"];
/** Commitment states where the budget is locked and not yet released. Disputed escrow is still locked. */
const ESCROWED_STATES = [...DISPUTABLE_STATES, "disputed"];
/** Starter roster every new workspace gets, private by default. */
const STARTER_AGENTS = [
  { name: "Iris", role: "Software engineering agent", description: "Autonomous full-stack software delivery, test remediation, and refactors.", capabilities: ["typescript", "github", "ci-cd", "security"], hourlyRate: "125.00", stakeAmount: "2400.00", walletAddress: "0x8d31...bE4a", reputation: "98.70", completedCommitments: 128, totalEarnings: "48200.00" },
  { name: "Vector", role: "Infrastructure agent", description: "Deployments, cloud reliability, and infrastructure-as-code execution.", capabilities: ["terraform", "kubernetes", "aws", "deployments"], hourlyRate: "148.00", stakeAmount: "3100.00", walletAddress: "0x5c12...Aa11", reputation: "97.90", completedCommitments: 94, totalEarnings: "39750.00" },
  { name: "Morrow", role: "Verification agent", description: "Independent CI, security, and delivery proof attestation.", capabilities: ["verification", "security", "attestation"], hourlyRate: "92.00", stakeAmount: "5200.00", walletAddress: "0x7f99...D210", reputation: "99.10", completedCommitments: 211, totalEarnings: "61350.00" },
];
/** Extra agents shown only in the public marketplace, for browsing variety. */
const MARKETPLACE_AGENTS = [
  { name: "Ledger", role: "Finance & reconciliation agent", description: "Vendor invoice matching, ledger reconciliation, and expense reporting.", capabilities: ["accounting", "reconciliation", "reporting"], hourlyRate: "95.00", stakeAmount: "1800.00", walletAddress: "0x2a47...C903", reputation: "97.40", completedCommitments: 63, totalEarnings: "18900.00" },
  { name: "Corpus", role: "Research & synthesis agent", description: "Long-context research, document synthesis, and summarization at scale.", capabilities: ["research", "summarization", "long-context"], hourlyRate: "110.00", stakeAmount: "2000.00", walletAddress: "0x91e6...F217", reputation: "96.80", completedCommitments: 41, totalEarnings: "14300.00" },
  { name: "Sentry", role: "Security & compliance agent", description: "Vulnerability scanning, SOC2 evidence collection, and audit preparation.", capabilities: ["security", "compliance", "evidence"], hourlyRate: "160.00", stakeAmount: "4200.00", walletAddress: "0x4b78...9A02", reputation: "99.30", completedCommitments: 87, totalEarnings: "36100.00" },
  { name: "Atlas", role: "Data & taxonomy agent", description: "Schema design, ETL pipelines, and large-scale data backfills.", capabilities: ["data", "etl", "schema"], hourlyRate: "118.00", stakeAmount: "2600.00", walletAddress: "0xc015...7Ee4", reputation: "96.20", completedCommitments: 55, totalEarnings: "19500.00" },
  { name: "Lex", role: "Legal & policy agent", description: "Licence review, contract redlines, and regulatory policy checks.", capabilities: ["legal", "licensing", "policy-review"], hourlyRate: "175.00", stakeAmount: "3800.00", walletAddress: "0x6f23...B588", reputation: "98.10", completedCommitments: 29, totalEarnings: "15900.00" },
  { name: "Wren", role: "Frontend & design agent", description: "Component implementation, design-system upkeep, and accessibility passes.", capabilities: ["react", "design-systems", "accessibility"], hourlyRate: "132.00", stakeAmount: "2100.00", walletAddress: "0xa839...1Dc6", reputation: "97.60", completedCommitments: 48, totalEarnings: "20700.00" },
];
export async function ensureWorkspace(workspaceId: number) {
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  // An authenticated caller always has a real workspace, so a miss here is our bug, not theirs.
  if (!workspace) throw new Error("Workspace not found.");
  const systemEmail = `workspace-${workspace.id}@keenetix.local`;
  let [account] = await db.select().from(developerAccounts).where(eq(developerAccounts.email, systemEmail)).limit(1);
  if (!account) [account] = await db.insert(developerAccounts).values({ organization: workspace.name, email: systemEmail }).returning();
  let workerList = await db.select().from(agents).where(eq(agents.workspaceId, workspace.id)).orderBy(agents.id);
  if (!workerList.length) {
    const isPublic = workspace.slug === PUBLIC_DEMO_WORKSPACE;
    const roster = isPublic ? [...STARTER_AGENTS, ...MARKETPLACE_AGENTS] : STARTER_AGENTS;
    workerList = await db.insert(agents).values(roster.map((agent) => ({ ...agent, workspaceId: workspace.id, isPublic }))).returning();
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
/** Paged commitment list. The API surface reads through this rather than the whole dashboard payload. */
export async function listCommitments(workspaceId: number, options: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50) || 50, 1), 200);
  const offset = Math.max(Math.trunc(options.offset ?? 0) || 0, 0);
  return db.select({ id: commitments.id, reference: commitments.reference, objective: commitments.objective, budget: commitments.budget, asset: commitments.asset, deadline: commitments.deadline, status: commitments.status, assignedAgentName: agents.name, createdAt: commitments.createdAt })
    .from(commitments).leftJoin(agents, eq(commitments.assignedAgentId, agents.id))
    .where(eq(commitments.workspaceId, workspaceId)).orderBy(desc(commitments.createdAt)).limit(limit).offset(offset);
}
export async function listAgents(workspaceId: number) {
  await ensureWorkspace(workspaceId);
  return db.select().from(agents).where(eq(agents.workspaceId, workspaceId)).orderBy(desc(agents.reputation));
}
export async function getDashboardData(workspaceId: number) {
  const { workspace } = await ensureWorkspace(workspaceId);
  const [commitmentRows, workerRows, keyRows, settlementRows, eventRows, disputeRows] = await Promise.all([
    listCommitments(workspace.id, { limit: 200 }),
    db.select().from(agents).where(eq(agents.workspaceId, workspace.id)).orderBy(desc(agents.reputation)),
    db.select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, scopes: apiKeys.scopes, rateLimitPerMinute: apiKeys.rateLimitPerMinute, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(and(eq(apiKeys.workspaceId, workspace.id), isNull(apiKeys.revokedAt))).orderBy(desc(apiKeys.createdAt)),
    db.select({ amount: settlements.amount, status: settlements.status, asset: settlements.asset, transactionHash: settlements.transactionHash, settledAt: settlements.settledAt, createdAt: settlements.createdAt, reference: commitments.reference }).from(settlements).innerJoin(commitments, eq(settlements.commitmentId, commitments.id)).where(eq(commitments.workspaceId, workspace.id)).orderBy(desc(settlements.createdAt)),
    db.select({ id: verificationEvents.id, type: verificationEvents.type, status: verificationEvents.status, createdAt: verificationEvents.createdAt, reference: commitments.reference, agentName: agents.name }).from(verificationEvents).innerJoin(commitments, eq(verificationEvents.commitmentId, commitments.id)).leftJoin(agents, eq(commitments.assignedAgentId, agents.id)).where(eq(commitments.workspaceId, workspace.id)).orderBy(desc(verificationEvents.createdAt)).limit(6),
    listDisputes(workspace.id),
  ]);
  const settled = settlementRows.filter((settlement) => settlement.status === "settled");
  const settledValue = settled.reduce((total, settlement) => total + Number(settlement.amount), 0);
  const escrowed = commitmentRows.filter((commitment) => ESCROWED_STATES.includes(commitment.status));
  const openDisputes = disputeRows.filter((dispute) => dispute.status === "open");
  return { workspace, commitments: commitmentRows, agents: workerRows, apiKeys: keyRows, settlements: settlementRows, events: eventRows, disputes: disputeRows, summary: { activeCommitments: commitmentRows.filter((commitment) => !["settled", "draft"].includes(commitment.status)).length, totalCommitments: commitmentRows.length, settledValue, escrowedValue: escrowed.reduce((total, commitment) => total + Number(commitment.budget), 0), escrowedCommitments: escrowed.length, activeAgents: workerRows.filter((agent) => agent.status !== "offline").length, openDisputes: openDisputes.length, disputedValue: openDisputes.reduce((total, dispute) => total + Number(dispute.budget), 0) } };
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
  if (demo.status !== expected[action]) throw new ProtocolError(`This commitment cannot ${action} while it is ${demo.status}.`);
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
  if (!commitment) throw new ProtocolError("Commitment not found in this workspace.", 404);
  if (!["verified", "awaiting_settlement"].includes(commitment.status)) throw new ProtocolError("Settlement is only available after verification.");
  const [existing] = await db.select().from(settlements).where(eq(settlements.commitmentId, commitment.id)).orderBy(desc(settlements.createdAt)).limit(1);
  // A split dispute resolution pre-writes the reduced award onto the settlement row, so an existing
  // amount always wins over the full budget. In the undisputed path the two are identical.
  const values = { amount: existing?.amount ?? commitment.budget, asset: commitment.asset, status: "submitted", transactionHash: input.transactionHash, chain, chainId: input.chainId ?? null, escrowAddress: input.escrowAddress };
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
  if (!row) throw new ProtocolError("Settlement transaction not found.", 404);
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
  if (payload.result.status !== "0x1") throw new ProtocolError("The submitted transaction reverted on-chain.");
  const expectedTo = settlement.escrowAddress?.toLowerCase();
  const expectedAmount = BigInt(Math.round(Number(settlement.amount) * 10 ** USDC_DECIMALS));
  const transferLog = payload.result.logs?.find((log) => log.topics?.[0] === ERC20_TRANSFER_TOPIC && log.topics.length === 3 && `0x${log.topics[2].slice(-40)}`.toLowerCase() === expectedTo);
  if (!expectedTo || !transferLog || BigInt(transferLog.data ?? "0x0") !== expectedAmount) {
    throw new ProtocolError("The transaction does not pay the required amount to the commitment escrow.");
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
  if (parsed.meta?.err) throw new ProtocolError("The submitted transaction failed on-chain.");
  const expectedTo = settlement.escrowAddress;
  const expectedAmount = BigInt(Math.round(Number(settlement.amount) * 10 ** USDC_DECIMALS));
  const instructions = parsed.transaction.message.instructions as unknown as { program?: string; parsed?: { type?: string; info?: { destination?: string; amount?: string; tokenAmount?: { amount?: string } } } }[];
  const transferIx = instructions.find((ix) => ix.program === "spl-token" && (ix.parsed?.type === "transfer" || ix.parsed?.type === "transferChecked") && ix.parsed.info?.destination === expectedTo);
  const paidAmount = transferIx?.parsed?.info?.tokenAmount?.amount ?? transferIx?.parsed?.info?.amount;
  if (!expectedTo || !transferIx || !paidAmount || BigInt(paidAmount) !== expectedAmount) {
    throw new ProtocolError("The transaction does not pay the required amount to the commitment escrow.");
  }
  return finalizeSettlement(workspaceId, settlement, commitment, { slot: parsed.slot }, String(parsed.slot));
}
const DAY = 24 * 60 * 60 * 1000;
/**
 * Scores a delivered commitment on the three axes a reputation record tracks. Every axis is
 * derived from what actually happened, so a record can be re-checked against the commitment and
 * its verification events rather than taken on trust:
 *
 * - reliability — delivered by the deadline, losing 10 points per day late.
 * - quality     — the share of verification conditions that passed.
 * - efficiency  — how much of the allotted window went unused. Delivering on the deadline scores
 *                 50, delivering instantly scores 100, delivering late scores below 50.
 */
export function scoreDelivery(commitment: Pick<CommitmentRow, "createdAt" | "deadline">, events: { type: string; status: string }[], settledAt: Date) {
  const checks = events.filter((event) => event.type !== "commitment_created");
  const passed = checks.filter((event) => event.status === "passed").length;
  const quality = checks.length ? (passed / checks.length) * 100 : 100;
  const due = commitment.deadline.getTime();
  const done = settledAt.getTime();
  const span = due - commitment.createdAt.getTime();
  const reliability = done <= due ? 100 : Math.max(0, 100 - ((done - due) / DAY) * 10);
  const efficiency = Math.min(100, Math.max(0, 50 + (span > 0 ? (due - done) / span : 0) * 50));
  return { reliability: reliability.toFixed(2), quality: quality.toFixed(2), efficiency: efficiency.toFixed(2), composite: (reliability + quality + efficiency) / 3 };
}
async function finalizeSettlement(workspaceId: number, settlement: SettlementRow, commitment: CommitmentRow, receipt: unknown, blockReference?: string) {
  const settledAt = new Date();
  await db.update(settlements).set({ status: "settled", receipt, settledAt }).where(eq(settlements.id, settlement.id));
  await db.update(commitments).set({ status: "settled", updatedAt: settledAt }).where(eq(commitments.id, commitment.id));
  if (commitment.assignedAgentId) {
    const [[worker], events] = await Promise.all([
      db.select().from(agents).where(eq(agents.id, commitment.assignedAgentId)).limit(1),
      db.select({ type: verificationEvents.type, status: verificationEvents.status }).from(verificationEvents).where(eq(verificationEvents.commitmentId, commitment.id)),
    ]);
    if (worker) {
      const score = scoreDelivery(commitment, events, settledAt);
      // A clean delivery is worth the full 0.20; one that scraped through earns proportionally less.
      const delta = Math.max(0.02, (score.composite / 100) * 0.2);
      const nextReputation = Math.min(99.99, Number(worker.reputation) + delta).toFixed(2);
      // Earnings credit the settled amount, which a split dispute may have cut below the budget.
      await db.update(agents).set({ status: "available", reputation: nextReputation, completedCommitments: worker.completedCommitments + 1, totalEarnings: (Number(worker.totalEarnings) + Number(settlement.amount)).toFixed(2) }).where(eq(agents.id, worker.id));
      await db.insert(reputationRecords).values({ agentId: worker.id, commitmentId: commitment.id, reliability: score.reliability, quality: score.quality, efficiency: score.efficiency, delta: delta.toFixed(2), note: "Verified on-chain settlement confirmed" });
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
  if (!commitment) throw new ProtocolError("Commitment not found.", 404);
  if (commitment.assignedAgentId) throw new ProtocolError("This commitment already has an assigned worker.");
  if (!["draft", "funded"].includes(commitment.status)) throw new ProtocolError("This commitment is not accepting bids.");
  const [agent] = await db.select().from(agents).where(and(eq(agents.id, input.agentId), eq(agents.workspaceId, input.workspaceId))).limit(1);
  if (!agent) throw new ProtocolError("Selected agent is not registered to your workspace.");
  const [existing] = await db.select({ id: commitmentBids.id }).from(commitmentBids).where(and(eq(commitmentBids.commitmentId, input.commitmentId), eq(commitmentBids.agentId, input.agentId))).limit(1);
  if (existing) throw new ProtocolError("This agent has already bid on this commitment.");
  const [bid] = await db.insert(commitmentBids).values({ commitmentId: input.commitmentId, agentId: input.agentId, workspaceId: input.workspaceId, proposedRate: input.proposedRate.toFixed(2), message: input.message?.trim().slice(0, 500) ?? "" }).returning();
  await logAudit({ workspaceId: input.workspaceId, action: "bid.created", entityType: "commitment_bid", entityId: bid.id, metadata: { commitmentId: input.commitmentId, agentId: input.agentId } });
  return bid;
}
export async function listBidsForCommitment(commitmentId: number, workspaceId: number) {
  const [commitment] = await db.select({ id: commitments.id }).from(commitments).where(and(eq(commitments.id, commitmentId), eq(commitments.workspaceId, workspaceId))).limit(1);
  if (!commitment) throw new ProtocolError("Commitment not found in this workspace.", 404);
  return db.select({ id: commitmentBids.id, proposedRate: commitmentBids.proposedRate, message: commitmentBids.message, status: commitmentBids.status, createdAt: commitmentBids.createdAt, agentId: agents.id, agentName: agents.name, agentReputation: agents.reputation }).from(commitmentBids).innerJoin(agents, eq(commitmentBids.agentId, agents.id)).where(eq(commitmentBids.commitmentId, commitmentId)).orderBy(desc(commitmentBids.createdAt));
}
export async function approveBid(input: { commitmentId: number; bidId: number; workspaceId: number }) {
  const [commitment] = await db.select().from(commitments).where(and(eq(commitments.id, input.commitmentId), eq(commitments.workspaceId, input.workspaceId))).limit(1);
  if (!commitment) throw new ProtocolError("Commitment not found in this workspace.", 404);
  if (commitment.assignedAgentId) throw new ProtocolError("This commitment already has an assigned worker.");
  const [bid] = await db.select().from(commitmentBids).where(and(eq(commitmentBids.id, input.bidId), eq(commitmentBids.commitmentId, input.commitmentId))).limit(1);
  if (!bid || bid.status !== "pending") throw new ProtocolError("This bid is not available to approve.");
  const [updatedCommitment] = await db.update(commitments).set({ assignedAgentId: bid.agentId, status: "funded", updatedAt: new Date() }).where(eq(commitments.id, commitment.id)).returning();
  const [updatedBid] = await db.update(commitmentBids).set({ status: "approved" }).where(eq(commitmentBids.id, bid.id)).returning();
  await db.update(commitmentBids).set({ status: "rejected" }).where(and(eq(commitmentBids.commitmentId, commitment.id), ne(commitmentBids.id, bid.id)));
  await db.update(agents).set({ status: "executing" }).where(eq(agents.id, bid.agentId));
  await db.insert(verificationEvents).values({ commitmentId: commitment.id, type: "bid_approved", provider: "Keenetix marketplace", status: "passed", evidence: { bidId: bid.id, proposedRate: bid.proposedRate }, attestor: "Keenetix protocol" });
  await logAudit({ workspaceId: input.workspaceId, action: "bid.approved", entityType: "commitment_bid", entityId: bid.id, metadata: { commitmentId: commitment.id, agentId: bid.agentId } });
  return { commitment: updatedCommitment, bid: updatedBid };
}
export async function createDispute(input: { commitmentId: number; workspaceId: number; reason: string; userId?: number; apiKeyId?: number }) {
  const [commitment] = await db.select().from(commitments).where(eq(commitments.id, input.commitmentId)).limit(1);
  if (!commitment) throw new ProtocolError("Commitment not found.", 404);
  let authorized = commitment.workspaceId === input.workspaceId;
  if (!authorized && commitment.assignedAgentId) {
    const [agent] = await db.select({ workspaceId: agents.workspaceId }).from(agents).where(eq(agents.id, commitment.assignedAgentId)).limit(1);
    authorized = agent?.workspaceId === input.workspaceId;
  }
  if (!authorized) throw new ProtocolError("You do not have access to dispute this commitment.");
  if (!DISPUTABLE_STATES.includes(commitment.status)) throw new ProtocolError(`A ${commitment.status} commitment holds no escrow to dispute.`);
  const [existing] = await db.select({ id: disputes.id }).from(disputes).where(and(eq(disputes.commitmentId, input.commitmentId), eq(disputes.status, "open"))).limit(1);
  if (existing) throw new ProtocolError("An open dispute already exists for this commitment.");
  const [dispute] = await db.insert(disputes).values({ commitmentId: input.commitmentId, raisedByUserId: input.userId, raisedByApiKeyId: input.apiKeyId, previousStatus: commitment.status, reason: input.reason.trim().slice(0, 1000) }).returning();
  await db.update(commitments).set({ status: "disputed", updatedAt: new Date() }).where(eq(commitments.id, commitment.id));
  await db.insert(verificationEvents).values({ commitmentId: commitment.id, type: "dispute_raised", provider: "Keenetix arbitration", status: "pending", evidence: { disputeId: dispute.id, frozenFrom: commitment.status }, attestor: "Keenetix protocol" });
  await logAudit({ workspaceId: input.workspaceId, userId: input.userId, apiKeyId: input.apiKeyId, action: "dispute.raised", entityType: "dispute", entityId: dispute.id, metadata: { commitmentId: commitment.id, previousStatus: commitment.status } });
  return dispute;
}
/**
 * Closes an open dispute and unfreezes the escrow behind it. Every outcome is terminal for the
 * dispute; what differs is where the commitment lands:
 *
 * - `release`  — the claim is dropped and the lifecycle resumes at the state it froze at.
 * - `refund`   — capital returns to the funder, pending settlements are cancelled, the worker
 *                takes a reliability penalty and is freed for other work.
 * - `split`    — the worker is awarded `splitBps` of the budget. The commitment is moved to
 *                `verified` and the reduced award is written onto the settlement row, so the
 *                normal on-chain settlement path pays out the partial amount and verifies
 *                against it.
 *
 * Only the workspace that funded the commitment may resolve — an agent's workspace can raise a
 * dispute but must not be able to award itself the escrow it is contesting.
 */
export async function resolveDispute(input: { disputeId: number; workspaceId: number; outcome: DisputeOutcome; note: string; splitBps?: number; userId?: number; apiKeyId?: number }) {
  if (!DISPUTE_OUTCOMES.includes(input.outcome)) throw new ProtocolError("Resolution must be release, refund, or split.");
  const splitBps = input.outcome === "split" ? Math.round(input.splitBps ?? 0) : null;
  if (splitBps !== null && (!Number.isInteger(splitBps) || splitBps < 1 || splitBps > 9999)) throw new ProtocolError("A split must award the worker between 1 and 9999 basis points.");
  const note = input.note.trim().slice(0, 1000);
  if (!note) throw new ProtocolError("Provide a resolution note explaining the decision.");
  const [row] = await db.select().from(disputes).innerJoin(commitments, eq(disputes.commitmentId, commitments.id)).where(eq(disputes.id, input.disputeId)).limit(1);
  if (!row) throw new ProtocolError("Dispute not found.", 404);
  const { disputes: dispute, commitments: commitment } = row;
  if (commitment.workspaceId !== input.workspaceId) throw new ProtocolError("Only the workspace that funded this commitment can resolve its dispute.");
  if (dispute.status !== "open") throw new ProtocolError("This dispute has already been resolved.");
  const award = splitBps === null ? null : (Number(commitment.budget) * splitBps / 10_000).toFixed(2);
  const nextStatus = input.outcome === "release" ? dispute.previousStatus : input.outcome === "refund" ? "refunded" : "verified";

  if (input.outcome === "refund") {
    await db.update(settlements).set({ status: "cancelled" }).where(and(eq(settlements.commitmentId, commitment.id), ne(settlements.status, "settled")));
  }
  if (input.outcome === "split" && award) {
    const [existing] = await db.select({ id: settlements.id }).from(settlements).where(and(eq(settlements.commitmentId, commitment.id), ne(settlements.status, "settled"))).orderBy(desc(settlements.createdAt)).limit(1);
    const values = { amount: award, status: "awaiting_wallet", transactionHash: null, receipt: null, settledAt: null };
    if (existing) await db.update(settlements).set(values).where(eq(settlements.id, existing.id));
    else await db.insert(settlements).values({ commitmentId: commitment.id, asset: commitment.asset, ...values });
  }
  if (input.outcome !== "release") await applyDisputePenalty(commitment, input.outcome, award);

  const [resolved] = await db.update(disputes).set({ status: "resolved", outcome: input.outcome, splitBps, resolution: note, resolvedByUserId: input.userId, resolvedByApiKeyId: input.apiKeyId, resolvedAt: new Date() }).where(and(eq(disputes.id, dispute.id), eq(disputes.status, "open"))).returning();
  if (!resolved) throw new ProtocolError("This dispute has already been resolved.");
  await db.update(commitments).set({ status: nextStatus, updatedAt: new Date() }).where(eq(commitments.id, commitment.id));
  await db.insert(verificationEvents).values({ commitmentId: commitment.id, type: "dispute_resolved", provider: "Keenetix arbitration", status: input.outcome === "refund" ? "failed" : "passed", evidence: { disputeId: dispute.id, outcome: input.outcome, splitBps, award }, attestor: "Keenetix protocol" });
  await logAudit({ workspaceId: input.workspaceId, userId: input.userId, apiKeyId: input.apiKeyId, action: "dispute.resolved", entityType: "dispute", entityId: dispute.id, metadata: { commitmentId: commitment.id, outcome: input.outcome, splitBps, award, nextStatus } });
  return { dispute: resolved, commitmentStatus: nextStatus, award };
}
/** Writes the reputation cost of a dispute that did not go the worker's way, and frees the agent. */
async function applyDisputePenalty(commitment: CommitmentRow, outcome: Exclude<DisputeOutcome, "release">, award: string | null) {
  if (!commitment.assignedAgentId) return;
  const [worker] = await db.select().from(agents).where(eq(agents.id, commitment.assignedAgentId)).limit(1);
  if (!worker) return;
  const penalty = outcome === "refund" ? 1.5 : 0.5;
  const nextReputation = Math.max(0, Number(worker.reputation) - penalty).toFixed(2);
  // Earnings are untouched: a split still settles on-chain later, and that is what credits the worker.
  await db.update(agents).set({ status: "available", reputation: nextReputation }).where(eq(agents.id, worker.id));
  await db.insert(reputationRecords).values({
    agentId: worker.id,
    commitmentId: commitment.id,
    reliability: outcome === "refund" ? "0.00" : "60.00",
    quality: outcome === "refund" ? "0.00" : "60.00",
    efficiency: outcome === "refund" ? "0.00" : "70.00",
    delta: (-penalty).toFixed(2),
    note: outcome === "refund" ? "Dispute resolved as a full refund to the funder" : `Dispute resolved as a partial award of ${award} ${commitment.asset}`,
  });
}
/**
 * The portable record behind an agent's headline score: every delta ever written, what moved it,
 * and the rolling averages of the three axes. This is the read side of `reputationRecords`, which
 * settlement and dispute resolution both write to.
 */
export async function getAgentReputation(agentId: number, workspaceId: number) {
  const [agent] = await db.select().from(agents).where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId))).limit(1);
  if (!agent) throw new ProtocolError("Agent not found in this workspace.", 404);
  const records = await db.select({ id: reputationRecords.id, reliability: reputationRecords.reliability, quality: reputationRecords.quality, efficiency: reputationRecords.efficiency, delta: reputationRecords.delta, note: reputationRecords.note, createdAt: reputationRecords.createdAt, commitmentId: reputationRecords.commitmentId, reference: commitments.reference, objective: commitments.objective })
    .from(reputationRecords).leftJoin(commitments, eq(reputationRecords.commitmentId, commitments.id))
    .where(eq(reputationRecords.agentId, agentId)).orderBy(desc(reputationRecords.createdAt)).limit(100);
  const mean = (pick: (record: typeof records[number]) => string) => records.length ? Number((records.reduce((total, record) => total + Number(pick(record)), 0) / records.length).toFixed(2)) : null;
  return {
    agent: { id: agent.id, name: agent.name, role: agent.role, status: agent.status, reputation: agent.reputation, stakeAmount: agent.stakeAmount, stakeAsset: agent.stakeAsset, completedCommitments: agent.completedCommitments, totalEarnings: agent.totalEarnings, capabilities: agent.capabilities, walletAddress: agent.walletAddress },
    records,
    summary: {
      records: records.length,
      reliability: mean((record) => record.reliability),
      quality: mean((record) => record.quality),
      efficiency: mean((record) => record.efficiency),
      positive: records.filter((record) => Number(record.delta) > 0).length,
      negative: records.filter((record) => Number(record.delta) < 0).length,
      netDelta: Number(records.reduce((total, record) => total + Number(record.delta), 0).toFixed(2)),
    },
  };
}
export async function listDisputes(workspaceId: number) {
  return db.select({ id: disputes.id, commitmentId: disputes.commitmentId, reason: disputes.reason, status: disputes.status, outcome: disputes.outcome, splitBps: disputes.splitBps, resolution: disputes.resolution, previousStatus: disputes.previousStatus, createdAt: disputes.createdAt, resolvedAt: disputes.resolvedAt, reference: commitments.reference, objective: commitments.objective, budget: commitments.budget, asset: commitments.asset, commitmentStatus: commitments.status, agentName: agents.name, raisedByName: users.name })
    .from(disputes)
    .innerJoin(commitments, eq(disputes.commitmentId, commitments.id))
    .leftJoin(agents, eq(commitments.assignedAgentId, agents.id))
    .leftJoin(users, eq(disputes.raisedByUserId, users.id))
    .where(eq(commitments.workspaceId, workspaceId))
    .orderBy(desc(disputes.createdAt));
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
