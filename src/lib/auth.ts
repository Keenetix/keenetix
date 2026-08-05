import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { organizationMemberships, organizations, sessions, users, workspaceMemberships, workspaces } from "@/db/schema";
const SESSION_COOKIE = "kntx_session";
const WORKSPACE_COOKIE = "kntx_workspace";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 7;
export type WorkspaceRole = "owner" | "admin" | "builder" | "member" | "viewer";
export type Identity = {
  userId: number;
  name: string;
  email: string;
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
  return { ...row, role: row.role as WorkspaceRole };
}
export async function signUp(input: { name: string; email: string; password: string; organization: string }) {
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
  return { user, organization, workspace };
}
export async function signIn(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !verifyPassword(input.password, user.passwordHash)) throw new Error("Invalid email or password.");
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