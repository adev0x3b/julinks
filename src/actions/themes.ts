"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { GALLERY_TAG, profileTag } from "@/lib/cache-tags";
import {
  activateTheme,
  createTheme,
  deleteTheme,
  findOwnCopy,
  getCopyableTheme,
  getOwnTheme,
  setThemePublic,
  ThemeNotFound,
  updateTheme,
} from "@/lib/data/themes";
import { rekeyImage } from "@/lib/images";
import { getCurrentUser, requireUser } from "@/lib/session";
import { copyObject, deleteObject } from "@/lib/storage";
import { getPreset } from "@/lib/themes";
import { fieldErrors, themeSchema } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; themeId: string; reused?: boolean } | { ok: false; error: string };
export type SaveThemeState = { errors?: Record<string, string>; savedAt?: number };

function message(error: unknown, fallback: string): string {
  if (error instanceof ThemeNotFound) return "Theme not found";
  return error instanceof Error && error.message.startsWith("You can have") ? error.message : fallback;
}

/** Starts a new theme from a built-in preset and makes it active. */
export async function createThemeFromPreset(presetId: string): Promise<CreateResult> {
  const user = await requireUser();
  const preset = getPreset(presetId);
  if (!preset) return { ok: false, error: "Unknown preset" };
  try {
    const theme = await createTheme(user.id, { name: preset.name, tokens: preset.tokens });
    updateTag(profileTag(user.username));
    return { ok: true, themeId: theme.id };
  } catch (error) {
    return { ok: false, error: message(error, "Could not create the theme") };
  }
}

/**
 * Copies a public theme (or one of your own) into your themes and makes it
 * active. A copy, not a reference: the original's owner can keep editing,
 * unpublishing or deleting it without touching anyone else's page. Taking
 * the same gallery theme twice activates the copy you already have.
 */
export async function copyTheme(themeId: string): Promise<CreateResult> {
  const user = await requireUser();
  try {
    const source = await getCopyableTheme(user.id, themeId);
    if (source.ownerId !== user.id) {
      const existing = await findOwnCopy(user.id, source.id);
      if (existing) {
        await activateTheme(user.id, existing.id);
        updateTag(profileTag(user.username));
        return { ok: true, themeId: existing.id, reused: true };
      }
    }
    let backgroundKey: string | null = null;
    if (source.backgroundKey) {
      // Same content under the new owner's prefix, so the two themes never share an object.
      backgroundKey = rekeyImage(source.backgroundKey, "background", user.id);
      await copyObject(source.backgroundKey, backgroundKey);
    }
    const theme = await createTheme(user.id, {
      name: source.ownerId === user.id ? `${source.name} copy` : source.name,
      tokens: source.tokens,
      backgroundKey,
      forkedFromId: source.ownerId === user.id ? source.forkedFromId : source.id,
    });
    updateTag(profileTag(user.username));
    return { ok: true, themeId: theme.id };
  } catch (error) {
    return { ok: false, error: message(error, "Could not copy the theme") };
  }
}

/** The gallery's "Use this theme" button: copy (or re-activate the earlier copy), then go to the studio, which says so. */
export async function useGalleryTheme(formData: FormData): Promise<void> {
  // Visitors are sent to log in and come back here.
  if (!(await getCurrentUser())) redirect("/login?next=/themes");
  const result = await copyTheme(String(formData.get("themeId") ?? ""));
  if (!result.ok) redirect("/dashboard/appearance?error=copy");
  redirect(`/dashboard/appearance?theme=${result.themeId}&${result.reused ? "reused" : "copied"}=1`);
}

export async function saveTheme(themeId: string, input: { name: string; tokens: unknown }): Promise<SaveThemeState> {
  const user = await requireUser();
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    const theme = await updateTheme(user.id, themeId, parsed.data);
    if (user.themeId === themeId) updateTag(profileTag(user.username));
    if (theme.isPublic) updateTag(GALLERY_TAG);
    return { savedAt: Date.now() };
  } catch (error) {
    return { errors: { form: message(error, "Could not save the theme") } };
  }
}

export async function setActiveTheme(themeId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await activateTheme(user.id, themeId);
    updateTag(profileTag(user.username));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error, "Could not switch theme") };
  }
}

export async function publishTheme(themeId: string, isPublic: boolean): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await setThemePublic(user.id, themeId, Boolean(isPublic));
    updateTag(GALLERY_TAG);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error, "Could not update the theme") };
  }
}

export async function removeTheme(themeId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const theme = await getOwnTheme(user.id, themeId);
    const { backgroundKey, wasPublic } = await deleteTheme(user.id, theme.id);
    if (backgroundKey) await deleteObject(backgroundKey).catch(() => undefined);
    if (user.themeId === themeId) updateTag(profileTag(user.username));
    if (wasPublic) updateTag(GALLERY_TAG);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error, "Could not delete the theme") };
  }
}
