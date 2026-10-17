"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { profileTag } from "@/lib/cache-tags";
import { updateProfile } from "@/lib/data/users";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors, profileSchema } from "@/lib/validation";

export type ProfileFormState = {
  errors?: Record<string, string>;
  savedAt?: number;
};

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    theme: formData.get("theme"),
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }
  await updateProfile(user.id, parsed.data);
  updateTag(profileTag(user.username));
  return { savedAt: Date.now() };
}
