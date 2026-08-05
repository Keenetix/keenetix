import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getCurrentIdentity, signIn, signOut, signUp } from "@/lib/auth";
import { fakeCookieStore } from "../setup";
import { TestRegistry } from "../helpers/db-cleanup";
const registry = new TestRegistry();
const uniqueEmail = (label: string) => `test_${label}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.test`;
beforeEach(() => {
  fakeCookieStore.clear();
});
afterAll(async () => {
  await registry.cleanup();
});
describe("auth flow", () => {
  it("signs up a new user and starts an authenticated session", async () => {
    const email = uniqueEmail("signup");
    registry.trackEmail(email);
    const { user, organization } = await signUp({ name: "Ada Lovelace", email, password: "password123", organization: "Ada Co" });
    registry.trackOrganization(organization.id);
    const identity = await getCurrentIdentity();
    expect(identity).not.toBeNull();
    expect(identity?.email).toBe(email);
    expect(identity?.role).toBe("owner");
    expect(user.email).toBe(email);
  });
  it("rejects duplicate email sign-up", async () => {
    const email = uniqueEmail("dup");
    registry.trackEmail(email);
    const first = await signUp({ name: "First", email, password: "password123", organization: "First Co" });
    registry.trackOrganization(first.organization.id);
    await expect(signUp({ name: "Second", email, password: "password123", organization: "Second Co" })).rejects.toThrow(/already exists/);
  });
  it("signs in with correct credentials and rejects the wrong password", async () => {
    const email = uniqueEmail("signin");
    registry.trackEmail(email);
    const { organization } = await signUp({ name: "Grace Hopper", email, password: "correct-password", organization: "Hopper Co" });
    registry.trackOrganization(organization.id);
    fakeCookieStore.clear();
    await signIn({ email, password: "correct-password" });
    const identity = await getCurrentIdentity();
    expect(identity?.email).toBe(email);
    fakeCookieStore.clear();
    await expect(signIn({ email, password: "wrong-password" })).rejects.toThrow(/Invalid email or password/);
  });
  it("clears the session on sign out", async () => {
    const email = uniqueEmail("signout");
    registry.trackEmail(email);
    const { organization } = await signUp({ name: "Alan Turing", email, password: "password123", organization: "Turing Co" });
    registry.trackOrganization(organization.id);
    expect(await getCurrentIdentity()).not.toBeNull();
    await signOut();
    expect(await getCurrentIdentity()).toBeNull();
  });
});
