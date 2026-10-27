"use server";

import { updateTag } from "next/cache";
import { GALLERY_TAG, profileTag } from "@/lib/cache-tags";
import { NotFound, setLinkThumbnail } from "@/lib/data/links";
import { prisma } from "@/lib/db";
import { PreviewError } from "@/lib/link-preview";
import { grabLinkPreviewFor } from "@/lib/link-preview-store";
import { getOwnTheme, setThemeBackground, ThemeNotFound } from "@/lib/data/themes";
import { setAvatar } from "@/lib/data/users";
import { imageKey, processImage, UnsupportedImage } from "@/lib/images";
import { uploadLimiter } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { deleteObject, putObject } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, type ImageKind } from "@/lib/validation";

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Shared upload path: size check before anything is read, rate limit per user,
 * decode + resize + re-encode, then store under a content-addressed key. The
 * caller records the key and deletes the previous object, if any.
 */
async function storeUpload(userId: string, formData: FormData, kind: ImageKind): Promise<{ key: string } | { error: string }> {
  const limit = uploadLimiter.check(userId);
  if (!limit.ok) return { error: `Too many uploads. Try again in ${limit.retryAfterSeconds} seconds.` };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload" };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `Images must be smaller than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` };
  try {
    const processed = await processImage(new Uint8Array(await file.arrayBuffer()), kind);
    const key = imageKey(kind, userId, processed.data);
    await putObject(key, processed.data, processed.contentType);
    return { key };
  } catch (error) {
    if (error instanceof UnsupportedImage) return { error: error.message };
    console.error("upload failed", error);
    return { error: "Could not store the image. Try again." };
  }
}

/** Best effort cleanup; a leftover object is cheap, a failed user action is not. */
async function discard(key: string | null, keep?: string) {
  if (!key || key === keep) return;
  await deleteObject(key).catch((error) => console.warn("could not delete", key, error));
}

export async function uploadAvatar(_prev: UploadResult | null, formData: FormData): Promise<UploadResult> {
  const user = await requireUser();
  const stored = await storeUpload(user.id, formData, "avatar");
  if ("error" in stored) return { ok: false, error: stored.error };
  const previous = await setAvatar(user.id, stored.key);
  await discard(previous, stored.key);
  updateTag(profileTag(user.username));
  return { ok: true, url: `/img/${stored.key}` };
}

export async function removeAvatar(): Promise<ActionResult> {
  const user = await requireUser();
  const previous = await setAvatar(user.id, null);
  await discard(previous);
  updateTag(profileTag(user.username));
  return { ok: true };
}

export async function uploadLinkThumbnail(linkId: string, formData: FormData): Promise<UploadResult> {
  const user = await requireUser();
  const stored = await storeUpload(user.id, formData, "thumbnail");
  if ("error" in stored) return { ok: false, error: stored.error };
  try {
    const previous = await setLinkThumbnail(user.id, linkId, stored.key);
    await discard(previous, stored.key);
  } catch (error) {
    await discard(stored.key);
    return { ok: false, error: error instanceof NotFound ? "Link not found" : "Could not save the thumbnail" };
  }
  updateTag(profileTag(user.username));
  return { ok: true, url: `/img/${stored.key}` };
}

/** The link's own preview image (og:image and friends) as its picture. */
export async function grabLinkPreview(linkId: string): Promise<UploadResult> {
  const user = await requireUser();
  const limit = uploadLimiter.check(user.id);
  if (!limit.ok) return { ok: false, error: `Too many uploads. Try again in ${limit.retryAfterSeconds} seconds.` };
  const link = await prisma.link.findFirst({ where: { id: linkId, userId: user.id }, select: { url: true } });
  if (!link) return { ok: false, error: "Link not found" };
  try {
    const stored = await grabLinkPreviewFor(user.id, linkId, link.url);
    updateTag(profileTag(user.username));
    return { ok: true, url: stored.url };
  } catch (error) {
    if (error instanceof PreviewError) return { ok: false, error: error.message };
    if (error instanceof NotFound) return { ok: false, error: "Link not found" };
    console.error("link preview failed", error);
    return { ok: false, error: "Could not fetch a preview for that link" };
  }
}

export async function removeLinkThumbnail(linkId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const previous = await setLinkThumbnail(user.id, linkId, null);
    await discard(previous);
  } catch (error) {
    return { ok: false, error: error instanceof NotFound ? "Link not found" : "Could not remove the thumbnail" };
  }
  updateTag(profileTag(user.username));
  return { ok: true };
}

export async function uploadThemeBackground(themeId: string, formData: FormData): Promise<UploadResult> {
  const user = await requireUser();
  const stored = await storeUpload(user.id, formData, "background");
  if ("error" in stored) return { ok: false, error: stored.error };
  try {
    const previous = await setThemeBackground(user.id, themeId, stored.key);
    await discard(previous, stored.key);
  } catch (error) {
    await discard(stored.key);
    return { ok: false, error: error instanceof ThemeNotFound ? "Theme not found" : "Could not save the background" };
  }
  await expireTheme(user, themeId);
  return { ok: true, url: `/img/${stored.key}` };
}

export async function removeThemeBackground(themeId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const previous = await setThemeBackground(user.id, themeId, null);
    await discard(previous);
  } catch (error) {
    return { ok: false, error: error instanceof ThemeNotFound ? "Theme not found" : "Could not remove the background" };
  }
  await expireTheme(user, themeId);
  return { ok: true };
}

/** A theme change shows on the owner's page (if active) and in the gallery (if public). */
async function expireTheme(user: { id: string; username: string; themeId: string | null }, themeId: string) {
  if (user.themeId === themeId) updateTag(profileTag(user.username));
  const theme = await getOwnTheme(user.id, themeId).catch(() => null);
  if (theme?.isPublic) updateTag(GALLERY_TAG);
}
