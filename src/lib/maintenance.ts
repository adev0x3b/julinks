import { pruneClosedAccounts } from "@/lib/data/accounts";
import { pruneContactMessages } from "@/lib/data/contact";

const HOUR = 60 * 60 * 1000;

/**
 * Deletes what the privacy notice says is kept only for a while: closed accounts and old contact
 * messages. No cache to expire: a denied account's page and gallery themes went offline with the decision.
 */
export async function pruneExpiredData(now = new Date()): Promise<{ accounts: number; messages: number }> {
  const accounts = await pruneClosedAccounts(now);
  const messages = await pruneContactMessages(now);
  return { accounts: accounts.length, messages };
}

/** Started once by the server (src/instrumentation.ts): prunes at start, then every hour. Runs with mail on or off. */
export function startMaintenanceLoop(): void {
  const tick = () =>
    pruneExpiredData()
      .then(({ accounts, messages }) => {
        if (accounts || messages) console.info(`[maintenance] deleted ${accounts} closed account(s) and ${messages} old message(s)`);
      })
      .catch((error) => console.error("[maintenance] prune failed:", error));
  setInterval(tick, HOUR);
  void tick();
}
