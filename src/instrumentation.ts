/**
 * Runs once when the server starts. A site that is not set up yet says so in the logs,
 * next to the URL, so an operator reading `docker compose logs web` knows why every
 * page redirects to /setup. The code itself is printed by the migrate step.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isSetupPending } = await import("@/lib/data/setup");
  const { REGENERATE_COMMAND } = await import("@/lib/setup-code");
  try {
    if (await isSetupPending()) {
      console.log(`JuLinks is not set up: open /setup with the code the migrate step printed (docker compose logs migrate), or make a new one with: ${REGENERATE_COMMAND}`);
    }
  } catch {
    // The database may not be reachable yet; the health check reports that on its own.
  }
}
