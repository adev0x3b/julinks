import { createTransport } from "nodemailer";
import type { MailConfig } from "@/lib/mail/config";
import { transportOptions } from "@/lib/mail/config";

export type Mail = { to: string[]; subject: string; text: string; html: string };

/**
 * What became of one attempt. A permanent failure (the server refused an address or the
 * message with a 5xx) is not worth retrying; anything else (relay down, 451 "try later",
 * a quota, a refused login) is.
 */
export type Delivery = { ok: true } | { ok: false; permanent: boolean; error: string };

/** Hands one message to the SMTP server. Never throws. */
export async function deliver(config: MailConfig, mail: Mail): Promise<Delivery> {
  try {
    await createTransport(transportOptions(config)).sendMail({
      from: config.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { ok: true };
  } catch (error) {
    const { responseCode, code, message } = error as { responseCode?: number; code?: string; message?: string };
    const permanent = typeof responseCode === "number" && responseCode >= 500 && responseCode < 600 && code !== "EAUTH";
    return { ok: false, permanent, error: (message ?? String(error)).slice(0, 500) };
  }
}
