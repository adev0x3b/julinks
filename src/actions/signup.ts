"use server";

import { after } from "next/server";
import { confirmSignup, InvalidConfirmLink } from "@/lib/data/signup";
import { RequestsFull, UniqueViolation } from "@/lib/data/users";
import { drainOutbox, queueAdminNotice } from "@/lib/mail/outbox";
import { mailLinkLimiter, retryLater } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { usernameSchema } from "@/lib/validation";

export type ConfirmFormState = {
  errors?: Record<string, string>;
  /** The name typed in place of one that was taken meanwhile; the form keeps showing the field. */
  username?: string;
  /** Set once the request is stored: the form swaps for "waiting for an admin". */
  confirmed?: { username: string };
};

/** Uses a sign-up's confirmation link: the request is stored and the admins hear about it. */
export async function confirmEmail(_prev: ConfirmFormState, formData: FormData): Promise<ConfirmFormState> {
  const ipKey = `confirm:${await clientIp()}`;
  // Only wrong links count: links are unguessable, this just keeps scanners out.
  const limit = mailLinkLimiter.peek(ipKey);
  if (!limit.ok) return { errors: { form: retryLater("attempts", limit) } };
  const typed = formData.get("username");
  let username: string | undefined;
  if (typeof typed === "string") {
    const parsed = usernameSchema.safeParse(typed);
    if (!parsed.success) return { username: typed, errors: { username: parsed.error.issues[0].message } };
    username = parsed.data;
  }
  try {
    const user = await confirmSignup(String(formData.get("token") ?? ""), username);
    after(async () => {
      await queueAdminNotice();
      await drainOutbox();
    });
    return { confirmed: { username: user.username } };
  } catch (error) {
    if (error instanceof UniqueViolation) return { username: username ?? "", errors: { username: "That username was taken in the meantime, pick another" } };
    if (error instanceof RequestsFull) return { username, errors: { form: error.message } };
    if (error instanceof InvalidConfirmLink) {
      mailLinkLimiter.check(ipKey);
      return { errors: { form: error.message } };
    }
    throw error;
  }
}
