import { createHash } from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, auditLogs } from "@/db/schema";
export type ApiScope = "commitments:read" | "commitments:write" | "agents:read" | "agents:write" | "verifications:write" | "settlements:write" | "audit:read" | "disputes:read" | "disputes:write";
export type ApiIdentity = { apiKeyId: number; workspaceId: number; scopes: ApiScope[]; rateLimitPerMinute: number };
/**
 * A rule the caller broke — a bad state transition, a missing resource, an unmet precondition.
 * Distinct from an unexpected fault so the API can answer 4xx with the reason instead of burying
 * it in a 500. Anything that is genuinely our fault stays a plain Error and stays a 500.
 */
export class ProtocolError extends Error {
  constructor(message: string, public readonly status: number = 400) { super(message); }
}
export class ApiSecurityError extends ProtocolError {}
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
  // One statement, so concurrent requests on the same key serialise on the row rather than each
  // reading the same count and all deciding they are under the limit. The window rolls inside the
  // same upsert, and the count is incremented before the check so a rejected request still counts.
  const [bucket] = await db.execute<{ request_count: number }>(sql`
    INSERT INTO api_rate_limits (api_key_id, window_started_at, request_count, updated_at)
    VALUES (${key.id}, ${now}, 1, ${now})
    ON CONFLICT (api_key_id) DO UPDATE SET
      request_count = CASE WHEN api_rate_limits.window_started_at <= ${now}::timestamptz - interval '60 seconds' THEN 1 ELSE api_rate_limits.request_count + 1 END,
      window_started_at = CASE WHEN api_rate_limits.window_started_at <= ${now}::timestamptz - interval '60 seconds' THEN ${now} ELSE api_rate_limits.window_started_at END,
      updated_at = ${now}
    RETURNING request_count
  `).then((result) => result.rows);
  if (bucket && bucket.request_count > key.rateLimitPerMinute) throw new ApiSecurityError("Rate limit exceeded. Try again in one minute.", 429);
  await db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, key.id));
  await logAudit({ workspaceId: key.workspaceId, apiKeyId: key.id, action: "api.request", entityType: requiredScope, ipAddress: request.headers.get("x-forwarded-for"), metadata: { method: request.method, path: new URL(request.url).pathname } });
  return { apiKeyId: key.id, workspaceId: key.workspaceId, scopes, rateLimitPerMinute: key.rateLimitPerMinute };
}
export function apiErrorResponse(error: unknown) {
  if (error instanceof ProtocolError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "Unexpected API error." }, { status: 500 });
}