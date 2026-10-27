import { prisma } from "@/lib/db";
import type { AccountStatus } from "@/lib/data/users";
import { assignableRoles, canManage, canReview, type Role } from "@/lib/roles";

export type AccountRequest = {
  id: string;
  username: string;
  email: string;
  status: AccountStatus;
  role: Role;
  createdAt: Date;
  reviewedAt: Date | null;
};

export type Reviewer = { id: string; role: Role };

const select = { id: true, username: true, email: true, status: true, role: true, createdAt: true, reviewedAt: true } as const;

/** Sign-up requests waiting for a decision, oldest first, and the accounts already decided, newest decision first. Demo profiles are left out. */
export async function listRequests(): Promise<{ pending: AccountRequest[]; decided: AccountRequest[] }> {
  const [pending, decided] = await Promise.all([
    prisma.user.findMany({ where: { status: "pending", isDemo: false }, orderBy: { createdAt: "asc" }, select }),
    prisma.user.findMany({
      where: { status: { not: "pending" }, isDemo: false },
      orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      select,
    }),
  ]);
  return { pending: pending as AccountRequest[], decided: decided as AccountRequest[] };
}

export async function countPendingRequests(): Promise<number> {
  return prisma.user.count({ where: { status: "pending" } });
}

export class RequestNotFound extends Error {}
/** The reviewer may not take this decision (role too low, or their own account). */
export class ReviewForbidden extends Error {}

export type Decision = { status: "approved"; role: Role } | { status: "denied" };

/**
 * Approves a request with a role, or denies it. Works on decided accounts too (a denied
 * request can be approved later, an approved account revoked or given another role).
 * Moderators only handle clients and only make clients; nobody reviews themselves.
 * Returns the account so the caller can drop its cached public page.
 */
export async function reviewRequest(reviewer: Reviewer, userId: string, decision: Decision): Promise<AccountRequest> {
  if (!canReview(reviewer.role) || reviewer.id === userId) throw new ReviewForbidden();
  if (decision.status === "approved" && !assignableRoles(reviewer.role).includes(decision.role)) throw new ReviewForbidden();
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, isDemo: true } });
    if (!target || target.isDemo) throw new RequestNotFound();
    if (!canManage(reviewer.role, target.role as Role)) throw new ReviewForbidden();
    const data =
      decision.status === "approved"
        ? { status: "approved" as const, role: decision.role, reviewedAt: new Date() }
        : { status: "denied" as const, reviewedAt: new Date() };
    const user = await tx.user.update({ where: { id: userId }, data, select });
    return user as AccountRequest;
  });
}
