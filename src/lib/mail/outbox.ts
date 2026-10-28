import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import type { AccountStatus } from "@/lib/data/users";
import { MailConfigError, mailConfig, mailEnabled, type MailConfig } from "@/lib/mail/config";
import { deliver, type Mail } from "@/lib/mail/send";
import { decisionMail, signupRequestsMail, type DecisionKind } from "@/lib/mail/templates";

/**
 * Every mail JuLinks sends is a row in mail_outbox first. drainOutbox() sends queued rows
 * while the budget allows; the rest wait, through restarts, until it does. The budget is
 * counted from the rows already sent (addresses, not messages, since that is what the
 * provider's quota counts) over the last 24 hours and the last hour, rolling.
 */

const ADMIN_NOTICE = "admin-requests";
const DECISION = "decision";
/** "Forgot password" links: sent ahead of everything else, and dropped if they cannot go out in time. */
export const RESET_MAIL = "password-reset";
/** A reset mail that has waited this long is dropped: the link would arrive about to expire. */
export const RESET_MAIL_MAX_WAIT_MS = 15 * 60 * 1000;
/** Admin notices are at least this far apart: a burst of sign-ups is one notice, then one more. */
export const ADMIN_NOTICE_SPACING_MS = 30 * 60 * 1000;
/** How many requests the admins' notice names; the rest are counted. */
const LATEST_SHOWN = 5;
/** Temporary failures are retried this many times, further apart each time, then given up. */
export const MAX_ATTEMPTS = 8;
/** Any key will do: it only has to be the same for every process that queues admin notices. */
const ADMIN_NOTICE_LOCK = 4_242_001;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type MailLimits = { daily: number; hourly: number };

/** MAIL_DAILY_LIMIT and MAIL_HOURLY_LIMIT, defaulting to a share of a 100-a-day free plan behind a relay that allows 20 an hour. */
export function mailLimits(env: Record<string, string | undefined> = process.env): MailLimits {
  return { daily: positiveInt(env.MAIL_DAILY_LIMIT, 50), hourly: positiveInt(env.MAIL_HOURLY_LIMIT, 10) };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : fallback;
}

/** The mail configuration, or null when mail is off or misconfigured (logged, so it is not silent). */
function activeConfig(): MailConfig | null {
  try {
    return mailConfig();
  } catch (error) {
    if (error instanceof MailConfigError) {
      console.error(`[mail] off, misconfigured: ${error.message}`);
      return null;
    }
    throw error;
  }
}

/**
 * A sign-up request was stored: make sure an admin notice is waiting. One at a time, so a
 * burst of requests shares it, and never sooner than ADMIN_NOTICE_SPACING_MS after the last one.
 */
export async function queueAdminNotice(): Promise<void> {
  if (!activeConfig()) return void console.info("[mail] off (no SMTP_HOST): admin notice not queued");
  await prisma.$transaction(async (tx) => {
    // Serialises concurrent sign-ups, so the check and the insert below cannot interleave.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_NOTICE_LOCK})`;
    const waiting = await tx.mailOutbox.count({ where: { kind: ADMIN_NOTICE, status: "queued" } });
    if (waiting > 0) return;
    const last = await tx.mailOutbox.findFirst({
      where: { kind: ADMIN_NOTICE, status: { in: ["sent", "sending"] } },
      orderBy: { notBefore: "desc" },
      select: { sentAt: true },
    });
    const now = Date.now();
    const lastAt = last ? (last.sentAt?.getTime() ?? now) : null;
    const notBefore = new Date(lastAt === null ? now : Math.max(now, lastAt + ADMIN_NOTICE_SPACING_MS));
    await tx.mailOutbox.create({ data: { kind: ADMIN_NOTICE, notBefore } });
  });
}

/** Which mail, if any, a status change calls for: role changes and repeated decisions send nothing. */
export function decisionKind(previous: AccountStatus, next: AccountStatus): DecisionKind | null {
  if (next === "approved" && previous !== "approved") return "approved";
  if (next === "denied" && previous === "pending") return "denied";
  if (next === "denied" && previous === "approved") return "revoked";
  return null;
}

/** A request was approved or denied, or an account closed: queue the requester's mail. */
export async function queueDecisionMail(account: { username: string; email: string }, previous: AccountStatus, next: AccountStatus): Promise<boolean> {
  const kind = decisionKind(previous, next);
  if (!kind) return false;
  if (!activeConfig()) {
    console.info(`[mail] off (no SMTP_HOST): ${kind} mail for ${account.username} not queued`);
    return false;
  }
  const content = decisionMail(appUrl(), account.username, kind);
  await prisma.mailOutbox.create({ data: { kind: DECISION, recipients: [account.email], ...content } });
  return true;
}

