"use server";

import { revalidatePath, updateTag } from "next/cache";
import { profileTag } from "@/lib/cache-tags";
import { RequestNotFound, ReviewForbidden, reviewRequest, type Decision } from "@/lib/data/requests";
import { requireReviewer } from "@/lib/session";
import { decisionSchema } from "@/lib/validation";

export type ReviewState = { error?: string };

/** Approve (with a role) or deny a sign-up request; `input` is validated here, the data layer checks the reviewer's rights. */
export async function reviewSignup(userId: unknown, input: unknown): Promise<ReviewState> {
  const reviewer = await requireReviewer();
  const parsed = decisionSchema.safeParse(input);
  if (typeof userId !== "string" || userId.length === 0 || !parsed.success) return { error: "Unknown request" };
  try {
    const account = await reviewRequest({ id: reviewer.id, role: reviewer.role }, userId, parsed.data as Decision);
    // Revoking an approved account takes its public page down; approving one makes it appear.
    updateTag(profileTag(account.username));
  } catch (error) {
    if (error instanceof RequestNotFound) return { error: "That request no longer exists" };
    if (error instanceof ReviewForbidden) return { error: "You cannot take that decision" };
    throw error;
  }
  revalidatePath("/dashboard", "layout");
  return {};
}
