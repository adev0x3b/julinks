import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { authenticate, createUser, getPublicProfile, UniqueViolation, updateProfile } from "@/lib/data/users";
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

  it("rejects a duplicate username or email with the offending field", async () => {
    await makeUser({ username: "ada", email: "ada@example.com" });
    await expect(makeUser({ username: "ada" })).rejects.toMatchObject(new UniqueViolation("username"));
    await expect(makeUser({ email: "ada@example.com" })).rejects.toMatchObject(new UniqueViolation("email"));
  });
});

describe("authenticate", () => {
  it("returns the user for the right password and null otherwise", async () => {
    const user = await makeUser({ email: "ada@example.com" });
    expect(await authenticate("ada@example.com", "correct horse battery staple")).toEqual({ id: user.id, username: user.username });
    expect(await authenticate("ada@example.com", "wrong")).toBeNull();
    expect(await authenticate("nobody@example.com", "correct horse battery staple")).toBeNull();
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

    const profile = await getPublicProfile("ada");
    expect(profile).toEqual({
      username: "ada",
      displayName: "Ada",
      bio: "Hi",
      avatarUrl: null,
      theme: { name: DEFAULT_PRESET.name, tokens: DEFAULT_PRESET.tokens, backgroundUrl: null },
      links: [
        { id: first.id, title: "First", url: "https://a.example", thumbnailUrl: null },
        { id: second.id, title: "Second", url: "https://b.example", thumbnailUrl: null },
      ],
    });
    expect(await getPublicProfile("nobody")).toBeNull();
  });
});

describe("createUser input", () => {
  it("is case-preserving for display name only", async () => {
    const user = await createUser({ username: "mixed", email: "m@example.com", password: "12345678", displayName: "Mixed Case" });
    expect(user.displayName).toBe("Mixed Case");
  });
});
