import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { DEFAULT_THEME } from "@/lib/themes";

export type NewUser = { username: string; email: string; password: string; displayName: string };

export class UniqueViolation extends Error {
  constructor(public readonly field: "username" | "email") {
    super(`${field} is already taken`);
  }
}

export async function createUser(input: NewUser) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
    select: { username: true, email: true },
  });
  if (existing) {
    throw new UniqueViolation(existing.username === input.username ? "username" : "email");
  }
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        theme: DEFAULT_THEME,
      },
      select: { id: true, username: true, email: true, displayName: true },
    });
  } catch (error) {
    // Two signups racing for the same name: the unique index wins, map it back to a field error.
    if (isUniqueError(error)) {
      throw new UniqueViolation(String(error.meta?.target).includes("email") ? "email" : "username");
    }
    throw error;
  }
}

function isUniqueError(error: unknown): error is { code: string; meta?: { target?: unknown } } {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** Returns the user when email and password match, otherwise null. Constant work on both paths. */
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Compare against a dummy hash when the email is unknown so timing does not reveal registered emails.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await verifyPassword(password, hash);
  if (!user || !ok) return null;
  return { id: user.id, username: user.username };
}

// bcrypt hash of a random string, cost 12. Only used to burn the same time as a real comparison.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5f3B7y2mHtZx7dL0JYQ.NnRhWvJmJ0e";

export type ProfileUpdate = { displayName: string; bio: string; theme: string };

export async function updateProfile(userId: string, input: ProfileUpdate) {
  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: { id: true, username: true, displayName: true, bio: true, theme: true },
  });
}

/** Everything the public page needs, or null when the username is unknown. */
export async function getPublicProfile(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      displayName: true,
      bio: true,
      theme: true,
      links: {
        where: { enabled: true },
        orderBy: { position: "asc" },
        select: { id: true, title: true, url: true },
      },
    },
  });
}
