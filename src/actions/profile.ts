"use server";

import { updateTag } from "next/cache";
import { profileTag } from "@/lib/cache-tags";
import { setAvatarFocus as saveAvatarFocus, updateProfile } from "@/lib/data/users";
import { requireUser } from "@/lib/session";
import { fieldErrors, imageFocusSchema, profileSchema } from "@/lib/validation";

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

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Where the avatar is centred inside its circle. */
export async function setAvatarFocus(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = imageFocusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid focal point" };
  await saveAvatarFocus(user.id, parsed.data);
  updateTag(profileTag(user.username));
  return { ok: true };
}
