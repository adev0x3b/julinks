import type { AddressInfo } from "node:net";
import { SMTPServer } from "smtp-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { requestPasswordReset } from "@/lib/data/password-reset";
import { startSignup } from "@/lib/data/signup";
import { reviewRequest } from "@/lib/data/requests";
import { mailConfig } from "@/lib/mail/config";
import {
  ADMIN_NOTICE_SPACING_MS,
  RESET_MAIL,
  deleteQueuedMail,
  drainOutbox,
  pruneMailData,
  outboxSummary,
  queueAdminNotice,
  queueDecisionMail,
  remainingBudget,
  requeueInterrupted,
} from "@/lib/mail/outbox";
import { deliver } from "@/lib/mail/send";
import { makeUser } from "./helpers";

/**
 * A real SMTP server on a random port: login required, every accepted message kept for the
 * test to read. Recipients starting with "bounce" are refused for good (550), with "later"
 * for now (451).
 */
type Received = { to: string[]; user: string | undefined; raw: string };
let received: Received[] = [];
let server: SMTPServer;
let port: number;

beforeAll(async () => {
  server = new SMTPServer({
    secure: false,
    disabledCommands: ["STARTTLS"],
    allowInsecureAuth: true,
    authMethods: ["PLAIN", "LOGIN"],
    onAuth(auth, _session, callback) {
      if (auth.username === "julinks" && auth.password === "relay-secret") return callback(null, { user: auth.username });
      callback(new Error("Invalid login"));
    },
    onRcptTo(address, _session, callback) {
      const refuse = (message: string, code: number) => callback(Object.assign(new Error(message), { responseCode: code }));
      if (address.address.startsWith("bounce")) return refuse("No such user", 550);
      if (address.address.startsWith("later")) return refuse("Rate limit, try again later", 451);
      callback();
    },
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        received.push({ to: session.envelope.rcptTo.map((r) => r.address), user: session.user as string | undefined, raw: Buffer.concat(chunks).toString("utf8") });
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_TLS", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "APP_URL", "MAIL_DAILY_LIMIT", "MAIL_HOURLY_LIMIT"];
const env = { ...process.env };
beforeEach(() => {
  received = [];
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(port),
    SMTP_TLS: "none",
    SMTP_USER: "julinks",
    SMTP_PASSWORD: "relay-secret",
    MAIL_FROM: "JuLinks <noreply@example.com>",
    APP_URL: "https://links.example.com",
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  for (const key of KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  vi.restoreAllMocks();
});

const at = (ms: number) => () => new Date(Date.now() + ms);
const config = () => mailConfig()!;

describe("deliver", () => {
  it("logs in and hands over a text and an HTML part", async () => {
    expect(await deliver(config(), { to: ["june@example.com"], subject: "Hello", text: "Plain words", html: "<p>Plain words</p>" })).toEqual({ ok: true });
    expect(received[0]).toMatchObject({ to: ["june@example.com"], user: "julinks" });
    expect(received[0].raw).toMatch(/^Subject: Hello$/m);
    expect(received[0].raw).toContain("multipart/alternative");
  });

  it("tells a permanent refusal from a temporary one, and a refused login is temporary", async () => {
    const mail = { subject: "x", text: "x", html: "x" };
    expect(await deliver(config(), { to: ["bounce@example.com"], ...mail })).toMatchObject({ ok: false, permanent: true });
    expect(await deliver(config(), { to: ["later@example.com"], ...mail })).toMatchObject({ ok: false, permanent: false });
    process.env.SMTP_PASSWORD = "wrong";
    expect(await deliver(config(), { to: ["june@example.com"], ...mail })).toMatchObject({ ok: false, permanent: false });
  });

  it("will not log in over a connection that cannot be upgraded with STARTTLS", async () => {
    delete process.env.SMTP_TLS;
    const result = await deliver(config(), { to: ["june@example.com"], subject: "x", text: "x", html: "x" });
    expect(result).toMatchObject({ ok: false });
    expect(received).toHaveLength(0);
  });
});

describe("admin notices", () => {
  async function admins() {
    await makeUser({ username: "boss", email: "boss@example.com" }, { role: "admin" });
    await makeUser({ username: "boss2", email: "boss2@example.com" }, { role: "admin" });
    await makeUser({ username: "mod", email: "mod@example.com" }, { role: "moderator" });
  }

  it("keeps one notice waiting however many requests arrive, and sends it to every admin", async () => {
    await admins();
    await makeUser({ username: "june", email: "june@example.com" }, { status: "pending" });
    await makeUser({ username: "marie", email: "marie@example.com" }, { status: "pending" });
    await Promise.all([queueAdminNotice(), queueAdminNotice(), queueAdminNotice()]);
    expect(await prisma.mailOutbox.count()).toBe(1);

    expect(await drainOutbox()).toBe(1);
    expect(received[0].to.sort()).toEqual(["boss2@example.com", "boss@example.com"]);
    expect(received[0].raw).toContain("2 sign-up requests waiting");
    expect(received[0].raw).toContain("https://links.example.com/dashboard/requests");
  });

  it("spaces notices half an hour apart, and the late one lists what is waiting when it goes", async () => {
    await admins();
    await makeUser({ username: "june" }, { status: "pending" });
    await queueAdminNotice();
    await drainOutbox();

    await makeUser({ username: "marie" }, { status: "pending" });
    await makeUser({ username: "alan" }, { status: "pending" });
    await queueAdminNotice();
    expect(await drainOutbox()).toBe(0);
    expect(await drainOutbox(at(ADMIN_NOTICE_SPACING_MS + 60_000))).toBe(1);
    expect(received).toHaveLength(2);
    expect(received[1].raw).toContain("3 sign-up requests waiting");
  });

  it("drops a notice when nothing is waiting any more by the time it is due", async () => {
    await admins();
    await queueAdminNotice();
    expect(await drainOutbox()).toBe(0);
    expect(await prisma.mailOutbox.count()).toBe(0);
  });
});

describe("decision mails and the budget", () => {
  it("queues the requester's mail on a decision, nothing on a role change", async () => {
    const admin = await makeUser({ username: "boss" }, { role: "admin" });
    const request = await makeUser({ username: "june", email: "june@example.com" }, { status: "pending" });
    const reviewer = { id: admin.id, role: "admin" as const };

    const approved = await reviewRequest(reviewer, request.id, { status: "approved", role: "client" });
    expect(await queueDecisionMail(approved, approved.previousStatus, approved.status)).toBe(true);
    const promoted = await reviewRequest(reviewer, request.id, { status: "approved", role: "moderator" });
    expect(await queueDecisionMail(promoted, promoted.previousStatus, promoted.status)).toBe(false);

    await drainOutbox();
    expect(received).toHaveLength(1);
    expect(received[0].to).toEqual(["june@example.com"]);
    expect(received[0].raw).toContain("Subject: Your JuLinks page is ready");
  });

  it("queues nothing while mail is off", async () => {
    delete process.env.SMTP_HOST;
    expect(await queueDecisionMail({ username: "june", email: "june@example.com" }, "pending", "denied")).toBe(false);
    await queueAdminNotice();
    expect(await prisma.mailOutbox.count()).toBe(0);
  });

  it("sends within the hourly and daily budget and keeps the rest for later", async () => {
    process.env.MAIL_DAILY_LIMIT = "3";
    process.env.MAIL_HOURLY_LIMIT = "2";
    for (const name of ["a", "b", "c", "d"]) await queueDecisionMail({ username: name, email: `${name}@example.com` }, "pending", "denied");

    expect(await drainOutbox()).toBe(2);
    expect(await remainingBudget()).toBe(0);
    expect(await drainOutbox(at(61 * 60 * 1000))).toBe(1);
    expect(await drainOutbox(at(2 * 60 * 60 * 1000))).toBe(0);
    expect((await outboxSummary()).queued).toBe(1);
    expect(await drainOutbox(at(25 * 60 * 60 * 1000))).toBe(1);
    expect(received.map((r) => r.to[0])).toEqual(["a@example.com", "b@example.com", "c@example.com", "d@example.com"]);
  });

  it("gives up on a refused address at once, and retries a deferred one later", async () => {
    await queueDecisionMail({ username: "gone", email: "bounce@example.com" }, "pending", "denied");
    await queueDecisionMail({ username: "busy", email: "later@example.com" }, "pending", "denied");
    await queueDecisionMail({ username: "june", email: "june@example.com" }, "pending", "denied");

    // The bounce fails for good and the round carries on; the deferral stops it, the relay is busy.
    expect(await drainOutbox()).toBe(0);
    const rows = await prisma.mailOutbox.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.status)).toEqual(["failed", "queued", "queued"]);
    expect(rows[0].lastError).toContain("No such user");
    expect(rows[1]).toMatchObject({ attempts: 1 });
    expect(rows[1].notBefore.getTime()).toBeGreaterThan(Date.now() + 60_000);

    // The next round skips the deferred one until its retry time and sends the rest.
    expect(await drainOutbox()).toBe(1);
    expect(received.map((r) => r.to[0])).toEqual(["june@example.com"]);

    const summary = await outboxSummary();
    expect(summary).toMatchObject({ enabled: true, queued: 1, sentToday: 1 });
    expect(summary.failed.map((f) => f.recipients)).toEqual([["bounce@example.com"]]);
  });

  it("puts rows a restart interrupted back in the queue", async () => {
    await queueDecisionMail({ username: "june", email: "june@example.com" }, "pending", "denied");
    await prisma.mailOutbox.updateMany({ data: { status: "sending" } });
    expect(await requeueInterrupted()).toBe(1);
    expect(await drainOutbox()).toBe(1);
  });
});

describe("deleting waiting mail", () => {
  it("lists what waits and deletes only a mail that has not started going out", async () => {
    await queueDecisionMail({ username: "june", email: "june@example.com" }, "pending", "denied");
    await queueDecisionMail({ username: "kim", email: "kim@example.com" }, "pending", "approved");
    await makeUser({ username: "boss" }, { role: "admin" });
    await makeUser({ username: "newbie" }, { status: "pending" });
    await queueAdminNotice();

    const { waiting } = await outboxSummary();
    expect(waiting.map((m) => m.recipients[0] ?? m.kind)).toEqual(["june@example.com", "kim@example.com", "admin-requests"]);
    const [june, kim, notice] = waiting;

    // One already claimed by the sender stays; a sent one stays in the history.
    await prisma.mailOutbox.update({ where: { id: kim.id }, data: { status: "sending" } });
    expect(await deleteQueuedMail(kim.id)).toBe(false);
    expect(await deleteQueuedMail(june.id)).toBe(true);
    expect(await deleteQueuedMail(june.id)).toBe(false);
    expect(await deleteQueuedMail(notice.id)).toBe(true);

    await requeueInterrupted();
    expect(await drainOutbox()).toBe(1);
    expect(received.map((r) => r.to[0])).toEqual(["kim@example.com"]);
    const sentId = (await prisma.mailOutbox.findFirstOrThrow({ where: { status: "sent" } })).id;
    expect(await deleteQueuedMail(sentId)).toBe(false);
    expect((await outboxSummary()).waiting).toEqual([]);
  });

  it("brings the admins' notice back with the next request", async () => {
    await makeUser({ username: "boss" }, { role: "admin" });
    await makeUser({ username: "newbie" }, { status: "pending" });
    await queueAdminNotice();
    const notice = (await outboxSummary()).waiting[0];
    expect(await deleteQueuedMail(notice.id)).toBe(true);

    await makeUser({ username: "another" }, { status: "pending" });
    await queueAdminNotice();
    expect(await drainOutbox()).toBe(1);
    expect(received[0].raw).toContain("another");
  });
});

describe("reset mails", () => {
  it("go out ahead of older mail, and their link is wiped from the outbox once sent", async () => {
    process.env.MAIL_HOURLY_LIMIT = "1";
    await queueDecisionMail({ username: "kim", email: "kim@example.com" }, "pending", "denied");
    await makeUser({ username: "june", email: "june@example.com" });
    expect(await requestPasswordReset("june@example.com")).toBe("queued");

    expect(await drainOutbox()).toBe(1);
    expect(received.map((r) => r.to[0])).toEqual(["june@example.com"]);
    expect(received[0].raw).toContain("/reset-password/");
    const sent = await prisma.mailOutbox.findFirstOrThrow({ where: { kind: RESET_MAIL } });
    expect(sent).toMatchObject({ status: "sent", text: "", html: "", recipients: ["june@example.com"] });
  });

  it("are dropped, link wiped, when they cannot go out within 15 minutes", async () => {
    process.env.MAIL_DAILY_LIMIT = "1";
    await makeUser({ username: "kim", email: "kim@example.com" });
    await makeUser({ username: "june", email: "june@example.com" });
    await requestPasswordReset("kim@example.com");
    await requestPasswordReset("june@example.com");
    expect(await drainOutbox()).toBe(1);

    expect(await drainOutbox(at(16 * 60 * 1000))).toBe(0);
    const dropped = await prisma.mailOutbox.findFirstOrThrow({ where: { kind: RESET_MAIL, recipients: { has: "june@example.com" } } });
    expect(dropped).toMatchObject({ status: "failed", text: "", html: "" });
    expect(dropped.lastError).toContain("15 minutes");
    expect(received).toHaveLength(1);
  });
});

describe("sign-up mails", () => {
  it("send the confirmation link, then wipe it from the outbox", async () => {
    expect(await startSignup({ username: "june", email: "june@example.com", password: "correct horse battery staple" })).toBe("queued");
    expect(await drainOutbox()).toBe(1);
    expect(received[0].raw).toContain("/signup/confirm/");
    const sent = await prisma.mailOutbox.findFirstOrThrow();
    expect(sent).toMatchObject({ kind: "signup-confirm", status: "sent", text: "", html: "" });
  });
});

describe("keeping the outbox moving", () => {
  it("fails a notice with more admins than the hourly limit instead of blocking the queue behind it", async () => {
    process.env.MAIL_HOURLY_LIMIT = "1";
    await makeUser({ username: "boss", email: "boss@example.com" }, { role: "admin" });
    await makeUser({ username: "boss2", email: "boss2@example.com" }, { role: "admin" });
    await makeUser({ username: "newbie" }, { status: "pending" });
    await queueAdminNotice();
    await queueDecisionMail({ username: "june", email: "june@example.com" }, "pending", "denied");

    expect(await drainOutbox()).toBe(1);
    expect(received.map((r) => r.to[0])).toEqual(["june@example.com"]);
    const notice = await prisma.mailOutbox.findFirstOrThrow({ where: { kind: "admin-requests" } });
    expect(notice.status).toBe("failed");
    expect(notice.lastError).toContain("more than the mail limits allow");
  });

  it("puts a row back in the queue when the database fails mid-send", async () => {
    await queueDecisionMail({ username: "june", email: "june@example.com" }, "pending", "denied");
    vi.spyOn(prisma.mailOutbox, "update").mockRejectedValueOnce(new Error("connection lost"));
    await expect(drainOutbox()).rejects.toThrow("connection lost");
    const row = await prisma.mailOutbox.findFirstOrThrow();
    expect(row.status).toBe("queued");
    // Due again a minute later, and goes out then.
    expect(await drainOutbox(at(61_000))).toBe(1);
  });

  it("prunes sent mail after a week and failed mail after a month", async () => {
    const day = 24 * 60 * 60 * 1000;
    const ago = (days: number) => new Date(Date.now() - days * day);
    await prisma.mailOutbox.createMany({
      data: [
        { kind: "decision", recipients: ["a@example.com"], status: "sent", sentAt: ago(8) },
        { kind: "decision", recipients: ["b@example.com"], status: "sent", sentAt: ago(2) },
        { kind: "decision", recipients: ["c@example.com"], status: "failed", createdAt: ago(31) },
        { kind: "decision", recipients: ["d@example.com"], status: "failed", createdAt: ago(8) },
        { kind: "decision", recipients: ["e@example.com"], status: "queued", createdAt: ago(40) },
      ],
    });
    expect(await pruneMailData()).toBe(2);
    const left = await prisma.mailOutbox.findMany({ orderBy: { recipients: "asc" } });
    expect(left.map((r) => r.recipients[0]).sort()).toEqual(["b@example.com", "d@example.com", "e@example.com"]);
  });
});
