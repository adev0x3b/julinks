import { prisma } from "@/lib/db";

export class NotFound extends Error {
  constructor() {
    super("Link not found");
  }
}

export const MAX_LINKS_PER_USER = 100;

export async function listLinks(userId: string) {
  return prisma.link.findMany({
    where: { userId },
    orderBy: { position: "asc" },
    select: { id: true, title: true, url: true, position: true, enabled: true, _count: { select: { clicks: true } } },
  });
}

/** Appends a link at the end of the user's list. */
export async function createLink(userId: string, input: { title: string; url: string }) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.link.count({ where: { userId } });
    if (count >= MAX_LINKS_PER_USER) {
      throw new Error(`You can have at most ${MAX_LINKS_PER_USER} links`);
    }
    const last = await tx.link.findFirst({ where: { userId }, orderBy: { position: "desc" }, select: { position: true } });
    return tx.link.create({
      data: { userId, title: input.title, url: input.url, position: (last?.position ?? -1) + 1 },
      select: { id: true, title: true, url: true, position: true, enabled: true },
    });
  });
}

/** Every mutation goes through the owner: a link id from another user is a NotFound, never a leak. */
export async function updateLink(userId: string, linkId: string, input: { title?: string; url?: string; enabled?: boolean }) {
  const result = await prisma.link.updateMany({ where: { id: linkId, userId }, data: input });
  if (result.count === 0) throw new NotFound();
  return prisma.link.findUniqueOrThrow({
    where: { id: linkId },
    select: { id: true, title: true, url: true, position: true, enabled: true },
  });
}

export async function deleteLink(userId: string, linkId: string) {
  const result = await prisma.link.deleteMany({ where: { id: linkId, userId } });
  if (result.count === 0) throw new NotFound();
}

/**
 * Rewrites positions to match the given order. Ids must be exactly the user's
 * links, otherwise the request is rejected rather than partially applied.
 */
export async function reorderLinks(userId: string, orderedIds: string[]) {
  const owned = await prisma.link.findMany({ where: { userId }, select: { id: true } });
  const ownedIds = new Set(owned.map((l) => l.id));
  const unique = new Set(orderedIds);
  if (unique.size !== orderedIds.length || unique.size !== ownedIds.size || !orderedIds.every((id) => ownedIds.has(id))) {
    throw new Error("Order must contain each of your links exactly once");
  }
  await prisma.$transaction(
    orderedIds.map((id, position) => prisma.link.update({ where: { id }, data: { position } })),
  );
}
