import { createHash, randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { createUser, MAX_PENDING_REQUESTS, RequestsFull, UniqueViolation } from "@/lib/data/users";
import { mailEnabled } from "@/lib/mail/config";
import { CONFIRM_MAIL, EXISTS_MAIL } from "@/lib/mail/outbox";
import { accountExistsMail, confirmSignupMail } from "@/lib/mail/templates";
import { hashPassword } from "@/lib/password";

/**
 * Sign-up with mail on: the form always answers "we sent you a link", whatever the address.
 * A new address gets a confirmation link; only using it stores the request the admins review.
 * An address that already has an account gets a mail saying so. So the form tells nobody which
 * addresses are registered, and junk sign-ups with made-up addresses never reach the admins.
 * With mail off, sign-up stores the request straight away (src/actions/auth.ts).
 */

export const CONFIRM_LINK_HOURS = 24;
/** Sign-up mails (confirmations and "already exists") the whole site sends in 24 hours. */
export const SIGNUP_MAILS_PER_DAY = 20;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Serialises sign-ups that send mail, so two at once cannot both slip under a limit. */
const SIGNUP_LOCK = 4_242_003;
/** 32 random bytes in base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type SignupOutcome = "mail-off" | "queued" | "recent" | "exists" | "exists-recent" | "site-limit";
export type SignupInput = { username: string; email: string; password: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function signupMailsToday(db: Pick<typeof prisma, "mailOutbox">, now: Date): Promise<number> {
  return db.mailOutbox.count({ where: { kind: { in: [CONFIRM_MAIL, EXISTS_MAIL] }, createdAt: { gte: new Date(now.getTime() - DAY) } } });
}

/** Usernames are public page addresses, so the form may say when one is taken. */
export async function usernameTaken(username: string): Promise<boolean> {
  return (await prisma.user.count({ where: { username } })) > 0;
}

/**
 * Whether the form should say sign-ups are paused: a site-wide state (review queue full, or the
 * day's sign-up mails spent), the same for every address, so it gives nothing away.
 */
export async function signupsPaused(now = new Date()): Promise<RequestsFull | null> {
  if ((await prisma.user.count({ where: { status: "pending" } })) >= MAX_PENDING_REQUESTS) return new RequestsFull("queue");
  if ((await signupMailsToday(prisma, now)) >= SIGNUP_MAILS_PER_DAY) return new RequestsFull("today");
  return null;
}

/**
 * Queues the mail a sign-up calls for, within the limits: one confirmation per address an
 * hour, one "already exists" per address a day, SIGNUP_MAILS_PER_DAY for the site. Runs after
 * the response (it hashes the password), and its outcome is for logs and tests only.
 */
export async function startSignup(input: SignupInput, now = new Date()): Promise<SignupOutcome> {
  if (!mailEnabled()) return "mail-off";
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SIGNUP_LOCK})`;
    await tx.signupConfirmation.deleteMany({ where: { expiresAt: { lte: now } } });
    const siteFull = async () => (await signupMailsToday(tx, now)) >= SIGNUP_MAILS_PER_DAY;

    const account = await tx.user.findUnique({ where: { email: input.email }, select: { username: true, status: true, isDemo: true } });
    if (account) {
      // Demo addresses are example.com placeholders: nobody to tell.
      if (account.isDemo) return "exists-recent";
      const told = await tx.mailOutbox.count({ where: { kind: EXISTS_MAIL, recipients: { has: input.email }, createdAt: { gte: new Date(now.getTime() - DAY) } } });
      if (told > 0) return "exists-recent";
      if (await siteFull()) return "site-limit";
      const content = accountExistsMail(appUrl(), account.username, account.status);
      await tx.mailOutbox.create({ data: { kind: EXISTS_MAIL, recipients: [input.email], createdAt: now, notBefore: now, ...content } });
      return "exists";
    }

    const last = await tx.signupConfirmation.findUnique({ where: { email: input.email }, select: { createdAt: true } });
    if (last && last.createdAt.getTime() > now.getTime() - HOUR) return "recent";
    if (await siteFull()) return "site-limit";
    // A newer sign-up replaces the older one, and with it the link: only the latest mail works.
    const token = randomBytes(32).toString("base64url");
    const data = { username: input.username, passwordHash, tokenHash: hashToken(token), createdAt: now, expiresAt: new Date(now.getTime() + CONFIRM_LINK_HOURS * HOUR) };
    await tx.signupConfirmation.upsert({ where: { email: input.email }, create: { email: input.email, ...data }, update: data });
    const content = confirmSignupMail(appUrl(), input.username, token, CONFIRM_LINK_HOURS);
    await tx.mailOutbox.create({ data: { kind: CONFIRM_MAIL, recipients: [input.email], createdAt: now, notBefore: now, ...content } });
    return "queued";
  });
}

/** For the confirm page: the sign-up behind a link that still works, or null. */
export async function findSignupConfirmation(token: string, now = new Date()): Promise<{ username: string; usernameTaken: boolean } | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const row = await prisma.signupConfirmation.findUnique({ where: { tokenHash: hashToken(token) }, select: { username: true, expiresAt: true } });
  if (!row || row.expiresAt <= now) return null;
  return { username: row.username, usernameTaken: await usernameTaken(row.username) };
}

export class InvalidConfirmLink extends Error {
  constructor() {
    super("This link has expired or was already used");
  }
}

/**
 * Uses a confirmation link: the sign-up becomes a pending request, with `username` in place of
 * the one it was made with when that was taken in the meantime. Throws UniqueViolation when the
 * name (or, by now, the address) is taken, RequestsFull when the review queue is, and
 * InvalidConfirmLink for anything else. The link is spent only once the request exists.
 */
export async function confirmSignup(token: string, username?: string, now = new Date()) {
  if (!TOKEN_PATTERN.test(token)) throw new InvalidConfirmLink();
  const row = await prisma.signupConfirmation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.expiresAt <= now) throw new InvalidConfirmLink();
  try {
    const user = await createUser({ username: username ?? row.username, email: row.email, passwordHash: row.passwordHash, displayName: username ?? row.username });
    await prisma.signupConfirmation.deleteMany({ where: { id: row.id } });
    return user;
  } catch (error) {
    // The address has an account by now (a double click, or an account made another way): this link is spent.
    if (error instanceof UniqueViolation && (await prisma.user.count({ where: { email: row.email } })) > 0) {
      await prisma.signupConfirmation.deleteMany({ where: { id: row.id } });
      throw new InvalidConfirmLink();
    }
    throw error;
  }
}
