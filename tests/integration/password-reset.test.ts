import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  findResetLink,
  InvalidResetLink,
  requestPasswordReset,
  resetPassword,
  RESET_MAILS_PER_DAY,
  RESETS_PER_ACCOUNT_PER_DAY,
} from "@/lib/data/password-reset";
import { authenticate, changePassword } from "@/lib/data/users";
import { RESET_MAIL } from "@/lib/mail/outbox";
import { makeUser } from "./helpers";

// Queuing only: nothing here sends, so the relay address is never dialled.
const KEYS = ["SMTP_HOST", "SMTP_TLS", "MAIL_FROM", "APP_URL"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
beforeEach(() => {
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_TLS: "none", MAIL_FROM: "JuLinks <noreply@example.com>", APP_URL: "https://links.example.com" });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

const MINUTE = 60 * 1000;
const later = (ms: number) => new Date(Date.now() + ms);

/** The token in the newest reset mail queued for the address. */
async function tokenFor(email: string): Promise<string> {
  const mail = await prisma.mailOutbox.findFirstOrThrow({ where: { kind: RESET_MAIL, recipients: { has: email } }, orderBy: { createdAt: "desc" } });
  return /\/reset-password\/([A-Za-z0-9_-]+)/.exec(mail.text)![1];
}

describe("asking for a reset link", () => {
  it("queues a mail with a one-use link and keeps only the token's hash", async () => {
    const user = await makeUser({ username: "june", email: "june@example.com" });
    expect(await requestPasswordReset("june@example.com")).toBe("queued");

    const mail = await prisma.mailOutbox.findFirstOrThrow({ where: { kind: RESET_MAIL } });
    expect(mail.recipients).toEqual(["june@example.com"]);
    expect(mail.subject).toBe("Reset your JuLinks password");
    expect(mail.text).toContain("https://links.example.com/reset-password/");
    const token = await tokenFor("june@example.com");
    const row = await prisma.passwordReset.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.tokenHash).not.toContain(token);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(30 * MINUTE);
    expect(await findResetLink(token)).toEqual({ username: "june" });
  });

  it("sends nothing to unknown addresses, requests, denied, demo accounts, or while mail is off", async () => {
    await makeUser({ email: "wait@example.com" }, { status: "pending" });
    await makeUser({ email: "no@example.com" }, { status: "denied" });
    await makeUser({ email: "demo@example.com" }, { isDemo: true });
    for (const email of ["nobody@example.com", "wait@example.com", "no@example.com", "demo@example.com"]) {
      expect(await requestPasswordReset(email)).toBe("unknown");
    }
    await makeUser({ email: "june@example.com" });
    delete process.env.SMTP_HOST;
    expect(await requestPasswordReset("june@example.com")).toBe("mail-off");
    expect(await prisma.mailOutbox.count()).toBe(0);
    expect(await prisma.passwordReset.count()).toBe(0);
  });

  it("sends no second link while the first still works, and at most three a day", async () => {
    await makeUser({ email: "june@example.com" });
    expect(await requestPasswordReset("june@example.com")).toBe("queued");
    expect(await requestPasswordReset("june@example.com", later(10 * MINUTE))).toBe("active");
    expect(await requestPasswordReset("june@example.com", later(31 * MINUTE))).toBe("queued");
    expect(await requestPasswordReset("june@example.com", later(62 * MINUTE))).toBe("queued");
    expect(RESETS_PER_ACCOUNT_PER_DAY).toBe(3);
    expect(await requestPasswordReset("june@example.com", later(93 * MINUTE))).toBe("account-limit");
    expect(await requestPasswordReset("june@example.com", later(25 * 60 * MINUTE))).toBe("queued");
  });

  it("makes a new link when the last one's mail never went out", async () => {
    const user = await makeUser({ email: "june@example.com" });
    expect(await requestPasswordReset("june@example.com")).toBe("queued");
    const first = await tokenFor("june@example.com");
    // Dropped for want of budget, bounced, or deleted by an admin: the owner never got the link.
    await prisma.mailOutbox.updateMany({ where: { kind: RESET_MAIL }, data: { status: "failed" } });
    expect(await requestPasswordReset("june@example.com", later(MINUTE))).toBe("queued");
    expect(await findResetLink(first)).toBeNull();
    expect(await prisma.passwordReset.count({ where: { userId: user.id, usedAt: null } })).toBe(1);

    await prisma.mailOutbox.deleteMany();
    expect(await requestPasswordReset("june@example.com", later(2 * MINUTE))).toBe("queued");
    expect(await requestPasswordReset("june@example.com", later(3 * MINUTE))).toBe("active");
    // Three links today, two of them never delivered: still three.
    expect(await requestPasswordReset("june@example.com", later(40 * MINUTE))).toBe("account-limit");
  });

  it("stops at the site-wide daily cap, whoever asks", async () => {
    // Straight into the table: hashing 21 real passwords would only slow the test down.
    const names = [...Array.from({ length: RESET_MAILS_PER_DAY }, (_, i) => `u${i}`), "late"];
    await prisma.user.createMany({
      data: names.map((name) => ({ username: name, email: `${name}@example.com`, passwordHash: "x", displayName: name, status: "approved" as const })),
    });
    for (const name of names.slice(0, -1)) expect(await requestPasswordReset(`${name}@example.com`)).toBe("queued");
    expect(await requestPasswordReset("late@example.com")).toBe("site-limit");
    expect(await prisma.mailOutbox.count({ where: { kind: RESET_MAIL } })).toBe(RESET_MAILS_PER_DAY);
  });
});

