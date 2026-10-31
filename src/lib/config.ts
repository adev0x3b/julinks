/**
 * Deployment switches read from the environment. Each one is documented in .env.example.
 */

/**
 * Whether the seeded demo profiles (ada, grace; passwords printed in the README) may log in.
 * Allowed on a laptop and in the compose stack; a public site sets ALLOW_DEMO_LOGIN=0 so a
 * stranger cannot put their own links on the showcase pages.
 */
export function demoLoginAllowed(): boolean {
  const value = process.env.ALLOW_DEMO_LOGIN;
  if (value === undefined || value === "") return true;
  return value === "1" || value === "true";
}

/**
 * Who runs this site, named on the privacy notice and the terms (SITE_OPERATOR, e.g. a person's or a
 * company's name). Unset, the pages say "the operator of this site".
 */
export function siteOperator(): string | null {
  return process.env.SITE_OPERATOR?.trim() || null;
}

/**
 * The service providers that handle data for this site, as a sentence fragment for the privacy notice
 * (SITE_PROCESSORS, e.g. "Cloudflare (network), Resend (email)"). Unset, the notice says the data stays on this server.
 */
export function siteProcessors(): string | null {
  return process.env.SITE_PROCESSORS?.trim() || null;
}
