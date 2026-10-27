import { isIP } from "node:net";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { Agent, buildConnector, fetch as undiciFetch, type Dispatcher } from "undici";

/**
 * Finds the preview image a link advertises (Open Graph / Twitter card / image_src)
 * and downloads it, so a link can get its picture without the owner uploading one.
 *
 * The server fetches a URL the owner typed, which is the classic SSRF shape, so:
 * only http(s); every hostname, including each redirect hop, must resolve to a
 * public address (checked inside the connection's own DNS lookup, so a rebinding
 * between check and connect cannot slip through); short timeouts; bodies capped.
 */
export class PreviewError extends Error {}

export type LinkPreviewOptions = {
  /** Tests run against servers on 127.0.0.1; production never sets this. */
  allowPrivateAddresses?: boolean;
  timeoutMs?: number;
};

const MAX_HTML_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; JuLinks link preview; +https://github.com/adev0x3b/julinks)";

/**
 * True for loopback, private, link-local, multicast and unspecified addresses, v4 and v6.
 * A v6 address that carries a v4 one (v4-mapped `::ffff:a.b.c.d`, which the URL parser and
 * resolvers also write as `::ffff:0a00:0001`, and NAT64 `64:ff9b::a.b.c.d`) is judged as that
 * v4 address, whichever spelling it arrives in.
 */
export function isPrivateAddress(address: string): boolean {
  const v4 = isIP(address) === 4 ? address : embeddedV4(address);
  if (v4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || a >= 224
    );
  }
  const groups = expandV6(address);
  if (!groups) return true;
  const v6 = groups.join(":");
  return (
    v6 === "0:0:0:0:0:0:0:0" || v6 === "0:0:0:0:0:0:0:1" || /^f[cd]/.test(groups[0]) || /^fe[89ab]/.test(groups[0]) || groups[0].startsWith("ff")
  );
}

/** The eight hex groups of a v6 address, zero-padding removed, or null when it is not one. */
function expandV6(address: string): string[] | null {
  let text = address.toLowerCase().replace(/%.*$/, "");
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    text = text.slice(0, -dotted[1].length) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => g.replace(/^0+(?=.)/, ""));
}

/** The v4 address a v4-mapped or NAT64 v6 address stands for, in dotted form; null for any other address. */
function embeddedV4(address: string): string | null {
  const groups = expandV6(address);
  if (!groups) return null;
  const prefix = groups.slice(0, 6).join(":");
  if (prefix !== "0:0:0:0:0:ffff" && prefix !== "64:ff9b:0:0:0:0") return null;
  const hi = parseInt(groups[6], 16);
  const lo = parseInt(groups[7], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

function guardedAgent(allowPrivate: boolean, timeoutMs: number): Dispatcher {
  const connectOptions = {
    timeout: timeoutMs,
    lookup(hostname: string, options: object, callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void) {
      dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error, addresses as LookupAddress[]);
        const list = addresses as LookupAddress[];
        const blocked = list.find((entry) => isPrivateAddress(entry.address));
        if (!allowPrivate && (blocked || list.length === 0)) {
          return callback(new PreviewError("That address is not reachable from here"), list);
        }
        callback(null, list);
      });
    },
  };
  const connect = buildConnector(connectOptions);
  return new Agent({
    connectTimeout: timeoutMs,
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    // The lookup above guards names; this guards the socket that was actually opened, which also
    // covers IP literals (they never go through DNS) whatever form they were written in.
    connect(options, callback) {
      connect(options, (error, socket) => {
        if (error || !socket) return callback(error, socket);
        const remote = socket.remoteAddress ?? "";
        if (!allowPrivate && (remote === "" || isPrivateAddress(remote))) {
          socket.destroy();
          return callback(new PreviewError("That address is not reachable from here"), null);
        }
        callback(null, socket);
      });
    },
  });
}

