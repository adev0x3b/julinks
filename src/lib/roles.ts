/**
 * Who may do what with sign-up requests. Pure functions: the data layer enforces them
 * and the UI uses them to show only the actions that will succeed.
 *
 *   client     a normal account: edits its own page.
 *   moderator  reviews requests too, but can only make clients and cannot touch moderators or admins.
 *   admin      everything, including giving someone the admin or moderator role.
 */
export const ROLES = ["client", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { client: "Client", moderator: "Moderator", admin: "Admin" };

export function canReview(role: Role): boolean {
  return role === "admin" || role === "moderator";
}

/** The roles an approver may give. */
export function assignableRoles(actor: Role): readonly Role[] {
  if (actor === "admin") return ROLES;
  if (actor === "moderator") return ["client"];
  return [];
}

/** Whether the actor may change the target's status or role (self excluded: nobody locks themselves out). */
export function canManage(actor: Role, target: Role): boolean {
  if (actor === "admin") return true;
  if (actor === "moderator") return target === "client";
  return false;
}
