import "dotenv/config";
import { vi } from "vitest";
class FakeCookieStore {
  private store = new Map<string, string>();
  get(name: string) {
    const value = this.store.get(name);
    return value === undefined ? undefined : { name, value };
  }
  set(name: string, value: string) {
    this.store.set(name, value);
  }
  delete(name: string) {
    this.store.delete(name);
  }
  clear() {
    this.store.clear();
  }
}
export const fakeCookieStore = new FakeCookieStore();
vi.mock("next/headers", () => ({ cookies: async () => fakeCookieStore }));
