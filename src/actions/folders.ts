"use server";

import { updateTag } from "next/cache";
import { profileTag } from "@/lib/cache-tags";
import { createFolder, deleteFolder, reorderFolders, updateFolder, type Folder } from "@/lib/data/folders";
import { NotFound } from "@/lib/data/links";
import { requireUser } from "@/lib/session";
import { folderSchema, reorderSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

export type FolderResult = { ok: true; folder: Folder } | { ok: false; error: string };

export async function addFolder(input: { title: string }): Promise<FolderResult> {
  const user = await requireUser();
  const parsed = folderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid folder" };
  try {
    const folder = await createFolder(user.id, parsed.data.title);
    return { ok: true, folder };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create the folder" };
  }
}

export async function renameFolder(folderId: string, input: { title: string }): Promise<FolderResult> {
  const user = await requireUser();
  const parsed = folderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid folder" };
  try {
    const folder = await updateFolder(user.id, folderId, { title: parsed.data.title });
    updateTag(profileTag(user.username));
    return { ok: true, folder };
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Folder not found" : "Could not rename the folder" };
  }
}

/** Collapsed folders show as a row that expands; open ones as a titled section. */
export async function setFolderCollapsed(folderId: string, collapsed: boolean): Promise<FolderResult> {
  const user = await requireUser();
  try {
    const folder = await updateFolder(user.id, folderId, { collapsed: Boolean(collapsed) });
    updateTag(profileTag(user.username));
    return { ok: true, folder };
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Folder not found" : "Could not update the folder" };
  }
}

export async function removeFolder(folderId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await deleteFolder(user.id, folderId);
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Folder not found" : "Could not delete the folder" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}

export async function reorderFolderList(orderedIds: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = reorderSchema.safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "Invalid order" };
  try {
    await reorderFolders(user.id, parsed.data);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reorder" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}
