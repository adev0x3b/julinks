/** Cache tag of a user's public page; every edit to profile or links expires it. */
export function profileTag(username: string): string {
  return `profile:${username}`;
}
