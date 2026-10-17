import { IMAGE_KEY_PATTERN } from "@/lib/images";
import { getObject } from "@/lib/storage";

/**
 * Serves stored images through the app, so the stack exposes one port and the
 * bucket stays private. Keys are content-addressed, hence the immutable cache
 * header; a changed picture gets a new URL. A CDN in front of this route, or
 * signed URLs straight to the bucket, would be the next step at scale.
 */
export async function GET(_request: Request, context: RouteContext<"/img/[...key]">) {
  const { key: parts } = await context.params;
  const key = parts.join("/");
  if (!IMAGE_KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });
  const object = await getObject(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Disposition": "inline",
  });
  if (object.contentLength) headers.set("Content-Length", String(object.contentLength));
  return new Response(object.body, { status: 200, headers });
}
