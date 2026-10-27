import { setLinkThumbnail } from "@/lib/data/links";
import { imageKey, processImage, UnsupportedImage } from "@/lib/images";
import { fetchLinkPreview, PreviewError } from "@/lib/link-preview";
import { deleteObject, putObject } from "@/lib/storage";

/**
 * Fetches the preview image a link advertises and makes it the link's picture,
 * through the same resize/re-encode/store path as an upload. Used right after a
 * link is added (best effort, after the response) and by the "Grab from the
 * link" button; callers expire the page cache. Throws PreviewError with a message for the owner.
 */
export async function grabLinkPreviewFor(userId: string, linkId: string, url: string): Promise<{ url: string; key: string }> {
  const preview = await fetchLinkPreview(url, { allowPrivateAddresses: process.env.LINK_PREVIEW_ALLOW_PRIVATE === "1" });
  let processed;
  try {
    processed = await processImage(new Uint8Array(preview.data), "thumbnail");
  } catch (error) {
    if (error instanceof UnsupportedImage) throw new PreviewError("The preview image is not a PNG, JPEG, WebP or GIF");
    throw error;
  }
  const key = imageKey("thumbnail", userId, processed.data);
  await putObject(key, processed.data, processed.contentType);
  const previous = await setLinkThumbnail(userId, linkId, key);
  if (previous && previous !== key) await deleteObject(previous).catch((error) => console.warn("could not delete", previous, error));
  return { url: `/img/${key}`, key };
}
