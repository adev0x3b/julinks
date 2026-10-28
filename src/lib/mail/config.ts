/**
 * Mail settings from the environment. Mail is optional: without SMTP_HOST the app sends
 * nothing and logs what it would have sent, which is what tests, CI and the demo stack do.
 */
export type MailConfig = {
  host: string;
  port: number;
  /** "starttls" (the default) refuses to send unless the server upgrades the connection; "none" is for local catchers such as Mailpit. */
  tls: "starttls" | "none";
  user: string | undefined;
  password: string | undefined;
  from: string;
};

export class MailConfigError extends Error {}

/** Null when mail is off; throws MailConfigError when it is half configured. */
export function mailConfig(env: Record<string, string | undefined> = process.env): MailConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  const from = env.MAIL_FROM?.trim();
  if (!from) throw new MailConfigError("SMTP_HOST is set but MAIL_FROM is not");
  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new MailConfigError("SMTP_PORT is not a port number");
  const tls = env.SMTP_TLS?.trim() || "starttls";
  if (tls !== "starttls" && tls !== "none") throw new MailConfigError('SMTP_TLS must be "starttls" or "none"');
  const user = env.SMTP_USER?.trim() || undefined;
  const password = env.SMTP_PASSWORD || undefined;
  if (Boolean(user) !== Boolean(password)) throw new MailConfigError("Set both SMTP_USER and SMTP_PASSWORD, or neither");
  return { host, port, tls, user, password, from };
}

/** The nodemailer transport options for a config: STARTTLS required unless turned off, plain auth when a login is set. */
export function transportOptions(config: MailConfig) {
  return {
    host: config.host,
    port: config.port,
    secure: false,
    requireTLS: config.tls === "starttls",
    ignoreTLS: config.tls === "none",
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
}
