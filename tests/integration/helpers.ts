import { createUser, type NewUserOptions } from "@/lib/data/users";

let counter = 0;

/** An approved client account by default: the first account on an empty database would otherwise become the admin. */
export async function makeUser(overrides: Partial<{ username: string; email: string }> = {}, options: NewUserOptions = {}) {
  counter += 1;
  return createUser(
    {
      username: overrides.username ?? `user${counter}`,
      email: overrides.email ?? `user${counter}@example.com`,
      password: "correct horse battery staple",
      displayName: `User ${counter}`,
    },
    { status: "approved", role: "client", ...options },
  );
}
