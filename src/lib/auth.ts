import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { emailVerifications, invites, oauthAccounts, organizationMemberships, organizations, passwordResets, sessions, users, workspaceMemberships, workspaces } from "@/db/schema";
import { sendEmail } from "@/lib/email";
const SESSION_COOKIE = "kntx_session";
const WORKSPACE_COOKIE = "kntx_workspace";
const CSRF_COOKIE = "kntx_csrf";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 7;
const EMAIL_VERIFICATION_AGE_SECONDS = 60 * 60 * 24;
const PASSWORD_RESET_AGE_SECONDS = 60 * 60;
const INVITE_AGE_SECONDS = 60 * 60 * 24 * 7;
export type WorkspaceRole = "owner" | "admin" | "builder" | "member" | "viewer";
export type Identity = {
  userId: number;
  name: string;
  email: string;
  emailVerified: boolean;
  organizationId: number;
  organizationName: string;
  workspaceId: number;
  workspaceName: string;
  workspaceSlug: string;
  role: WorkspaceRole;
};
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "workspace";
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
async function createSession(userId: number, workspaceId: number) {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_AGE_SECONDS * 1000) });
  const store = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_AGE_SECONDS };
  store.set(SESSION_COOKIE, token, options);
  store.set(WORKSPACE_COOKIE, String(workspaceId), { ...options, httpOnly: false });
  store.set(CSRF_COOKIE, randomBytes(24).toString("hex"), { ...options, httpOnly: false });
}
export async function getCurrentIdentity(): Promise<Identity | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const selectedWorkspaceId = Number(store.get(WORKSPACE_COOKIE)?.value);
  const rows = await db.select({
    userId: users.id,
    name: users.name,
    email: users.email,
    emailVerifiedAt: users.emailVerifiedAt,
    organizationId: organizations.id,
    organizationName: organizations.name,
    workspaceId: workspaces.id,
    workspaceName: workspaces.name,
    workspaceSlug: workspaces.slug,
    role: workspaceMemberships.role,
  }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(workspaceMemberships, eq(workspaceMemberships.userId, users.id))
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  const row = rows.find((candidate) => candidate.workspaceId === selectedWorkspaceId) ?? rows[0];
  if (!row) return null;
  const { emailVerifiedAt, ...rest } = row;
  return { ...rest, role: row.role as WorkspaceRole, emailVerified: !!emailVerifiedAt };
}
export async function signUp(input: { name: string; email: string; password: string; organization: string; origin: string }) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 160);
  const organizationName = input.organization.trim().slice(0, 160);
  if (!name || !organizationName || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter your name, organization, and a valid email.");
  if (input.password.length < 8) throw new Error("Use a password with at least 8 characters.");
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) throw new Error("An account with this email already exists.");
  const suffix = randomBytes(3).toString("hex");
  const [user] = await db.insert(users).values({ name, email, passwordHash: hashPassword(input.password) }).returning();
  const [organization] = await db.insert(organizations).values({ name: organizationName, slug: `${slugify(organizationName)}-${suffix}` }).returning();
  await db.insert(organizationMemberships).values({ userId: user.id, organizationId: organization.id, role: "owner" });
  const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: `${organizationName} workspace`, slug: "main" }).returning();
  await db.insert(workspaceMemberships).values({ userId: user.id, workspaceId: workspace.id, role: "owner" });
  await createSession(user.id, workspace.id);
  await sendVerificationEmail(user.id, email, input.origin);
  return { user, organization, workspace };
}
export async function sendVerificationEmail(userId: number, email: string, origin: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(emailVerifications).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_AGE_SECONDS * 1000) });
  await sendEmail({ to: email, subject: "Verify your Keenetix email", text: `Confirm your email address to finish setting up Keenetix:\n${origin}/api/auth/verify-email?token=${token}\n\nThis link expires in 24 hours.` });
}
export async function verifyEmailToken(token: string) {
  const [record] = await db.select().from(emailVerifications).where(and(eq(emailVerifications.tokenHash, hashToken(token)), gt(emailVerifications.expiresAt, new Date()))).limit(1);
  if (!record) throw new Error("This verification link is invalid or has expired.");
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, record.userId));
  await db.delete(emailVerifications).where(eq(emailVerifications.userId, record.userId));
}
export async function requestPasswordReset(email: string, origin: string) {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  await db.insert(passwordResets).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + PASSWORD_RESET_AGE_SECONDS * 1000) });
  await sendEmail({ to: normalized, subject: "Reset your Keenetix password", text: `Reset your password:\n${origin}/reset-password?token=${token}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore it.` });
}
export async function resetPassword(token: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("Use a password with at least 8 characters.");
  const [record] = await db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash, hashToken(token)), gt(passwordResets.expiresAt, new Date()))).limit(1);
  if (!record || record.usedAt) throw new Error("This reset link is invalid or has expired.");
  await db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, record.userId));
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, record.id));
  await db.delete(sessions).where(eq(sessions.userId, record.userId));
}
export async function getUserWorkspaces(userId: number) {
  return db.select({ workspaceId: workspaces.id, workspaceName: workspaces.name, organizationName: organizations.name, role: workspaceMemberships.role })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
    .where(eq(workspaceMemberships.userId, userId));
}
export async function createInvite(input: { workspaceId: number; email: string; role: WorkspaceRole; invitedByUserId: number; origin: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) {
    const [existingMembership] = await db.select().from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, input.workspaceId), eq(workspaceMemberships.userId, existingUser.id))).limit(1);
    if (existingMembership) {
      await db.update(workspaceMemberships).set({ role: input.role }).where(eq(workspaceMemberships.id, existingMembership.id));
    } else {
      const [workspace] = await db.select({ organizationId: workspaces.organizationId }).from(workspaces).where(eq(workspaces.id, input.workspaceId)).limit(1);
      if (!workspace) throw new Error("Workspace not found.");
      const [orgMembership] = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.organizationId, workspace.organizationId), eq(organizationMemberships.userId, existingUser.id))).limit(1);
      if (!orgMembership) await db.insert(organizationMemberships).values({ organizationId: workspace.organizationId, userId: existingUser.id, role: input.role === "admin" ? "admin" : "member" });
      await db.insert(workspaceMemberships).values({ workspaceId: input.workspaceId, userId: existingUser.id, role: input.role });
    }
    return { status: "added" as const };
  }
  const token = randomBytes(32).toString("hex");
  await db.insert(invites).values({ workspaceId: input.workspaceId, email, role: input.role, tokenHash: hashToken(token), invitedByUserId: input.invitedByUserId, expiresAt: new Date(Date.now() + INVITE_AGE_SECONDS * 1000) });
  await sendEmail({ to: email, subject: "You're invited to a Keenetix workspace", text: `You've been invited to join a Keenetix workspace:\n${input.origin}/accept-invite?token=${token}\n\nThis link expires in 7 days.` });
  return { status: "invited" as const };
}
export async function getInviteDetails(token: string) {
  const [row] = await db.select({ email: invites.email, role: invites.role, expiresAt: invites.expiresAt, acceptedAt: invites.acceptedAt, workspaceName: workspaces.name, organizationName: organizations.name })
    .from(invites)
    .innerJoin(workspaces, eq(invites.workspaceId, workspaces.id))
    .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
    .where(eq(invites.tokenHash, hashToken(token))).limit(1);
  if (!row || row.acceptedAt || row.expiresAt < new Date()) return null;
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, row.email)).limit(1);
  return { email: row.email, role: row.role, workspaceName: row.workspaceName, organizationName: row.organizationName, needsAccount: !existingUser };
}
export async function acceptInvite(input: { token: string; name?: string; password?: string }) {
  const [invite] = await db.select().from(invites).where(and(eq(invites.tokenHash, hashToken(input.token)), gt(invites.expiresAt, new Date()))).limit(1);
  if (!invite || invite.acceptedAt) throw new Error("This invite is invalid or has expired.");
  let [user] = await db.select().from(users).where(eq(users.email, invite.email)).limit(1);
  if (!user) {
    const name = input.name?.trim().slice(0, 160);
    if (!name || !input.password || input.password.length < 8) throw new Error("Enter your name and a password with at least 8 characters.");
    [user] = await db.insert(users).values({ name, email: invite.email, passwordHash: hashPassword(input.password) }).returning();
  }
  const [workspace] = await db.select({ organizationId: workspaces.organizationId }).from(workspaces).where(eq(workspaces.id, invite.workspaceId)).limit(1);
  if (!workspace) throw new Error("Workspace not found.");
  const [existingMembership] = await db.select().from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, invite.workspaceId), eq(workspaceMemberships.userId, user.id))).limit(1);
  if (!existingMembership) {
    const [orgMembership] = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.organizationId, workspace.organizationId), eq(organizationMemberships.userId, user.id))).limit(1);
    if (!orgMembership) await db.insert(organizationMemberships).values({ organizationId: workspace.organizationId, userId: user.id, role: invite.role === "admin" ? "admin" : "member" });
    await db.insert(workspaceMemberships).values({ workspaceId: invite.workspaceId, userId: user.id, role: invite.role as WorkspaceRole });
  }
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));
  await createSession(user.id, invite.workspaceId);
  return { userId: user.id, workspaceId: invite.workspaceId };
}
export async function signInWithOAuth(input: { provider: "google" | "github"; providerAccountId: string; email: string; name: string }) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 160) || email.split("@")[0];
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Your account did not provide a usable email address.");
  const [linked] = await db.select({ userId: oauthAccounts.userId }).from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, input.provider), eq(oauthAccounts.providerAccountId, input.providerAccountId))).limit(1);
  let userId = linked?.userId;
  if (!userId) {
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const suffix = randomBytes(3).toString("hex");
      const [user] = await db.insert(users).values({ name, email, passwordHash: null, emailVerifiedAt: new Date() }).returning();
      const [organization] = await db.insert(organizations).values({ name, slug: `${slugify(name)}-${suffix}` }).returning();
      await db.insert(organizationMemberships).values({ userId: user.id, organizationId: organization.id, role: "owner" });
      const [workspace] = await db.insert(workspaces).values({ organizationId: organization.id, name: `${name} workspace`, slug: "main" }).returning();
      await db.insert(workspaceMemberships).values({ userId: user.id, workspaceId: workspace.id, role: "owner" });
      userId = user.id;
    }
    await db.insert(oauthAccounts).values({ userId, provider: input.provider, providerAccountId: input.providerAccountId });
  }
  const [membership] = await db.select({ workspaceId: workspaceMemberships.workspaceId }).from(workspaceMemberships).where(eq(workspaceMemberships.userId, userId)).limit(1);
  if (!membership) throw new Error("This account does not have an active workspace.");
  await createSession(userId, membership.workspaceId);
  return { userId, workspaceId: membership.workspaceId };
}
export async function signIn(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) throw new Error("Invalid email or password.");
  const [membership] = await db.select({ workspaceId: workspaceMemberships.workspaceId }).from(workspaceMemberships).where(eq(workspaceMemberships.userId, user.id)).limit(1);
  if (!membership) throw new Error("This account does not have an active workspace.");
  await createSession(user.id, membership.workspaceId);
  return { user, workspaceId: membership.workspaceId };
}
export async function signOut() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(SESSION_COOKIE);
  store.delete(WORKSPACE_COOKIE);
  store.delete(CSRF_COOKIE);
}
export async function setActiveWorkspace(workspaceId: number, userId: number) {
  const [membership] = await db.select().from(workspaceMemberships).where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.userId, userId))).limit(1);
  if (!membership) throw new Error("You do not have access to that workspace.");
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, String(workspaceId), { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_AGE_SECONDS });
}
export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "builder";
}