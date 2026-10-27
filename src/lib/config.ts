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
