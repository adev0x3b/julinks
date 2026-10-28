import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  authenticate,
  changePassword,
  createUser,
  getPublicProfile,
  MAX_PENDING_REQUESTS,
  MAX_REQUESTS_PER_DAY,
  setAvatar,
  setAvatarFocus,
  UniqueViolation,
  updateProfile,
  WrongPassword,
} from "@/lib/data/users";
import { createLink, updateLink } from "@/lib/data/links";
import { DEFAULT_PRESET } from "@/lib/themes";
import { makeUser } from "./helpers";

describe("createUser", () => {
  it("stores a bcrypt hash, never the password", async () => {
    const user = await makeUser({ username: "ada" });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.passwordHash).not.toContain("correct horse");
  });

  it("stores every sign-up as a pending client, demo or not first", async () => {
    const demo = await createUser({ username: "ada", email: "ada@example.com", password: "12345678", displayName: "Ada" }, { status: "approved", isDemo: true });
    expect(demo.role).toBe("client");
    // No first-account exception: the admin comes from the setup flow, never from the sign-up form.
    const first = await createUser({ username: "first", email: "first@example.com", password: "12345678", displayName: "First" });
    expect(first).toMatchObject({ status: "pending", role: "client" });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: first.id }, select: { reviewedAt: true } });
    expect(row.reviewedAt).toBeNull();
  });

  it("stops taking requests once the queue is full", async () => {
    await makeUser({ username: "admin" }, { role: "admin" });
    // Rows written directly: hashing a hundred passwords is not what this test is about.
    await prisma.user.createMany({
      data: Array.from({ length: MAX_PENDING_REQUESTS }, (_, i) => ({
        username: `pending${i}`,
        email: `pending${i}@example.com`,
        passwordHash: "x",
        displayName: `Pending ${i}`,
        status: "pending" as const,
        // Older than a day, so this is the queue limit and not the daily one.
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      })),
    });
    await expect(createUser({ username: "late", email: "late@example.com", password: "12345678", displayName: "Late" })).rejects.toThrow(
      "until the current requests are reviewed",
    );
    // Approved accounts (tests, seeds) are not requests and still go through.
    await expect(makeUser({ username: "seeded" })).resolves.toMatchObject({ status: "approved" });
  });

  it("takes at most MAX_REQUESTS_PER_DAY new requests in 24 hours, whatever became of them", async () => {
    const day = Date.now() - 60 * 60 * 1000;
    await prisma.user.createMany({
      data: Array.from({ length: MAX_REQUESTS_PER_DAY }, (_, i) => ({
        username: `today${i}`,
        email: `today${i}@example.com`,
        passwordHash: "x",
        displayName: `Today ${i}`,
        // Denied ones count too: denying does not reopen the day's budget.
        status: i % 2 === 0 ? ("pending" as const) : ("denied" as const),
        createdAt: new Date(day),
      })),
    });
    await expect(createUser({ username: "late", email: "late@example.com", password: "12345678", displayName: "Late" })).rejects.toThrow(
      "paused for today",
    );
    await prisma.user.updateMany({ data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
    await expect(createUser({ username: "late", email: "late@example.com", password: "12345678", displayName: "Late" })).resolves.toMatchObject({
      status: "pending",
    });
  });

  it("rejects a duplicate username or email with the offending field", async () => {
    await makeUser({ username: "ada", email: "ada@example.com" });
    await expect(makeUser({ username: "ada" })).rejects.toMatchObject(new UniqueViolation("username"));
    await expect(makeUser({ email: "ada@example.com" })).rejects.toMatchObject(new UniqueViolation("email"));
  });
});

describe("authenticate", () => {
  it("returns the user for the right password and null otherwise", async () => {
    const user = await makeUser({ email: "ada@example.com" });
    expect(await authenticate("ada@example.com", "correct horse battery staple")).toEqual({
      id: user.id,
      username: user.username,
      status: "approved",
      isDemo: false,
      sessionVersion: 0,
    });
    expect(await authenticate("ada@example.com", "wrong")).toBeNull();
    expect(await authenticate("nobody@example.com", "correct horse battery staple")).toBeNull();
  });

  it("reports a pending or denied status only with the right password", async () => {
    await makeUser({ email: "waiting@example.com" }, { status: "pending" });
    await makeUser({ email: "refused@example.com" }, { status: "denied" });
    expect((await authenticate("waiting@example.com", "correct horse battery staple"))?.status).toBe("pending");
    expect((await authenticate("refused@example.com", "correct horse battery staple"))?.status).toBe("denied");
    expect(await authenticate("refused@example.com", "wrong")).toBeNull();
  });
});

describe("changePassword", () => {
  it("needs the current password, stores the new one and bumps the session version", async () => {
    const user = await makeUser({ email: "ada@example.com" });
    await expect(changePassword(user.id, "not it", "a brand new password")).rejects.toBeInstanceOf(WrongPassword);
    expect(await changePassword(user.id, "correct horse battery staple", "a brand new password")).toBe(1);
    expect(await authenticate("ada@example.com", "correct horse battery staple")).toBeNull();
    expect(await authenticate("ada@example.com", "a brand new password")).toMatchObject({ id: user.id, sessionVersion: 1 });
  });
});

describe("getPublicProfile", () => {
  it("returns enabled links in position order and nothing private", async () => {
    const user = await makeUser({ username: "ada" });
    const first = await createLink(user.id, { title: "First", url: "https://a.example" });
    const second = await createLink(user.id, { title: "Second", url: "https://b.example" });
    const hidden = await createLink(user.id, { title: "Hidden", url: "https://c.example" });
    await updateLink(user.id, hidden.id, { enabled: false });
    await updateProfile(user.id, { displayName: "Ada", bio: "Hi" });
    await setAvatar(user.id, "avatars/u/000000000000000000000000.webp");
    await setAvatarFocus(user.id, { x: 10, y: 90 });

    const centred = { imageLayout: "thumbnail", imageFocus: { x: 50, y: 50 } };
    const profile = await getPublicProfile("ada");
    expect(profile).toEqual({
      username: "ada",
      displayName: "Ada",
      bio: "Hi",
      avatarUrl: "/img/avatars/u/000000000000000000000000.webp",
      avatarFocus: { x: 10, y: 90 },
      theme: { name: DEFAULT_PRESET.name, tokens: DEFAULT_PRESET.tokens, backgroundUrl: null },
      socials: [],
      folders: [],
      links: [
        { id: first.id, title: "First", url: "https://a.example", thumbnailUrl: null, folderId: null, ...centred },
        { id: second.id, title: "Second", url: "https://b.example", thumbnailUrl: null, folderId: null, ...centred },
      ],
    });
    expect(await getPublicProfile("nobody")).toBeNull();
    // Requests and denied accounts have no public page.
    await makeUser({ username: "waiting" }, { status: "pending" });
    expect(await getPublicProfile("waiting")).toBeNull();

    // A new avatar starts centred again.
    await setAvatar(user.id, "avatars/u/111111111111111111111111.webp");
    expect((await getPublicProfile("ada"))?.avatarFocus).toEqual({ x: 50, y: 50 });
  });
});

describe("createUser input", () => {
  it("is case-preserving for display name only", async () => {
    const user = await createUser({ username: "mixed", email: "m@example.com", password: "12345678", displayName: "Mixed Case" });
    expect(user.displayName).toBe("Mixed Case");
  });
});
