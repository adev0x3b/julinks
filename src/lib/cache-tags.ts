/** Cache tag of a user's public page; every edit to profile, links or theme expires it. */
export function profileTag(username: string): string {
  return `profile:${username}`;
}

/** Cache tag of the public theme gallery; publishing, editing or deleting a public theme expires it. */
export const GALLERY_TAG = "themes:gallery";
