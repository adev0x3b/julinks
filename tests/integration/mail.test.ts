import type { AddressInfo } from "node:net";
import { SMTPServer } from "smtp-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { reviewRequest } from "@/lib/data/requests";
import { notifyDecision, sendAdminDigest } from "@/lib/mail/notices";
import { sendMail } from "@/lib/mail/send";
import { makeUser } from "./helpers";

/** A real SMTP server on a random port: login required, every accepted message kept for the test to read. */
type Received = { from: string; to: string[]; user: string | undefined; raw: string };
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
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((r) => r.address),
          user: session.user as string | undefined,
          raw: Buffer.concat(chunks).toString("utf8"),
        });
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
});
afterEach(() => {
  for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_TLS", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "APP_URL"]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  vi.restoreAllMocks();
});

describe("sendMail", () => {
  it("logs in and delivers a text and an HTML part", async () => {
    expect(await sendMail({ to: ["june@example.com"], subject: "Hello", text: "Plain words", html: "<p>Plain words</p>" })).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ from: "noreply@example.com", to: ["june@example.com"], user: "julinks" });
    expect(received[0].raw).toMatch(/^Subject: Hello$/m);
    expect(received[0].raw).toContain("multipart/alternative");
    expect(received[0].raw).toContain("text/plain");
    expect(received[0].raw).toContain("text/html");
  });

  it("reports a refused login without throwing", async () => {
    process.env.SMTP_PASSWORD = "wrong";
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sendMail({ to: ["june@example.com"], subject: "Hello", text: "x", html: "x" })).toBe(false);
    expect(received).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[mail] not sent"));
  });

  it("refuses to log in over a connection that cannot be upgraded with STARTTLS", async () => {
    delete process.env.SMTP_TLS;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sendMail({ to: ["june@example.com"], subject: "Hello", text: "x", html: "x" })).toBe(false);
    expect(received).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("STARTTLS"));
  });

  it("sends nothing and logs when mail is off", async () => {
    delete process.env.SMTP_HOST;
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(await sendMail({ to: ["june@example.com"], subject: "Hello", text: "x", html: "x" })).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[mail] off"));
  });
});

describe("sign-up notices", () => {
  it("mails every approved admin, not moderators, with the requests waiting", async () => {
    await makeUser({ username: "boss", email: "boss@example.com" }, { role: "admin" });
    await makeUser({ username: "boss2", email: "boss2@example.com" }, { role: "admin" });
    await makeUser({ username: "mod", email: "mod@example.com" }, { role: "moderator" });
    await makeUser({ username: "gone", email: "gone@example.com" }, { role: "admin", status: "denied" });
    await makeUser({ username: "june", email: "june@example.com" }, { status: "pending" });
    await makeUser({ username: "marie", email: "marie@example.com" }, { status: "pending" });

    expect(await sendAdminDigest()).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].to.sort()).toEqual(["boss2@example.com", "boss@example.com"]);
    expect(received[0].raw).toContain("2 sign-up requests waiting");
    expect(received[0].raw).toContain("june <june@example.com>");
    expect(received[0].raw).toContain("https://links.example.com/dashboard/requests");
  });

  it("sends no admin notice when nothing is waiting", async () => {
    await makeUser({ username: "boss" }, { role: "admin" });
    expect(await sendAdminDigest()).toBe(false);
    expect(received).toHaveLength(0);
  });

  it("tells the requester about the decision, and nothing about a role change", async () => {
    const admin = await makeUser({ username: "boss" }, { role: "admin" });
    const request = await makeUser({ username: "june", email: "june@example.com" }, { status: "pending" });
    const reviewer = { id: admin.id, role: "admin" as const };

    const approved = await reviewRequest(reviewer, request.id, { status: "approved", role: "client" });
    expect(await notifyDecision(approved, approved.previousStatus, approved.status)).toBe(true);
    expect(received[0].to).toEqual(["june@example.com"]);
    expect(received[0].raw).toContain("Subject: Your JuLinks page is ready");

    const promoted = await reviewRequest(reviewer, request.id, { status: "approved", role: "moderator" });
    expect(await notifyDecision(promoted, promoted.previousStatus, promoted.status)).toBe(false);

    const revoked = await reviewRequest(reviewer, request.id, { status: "denied" });
    expect(await notifyDecision(revoked, revoked.previousStatus, revoked.status)).toBe(true);
    expect(received).toHaveLength(2);
    expect(received[1].raw).toContain("account has been closed");
  });
});
