import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { developerAccounts, organizations, users } from "@/db/schema";
export class TestRegistry {
  private emails: string[] = [];
  private organizationIds: number[] = [];
  private developerAccountIds: number[] = [];
  trackEmail(email: string) {
    this.emails.push(email);
  }
  trackOrganization(id: number) {
    this.organizationIds.push(id);
  }
  trackDeveloperAccount(id: number) {
    this.developerAccountIds.push(id);
  }
  async cleanup() {
    if (this.organizationIds.length) await db.delete(organizations).where(inArray(organizations.id, this.organizationIds));
    if (this.developerAccountIds.length) await db.delete(developerAccounts).where(inArray(developerAccounts.id, this.developerAccountIds));
    if (this.emails.length) await db.delete(users).where(inArray(users.email, this.emails));
  }
}
