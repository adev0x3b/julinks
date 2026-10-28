"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { profileTag } from "@/lib/cache-tags";
import { RequestNotFound, ReviewForbidden, reviewRequest, type Decision } from "@/lib/data/requests";
import { drainOutbox, queueDecisionMail } from "@/lib/mail/outbox";
import { requireReviewer } from "@/lib/session";
import { decisionSchema } from "@/lib/validation";

export type ReviewState = { error?: string };

/** Approve (with a role) or deny a sign-up request; `input` is validated here, the data layer checks the reviewer's rights. */
export async function reviewSignup(userId: unknown, input: unknown): Promise<ReviewState> {
  const reviewer = await requireReviewer();
  const parsed = decisionSchema.safeParse(input);
  if (typeof userId !== "string" || userId.length === 0 || !parsed.success) return { error: "Unknown request" };
  try {
    const { notify, ...decision } = parsed.data;
    const account = await reviewRequest({ id: reviewer.id, role: reviewer.role }, userId, decision as Decision);
    // Revoking an approved account takes its public page down; approving one makes it appear.
    updateTag(profileTag(account.username));
    // The requester hears about it by mail, after the response, unless the request was denied as spam:
    // junk sign-ups often carry made-up addresses, and mail to those bounces.
    if (notify !== false) {
      after(async () => {
        await queueDecisionMail(account, account.previousStatus, account.status);
        await drainOutbox();
      });
    }
  } catch (error) {
    if (error instanceof RequestNotFound) return { error: "That request no longer exists" };
    if (error instanceof ReviewForbidden) return { error: "You cannot take that decision" };
    throw error;
  }
  revalidatePath("/dashboard", "layout");
  return {};
}