/** Addresses still allowed now: the smaller of what is left of the daily and the hourly budget. */
export async function remainingBudget(now = new Date(), limits = mailLimits()): Promise<number> {
  const sentSince = async (ms: number) =>
    (await prisma.mailOutbox.aggregate({ where: { status: "sent", sentAt: { gte: new Date(now.getTime() - ms) } }, _sum: { recipientCount: true } }))._sum
      .recipientCount ?? 0;
  const [day, hour] = await Promise.all([sentSince(DAY), sentSince(HOUR)]);
  return Math.max(0, Math.min(limits.daily - day, limits.hourly - hour));
}

/** The admin notice is written when it goes out, so it lists what is waiting then. Null when nothing is. */
async function adminNotice(): Promise<Mail | null> {
  const [admins, pending, latest] = await Promise.all([
    prisma.user.findMany({ where: { role: "admin", status: "approved", isDemo: false }, select: { email: true } }),
    prisma.user.count({ where: { status: "pending", isDemo: false } }),
    prisma.user.findMany({
      where: { status: "pending", isDemo: false },
      orderBy: { createdAt: "desc" },
      take: LATEST_SHOWN,
      select: { username: true, email: true },
    }),
  ]);
  if (admins.length === 0 || pending === 0) return null;
  return { to: admins.map((a) => a.email), ...signupRequestsMail(appUrl(), pending, latest) };
}

/** Wait before retry number `attempts`: 2, 4, 8 ... minutes, at most six hours. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** attempts * 60 * 1000, 6 * HOUR);
}

const globalOutbox = globalThis as unknown as { __julinksDraining?: boolean };

/**
 * Sends what is due, oldest first, until the queue is empty, the budget is spent or the
 * server refuses for now. Returns how many messages went out. Safe to call often: a call
 * while another is running returns at once, and each row is claimed before it is sent.
 */
export async function drainOutbox(now: () => Date = () => new Date()): Promise<number> {
  const config = activeConfig();
  if (!config || globalOutbox.__julinksDraining) return 0;
  globalOutbox.__julinksDraining = true;
  let sent = 0;
  try {
    await dropStaleResetMails(now());
    for (;;) {
      const budget = await remainingBudget(now());
      if (budget <= 0) break;
      // Someone is waiting at the reset form, so its mail goes first; then everything else, oldest first.
      const due = { status: "queued" as const, notBefore: { lte: now() } };
      const row =
        (await prisma.mailOutbox.findFirst({ where: { ...due, kind: RESET_MAIL }, orderBy: { createdAt: "asc" } })) ??
        (await prisma.mailOutbox.findFirst({ where: due, orderBy: [{ notBefore: "asc" }, { createdAt: "asc" }] }));
      if (!row) break;
      const claimed = await prisma.mailOutbox.updateMany({ where: { id: row.id, status: "queued" }, data: { status: "sending" } });
      if (claimed.count === 0) continue;
      const outcome = await sendClaimed(config, row, budget, now).catch(async (error) => {
        // A database hiccup mid-send must not leave the row "sending" (no Delete button, never retried) until a restart.
        await prisma.mailOutbox.updateMany({ where: { id: row.id, status: "sending" }, data: { status: "queued", notBefore: new Date(now().getTime() + 60_000) } });
        throw error;
      });
      if (outcome === "sent") sent += 1;
      if (outcome === "stop") break;
    }
  } finally {
    globalOutbox.__julinksDraining = false;
  }
  return sent;
}

type Row = { id: string; kind: string; recipients: string[]; subject: string; text: string; html: string; attempts: number };

/** One claimed row: built, checked against the budget, sent, and its outcome recorded. "stop" ends the round. */
async function sendClaimed(config: MailConfig, row: Row, budget: number, now: () => Date): Promise<"sent" | "next" | "stop"> {
  const mail = row.kind === ADMIN_NOTICE ? await adminNotice() : { to: row.recipients, subject: row.subject, text: row.text, html: row.html };
  if (!mail) {
    // Nothing waiting any more (all reviewed already), or no admin to tell.
    await prisma.mailOutbox.delete({ where: { id: row.id } });
    return "next";
  }
  const limits = mailLimits();
  if (mail.to.length > Math.min(limits.daily, limits.hourly)) {
    // More addresses than an hour's budget: it would wait at the head of the queue forever.
    await prisma.mailOutbox.update({ where: { id: row.id }, data: { status: "failed", lastError: `${mail.to.length} recipients, more than the mail limits allow` } });
    return "next";
  }
  if (mail.to.length > budget) {
    // Fits later, not now: put it back for the next round.
    await prisma.mailOutbox.update({ where: { id: row.id }, data: { status: "queued" } });
    return "stop";
  }

  const result = await deliver(config, mail);
  const attempts = row.attempts + 1;
  // A reset mail's body holds a live link: once it is out (or given up), only the envelope is kept.
  const forget = row.kind === RESET_MAIL ? { text: "", html: "" } : {};
  if (result.ok) {
    await prisma.mailOutbox.update({
      where: { id: row.id },
      data: { status: "sent", sentAt: now(), attempts, recipientCount: mail.to.length, recipients: mail.to, subject: mail.subject, lastError: null, ...forget },
    });
    return "sent";
  }
  const giveUp = result.permanent || attempts >= MAX_ATTEMPTS;
  await prisma.mailOutbox.update({
    where: { id: row.id },
    data: giveUp
      ? { status: "failed", attempts, lastError: result.error, ...forget }
      : { status: "queued", attempts, lastError: result.error, notBefore: new Date(now().getTime() + retryDelayMs(attempts)) },
  });
  console.error(`[mail] "${mail.subject}" ${giveUp ? "failed for good" : "will be retried"}: ${result.error}`);
  // A permanent refusal is about that one message; anything else is the server, so stop for now.
  return result.permanent ? "next" : "stop";
}

