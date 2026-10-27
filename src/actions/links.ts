"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import { profileTag } from "@/lib/cache-tags";
import { setLinkFolder as saveLinkFolder } from "@/lib/data/folders";
import { createLink, deleteLink, NotFound, reorderLinks, setLinkImage as saveLinkImage, updateLink } from "@/lib/data/links";
import { PreviewError } from "@/lib/link-preview";
import { grabLinkPreviewFor } from "@/lib/link-preview-store";
import { requireUser } from "@/lib/session";
import { fieldErrors, linkImageSchema, linkSchema, reorderSchema } from "@/lib/validation";

export type LinkFormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** Changes on each successful submit so the form can reset itself. */
  savedAt?: number;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addLink(_prev: LinkFormState, formData: FormData): Promise<LinkFormState> {
  const user = await requireUser();
  const values = { title: String(formData.get("title") ?? ""), url: String(formData.get("url") ?? "") };
  const parsed = linkSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: fieldErrors(parsed.error) };
  }
  let link;
  try {
    link = await createLink(user.id, parsed.data);
  } catch (error) {
    return { values, errors: { form: error instanceof Error ? error.message : "Could not add link" } };
  }
  updateTag(profileTag(user.username));
  // Best effort, after the response: the link's own preview image, if the page advertises one.
  after(async () => {
    try {
      await grabLinkPreviewFor(user.id, link.id, link.url);
      updateTag(profileTag(user.username));
    } catch (error) {
      // Most pages simply have no preview image; nothing to tell the owner.
      if (!(error instanceof PreviewError)) console.warn("auto preview failed", error);
    }
  });
  return { savedAt: Date.now() };
}

export async function setLinkFolder(linkId: string, folderId: string | null): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await saveLinkFolder(user.id, linkId, typeof folderId === "string" && folderId.length > 0 ? folderId : null);
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Link or folder not found" : "Could not move the link" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}

export async function editLink(linkId: string, input: { title: string; url: string }): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: Object.values(fieldErrors(parsed.error))[0] ?? "Invalid link" };
  }
  try {
    await updateLink(user.id, linkId, parsed.data);
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Link not found" : "Could not save link" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}

export async function setLinkEnabled(linkId: string, enabled: boolean): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await updateLink(user.id, linkId, { enabled: Boolean(enabled) });
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Link not found" : "Could not update link" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}

/** Small or big, and where the picture is centred. */
export async function setLinkImage(linkId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = linkImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid picture settings" };
  try {
    await saveLinkImage(user.id, linkId, parsed.data);
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Link not found" : "Could not save the picture settings" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}

export async function removeLink(linkId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await deleteLink(user.id, linkId);
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Link not found" : "Could not delete link" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}

export async function reorder(orderedIds: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = reorderSchema.safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "Invalid order" };
  try {
    await reorderLinks(user.id, parsed.data);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reorder" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}
