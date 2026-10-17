import { createUser } from "@/lib/data/users";

let counter = 0;

export async function makeUser(overrides: Partial<{ username: string; email: string }> = {}) {
  counter += 1;
  return createUser({
    username: overrides.username ?? `user${counter}`,
    email: overrides.email ?? `user${counter}@example.com`,
    password: "correct horse battery staple",
    displayName: `User ${counter}`,
  });
}