/** Reset mails that could not go out in time are marked failed (the admins see them) and their link is wiped. */
export async function dropStaleResetMails(now = new Date()): Promise<number> {
  const { count } = await prisma.mailOutbox.updateMany({
    where: { kind: RESET_MAIL, status: "queued", createdAt: { lt: new Date(now.getTime() - RESET_MAIL_MAX_WAIT_MS) } },
    data: { status: "failed", text: "", html: "", lastError: "Not sent within 15 minutes, so the link would have expired" },
  });
  return count;
}

/** Rows a crash or restart left "sending" go back in the queue: at worst one message goes out twice. */
export async function requeueInterrupted(): Promise<number> {
  return (await prisma.mailOutbox.updateMany({ where: { status: "sending" }, data: { status: "queued" } })).count;
}

/** Sent mail is kept a week (the budget needs a day of it), failed mail a month for the admins; then the addresses go. */
export async function pruneOutbox(now = new Date()): Promise<number> {
  const { count } = await prisma.mailOutbox.deleteMany({
    where: {
      OR: [
        { status: "sent", sentAt: { lt: new Date(now.getTime() - 7 * DAY) } },
        { status: "failed", createdAt: { lt: new Date(now.getTime() - 30 * DAY) } },
      ],
    },
  });
  return count;
}

/**
 * Started once by the server (src/instrumentation.ts): rows a crash left half sent go back
 * in the queue, then the outbox is pruned and drained every minute. Does nothing while mail is off.
 */
export async function startMailLoop(): Promise<void> {
  if (!activeConfig()) return;
  await requeueInterrupted();
  const tick = () =>
    pruneOutbox()
      .then(() => drainOutbox())
      .catch((error) => console.error("[mail] outbox round failed:", error));
  setInterval(tick, 60 * 1000);
  void tick();
}

export type OutboxSummary = {
  enabled: boolean;
  limits: MailLimits;
  queued: number;
  sentToday: number;
  nextAt: Date | null;
  /** The next mails due, oldest first; "sending" ones are on their way and cannot be deleted. */
  waiting: { id: string; kind: string; recipients: string[]; subject: string; status: "queued" | "sending"; notBefore: Date; attempts: number }[];
  failed: { id: string; recipients: string[]; subject: string; lastError: string | null; createdAt: Date }[];
};

/** How many waiting mails the admins' view lists. */
const WAITING_SHOWN = 20;

/** For the admins' view of the outbox: what waits, what went in the last 24 hours, what failed. */
export async function outboxSummary(now = new Date()): Promise<OutboxSummary> {
  const [queued, next, sent, waiting, failed] = await Promise.all([
    prisma.mailOutbox.count({ where: { status: { in: ["queued", "sending"] } } }),
    prisma.mailOutbox.findFirst({ where: { status: "queued" }, orderBy: { notBefore: "asc" }, select: { notBefore: true } }),
    prisma.mailOutbox.aggregate({ where: { status: "sent", sentAt: { gte: new Date(now.getTime() - DAY) } }, _sum: { recipientCount: true } }),
    prisma.mailOutbox.findMany({
      where: { status: { in: ["queued", "sending"] } },
      orderBy: [{ notBefore: "asc" }, { createdAt: "asc" }],
      take: WAITING_SHOWN,
      select: { id: true, kind: true, recipients: true, subject: true, status: true, notBefore: true, attempts: true },
    }),
    prisma.mailOutbox.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, recipients: true, subject: true, lastError: true, createdAt: true },
    }),
  ]);
  return {
    enabled: mailEnabled(),
    limits: mailLimits(),
    queued,
    sentToday: sent._sum.recipientCount ?? 0,
    nextAt: next?.notBefore ?? null,
    waiting: waiting as OutboxSummary["waiting"],
    failed,
  };
}

/**
 * Deletes a mail that has not gone out yet. Only a queued row: one being sent right now is
 * left alone, and the sender claims rows the same way, so the two cannot both win.
 * A deleted admin notice comes back with the next sign-up request.
 */
export async function deleteQueuedMail(id: string): Promise<boolean> {
  return (await prisma.mailOutbox.deleteMany({ where: { id, status: "queued" } })).count > 0;
}

/** Whether a row is the admins' notice, whose recipients and text are filled in when it is sent. */
export function isAdminNotice(kind: string): boolean {
  return kind === ADMIN_NOTICE;
}
