"use server";

import { updateTag } from "next/cache";
import { profileTag } from "@/lib/cache-tags";
import { replaceSocials, type Social } from "@/lib/data/socials";
import { setAvatarFocus as saveAvatarFocus, updateProfile } from "@/lib/data/users";
import { requireUser } from "@/lib/session";
import { fieldErrors, imageFocusSchema, profileSchema, socialsSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

export type ProfileFormState = {
  errors?: Record<string, string>;
  savedAt?: number;
};

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }
  await updateProfile(user.id, parsed.data);
  updateTag(profileTag(user.username));
  return { savedAt: Date.now() };
}


/** Where the avatar is centred inside its circle. */
export async function setAvatarFocus(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = imageFocusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid focal point" };
  await saveAvatarFocus(user.id, parsed.data);
  updateTag(profileTag(user.username));
  return { ok: true };
}

export type SocialsResult = { ok: true; socials: Social[] } | { ok: false; errors: Record<number, string>; error?: string };

/** Saves the icon row as a whole, in order. Errors come back per row (by index) so the editor can mark the bad input. */
export async function saveSocials(input: unknown): Promise<SocialsResult> {
  const user = await requireUser();
  const parsed = socialsSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<number, string> = {};
    let error: string | undefined;
    for (const issue of parsed.error.issues) {
      if (typeof issue.path[0] === "number") errors[issue.path[0]] ??= issue.message;
      else error ??= issue.message;
    }
    return { ok: false, errors, error };
  }
  const socials = await replaceSocials(user.id, parsed.data);
  updateTag(profileTag(user.username));
  return { ok: true, socials };
}
