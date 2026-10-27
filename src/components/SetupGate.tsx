import { redirect } from "next/navigation";
import { isSetupPending } from "@/lib/data/setup";

/**
 * Until the admin account exists, nothing public is shown: every page that renders for
 * visitors sits behind this gate and goes to /setup instead. It reads the database on every
 * request (one indexed count), so it needs no cache invalidation and is right the moment
 * setup completes. Rendered inside Suspense so the page's static shell still prerenders.
 */
export async function SetupGate({ children }: { children: React.ReactNode }) {
  if (await isSetupPending()) redirect("/setup");
  return <>{children}</>;
}
