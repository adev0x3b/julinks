import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

/** Denied requests and closed accounts are deleted this many days after the decision; the privacy page says so. */
export const CLOSED_ACCOUNT_RETENTION_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/** The only approved admin cannot delete their account: the site would be left with nobody to run it. */
export class LastAdmin extends Error {
  constructor() {
    super("You are the only admin. Make someone else an admin first, then delete your account.");
  }
}

export class DemoAccount extends Error {
  constructor() {
    super("Demo accounts cannot be deleted");
  }
}

export type DeletedAccount = { username: string; hadPublicTheme: boolean };

/**
 * Deletes an account with everything it owns: links, folders, socials, themes, clicks and reset
 * links go with the row (cascades), then its pictures are removed from storage. A picture that
 * fails to delete is logged and left behind: the row is what makes it reachable, and it is gone.
 */
export async function deleteAccount(userId: string): Promise<DeletedAccount> {
  const { user, keys } = await prisma.$transaction(async (tx) => {
    // Serialises with other admin deletions, so two admins cannot both remove themselves at once.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242002)`;
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        username: true,
        role: true,
        status: true,
        isDemo: true,
        avatarKey: true,
        links: { select: { thumbnailKey: true } },
        themes: { select: { backgroundKey: true, isPublic: true } },
      },
    });
    if (user.isDemo) throw new DemoAccount();
    if (user.role === "admin" && user.status === "approved") {
      const admins = await tx.user.count({ where: { role: "admin", status: "approved", isDemo: false } });
      if (admins <= 1) throw new LastAdmin();
    }
    await tx.user.delete({ where: { id: userId } });
    const keys = [user.avatarKey, ...user.links.map((l) => l.thumbnailKey), ...user.themes.map((t) => t.backgroundKey)];
    return { user, keys: [...new Set(keys.filter((key): key is string => Boolean(key)))] };
  });
  await Promise.all(keys.map((key) => deleteObject(key).catch((error) => console.warn("could not delete", key, error))));
  return { username: user.username, hadPublicTheme: user.themes.some((t) => t.isPublic) };
}

/** Denied requests and closed (revoked) accounts whose decision is older than the retention period. */
export async function pruneClosedAccounts(now = new Date()): Promise<DeletedAccount[]> {
  const closed = await prisma.user.findMany({
    where: { status: "denied", isDemo: false, reviewedAt: { lt: new Date(now.getTime() - CLOSED_ACCOUNT_RETENTION_DAYS * DAY) } },
    select: { id: true },
  });
  const deleted: DeletedAccount[] = [];
  for (const { id } of closed) {
    // One account that cannot go (re-approved meanwhile, a database hiccup) must not hold up the rest.
    try {
      deleted.push(await deleteAccount(id));
    } catch (error) {
      console.error("[maintenance] could not delete closed account", id, error);
    }
  }
  return deleted;
}

/**
 * Everything an account holds, for the "Download my data" button: what the owner typed and
 * uploaded (pictures as links), plus click totals. Visitors' clicks are counted, not listed.
 */
export async function exportAccount(userId: string, imageUrl: (key: string) => string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      username: true,
      email: true,
      displayName: true,
      bio: true,
      role: true,
      createdAt: true,
      avatarKey: true,
      folders: { orderBy: { position: "asc" }, select: { id: true, title: true, collapsed: true } },
      socials: { orderBy: { position: "asc" }, select: { platform: true, value: true, url: true } },
      links: {
        orderBy: { position: "asc" },
        select: { title: true, url: true, enabled: true, folderId: true, thumbnailKey: true, imageLayout: true, createdAt: true, _count: { select: { clicks: true } } },
      },
      themes: { orderBy: { createdAt: "asc" }, select: { name: true, tokens: true, backgroundKey: true, isPublic: true, createdAt: true } },
      theme: { select: { name: true } },
    },
  });
  const folderTitle = new Map(user.folders.map((f) => [f.id, f.title]));
  const picture = (key: string | null) => (key ? imageUrl(key) : null);
  return {
    exportedAt: new Date().toISOString(),
    account: {
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      avatar: picture(user.avatarKey),
      activeTheme: user.theme?.name ?? null,
    },
    folders: user.folders.map(({ title, collapsed }) => ({ title, collapsed })),
    socials: user.socials,
    links: user.links.map((l) => ({
      title: l.title,
      url: l.url,
      enabled: l.enabled,
      folder: l.folderId ? (folderTitle.get(l.folderId) ?? null) : null,
      picture: picture(l.thumbnailKey),
      pictureLayout: l.imageLayout,
      createdAt: l.createdAt.toISOString(),
      clicks: l._count.clicks,
    })),
    themes: user.themes.map((t) => ({ name: t.name, tokens: t.tokens, background: picture(t.backgroundKey), public: t.isPublic, createdAt: t.createdAt.toISOString() })),
  };
}
