import { z } from "zod";
import { ROLES } from "@/lib/roles";
import { BUTTON_STYLES, FONTS, HEX_COLOUR, RADII } from "@/lib/themes";

/** Path segments that would collide with app routes if used as usernames. */
export const RESERVED_USERNAMES = new Set([
  "login", "signup", "logout", "dashboard", "api", "l", "img", "themes", "admin", "settings",
  "stats", "static", "public", "assets", "uploads", "favicon.ico", "robots.txt", "sitemap.xml", "health",
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

/** A sign-up request: username, email and password. The display name starts as the username and is edited in the dashboard. */
export const signupSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: passwordSchema,
});

/** A reviewer's decision on a sign-up request. */
export const decisionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("approved"), role: z.enum(ROLES) }),
  z.object({ status: z.literal("denied") }),
]);

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
});

const colour = z.string().trim().toLowerCase().regex(HEX_COLOUR, "Use a #rrggbb colour");

/** Theme tokens as stored in the database and posted by the theme studio. Strict: unknown keys are errors. */
export const themeTokensSchema = z.strictObject({
  background: colour,
  backgroundEnd: colour.nullable(),
  text: colour,
  muted: colour,
  button: colour,
  buttonText: colour,
  buttonStyle: z.enum(BUTTON_STYLES),
  radius: z.enum(Object.keys(RADII) as [keyof typeof RADII, ...(keyof typeof RADII)[]]),
  font: z.enum(Object.keys(FONTS) as [keyof typeof FONTS, ...(keyof typeof FONTS)[]]),
  overlay: z.coerce.number().int().min(0).max(90),
});

export const themeSchema = z.object({
  name: z.string().trim().min(1, "Give the theme a name").max(40, "Name must be at most 40 characters"),
  tokens: themeTokensSchema,
});

/** Uploads: the three image kinds and the size limit enforced before any decoding happens. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_KINDS = ["avatar", "thumbnail", "background"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

/** How a link's picture shows on the page, and where its focal point sits (percent of the picture). */
export const IMAGE_LAYOUTS = ["thumbnail", "featured"] as const;
export type ImageLayout = (typeof IMAGE_LAYOUTS)[number];
export type ImageFocus = { x: number; y: number };
const focusCoordinate = z.coerce.number().int().min(0).max(100);
export const imageFocusSchema = z.object({ x: focusCoordinate, y: focusCoordinate });
export const linkImageSchema = z.object({ layout: z.enum(IMAGE_LAYOUTS), focus: imageFocusSchema });

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
