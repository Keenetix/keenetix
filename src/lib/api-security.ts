import { createHash } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, apiRateLimits, auditLogs } from "@/db/schema";
export type ApiScope = "commitments:read" | "commitments:write" | "agents:read" | "agents:write" | "verifications:write" | "settlements:write" | "audit:read";
export type ApiIdentity = { apiKeyId: number; workspaceId: number; scopes: ApiScope[]; rateLimitPerMinute: number };
export class ApiSecurityError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export async function logAudit(input: { workspaceId: number; action: string; entityType: string; entityId?: string | number; userId?: number; apiKeyId?: number; ipAddress?: string | null; metadata?: Record<string, unknown> }) {
  await db.insert(auditLogs).values({
    workspaceId: input.workspaceId,
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ? String(input.entityId) : undefined,
    ipAddress: input.ipAddress ?? undefined,
    metadata: input.metadata ?? {},
  });
}
export async function authenticateApiKey(request: Request, requiredScope: ApiScope): Promise<ApiIdentity> {
  const header = request.headers.get("authorization");
  const rawKey = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!rawKey.startsWith("kntx_live_")) throw new ApiSecurityError("A valid Bearer API key is required.", 401);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const [key] = await db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt))).limit(1);
  if (!key || !key.workspaceId) throw new ApiSecurityError("This API key is invalid or has been revoked.", 401);
  const scopes = Array.isArray(key.scopes) ? key.scopes.filter((scope): scope is ApiScope => typeof scope === "string") : [];
  if (!scopes.includes(requiredScope)) throw new ApiSecurityError("This API key does not have the required scope.", 403);
  const now = new Date();
  const [bucket] = await db.select().from(apiRateLimits).where(eq(apiRateLimits.apiKeyId, key.id)).limit(1);
  if (!bucket) {
    await db.insert(apiRateLimits).values({ apiKeyId: key.id, windowStartedAt: now, requestCount: 1, updatedAt: now });
  } else if (now.getTime() - bucket.windowStartedAt.getTime() >= 60_000) {
    await db.update(apiRateLimits).set({ windowStartedAt: now, requestCount: 1, updatedAt: now }).where(eq(apiRateLimits.id, bucket.id));
  } else if (bucket.requestCount >= key.rateLimitPerMinute) {
    throw new ApiSecurityError("Rate limit exceeded. Try again in one minute.", 429);
  } else {
    await db.update(apiRateLimits).set({ requestCount: bucket.requestCount + 1, updatedAt: now }).where(eq(apiRateLimits.id, bucket.id));
  }
  await db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, key.id));
  await logAudit({ workspaceId: key.workspaceId, apiKeyId: key.id, action: "api.request", entityType: requiredScope, ipAddress: request.headers.get("x-forwarded-for"), metadata: { method: request.method, path: new URL(request.url).pathname } });
  return { apiKeyId: key.id, workspaceId: key.workspaceId, scopes, rateLimitPerMinute: key.rateLimitPerMinute };
}
export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiSecurityError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "Unexpected API error." }, { status: 500 });
}