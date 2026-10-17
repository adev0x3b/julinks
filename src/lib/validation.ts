import { z } from "zod";
import { THEME_IDS } from "@/lib/themes";

/** Path segments that would collide with app routes if used as usernames. */
export const RESERVED_USERNAMES = new Set([
  "login", "signup", "logout", "dashboard", "api", "l", "admin", "settings",
  "stats", "static", "public", "assets", "favicon.ico", "robots.txt", "sitemap.xml", "health",
]);

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(USERNAME_PATTERN, "Use letters, numbers, - and _ only, starting and ending with a letter or number")
  .refine((u) => !RESERVED_USERNAMES.has(u), "That username is reserved");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const signupSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: passwordSchema,
  displayName: z.string().trim().min(1, "Display name is required").max(60),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(128),
});

/** Only web URLs: no javascript:, data: or file: schemes on a public page. */
export const linkUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .transform((value) => (/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`))
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
    } catch {
      return false;
    }
  }, "Enter a valid http(s) URL");

export const linkSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80, "Title must be at most 80 characters"),
  url: linkUrlSchema,
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(60),
  bio: z.string().trim().max(200, "Bio must be at most 200 characters"),
  theme: z.enum(THEME_IDS),
});

export const reorderSchema = z.array(z.string().min(1)).min(1).max(200);

/** Flattens a zod error into one message per field, the shape the forms render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
