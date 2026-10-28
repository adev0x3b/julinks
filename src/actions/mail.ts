"use server";

import { revalidatePath } from "next/cache";
import { deleteQueuedMail } from "@/lib/mail/outbox";
import { requireReviewer } from "@/lib/session";

export type MailActionState = { error?: string };

/** Admins only: drop a mail from the outbox before it goes out. */
export async function removeQueuedMail(mailId: unknown): Promise<MailActionState> {
  const reviewer = await requireReviewer();
  if (reviewer.role !== "admin") return { error: "Only admins can manage mail" };
  if (typeof mailId !== "string" || mailId.length === 0 || mailId.length > 64) return { error: "Unknown mail" };
  const deleted = await deleteQueuedMail(mailId);
  revalidatePath("/dashboard/requests");
  return deleted ? {} : { error: "That mail is already on its way or gone" };
}
