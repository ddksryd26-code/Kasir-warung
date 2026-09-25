import { describe, expect, it } from "vitest";
import { scopeClerkUserId } from "./clerkAuth";

describe("scopeClerkUserId", () => {
  it("keeps existing Replit Clerk IDs unchanged", () => {
    expect(scopeClerkUserId("user_replit_123", "replit")).toBe("user_replit_123");
  });

  it("namespaces external Clerk IDs so their data stays separate", () => {
    expect(scopeClerkUserId("user_external_123", "external")).toBe("external:user_external_123");
  });
});