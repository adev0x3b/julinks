import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  confirmSignup,
  findSignupConfirmation,
  InvalidConfirmLink,
  SIGNUP_MAILS_PER_DAY,
  signupsPaused,
  startSignup,
} from "@/lib/data/signup";
import { authenticate, UniqueViolation } from "@/lib/data/users";
import { CONFIRM_MAIL, EXISTS_MAIL, pruneMailData } from "@/lib/mail/outbox";
import { makeUser } from "./helpers";

// Queuing only: nothing here sends, so the relay address is never dialled.
const KEYS = ["SMTP_HOST", "SMTP_TLS", "MAIL_FROM", "APP_URL"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
beforeEach(() => {
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_TLS: "none", MAIL_FROM: "JuLinks <noreply@example.com>", APP_URL: "https://links.example.com" });
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const later = (ms: number) => new Date(Date.now() + ms);
const june = { username: "june", email: "june@example.com", password: "correct horse battery staple" };

/** The token in the newest confirmation mail queued for the address. */
async function tokenFor(email: string): Promise<string> {
  const mail = await prisma.mailOutbox.findFirstOrThrow({ where: { kind: CONFIRM_MAIL, recipients: { has: email } }, orderBy: { createdAt: "desc" } });
  return /\/signup\/confirm\/([A-Za-z0-9_-]+)/.exec(mail.text)![1];
}

describe("signing up with mail on", () => {
  it("stores nothing the admins see until the link is used, then a pending request with the password typed", async () => {
    expect(await startSignup(june)).toBe("queued");
    expect(await prisma.user.count()).toBe(0);
    const mail = await prisma.mailOutbox.findFirstOrThrow({ where: { kind: CONFIRM_MAIL } });
    expect(mail.recipients).toEqual(["june@example.com"]);
    expect(mail.subject).toBe("Confirm your email for JuLinks");
    expect(mail.text).toContain("/june");

    const token = await tokenFor("june@example.com");
    expect(await findSignupConfirmation(token)).toEqual({ username: "june", usernameTaken: false });
    const user = await confirmSignup(token);
    expect(user).toMatchObject({ username: "june", email: "june@example.com", status: "pending", role: "client" });
    expect((await authenticate("june@example.com", june.password))?.status).toBe("pending");

    // Spent: the row is gone, a second use fails.
    expect(await findSignupConfirmation(token)).toBeNull();
    await expect(confirmSignup(token)).rejects.toBeInstanceOf(InvalidConfirmLink);
  });

  it("mails the owner of an address that has an account, never more than once a day", async () => {
    await makeUser({ username: "kim", email: "kim@example.com" });
    await makeUser({ username: "wait", email: "wait@example.com" }, { status: "pending" });
    await makeUser({ username: "nope", email: "nope@example.com" }, { status: "denied" });

    expect(await startSignup({ ...june, email: "kim@example.com" })).toBe("exists");
    expect(await startSignup({ ...june, email: "kim@example.com" }, later(HOUR))).toBe("exists-recent");
    expect(await startSignup({ ...june, email: "wait@example.com" })).toBe("exists");
    expect(await startSignup({ ...june, email: "nope@example.com" })).toBe("exists");

    const mails = await prisma.mailOutbox.findMany({ where: { kind: EXISTS_MAIL }, orderBy: { createdAt: "asc" } });
    expect(mails.map((m) => m.recipients[0])).toEqual(["kim@example.com", "wait@example.com", "nope@example.com"]);
    expect(mails[0].text).toContain("already belongs to /kim");
    expect(mails[0].text).toContain("/forgot-password");
    expect(mails[1].text).toContain("still waiting for an admin");
    expect(mails[2].text).toContain("was declined");
    expect(await prisma.signupConfirmation.count()).toBe(0);
    expect(await startSignup({ ...june, email: "kim@example.com" }, later(25 * HOUR))).toBe("exists");
  });

  it("sends one confirmation an hour per address, and a newer sign-up replaces the older link", async () => {
    expect(await startSignup(june)).toBe("queued");
    const first = await tokenFor("june@example.com");
    expect(await startSignup({ ...june, username: "june2" }, later(30 * MINUTE))).toBe("recent");
    expect(await startSignup({ ...june, username: "june2" }, later(61 * MINUTE))).toBe("queued");
    const second = await tokenFor("june@example.com");
    expect(await findSignupConfirmation(first)).toBeNull();
    expect(await findSignupConfirmation(second)).toMatchObject({ username: "june2" });
  });

  it("stops at the site-wide daily cap, and the form says sign-ups are paused", async () => {
    for (let i = 0; i < SIGNUP_MAILS_PER_DAY; i += 1) {
      expect(await startSignup({ ...june, username: `u${i}`, email: `u${i}@example.com` })).toBe("queued");
    }
    expect(await startSignup({ ...june, email: "late@example.com" })).toBe("site-limit");
    expect((await signupsPaused())?.message).toContain("paused for today");
    // Each sign-up hashes its password: 21 of them take a few seconds.
  }, 30_000);

  it("asks for another name when the one signed up with was taken meanwhile", async () => {
    await startSignup(june);
    const token = await tokenFor("june@example.com");
    await makeUser({ username: "june", email: "other@example.com" });
    expect(await findSignupConfirmation(token)).toEqual({ username: "june", usernameTaken: true });
    await expect(confirmSignup(token)).rejects.toBeInstanceOf(UniqueViolation);
    // The link is not spent by a refused name.
    expect(await confirmSignup(token, "june-b")).toMatchObject({ username: "june-b", displayName: "june-b" });
  });

  it("spends the link when the address got an account in the meantime", async () => {
    await startSignup(june);
    const token = await tokenFor("june@example.com");
    await makeUser({ username: "elsewhere", email: "june@example.com" });
    await expect(confirmSignup(token)).rejects.toBeInstanceOf(InvalidConfirmLink);
    expect(await prisma.signupConfirmation.count()).toBe(0);
  });

  it("lets only one of two clicks through", async () => {
    await startSignup(june);
    const token = await tokenFor("june@example.com");
    const results = await Promise.allSettled([confirmSignup(token), confirmSignup(token)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it("refuses expired and made-up links, and prunes unconfirmed sign-ups once expired", async () => {
    await startSignup(june);
    const token = await tokenFor("june@example.com");
    await expect(confirmSignup(token, undefined, later(25 * HOUR))).rejects.toBeInstanceOf(InvalidConfirmLink);
    await expect(confirmSignup("A".repeat(43))).rejects.toBeInstanceOf(InvalidConfirmLink);
    await expect(confirmSignup("not a token")).rejects.toBeInstanceOf(InvalidConfirmLink);
    await pruneMailData(later(25 * HOUR));
    expect(await prisma.signupConfirmation.count()).toBe(0);
  });

  it("does nothing while mail is off (the form stores the request directly then)", async () => {
    delete process.env.SMTP_HOST;
    expect(await startSignup(june)).toBe("mail-off");
    expect(await prisma.signupConfirmation.count()).toBe(0);
  });
});
