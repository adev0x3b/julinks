import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { mailEnabled } from "@/lib/mail/config";
import { RESET_MAIL } from "@/lib/mail/outbox";
import { resetMail } from "@/lib/mail/templates";
import { hashPassword } from "@/lib/password";

/**
 * "Forgot password": a link by mail that lets an approved account choose a new password.
 * Only the SHA-256 of the token is stored, the link works once and for half an hour, and
 * the form says the same thing whatever happened, so it cannot be used to find accounts.
 */

export const RESET_LINK_MINUTES = 30;
/** Links one account may ask for in 24 hours. */
export const RESETS_PER_ACCOUNT_PER_DAY = 3;
/** Reset mails the whole site sends in 24 hours: the rest of the mail budget stays for sign-ups and decisions. */
export const RESET_MAILS_PER_DAY = 20;

const DAY = 24 * 60 * 60 * 1000;
/** Serialises reset requests, so two at once cannot both slip under a limit. */
const RESET_LOCK = 4_242_002;
/** 32 random bytes in base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ResetOutcome = "queued" | "mail-off" | "unknown" | "active" | "account-limit" | "site-limit";

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Queues a reset link for the address when the limits allow. The outcome is for logs and
 * tests only: the person at the form sees the same message whatever it is.
 */
export async function requestPasswordReset(email: string, now = new Date()): Promise<ResetOutcome> {
  if (!mailEnabled()) return "mail-off";
  // Pending, denied and demo accounts cannot log in, so a new password would not help them.
  const user = await prisma.user.findFirst({ where: { email, status: "approved", isDemo: false }, select: { id: true, username: true, email: true } });
  if (!user) return "unknown";
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RESET_LOCK})`;
    const since = new Date(now.getTime() - DAY);
    // One link at a time: asking again while the last one still works sends nothing new. Unless its mail
    // never left (dropped, bounced or deleted by an admin): then a new link is the only way in.
    const open = await tx.passwordReset.count({ where: { userId: user.id, usedAt: null, expiresAt: { gt: now } } });
    const onItsWay = await tx.mailOutbox.count({
      where: { kind: RESET_MAIL, recipients: { has: user.email }, status: { in: ["queued", "sending", "sent"] }, createdAt: { gt: new Date(now.getTime() - RESET_LINK_MINUTES * 60 * 1000) } },
    });
    if (open > 0 && onItsWay > 0) return "active";
    // An open link without a mail is useless to its owner; retire it before making the new one.
    await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    if ((await tx.passwordReset.count({ where: { userId: user.id, createdAt: { gte: since } } })) >= RESETS_PER_ACCOUNT_PER_DAY) return "account-limit";
    if ((await tx.mailOutbox.count({ where: { kind: RESET_MAIL, createdAt: { gte: since } } })) >= RESET_MAILS_PER_DAY) return "site-limit";

    const token = randomBytes(32).toString("base64url");
    await tx.passwordReset.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), createdAt: now, expiresAt: new Date(now.getTime() + RESET_LINK_MINUTES * 60 * 1000) },
    });
    const content = resetMail(appUrl(), user.username, token, RESET_LINK_MINUTES);
    await tx.mailOutbox.create({ data: { kind: RESET_MAIL, recipients: [user.email], createdAt: now, notBefore: now, ...content } });
    return "queued";
  });
}

/** The link's row when it can still be used; null for anything else (unknown, used, expired, account no longer approved). */
async function usableReset(token: string, now: Date) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true, user: { select: { username: true, email: true, status: true, isDemo: true } } },
  });
  if (!row || row.usedAt || row.expiresAt <= now || row.user.status !== "approved" || row.user.isDemo) return null;
  return row;
}

/** For the reset page: whose link this is, or null when it cannot be used. */
export async function findResetLink(token: string, now = new Date()): Promise<{ username: string } | null> {
  const row = await usableReset(token, now);
  return row ? { username: row.user.username } : null;
}

export class InvalidResetLink extends Error {
  constructor() {
    super("This link has expired or was already used");
  }
}

/**
 * Sets the new password and uses up the link, along with any other open link of the account.
 * The session version goes up, so every device that was logged in is logged out.
 */
export async function resetPassword(token: string, password: string, now = new Date()): Promise<{ username: string; email: string }> {
  const row = await usableReset(token, now);
  if (!row) throw new InvalidResetLink();
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    // Claimed like a queue row: of two submits of the same link, one wins.
    const claimed = await tx.passwordReset.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimed.count === 0) throw new InvalidResetLink();
    await tx.passwordReset.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } });
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    return { username: row.user.username, email: row.user.email };
  });
}
