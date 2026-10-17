/** Public URL of a stored image. Shared by server and client, so no server-only imports here. */
export function imageUrl(key: string | null | undefined): string | null {
  return key ? `/img/${key}` : null;
}
