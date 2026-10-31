"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { HONEYPOT_FIELD } from "@/lib/contact-kinds";
import { deleteContactMessage, InboxFull, storeContactMessage } from "@/lib/data/contact";
import { drainOutbox, queueAdminNotice } from "@/lib/mail/outbox";
import { contactLimiter, retryLater } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { requireUser } from "@/lib/session";
import { contactSchema, fieldErrors } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";

export type ContactFormState = {
  errors?: Record<string, string>;
  values?: { kind?: string; page?: string; message?: string; email?: string };
  sent?: boolean;
};

/** Stores a contact form message for the admins and makes sure they get a notice. */
export async function sendContactMessage(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  // A filled honeypot gets the same answer as a real message, so the bot learns nothing.
  if (String(formData.get(HONEYPOT_FIELD) ?? "") !== "") return { sent: true };
  const values = {
    kind: String(formData.get("kind") ?? ""),
    page: String(formData.get("page") ?? ""),
    message: String(formData.get("message") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const limit = contactLimiter.check(`contact:${await clientIp()}`);
  if (!limit.ok) return { values, errors: { form: retryLater("messages", limit) } };
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return { values, errors: fieldErrors(parsed.error) };
  try {
    await storeContactMessage(parsed.data);
  } catch (error) {
    if (error instanceof InboxFull) return { values, errors: { form: error.message } };
    throw error;
  }
  after(async () => {
    await queueAdminNotice();
    await drainOutbox();
  });
  return { sent: true };
}

/** Admins only: removes a message once it is dealt with. */
export async function deleteMessage(id: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "admin") return { ok: false, error: "Only admins can delete messages" };
  if (typeof id !== "string" || id.length === 0 || !(await deleteContactMessage(id))) return { ok: false, error: "That message is already gone" };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
