import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { completeSetup, isSetupPending, issueSetupCode, NoSetupCode, SetupDone, WrongSetupCode } from "@/lib/data/setup";
import { UniqueViolation } from "@/lib/data/users";
import { MAX_SETUP_ATTEMPTS } from "@/lib/setup-code";
import { makeUser } from "./helpers";

const admin = { username: "owner", email: "owner@example.com", password: "correct horse battery staple", displayName: "owner" };

describe("first-run setup", () => {
  it("is pending until an approved, non-demo admin exists", async () => {
    expect(await isSetupPending()).toBe(true);
    await makeUser({ username: "ada" }, { isDemo: true, role: "admin" });
    await makeUser({ username: "client" });
    await makeUser({ username: "waiting" }, { status: "pending", role: "admin" });
    expect(await isSetupPending()).toBe(true);
    await makeUser({ username: "boss" }, { role: "admin" });
    expect(await isSetupPending()).toBe(false);
  });

  it("issues a code whose hash is stored, replaces it on the next call, and issues none once set up", async () => {
    const first = await issueSetupCode();
    expect(first).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const rows = await prisma.setupCode.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toContain(first);
    const second = await issueSetupCode();
    expect(second).not.toBe(first);
    expect(await prisma.setupCode.count()).toBe(1);
    // The old code is gone with its row.
    await expect(completeSetup(first!, admin)).rejects.toBeInstanceOf(WrongSetupCode);

    await makeUser({ username: "boss" }, { role: "admin" });
    expect(await issueSetupCode()).toBeNull();
    expect(await prisma.setupCode.count()).toBe(0);
  });

  it("creates the approved admin with the right code, logged in straight away, and closes setup", async () => {
    const code = (await issueSetupCode())!;
    const user = await completeSetup(code.toLowerCase().replace(/-/g, " "), admin);
    expect(user).toMatchObject({ username: "owner", status: "approved", role: "admin" });
    expect(await isSetupPending()).toBe(false);
    expect(await prisma.setupCode.count()).toBe(0);
    await expect(completeSetup(code, { ...admin, username: "again", email: "again@example.com" })).rejects.toBeInstanceOf(SetupDone);
  });

  it("refuses without a code, counts wrong guesses and burns the code after the last one", async () => {
    await expect(completeSetup("ABCD-EFGH-JKLM", admin)).rejects.toBeInstanceOf(NoSetupCode);
    const code = (await issueSetupCode())!;
    for (let i = 1; i <= MAX_SETUP_ATTEMPTS; i += 1) {
      const error = await completeSetup("ABCD-EFGH-JKLM", admin).catch((e) => e);
      expect(error).toBeInstanceOf(WrongSetupCode);
      expect((error as WrongSetupCode).attemptsLeft).toBe(MAX_SETUP_ATTEMPTS - i);
    }
    // Even the right code is dead now; a new one works.
    await expect(completeSetup(code, admin)).rejects.toBeInstanceOf(NoSetupCode);
    expect(await isSetupPending()).toBe(true);
    const fresh = (await issueSetupCode())!;
    await expect(completeSetup(fresh, admin)).resolves.toMatchObject({ role: "admin" });
  });

  it("does not spend the code on a username or email that is taken", async () => {
    await makeUser({ username: "owner", email: "someone@example.com" });
    const code = (await issueSetupCode())!;
    await expect(completeSetup(code, admin)).rejects.toMatchObject(new UniqueViolation("username"));
    await expect(completeSetup(code, { ...admin, username: "owner2", email: "someone@example.com" })).rejects.toMatchObject(new UniqueViolation("email"));
    await expect(completeSetup(code, { ...admin, username: "owner2" })).resolves.toMatchObject({ role: "admin" });
  });
});