/** Scheme, credentials and, for an IP literal (which never goes through DNS), the private-address rule. */
function checkUrl(value: string, allowPrivate: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PreviewError("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new PreviewError("Only http(s) links can be previewed");
  if (url.username || url.password) throw new PreviewError("Links with credentials are not previewed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowPrivate && isIP(host) && isPrivateAddress(host)) throw new PreviewError("That address is not reachable from here");
  return url;
}

/** GET with manual redirects (each hop re-checked), a body cap and a total deadline. */
async function fetchCapped(start: URL, maxBytes: number, accept: string, dispatcher: Dispatcher, timeoutMs: number, allowPrivate: boolean) {
  const deadline = AbortSignal.timeout(timeoutMs);
  let url = start;
  for (let hop = 0; ; hop += 1) {
    const response = await undiciFetch(url, {
      dispatcher,
      redirect: "manual",
      signal: deadline,
      headers: { "user-agent": USER_AGENT, accept },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || hop >= MAX_REDIRECTS) throw new PreviewError("Too many redirects");
      url = checkUrl(new URL(location, url).toString(), allowPrivate);
      continue;
    }
    if (!response.ok) throw new PreviewError(`The link answered ${response.status}`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      await response.body?.cancel();
      throw new PreviewError("The response is too large");
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new PreviewError("The response is too large");
        }
        chunks.push(value);
      }
    }
    return { url, contentType: response.headers.get("content-type") ?? "", body: Buffer.concat(chunks) };
  }
}

const META_TAG = /<meta\s[^>]*>/gi;
const LINK_TAG = /<link\s[^>]*>/gi;

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "").trim() : null;
}

/**
 * The preview image URL named by the page's head, in order of preference:
 * og:image(:secure_url), twitter:image, link rel="image_src". Relative URLs are
 * resolved against the page. Returns null when the page names none.
 */
export function extractPreviewImage(html: string, pageUrl: string): string | null {
  const head = html.slice(0, MAX_HTML_BYTES);
  const candidates: { rank: number; url: string }[] = [];
  const ranks: Record<string, number> = { "og:image:secure_url": 0, "og:image": 1, "og:image:url": 1, "twitter:image": 2, "twitter:image:src": 2 };
  for (const tag of head.match(META_TAG) ?? []) {
    const key = (attribute(tag, "property") ?? attribute(tag, "name") ?? "").toLowerCase();
    const content = attribute(tag, "content");
    if (key in ranks && content) candidates.push({ rank: ranks[key], url: content });
  }
  for (const tag of head.match(LINK_TAG) ?? []) {
    const rel = (attribute(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const href = attribute(tag, "href");
    if (rel.includes("image_src") && href) candidates.push({ rank: 3, url: href });
  }
  candidates.sort((a, b) => a.rank - b.rank);
  for (const candidate of candidates) {
    try {
      const resolved = new URL(decodeEntities(candidate.url), pageUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") return resolved.toString();
    } catch {
      // try the next one
    }
  }
  return null;
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export type LinkPreview = { imageUrl: string; data: Buffer; contentType: string };

/** Downloads the preview image a link advertises. Throws PreviewError with a message fit for the owner. */
export async function fetchLinkPreview(link: string, options: LinkPreviewOptions = {}): Promise<LinkPreview> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const allowPrivate = options.allowPrivateAddresses ?? false;
  const dispatcher = guardedAgent(allowPrivate, timeoutMs);
  try {
    const page = await fetchCapped(checkUrl(link, allowPrivate), MAX_HTML_BYTES, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1", dispatcher, timeoutMs, allowPrivate);
    if (page.contentType.startsWith("image/")) {
      // The link itself is a picture.
      return { imageUrl: page.url.toString(), data: page.body, contentType: page.contentType };
    }
    const imageUrl = extractPreviewImage(page.body.toString("utf8"), page.url.toString());
    if (!imageUrl) throw new PreviewError("That page does not advertise a preview image");
    const image = await fetchCapped(checkUrl(imageUrl, allowPrivate), MAX_IMAGE_BYTES, "image/*", dispatcher, timeoutMs, allowPrivate);
    return { imageUrl: image.url.toString(), data: image.body, contentType: image.contentType };
  } catch (error) {
    // undici wraps the lookup's error in one or two layers of connect errors.
    for (let current: unknown = error, depth = 0; current && depth < 5; current = (current as { cause?: unknown }).cause, depth += 1) {
      if (current instanceof PreviewError) throw current;
      if ((current as { name?: string }).name === "TimeoutError") throw new PreviewError("The link took too long to answer");
    }
    throw new PreviewError("Could not reach that link");
  } finally {
    await dispatcher.close().catch(() => undefined);
  }
}
