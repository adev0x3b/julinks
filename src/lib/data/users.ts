import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { PublicProfileData } from "@/components/PublicProfile";
import { imageUrl } from "@/lib/image-url";
import { DEFAULT_PRESET, type ThemeTokens } from "@/lib/themes";
import type { Role } from "@/lib/roles";
import type { SocialPlatformId } from "@/lib/socials";
import type { ImageFocus } from "@/lib/validation";

export type NewUser = { username: string; email: string; password: string; displayName: string };
export type AccountStatus = "pending" | "approved" | "denied";
export type { Role };
export type NewUserOptions = {
  /** Defaults to a pending sign-up request; tests pass "approved". */
  status?: AccountStatus;
  role?: Role;
  /** Seeded demo profiles: never the first account, never listed as requests. */
  isDemo?: boolean;
};

export class UniqueViolation extends Error {
  constructor(public readonly field: "username" | "email") {
    super(`${field} is already taken`);
  }
}

/**
 * Stores a sign-up. Invite only: the account starts as a pending request unless the
 * options say otherwise, with one exception: the very first real account (demo
 * profiles do not count) is approved on the spot and made admin, so there is someone
 * to review the rest.
 */
export async function createUser(input: NewUser, options: NewUserOptions = {}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
    select: { username: true, email: true },
  });
  if (existing) {
    throw new UniqueViolation(existing.username === input.username ? "username" : "email");
  }
  const passwordHash = await hashPassword(input.password);
  // Serializable so two "first" sign-ups cannot both see an empty table; the loser retries and lands as pending.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const first = !options.isDemo && (await tx.user.count({ where: { isDemo: false } })) === 0;
          const status = options.status ?? (first ? "approved" : "pending");
          const role = options.role ?? (first ? "admin" : "client");
          return tx.user.create({
            data: {
              username: input.username,
              email: input.email,
              passwordHash,
              displayName: input.displayName,
              status,
              role,
              isDemo: options.isDemo ?? false,
              reviewedAt: status === "pending" ? null : new Date(),
            },
            select: { id: true, username: true, email: true, displayName: true, status: true, role: true },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      // Two signups racing for the same name: the unique index wins, map it back to a field error.
      if (isUniqueError(error)) {
        throw new UniqueViolation(String(error.meta?.target).includes("email") ? "email" : "username");
      }
      if (isSerializationError(error) && attempt < 3) continue;
      throw error;
    }
  }
}

function isUniqueError(error: unknown): error is { code: string; meta?: { target?: unknown } } {
  return prismaCode(error) === "P2002";
}

function isSerializationError(error: unknown): boolean {
  return prismaCode(error) === "P2034";
}

function prismaCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
}

/**
 * Returns the user when email and password match, otherwise null. Constant work on both paths.
 * The status comes back with the user: only a correct password reveals whether a request is
 * still pending or was denied, so the login form cannot be used to probe for emails.
 */
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Compare against a dummy hash when the email is unknown so timing does not reveal registered emails.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await verifyPassword(password, hash);
  if (!user || !ok) return null;
  return { id: user.id, username: user.username, status: user.status as AccountStatus };
}

// bcrypt hash of a random string, cost 12. Only used to burn the same time as a real comparison.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5f3B7y2mHtZx7dL0JYQ.NnRhWvJmJ0e";

export type ProfileUpdate = { displayName: string; bio: string };

export async function updateProfile(userId: string, input: ProfileUpdate) {
  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: { id: true, username: true, displayName: true, bio: true },
  });
}

/** Sets or clears the avatar (re-centred); returns the previous key so the caller can delete the old object. */
export async function setAvatar(userId: string, avatarKey: string | null): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } });
    await tx.user.update({ where: { id: userId }, data: { avatarKey, avatarFocusX: 50, avatarFocusY: 50 } });
    return current.avatarKey;
  });
}

/** Where the avatar is centred inside its circle. */
export async function setAvatarFocus(userId: string, focus: ImageFocus) {
  await prisma.user.update({ where: { id: userId }, data: { avatarFocusX: focus.x, avatarFocusY: focus.y } });
}

/** Everything the public page needs, or null when the username is unknown or the account is not approved. */
export async function getPublicProfile(username: string): Promise<PublicProfileData | null> {
  const user = await prisma.user.findFirst({
    where: { username, status: "approved" },
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatarKey: true,
      avatarFocusX: true,
      avatarFocusY: true,
      theme: { select: { name: true, tokens: true, backgroundKey: true } },
      socials: { orderBy: { position: "asc" }, select: { platform: true, url: true } },
      folders: { orderBy: { position: "asc" }, select: { id: true, title: true, collapsed: true } },
      links: {
        where: { enabled: true },
        orderBy: { position: "asc" },
        select: { id: true, title: true, url: true, thumbnailKey: true, imageLayout: true, imageFocusX: true, imageFocusY: true, folderId: true },
      },
    },
  });
  if (!user) return null;
  const theme = user.theme
    ? { name: user.theme.name, tokens: user.theme.tokens as ThemeTokens, backgroundUrl: imageUrl(user.theme.backgroundKey) }
    : { name: DEFAULT_PRESET.name, tokens: DEFAULT_PRESET.tokens, backgroundUrl: null };
  return {
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: imageUrl(user.avatarKey),
    avatarFocus: { x: user.avatarFocusX, y: user.avatarFocusY },
    theme,
    socials: user.socials.map((s) => ({ platform: s.platform as SocialPlatformId, url: s.url })),
    folders: user.folders,
    links: user.links.map((l) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      thumbnailUrl: imageUrl(l.thumbnailKey),
      imageLayout: l.imageLayout,
      imageFocus: { x: l.imageFocusX, y: l.imageFocusY },
      folderId: l.folderId,
    })),
  };
}
