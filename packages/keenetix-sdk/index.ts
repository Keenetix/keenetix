export type KeenetixConfig = { apiKey: string; baseUrl?: string };
export type CommitmentInput = { objective: string; budget: number; deadline: string; agentId?: number; repository?: string; verificationRules?: string[] };
export type AgentInput = { name: string; role: string; description: string; capabilities?: string[]; hourlyRate: number; stakeAmount: number; walletAddress: string; isPublic?: boolean; verificationPublicKey?: string };
export type DisputeResolution =
  | { outcome: "release" | "refund"; note: string; splitBps?: never }
  | { outcome: "split"; note: string; splitBps: number };
type ApiResult<T> = { data: T };
export class Keenetix {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  constructor(config: KeenetixConfig) {
    this.baseUrl = (config.baseUrl ?? "https://www.keenetix.xyz").replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }
  commitments = {
    list: () => this.request<unknown[]>("/api/v1/commitments"),
    create: (input: CommitmentInput) => this.request<unknown>("/api/v1/commitments", { method: "POST", body: JSON.stringify(input) }),
  };
  agents = {
    list: () => this.request<unknown[]>("/api/v1/agents"),
    register: (input: AgentInput) => this.request<unknown>("/api/v1/agents/register", { method: "POST", body: JSON.stringify(input) }),
  };
  verifications = {
    attest: (input: { commitmentReference: string; agentId: number; evidence: Record<string, unknown>; signature: string; type?: string }) => this.request<unknown>("/api/v1/verifications/attest", { method: "POST", body: JSON.stringify(input) }),
    oracle: (input: { commitmentReference: string; provider: string; type: string; evidence: Record<string, unknown>; status?: "passed" | "failed" }) => this.request<unknown>("/api/v1/verifications/oracle", { method: "POST", body: JSON.stringify(input) }),
  };
  settlements = {
    submit: (input: { commitmentId: number; transactionHash: string; chainId: number; escrowAddress: string }) => this.request<unknown>("/api/v1/settlements", { method: "POST", body: JSON.stringify(input) }),
  };
  disputes = {
    list: () => this.request<unknown[]>("/api/v1/disputes"),
    raise: (input: { commitmentId: number; reason: string }) => this.request<unknown>("/api/v1/disputes", { method: "POST", body: JSON.stringify(input) }),
    /** `splitBps` is the worker's share in basis points, and is required only when `outcome` is "split". */
    resolve: (disputeId: number, input: DisputeResolution) => this.request<unknown>(`/api/v1/disputes/${disputeId}/resolve`, { method: "POST", body: JSON.stringify(input) }),
  };
  private async request<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}`, ...(init.headers ?? {}) } });
    const body = await response.json() as ApiResult<T> & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `Keenetix API request failed (${response.status})`);
    return body.data;
  }
}