import { createHash } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { apiKeys, developerAccounts, organizations, workspaces } from "@/db/schema";
import { authenticateApiKey } from "@/lib/api-security";
import { TestRegistry } from "../helpers/db-cleanup";
const registry = new TestRegistry();
afterAll(async () => {
  await registry.cleanup();
});
async function setupApiKey(input: { scopes: string[]; rateLimitPerMinute?: number; revoked?: boolean }) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const [organization] = await db.insert(organizations).values({ name: `API Key Test ${suffix}`, slug: `api-key-test-${suffix}` }).returning();
  registry.trackOrganization(organization.id);
  const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: "API workspace", slug: "main" }).returning();
  const [developer] = await db.insert(developerAccounts).values({ organization: organization.name, email: `apikey_${suffix}@example.test` }).returning();
  registry.trackDeveloperAccount(developer.id);
  const rawKey = `kntx_live_test_${suffix}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  await db.insert(apiKeys).values({ developerId: developer.id, workspaceId: workspace.id, name: "test key", keyPrefix: rawKey.slice(0, 14), keyHash, scopes: input.scopes, rateLimitPerMinute: input.rateLimitPerMinute ?? 60, revokedAt: input.revoked ? new Date() : undefined });
  return { rawKey, workspaceId: workspace.id };
}
function makeRequest(rawKey: string) {
  return new Request("http://localhost/api/v1/commitments", { headers: { authorization: `Bearer ${rawKey}` } });
}
describe("API key scope enforcement", () => {
  it("authenticates a key that has the required scope", async () => {
    const { rawKey, workspaceId } = await setupApiKey({ scopes: ["commitments:read"] });
    const identity = await authenticateApiKey(makeRequest(rawKey), "commitments:read");
    expect(identity.workspaceId).toBe(workspaceId);
  });
  it("rejects a key missing the required scope", async () => {
    const { rawKey } = await setupApiKey({ scopes: ["agents:read"] });
    await expect(authenticateApiKey(makeRequest(rawKey), "commitments:write")).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a revoked key", async () => {
    const { rawKey } = await setupApiKey({ scopes: ["commitments:read"], revoked: true });
    await expect(authenticateApiKey(makeRequest(rawKey), "commitments:read")).rejects.toMatchObject({ status: 401 });
  });
  it("rejects a malformed bearer token", async () => {
    const request = new Request("http://localhost/api/v1/commitments", { headers: { authorization: "Bearer garbage" } });
    await expect(authenticateApiKey(request, "commitments:read")).rejects.toMatchObject({ status: 401 });
  });
  it("enforces the per-key rate limit", async () => {
    const { rawKey } = await setupApiKey({ scopes: ["commitments:read"], rateLimitPerMinute: 1 });
    await authenticateApiKey(makeRequest(rawKey), "commitments:read");
    await expect(authenticateApiKey(makeRequest(rawKey), "commitments:read")).rejects.toMatchObject({ status: 429 });
  });
});
