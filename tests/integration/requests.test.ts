import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { countPendingRequests, listRequests, RequestNotFound, ReviewForbidden, reviewRequest } from "@/lib/data/requests";
import { authenticate, getPublicProfile } from "@/lib/data/users";
import { makeUser } from "./helpers";

async function setup() {
  const admin = await makeUser({ username: "admin" }, { role: "admin" });
  const moderator = await makeUser({ username: "mod" }, { role: "moderator" });
  const request = await makeUser({ username: "newcomer", email: "new@example.com" }, { status: "pending" });
  return { admin: { id: admin.id, role: "admin" as const }, moderator: { id: moderator.id, role: "moderator" as const }, request };
}

describe("listRequests", () => {
  it("separates pending requests (oldest first) from decided accounts", async () => {
    const { request } = await setup();
    const later = await makeUser({ username: "later" }, { status: "pending" });
    const { pending, decided } = await listRequests();
    expect(pending.map((r) => r.username)).toEqual([request.username, later.username]);
    expect(decided.map((r) => r.username).sort()).toEqual(["admin", "mod"]);
    expect(pending[0]).toMatchObject({ email: "new@example.com", status: "pending", role: "client", reviewedAt: null });
    expect(await countPendingRequests()).toBe(2);
  });
});

describe("reviewRequest", () => {
  it("approves with a role, after which the account can log in and has a public page", async () => {
    const { admin, request } = await setup();
    const before = await authenticate("new@example.com", "correct horse battery staple");
    expect(before?.status).toBe("pending");
    expect(await getPublicProfile("newcomer")).toBeNull();

    const reviewed = await reviewRequest(admin, request.id, { status: "approved", role: "moderator" });
    expect(reviewed).toMatchObject({ status: "approved", role: "moderator" });
    expect(reviewed.reviewedAt).toBeInstanceOf(Date);
    expect((await authenticate("new@example.com", "correct horse battery staple"))?.status).toBe("approved");
    expect(await getPublicProfile("newcomer")).not.toBeNull();
    expect(await countPendingRequests()).toBe(0);
  });

  it("denies, and can approve a denied request later", async () => {
    const { admin, request } = await setup();
    await reviewRequest(admin, request.id, { status: "denied" });
    expect((await authenticate("new@example.com", "correct horse battery staple"))?.status).toBe("denied");
    await reviewRequest(admin, request.id, { status: "approved", role: "client" });
    expect((await authenticate("new@example.com", "correct horse battery staple"))?.status).toBe("approved");
  });

  it("lets a moderator make clients only, and never touch moderators or admins", async () => {
    const { admin, moderator, request } = await setup();
    await expect(reviewRequest(moderator, request.id, { status: "approved", role: "admin" })).rejects.toBeInstanceOf(ReviewForbidden);
    await expect(reviewRequest(moderator, admin.id, { status: "denied" })).rejects.toBeInstanceOf(ReviewForbidden);
    await reviewRequest(moderator, request.id, { status: "approved", role: "client" });
    // Now a client: still manageable by the moderator. Promote them and the moderator loses that.
    await reviewRequest(admin, request.id, { status: "approved", role: "moderator" });
    await expect(reviewRequest(moderator, request.id, { status: "denied" })).rejects.toBeInstanceOf(ReviewForbidden);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).status).toBe("approved");
  });

  it("refuses clients, self-review and unknown accounts", async () => {
    const { admin, request } = await setup();
    await expect(reviewRequest({ id: request.id, role: "client" }, admin.id, { status: "denied" })).rejects.toBeInstanceOf(ReviewForbidden);
    await expect(reviewRequest(admin, admin.id, { status: "denied" })).rejects.toBeInstanceOf(ReviewForbidden);
    await expect(reviewRequest(admin, "no-such-user", { status: "denied" })).rejects.toBeInstanceOf(RequestNotFound);
  });
});
