import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { authenticate, createUser, getPublicProfile, setAvatar, setAvatarFocus, UniqueViolation, updateProfile } from "@/lib/data/users";
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

  it("makes the first real account the approved admin and every later sign-up a pending client", async () => {
    // Seeded demo profiles do not count.
    const demo = await createUser({ username: "ada", email: "ada@example.com", password: "12345678", displayName: "Ada" }, { status: "approved", isDemo: true });
    expect(demo.role).toBe("client");
    const first = await createUser({ username: "first", email: "first@example.com", password: "12345678", displayName: "First" });
    expect(first).toMatchObject({ status: "approved", role: "admin" });
    const second = await createUser({ username: "second", email: "second@example.com", password: "12345678", displayName: "Second" });
    expect(second).toMatchObject({ status: "pending", role: "client" });
    const rows = await prisma.user.findMany({ where: { isDemo: false }, orderBy: { createdAt: "asc" }, select: { reviewedAt: true } });
    expect(rows[0].reviewedAt).toBeInstanceOf(Date);
    expect(rows[1].reviewedAt).toBeNull();
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
    expect(await authenticate("ada@example.com", "correct horse battery staple")).toEqual({ id: user.id, username: user.username, status: "approved" });
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
      links: [
        { id: first.id, title: "First", url: "https://a.example", thumbnailUrl: null, ...centred },
        { id: second.id, title: "Second", url: "https://b.example", thumbnailUrl: null, ...centred },
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
