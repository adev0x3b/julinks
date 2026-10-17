"use server";

import { updateTag } from "next/cache";
import { profileTag } from "@/lib/cache-tags";
import { updateProfile } from "@/lib/data/users";
import { requireUser } from "@/lib/session";
import { fieldErrors, profileSchema } from "@/lib/validation";

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
