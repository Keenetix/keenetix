import type {
  Agent,
  AuditLogEntry,
  Commitment,
  CommitmentSummary,
  Dispute,
  DisputeResolutionResult,
  DisputeSummary,
  ReputationReport,
  Settlement,
  VerificationEvent,
} from "./types.js";

export * from "./types.js";

export type KeenetixConfig = {
  apiKey: string;
  /** Defaults to the production API. Point this at a local server for development. */
  baseUrl?: string;
  /** Injected for testing, or to supply a fetch with your own agent or proxy. */
  fetch?: typeof globalThis.fetch;
};
export type CommitmentInput = { objective: string; budget: number; deadline: string; agentId?: number; repository?: string; verificationRules?: string[] };
export type AgentInput = { name: string; role: string; description: string; capabilities?: string[]; hourlyRate: number; stakeAmount: number; walletAddress: string; isPublic?: boolean; verificationPublicKey?: string };
export type AttestInput = { commitmentReference: string; agentId: number; evidence: Record<string, unknown>; signature: string; type?: string };
export type OracleInput = { commitmentReference: string; provider: string; type: string; evidence: Record<string, unknown>; status?: "passed" | "failed" };
export type SettlementInput = { commitmentId: number; transactionHash: string; escrowAddress: string; chain?: "evm" | "solana"; chainId?: number };
export type Page = { limit?: number; offset?: number };
/** `splitBps` is the worker's share in basis points, and is required only for a split. */
export type DisputeResolution =
  | { outcome: "release" | "refund"; note: string; splitBps?: never }
  | { outcome: "split"; note: string; splitBps: number };

/**
 * An error response from the API. `status` distinguishes the cases worth handling differently:
 * 401/403 for a key problem, 429 for rate limiting, 400 for a rule you broke, 404 for something
 * that is not there.
 */
export class KeenetixError extends Error {
  constructor(message: string, readonly status: number, readonly path: string) {
    super(message);
    this.name = "KeenetixError";
  }
  /** True when the request was refused for lack of a valid key or the required scope. */
  get isAuthError() { return this.status === 401 || this.status === 403; }
  /** True when the key's per-minute budget is spent. Retry after the window rolls. */
  get isRateLimited() { return this.status === 429; }
}

function query(params: Page) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  return search.size ? `?${search.toString()}` : "";
}

export class Keenetix {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(config: KeenetixConfig) {
    if (!config?.apiKey) throw new Error("A Keenetix API key is required.");
    this.baseUrl = (config.baseUrl ?? "https://www.keenetix.xyz").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") throw new Error("No fetch implementation available. Pass one via config.fetch.");
  }

  commitments = {
    list: (page: Page = {}) => this.request<CommitmentSummary[]>(`/api/v1/commitments${query(page)}`),
    create: (input: CommitmentInput) => this.request<Commitment>("/api/v1/commitments", "POST", input),
  };
  agents = {
    list: () => this.request<Agent[]>("/api/v1/agents"),
    register: (input: AgentInput) => this.request<Agent>("/api/v1/agents/register", "POST", input),
    /** The agent's portable reputation record: every delta, what moved it, and rolling averages. */
    reputation: (agentId: number) => this.request<ReputationReport>(`/api/v1/agents/${agentId}/reputation`),
  };
  verifications = {
    attest: (input: AttestInput) => this.request<VerificationEvent>("/api/v1/verifications/attest", "POST", input),
    oracle: (input: OracleInput) => this.request<VerificationEvent>("/api/v1/verifications/oracle", "POST", input),
  };
  settlements = {
    submit: (input: SettlementInput) => this.request<Settlement>("/api/v1/settlements", "POST", input),
  };
  disputes = {
    list: () => this.request<DisputeSummary[]>("/api/v1/disputes"),
    /** Freezes the commitment's escrow until the funding workspace resolves it. */
    raise: (input: { commitmentId: number; reason: string }) => this.request<Dispute>("/api/v1/disputes", "POST", input),
    resolve: (disputeId: number, input: DisputeResolution) => this.request<DisputeResolutionResult>(`/api/v1/disputes/${disputeId}/resolve`, "POST", input),
  };
  audit = {
    list: () => this.request<AuditLogEntry[]>("/api/v1/audit"),
  };

  private async request<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null) as { data?: T; error?: string } | null;
    if (!response.ok) throw new KeenetixError(payload?.error ?? `Keenetix API request failed (${response.status})`, response.status, path);
    return payload?.data as T;
  }
}
