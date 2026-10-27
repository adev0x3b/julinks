import { prisma } from "@/lib/db";
import { NotFound } from "@/lib/data/links";

export type Folder = { id: string; title: string; position: number; collapsed: boolean };

const select = { id: true, title: true, position: true, collapsed: true } as const;

export const MAX_FOLDERS_PER_USER = 20;

export async function listFolders(userId: string): Promise<Folder[]> {
  return prisma.folder.findMany({ where: { userId }, orderBy: { position: "asc" }, select });
}

/** Appends a folder; it shows on the page as an open section until collapsed. */
export async function createFolder(userId: string, title: string): Promise<Folder> {
  return prisma.$transaction(async (tx) => {
    const count = await tx.folder.count({ where: { userId } });
    if (count >= MAX_FOLDERS_PER_USER) throw new Error(`You can have at most ${MAX_FOLDERS_PER_USER} folders`);
    const last = await tx.folder.findFirst({ where: { userId }, orderBy: { position: "desc" }, select: { position: true } });
    return tx.folder.create({ data: { userId, title, position: (last?.position ?? -1) + 1 }, select });
  });
}

export async function updateFolder(userId: string, folderId: string, input: { title?: string; collapsed?: boolean }): Promise<Folder> {
  const result = await prisma.folder.updateMany({ where: { id: folderId, userId }, data: input });
  if (result.count === 0) throw new NotFound();
  return prisma.folder.findUniqueOrThrow({ where: { id: folderId }, select });
}

/** Deleting a folder moves its links back to the top level (the foreign key sets folderId to null). */
export async function deleteFolder(userId: string, folderId: string): Promise<void> {
  const result = await prisma.folder.deleteMany({ where: { id: folderId, userId } });
  if (result.count === 0) throw new NotFound();
}

/** Rewrites folder positions to the given order, which must list the user's folders exactly once. */
export async function reorderFolders(userId: string, orderedIds: string[]): Promise<void> {
  const owned = await prisma.folder.findMany({ where: { userId }, select: { id: true } });
  const ownedIds = new Set(owned.map((f) => f.id));
  const unique = new Set(orderedIds);
  if (unique.size !== orderedIds.length || unique.size !== ownedIds.size || !orderedIds.every((id) => ownedIds.has(id))) {
    throw new Error("Order must contain each of your folders exactly once");
  }
  await prisma.$transaction(orderedIds.map((id, position) => prisma.folder.update({ where: { id }, data: { position } })));
}

/** Puts a link in one of the user's folders, or back at the top level with null. */
export async function setLinkFolder(userId: string, linkId: string, folderId: string | null): Promise<void> {
  if (folderId) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, userId }, select: { id: true } });
    if (!folder) throw new NotFound();
  }
  const result = await prisma.link.updateMany({ where: { id: linkId, userId }, data: { folderId } });
  if (result.count === 0) throw new NotFound();
}
