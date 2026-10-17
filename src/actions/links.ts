"use server";

import { updateTag } from "next/cache";
import { profileTag } from "@/lib/cache-tags";
import { createLink, deleteLink, NotFound, reorderLinks, updateLink } from "@/lib/data/links";
import { requireUser } from "@/lib/session";
import { fieldErrors, linkSchema, reorderSchema } from "@/lib/validation";

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
  try {
    await createLink(user.id, parsed.data);
  } catch (error) {
    return { values, errors: { form: error instanceof Error ? error.message : "Could not add link" } };
  }
  updateTag(profileTag(user.username));
  return { savedAt: Date.now() };
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
