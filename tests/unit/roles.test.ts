import { describe, expect, it } from "vitest";
import { assignableRoles, canManage, canReview } from "@/lib/roles";

describe("roles", () => {
  it("lets admins and moderators review, clients not", () => {
    expect(canReview("admin")).toBe(true);
    expect(canReview("moderator")).toBe(true);
    expect(canReview("client")).toBe(false);
  });

  it("lets admins give any role and moderators only make clients", () => {
    expect(assignableRoles("admin")).toEqual(["client", "moderator", "admin"]);
    expect(assignableRoles("moderator")).toEqual(["client"]);
    expect(assignableRoles("client")).toEqual([]);
  });

  it("keeps moderators away from moderators and admins", () => {
    expect(canManage("admin", "admin")).toBe(true);
    expect(canManage("moderator", "client")).toBe(true);
    expect(canManage("moderator", "moderator")).toBe(false);
    expect(canManage("moderator", "admin")).toBe(false);
    expect(canManage("client", "client")).toBe(false);
  });
});
