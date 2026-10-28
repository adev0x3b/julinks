import { createTransport } from "nodemailer";
import { MailConfigError, mailConfig, transportOptions } from "@/lib/mail/config";

export type Mail = { to: string[]; subject: string; text: string; html: string };

/**
 * Sends one message and reports whether it went out. Never throws: a mail that cannot be
 * sent (mail off, relay down, quota spent) is logged and the caller carries on, so a sign-up
 * or a review never fails because of it.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (mail.to.length === 0) return false;
  let config;
  try {
    config = mailConfig();
  } catch (error) {
    if (error instanceof MailConfigError) {
      console.error(`[mail] not sent, mail is misconfigured: ${error.message}`);
      return false;
    }
    throw error;
  }
  if (!config) {
    console.info(`[mail] off (no SMTP_HOST), not sent: "${mail.subject}" to ${mail.to.length} recipient(s)`);
    return false;
  }
  try {
    await createTransport(transportOptions(config)).sendMail({
      from: config.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return true;
  } catch (error) {
    console.error(`[mail] not sent: "${mail.subject}": ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
