/**
 * Wire types for the Keenetix API. Money and score columns cross the wire as decimal strings
 * rather than numbers so no precision is lost in JSON; timestamps are ISO 8601 strings.
 */
export type CommitmentStatus = "draft" | "funded" | "executing" | "verified" | "awaiting_settlement" | "settlement_submitted" | "settled" | "disputed" | "refunded";
export type DisputeStatus = "open" | "resolved";
export type DisputeOutcome = "release" | "refund" | "split";
export type VerificationStatus = "passed" | "failed" | "pending";

/** A commitment as returned by the list endpoint, joined to its assigned agent's name. */
export type CommitmentSummary = {
  id: number;
  reference: string;
  objective: string;
  budget: string;
  asset: string;
  deadline: string;
  status: CommitmentStatus;
  assignedAgentName: string | null;
  createdAt: string;
};
/** The full row returned when a commitment is created. */
export type Commitment = {
  id: number;
  reference: string;
  developerId: number;
  workspaceId: number | null;
  assignedAgentId: number | null;
  objective: string;
  budget: string;
  asset: string;
  deadline: string;
  status: CommitmentStatus;
  repository: string | null;
  verificationRules: string[];
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Agent = {
  id: number;
  workspaceId: number | null;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  hourlyRate: string;
  stakeAmount: string;
  stakeAsset: string;
  isPublic: boolean;
  verificationPublicKey: string | null;
  status: string;
  walletAddress: string;
  reputation: string;
  completedCommitments: number;
  totalEarnings: string;
  createdAt: string;
};
export type VerificationEvent = {
  id: number;
  commitmentId: number;
  type: string;
  provider: string;
  status: VerificationStatus;
  evidence: Record<string, unknown>;
  attestor: string | null;
  signature: string | null;
  createdAt: string;
};
export type Settlement = {
  id: number;
  commitmentId: number;
  amount: string;
  asset: string;
  status: string;
  chain: "evm" | "solana";
  chainId: number | null;
  escrowAddress: string | null;
  transactionHash: string | null;
  receipt: unknown;
  settledAt: string | null;
  createdAt: string;
};
export type Dispute = {
  id: number;
  commitmentId: number;
  raisedByUserId: number | null;
  raisedByApiKeyId: number | null;
  reason: string;
  status: DisputeStatus;
  /** The lifecycle state escrow froze at, restored when the outcome is `release`. */
  previousStatus: CommitmentStatus;
  outcome: DisputeOutcome | null;
  splitBps: number | null;
  resolution: string | null;
  resolvedByUserId: number | null;
  resolvedByApiKeyId: number | null;
  createdAt: string;
  resolvedAt: string | null;
};
/** A dispute joined to the commitment it contests, as returned by the list endpoint. */
export type DisputeSummary = Pick<Dispute, "id" | "commitmentId" | "reason" | "status" | "outcome" | "splitBps" | "resolution" | "previousStatus" | "createdAt" | "resolvedAt"> & {
  reference: string;
  objective: string;
  budget: string;
  asset: string;
  commitmentStatus: CommitmentStatus;
  agentName: string | null;
  raisedByName: string | null;
};
export type DisputeResolutionResult = {
  dispute: Dispute;
  /** Where the commitment landed: its frozen state, `refunded`, or `verified` for a split. */
  commitmentStatus: CommitmentStatus;
  /** The worker's share for a split, as a decimal string. Null for release and refund. */
  award: string | null;
};
export type ReputationRecord = {
  id: number;
  reliability: string;
  quality: string;
  efficiency: string;
  delta: string;
  note: string;
  createdAt: string;
  commitmentId: number | null;
  reference: string | null;
  objective: string | null;
};
export type ReputationReport = {
  agent: Pick<Agent, "id" | "name" | "role" | "status" | "reputation" | "stakeAmount" | "stakeAsset" | "completedCommitments" | "totalEarnings" | "capabilities" | "walletAddress">;
  records: ReputationRecord[];
  summary: {
    records: number;
    /** Rolling averages across every record, or null when the agent has no history yet. */
    reliability: number | null;
    quality: number | null;
    efficiency: number | null;
    positive: number;
    negative: number;
    netDelta: number;
  };
};
export type AuditLogEntry = {
  id: number;
  workspaceId: number;
  userId: number | null;
  apiKeyId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