describe("using a reset link", () => {
  it("sets the new password, logs every device out and uses the link up", async () => {
    const user = await makeUser({ email: "june@example.com" });
    await requestPasswordReset("june@example.com");
    const token = await tokenFor("june@example.com");

    expect(await resetPassword(token, "a brand new passphrase")).toEqual({ username: user.username, email: "june@example.com" });
    expect(await authenticate("june@example.com", "correct horse battery staple")).toBeNull();
    const after = await authenticate("june@example.com", "a brand new passphrase");
    expect(after?.sessionVersion).toBe(1);

    await expect(resetPassword(token, "yet another passphrase")).rejects.toBeInstanceOf(InvalidResetLink);
    expect(await findResetLink(token)).toBeNull();
  });

  it("refuses expired, made-up and malformed links, and links of accounts closed since", async () => {
    const user = await makeUser({ email: "june@example.com" });
    await requestPasswordReset("june@example.com");
    const token = await tokenFor("june@example.com");

    await expect(resetPassword(token, "a brand new passphrase", later(31 * MINUTE))).rejects.toBeInstanceOf(InvalidResetLink);
    await expect(resetPassword("A".repeat(43), "a brand new passphrase")).rejects.toBeInstanceOf(InvalidResetLink);
    await expect(resetPassword("../../etc", "a brand new passphrase")).rejects.toBeInstanceOf(InvalidResetLink);
    await prisma.user.update({ where: { id: user.id }, data: { status: "denied" } });
    expect(await findResetLink(token)).toBeNull();
    await expect(resetPassword(token, "a brand new passphrase")).rejects.toBeInstanceOf(InvalidResetLink);
  });

  it("lets only one of two submits of the same link through", async () => {
    await makeUser({ email: "june@example.com" });
    await requestPasswordReset("june@example.com");
    const token = await tokenFor("june@example.com");
    const results = await Promise.allSettled([resetPassword(token, "first new passphrase"), resetPassword(token, "second new passphrase")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("is used up by a password change from the account page", async () => {
    const user = await makeUser({ email: "june@example.com" });
    await requestPasswordReset("june@example.com");
    const token = await tokenFor("june@example.com");
    await changePassword(user.id, "correct horse battery staple", "changed the usual way");
    expect(await findResetLink(token)).toBeNull();
  });
});
