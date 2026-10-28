import { z } from "zod";
import { ROLES } from "@/lib/roles";
import { MAX_SOCIALS, SOCIAL_PLATFORM_IDS, SOCIAL_PLATFORMS } from "@/lib/socials";
import { BUTTON_STYLES, FONTS, HEX_COLOUR, RADII } from "@/lib/themes";

// Zod would otherwise probe `new Function("")` once in the browser to pick a faster parser; the
// Content Security Policy (next.config.ts) has no 'unsafe-eval', so skip the probe instead of logging a violation.
z.config({ jitless: true });

/** Path segments that would collide with app routes if used as usernames. */
export const RESERVED_USERNAMES = new Set([
  "login", "signup", "logout", "dashboard", "api", "l", "img", "themes", "admin", "settings",
  "stats", "static", "public", "assets", "uploads", "favicon.ico", "robots.txt", "sitemap.xml", "health", "setup",
]);

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$/;

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

/** Changing the password: the current one proves it is the owner at the keyboard, the new one is typed twice. */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "The passwords do not match", path: ["confirmPassword"] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: "Choose a different password", path: ["newPassword"] });

/** A sign-up request: username, email and password. The display name starts as the username and is edited in the dashboard. */
export const signupSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: passwordSchema,
});

/** First-run setup: the code the migrate step printed, and the admin account to create. */
export const setupSchema = z
  .object({
    code: z.string().trim().min(1, "Enter the setup code").max(64, "That is not a setup code"),
    username: usernameSchema,
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/** A reviewer's decision on a sign-up request. */
export const decisionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("approved"), role: z.enum(ROLES), notify: z.boolean().optional() }),
  /** notify: false is "deny as spam": no mail to an address that is probably made up. */
  z.object({ status: z.literal("denied"), notify: z.boolean().optional() }),
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

export const MAX_BIO_LINES = 6;

/** The bio keeps its line breaks (so emoji can sit on their own row) but not runs of blank lines. */
export const bioSchema = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).join("\n").replace(/\n{2,}/g, "\n").trim())
  .pipe(z.string().max(200, "Bio must be at most 200 characters"))
  .refine((value) => value.split("\n").length <= MAX_BIO_LINES, `Bio must be at most ${MAX_BIO_LINES} lines`);

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(60),
  bio: bioSchema,
});

/** One entry of the icon row: the platform and what the owner typed, turned into the URL the icon opens. */
export const socialEntrySchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORM_IDS),
    value: z.string().trim().min(1, "Enter a handle, address or URL").max(200),
  })
  .transform((entry, ctx) => {
    const url = SOCIAL_PLATFORMS[entry.platform].toUrl(entry.value);
    if (!url) {
      ctx.addIssue({ code: "custom", path: ["value"], message: `That does not look like a ${SOCIAL_PLATFORMS[entry.platform].label} ${entry.platform === "email" ? "address" : "handle or URL"}` });
      return z.NEVER;
    }
    return { ...entry, url };
  });

export const socialsSchema = z.array(socialEntrySchema).max(MAX_SOCIALS, `At most ${MAX_SOCIALS} icons`);
export type SocialEntryInput = z.input<typeof socialEntrySchema>;
export type SocialEntry = z.output<typeof socialEntrySchema>;

export const folderSchema = z.object({
  title: z.string().trim().min(1, "Give the folder a name").max(40, "Folder names are at most 40 characters"),
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
export type ImageKind = "avatar" | "thumbnail" | "background";

/** How a link's picture shows on the page, and where its focal point sits (percent of the picture). */
const IMAGE_LAYOUTS = ["thumbnail", "featured"] as const;
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
