import { appUrl } from "@/lib/app-url";
import { exportAccount } from "@/lib/data/accounts";
import { imageUrl } from "@/lib/image-url";
import { getCurrentUser } from "@/lib/session";

/** "Download my data": the signed-in account as a JSON file. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const data = await exportAccount(user.id, (key) => new URL(imageUrl(key)!, appUrl()).toString());
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="julinks-${user.username}-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
