import { afterEach, describe, expect, it, vi } from "vitest";
import { MailConfigError, mailConfig, transportOptions } from "@/lib/mail/config";
import { decisionMail, signupRequestsMail } from "@/lib/mail/templates";
import { Throttle } from "@/lib/mail/throttle";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { decisionKind } = await import("@/lib/mail/notices");

const base = { SMTP_HOST: "mail.example.com", MAIL_FROM: "JuLinks <noreply@example.com>" };

describe("mailConfig", () => {
  it("is off without SMTP_HOST", () => {
    expect(mailConfig({})).toBeNull();
    expect(mailConfig({ SMTP_HOST: "  " })).toBeNull();
  });

  it("defaults to port 587 with STARTTLS required", () => {
    const config = mailConfig({ ...base, SMTP_USER: "julinks", SMTP_PASSWORD: "secret" });
    expect(config).toEqual({ host: "mail.example.com", port: 587, tls: "starttls", user: "julinks", password: "secret", from: base.MAIL_FROM });
    expect(transportOptions(config!)).toMatchObject({ secure: false, requireTLS: true, ignoreTLS: false, auth: { user: "julinks", pass: "secret" } });
  });

  it("lets a local catcher run without TLS or a login", () => {
    const config = mailConfig({ ...base, SMTP_PORT: "1025", SMTP_TLS: "none" });
    expect(transportOptions(config!)).toMatchObject({ port: 1025, requireTLS: false, ignoreTLS: true, auth: undefined });
  });

  it("refuses a half-finished configuration", () => {
    expect(() => mailConfig({ SMTP_HOST: "mail.example.com" })).toThrow(MailConfigError);
    expect(() => mailConfig({ ...base, SMTP_PORT: "smtp" })).toThrow(/port/);
    expect(() => mailConfig({ ...base, SMTP_TLS: "ssl" })).toThrow(/SMTP_TLS/);
    expect(() => mailConfig({ ...base, SMTP_USER: "julinks" })).toThrow(/both/);
  });
});

describe("mail templates", () => {
  const app = new URL("https://links.example.com");

  it("names one new request and links to the review page", () => {
    const mail = signupRequestsMail(app, 1, [{ username: "june", email: "june@example.com" }]);
    expect(mail.subject).toBe("JuLinks: a new sign-up request");
    expect(mail.text).toContain("- june <june@example.com>");
    expect(mail.text).toContain("https://links.example.com/dashboard/requests");
    expect(mail.html).toContain("june &lt;june@example.com&gt;");
    expect(mail.html).toContain('href="https://links.example.com/dashboard/requests"');
  });

  it("counts the requests it does not name", () => {
    const latest = ["a", "b", "c", "d", "e"].map((u) => ({ username: u, email: `${u}@example.com` }));
    const mail = signupRequestsMail(app, 8, latest);
    expect(mail.subject).toBe("JuLinks: 8 sign-up requests waiting");
    expect(mail.text).toContain("- and 3 more");
  });

  it("escapes what it puts in HTML", () => {
    const mail = signupRequestsMail(app, 1, [{ username: "x", email: '"><script>@example.com' }]);
    expect(mail.html).not.toContain("<script>");
  });

  it("writes the approval with the login and page links, and the other decisions without links", () => {
    const approved = decisionMail(app, "june", "approved");
    expect(approved.subject).toBe("Your JuLinks page is ready");
    expect(approved.text).toContain("https://links.example.com/login");
    expect(approved.text).toContain("https://links.example.com/june");
    expect(decisionMail(app, "june", "denied").text).toContain("has been declined");
    expect(decisionMail(app, "june", "revoked").text).toContain("account has been closed");
    expect(decisionMail(app, "june", "denied").html).not.toContain("href");
  });
});

describe("decisionKind", () => {
  it("mails a change of decision, not a role change or the same decision again", () => {
    expect(decisionKind("pending", "approved")).toBe("approved");
    expect(decisionKind("denied", "approved")).toBe("approved");
    expect(decisionKind("pending", "denied")).toBe("denied");
    expect(decisionKind("approved", "denied")).toBe("revoked");
    expect(decisionKind("approved", "approved")).toBeNull();
    expect(decisionKind("denied", "denied")).toBeNull();
  });
});

describe("Throttle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends at once, then once more when the cooldown ends however many triggers came meanwhile", async () => {
    vi.useFakeTimers();
    const send = vi.fn(async () => undefined);
    const throttle = new Throttle(send, 30 * 60 * 1000);

    await throttle.trigger();
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60 * 1000);
    await throttle.trigger();
    await throttle.trigger();
    await throttle.trigger();
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(send).toHaveBeenCalledTimes(2);

    // Quiet afterwards: the timer does not fire again on its own.
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(send).toHaveBeenCalledTimes(2);

    // A trigger after a quiet cooldown sends at once again.
    await throttle.trigger();
    expect(send).toHaveBeenCalledTimes(3);
  });
});
