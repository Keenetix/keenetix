import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);
export const oauthAccounts = pgTable("oauth_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("oauth_accounts_provider_unique").on(table.provider, table.providerAccountId)]);
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)]);
export const organizationMemberships = pgTable("organization_memberships", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("organization_memberships_unique").on(table.organizationId, table.userId)]);
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("workspaces_organization_slug_unique").on(table.organizationId, table.slug)]);
export const workspaceMemberships = pgTable("workspace_memberships", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("workspace_memberships_unique").on(table.workspaceId, table.userId)]);
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)]);
// Legacy account record retained for existing data compatibility. New resources use workspaces.
export const developerAccounts = pgTable("developer_accounts", {
  id: serial("id").primaryKey(),
  organization: varchar("organization", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("developer_accounts_email_unique").on(table.email)]);
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  developerId: integer("developer_id").notNull().references(() => developerAccounts.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 100 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 32 }).notNull(),
  keyHash: varchar("key_hash", { length: 128 }).notNull(),
  scopes: jsonb("scopes").notNull().default(["commitments:read", "commitments:write", "agents:read", "verifications:write", "settlements:write"]),
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const apiRateLimits = pgTable("api_rate_limits", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  requestCount: integer("request_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("api_rate_limits_key_unique").on(table.apiKeyId)]);
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  role: varchar("role", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  capabilities: jsonb("capabilities").notNull().default([]),
  hourlyRate: numeric("hourly_rate", { precision: 12, scale: 2 }).notNull().default("0"),
  stakeAmount: numeric("stake_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  stakeAsset: varchar("stake_asset", { length: 16 }).notNull().default("KNTX"),
  isPublic: boolean("is_public").notNull().default(false),
  verificationPublicKey: text("verification_public_key"),
  status: varchar("status", { length: 32 }).notNull().default("available"),
  walletAddress: varchar("wallet_address", { length: 100 }).notNull(),
  reputation: numeric("reputation", { precision: 5, scale: 2 }).notNull().default("0"),
  completedCommitments: integer("completed_commitments").notNull().default(0),
  totalEarnings: numeric("total_earnings", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const commitments = pgTable("commitments", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 48 }).notNull(),
  developerId: integer("developer_id").notNull().references(() => developerAccounts.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  assignedAgentId: integer("assigned_agent_id").references(() => agents.id, { onDelete: "set null" }),
  objective: text("objective").notNull(),
  budget: numeric("budget", { precision: 14, scale: 2 }).notNull(),
  asset: varchar("asset", { length: 16 }).notNull().default("USDC"),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  repository: varchar("repository", { length: 255 }),
  verificationRules: jsonb("verification_rules").notNull().default([]),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("commitments_reference_unique").on(table.reference)]);
export const verificationIntegrations = pgTable("verification_integrations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 80 }).notNull(),
  repository: varchar("repository", { length: 255 }),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  configuration: jsonb("configuration").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const verificationEvents = pgTable("verification_events", {
  id: serial("id").primaryKey(),
  commitmentId: integer("commitment_id").notNull().references(() => commitments.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  evidence: jsonb("evidence").notNull().default({}),
  attestor: varchar("attestor", { length: 160 }),
  signature: text("signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const settlements = pgTable("settlements", {
  id: serial("id").primaryKey(),
  commitmentId: integer("commitment_id").notNull().references(() => commitments.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  asset: varchar("asset", { length: 16 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  chain: varchar("chain", { length: 16 }).notNull().default("evm"),
  chainId: integer("chain_id"),
  escrowAddress: varchar("escrow_address", { length: 100 }),
  transactionHash: varchar("transaction_hash", { length: 128 }),
  receipt: jsonb("receipt"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const reputationRecords = pgTable("reputation_records", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  commitmentId: integer("commitment_id").references(() => commitments.id, { onDelete: "set null" }),
  reliability: numeric("reliability", { precision: 5, scale: 2 }).notNull(),
  quality: numeric("quality", { precision: 5, scale: 2 }).notNull(),
  efficiency: numeric("efficiency", { precision: 5, scale: 2 }).notNull(),
  delta: numeric("delta", { precision: 5, scale: 2 }).notNull(),
  note: varchar("note", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  apiKeyId: integer("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 80 }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const commitmentBids = pgTable("commitment_bids", {
  id: serial("id").primaryKey(),
  commitmentId: integer("commitment_id").notNull().references(() => commitments.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  proposedRate: numeric("proposed_rate", { precision: 12, scale: 2 }).notNull(),
  message: text("message").notNull().default(""),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("commitment_bids_unique").on(table.commitmentId, table.agentId)]);
export const disputes = pgTable("disputes", {
  id: serial("id").primaryKey(),
  commitmentId: integer("commitment_id").notNull().references(() => commitments.id, { onDelete: "cascade" }),
  // Either a signed-in member or an API key can raise and resolve a dispute, so both attributions are optional.
  raisedByUserId: integer("raised_by_user_id").references(() => users.id, { onDelete: "set null" }),
  raisedByApiKeyId: integer("raised_by_api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  // The lifecycle state escrow was frozen at, so a `release` outcome can resume exactly where it stopped.
  previousStatus: varchar("previous_status", { length: 32 }).notNull().default("verified"),
  outcome: varchar("outcome", { length: 32 }),
  // Worker share in basis points, set only when `outcome` is "split".
  splitBps: integer("split_bps"),
  resolution: text("resolution"),
  resolvedByUserId: integer("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  resolvedByApiKeyId: integer("resolved_by_api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
export const emailVerifications = pgTable("email_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("email_verifications_token_hash_unique").on(table.tokenHash)]);
export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("password_resets_token_hash_unique").on(table.tokenHash)]);
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("member"),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  invitedByUserId: integer("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("invites_token_hash_unique").on(table.tokenHash)]);
export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  focus: varchar("focus", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
