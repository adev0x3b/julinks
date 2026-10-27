/** Where the app is reachable (APP_URL), for absolute URLs in metadata such as og:image. */
export function appUrl(): URL {
  return new URL(process.env.APP_URL ?? "http://localhost:3000");
}
