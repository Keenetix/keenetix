import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { canManageWorkspace, getCurrentIdentity } from "@/lib/auth";
import { logAudit, type ApiScope } from "@/lib/api-security";
import { ensureWorkspace } from "@/lib/keenetix";
const supportedScopes: ApiScope[] = ["commitments:read", "commitments:write", "agents:read", "agents:write", "verifications:write", "settlements:write", "audit:read"];
export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!canManageWorkspace(identity.role)) return NextResponse.json({ error: "Your workspace role cannot create API keys." }, { status: 403 });
  try {
    const body = await request.json() as { name?: unknown; scopes?: unknown; rateLimitPerMinute?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    const requestedScopes = Array.isArray(body.scopes) ? body.scopes.filter((scope): scope is ApiScope => typeof scope === "string" && supportedScopes.includes(scope as ApiScope)) : supportedScopes;
    const rateLimit = typeof body.rateLimitPerMinute === "number" ? Math.max(10, Math.min(600, Math.floor(body.rateLimitPerMinute))) : 60;
    if (!name) return NextResponse.json({ error: "A key name is required." }, { status: 400 });
    const { account } = await ensureWorkspace(identity.workspaceId);
    const rawKey = `kntx_live_${randomBytes(20).toString("hex")}`;
    const keyPrefix = `${rawKey.slice(0, 14)}…${rawKey.slice(-4)}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const [key] = await db.insert(apiKeys).values({ developerId: account.id, workspaceId: identity.workspaceId, createdByUserId: identity.userId, name, keyPrefix, keyHash, scopes: requestedScopes.length ? requestedScopes : ["commitments:read"], rateLimitPerMinute: rateLimit }).returning({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, scopes: apiKeys.scopes, rateLimitPerMinute: apiKeys.rateLimitPerMinute, createdAt: apiKeys.createdAt });
    await logAudit({ workspaceId: identity.workspaceId, userId: identity.userId, action: "api_key.created", entityType: "api_key", entityId: key.id, metadata: { name, scopes: key.scopes } });
    return NextResponse.json({ key, rawKey }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create an API key." }, { status: 500 });
  }
}

