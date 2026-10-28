import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import type { AccountStatus } from "@/lib/data/users";
import { sendMail } from "@/lib/mail/send";
import { decisionMail, signupRequestsMail, type DecisionKind } from "@/lib/mail/templates";
import { Throttle } from "@/lib/mail/throttle";
import { RateLimiter } from "@/lib/rate-limit";

/**
 * The two mails sign-up review sends, both best effort (see sendMail):
 * - the admins hear about new requests, at most one message per half hour;
 * - a requester hears about the decision on their request.
 * Both run after the response, so the person clicking never waits for the relay.
 */

const ADMIN_NOTICE_COOLDOWN_MS = 30 * 60 * 1000;
/** How many requests the admins' notice names; the rest are counted. */
const LATEST_SHOWN = 5;
/**
 * Decision mails per hour across the app. The mail relay allows a few dozen messages an hour;
 * an admin clearing a page of junk requests must not spend all of it. Past the limit the
 * requester finds out at login, as they always could.
 */
const decisionLimiter = new RateLimiter(10, 60 * 60 * 1000);

/** Emails every approved admin with the requests waiting. Exported for tests; the app calls notifyAdminsOfRequest. */
export async function sendAdminDigest(): Promise<boolean> {
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
  if (admins.length === 0 || pending === 0) return false;
  return sendMail({ to: admins.map((a) => a.email), ...signupRequestsMail(appUrl(), pending, latest) });
}

const globalNotices = globalThis as unknown as { __julinksAdminNotice?: Throttle };
const adminNotice = (globalNotices.__julinksAdminNotice ??= new Throttle(sendAdminDigest, ADMIN_NOTICE_COOLDOWN_MS));

/** A sign-up request was stored. */
export function notifyAdminsOfRequest(): Promise<void> {
  return adminNotice.trigger();
}

/** Which mail, if any, a status change calls for: role changes and repeated decisions send nothing. */
export function decisionKind(previous: AccountStatus, next: AccountStatus): DecisionKind | null {
  if (next === "approved" && previous !== "approved") return "approved";
  if (next === "denied" && previous === "pending") return "denied";
  if (next === "denied" && previous === "approved") return "revoked";
  return null;
}

/** A request was approved or denied, or an account revoked. */
export async function notifyDecision(account: { username: string; email: string }, previous: AccountStatus, next: AccountStatus): Promise<boolean> {
  const kind = decisionKind(previous, next);
  if (!kind) return false;
  if (!decisionLimiter.check("all").ok) {
    console.warn(`[mail] decision mail for ${account.username} skipped: hourly limit reached`);
    return false;
  }
  return sendMail({ to: [account.email], ...decisionMail(appUrl(), account.username, kind) });
}
